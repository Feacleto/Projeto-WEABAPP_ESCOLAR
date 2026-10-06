import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import { LogoMark } from '../common/Logo';
import PixDaPerua from '../route/PixDaPerua';
import { useVoltarFechaFolha } from '../../hooks/useVoltarFechaFolha';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useTurmaDaAuxiliar } from '../../hooks/useAuxiliares';
import { paletaDaMarca } from '../../marca/corDaMarca.js';
import { marcaDaCortina } from '../../marca/travessia.js';
import { CORES_DO_ADESIVO } from '../../config/paletaCategorica';
import { linkDoZap, rotaDaPeruaRodando, trocaDePerua } from '../../dominio/identidade/auxiliar.js';
import { getDateKey } from '../../dominio/rota/horarios';
import {
  DICA_DA_METADE,
  DICA_DA_CHEIA,
  FAIXA_DO_SELO,
  acoesDaFolha,
  aoSoltarAAlca,
  iniciaisDaMarca,
  mensagemDoCartao,
  mostraTrabalhandoPara,
  subtituloDaAuxiliar,
  subtituloDoTio,
} from '../../marca/folhaDaMarca.js';

/**
 * A FOLHA DA MARCA (05/10/2026, protótipo "Abrir o logo do tio", versão A
 * com os dados do B, aprovado pelo dono: "pode aplicar").
 *
 * Tocar no logo do cabeçalho abre esta folha PELA METADE: o cartão de visita
 * (logo, nome, de onde é) e as ações. Puxar a alça para cima (ou tocar nela)
 * abre a TELA CHEIA, que é o SELO: a marca grande na cor dela e a faixa do
 * Alô Buzinou, como no adesivo da perua — para mostrar à mãe no portão. Puxar
 * para baixo volta à metade, e da metade fecha.
 *
 * POR QUE NÃO O `Sheet` DO PROJETO: ele tem um tamanho só e o arrasto dele só
 * fecha. Aqui a mesma alça tem três destinos. O rosto é o mesmo (véu a 45%,
 * cantos de 28px, alça cinza), e o contrato também: Escape e o voltar do
 * celular fecham, tocar fora fecha.
 *
 * ⚠️ É PORTAL: montada no layout, mas desenhada no `body` — a tela anima com
 * `transform`, e `fixed` dentro dela deixaria de ser relativo à janela.
 *
 * ⚠️ A AUXILIAR VÊ DO TIO SÓ O QUE JÁ VÊ HOJE: marca, logo, cor, o WhatsApp
 * dele e o PIX da perua (o mesmo `PixDaPerua` do Hoje). Nada de nível,
 * plano, assinatura, nota das famílias ou dinheiro — o teste procura.
 */
export default function FolhaDaMarca({ papel, marca, onFechar, tio, tioUid, auxiliar }) {
  const [cheia, setCheia] = useState(false);
  const [arrasto, setArrasto] = useState(null); // { inicio, delta } durante o arrasto
  const cor = paletaDaMarca(marca?.cor);
  const nome = String(marca?.nome || '').trim() || 'Sua marca';

  useVoltarFechaFolha(true, onFechar);
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  function aplicar(destino) {
    if (destino === 'fechar') onFechar();
    else setCheia(destino === 'cheia');
  }

  const alcaProps = {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setArrasto({ inicio: e.clientY, delta: 0 });
    },
    onPointerMove: (e) => {
      if (!arrasto) return;
      setArrasto({ inicio: arrasto.inicio, delta: arrasto.inicio - e.clientY });
    },
    onPointerUp: () => {
      if (!arrasto) return;
      const d = arrasto.delta;
      setArrasto(null);
      aplicar(aoSoltarAAlca(d, cheia));
    },
    onPointerCancel: () => setArrasto(null),
    // Teclado (Enter/Espaço chegam como clique sem ponteiro): alterna.
    onClick: (e) => {
      if (e.detail === 0) setCheia((c) => !c);
    },
  };

  // A metade da auxiliar com dois tios é mais alta: o bloco "Trabalhando
  // para" mora nela. Acima de 88% da tela, o conteúdo rola dentro da folha.
  const doisTios = papel === 'auxiliar' && mostraTrabalhandoPara(auxiliar?.ativos);
  const metade = `min(${papel === 'auxiliar' ? (doisTios ? 660 : 470) : 500}px, 88svh)`;
  const base = cheia ? '100svh' : metade;
  const altura = arrasto ? `clamp(160px, calc(${base} + ${arrasto.delta}px), 100svh)` : base;

  // NA TELA CHEIA a folha vira a cor da marca. Com cor, pela `paletaDaMarca`
  // (a letra `naMarca` já lê nela); sem cor, as classes do tema (o verde).
  const fundoCheio = cor ? { backgroundColor: cor.marca, color: cor.naMarca } : undefined;

  return createPortal(
    <div className="fixed inset-0 z-50 mx-auto flex max-w-mobile items-end">
      <div
        className="animate-sheet-fade absolute inset-0 bg-night/45 motion-reduce:animate-none"
        onClick={onFechar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Marca: ${nome}`}
        style={{ height: altura, ...(cheia ? fundoCheio : {}) }}
        className={`relative flex w-full flex-col overflow-hidden shadow-float ${
          cheia ? `rounded-none ${cor ? '' : 'bg-marca text-naMarca'}` : 'rounded-t-[28px] bg-card text-text'
        } ${arrasto ? '' : 'animate-sheet-up motion-safe:transition-[height] motion-safe:duration-300 motion-reduce:animate-none'}`}
      >
        {/* A ALÇA: puxe (ou toque). Só ela arrasta — o resto da folha rola. */}
        <button
          type="button"
          {...alcaProps}
          aria-label={cheia ? 'Voltar à folha pela metade' : 'Abrir a marca em tela cheia'}
          className="flex min-h-12 w-full shrink-0 cursor-grab touch-none flex-col items-center gap-1.5 px-5 pb-1 pt-2.5"
        >
          <span aria-hidden="true" className={`block h-[5px] w-11 rounded-full ${cheia ? 'bg-current opacity-45' : 'bg-borderStrong'}`} />
          <span className={`text-base font-semibold ${cheia ? '' : 'text-textMuted'}`}>
            {cheia ? DICA_DA_CHEIA : DICA_DA_METADE}
          </span>
        </button>

        {cheia ? (
          <SeloDaMarca nome={nome} logoURL={marca?.logoURL} cor={cor} />
        ) : papel === 'auxiliar' ? (
          <MetadeDaAuxiliar nome={nome} marca={marca} cor={cor} {...auxiliar} />
        ) : (
          <MetadeDoTio nome={nome} marca={marca} cor={cor} perfil={tio} uid={tioUid} onFechar={onFechar} />
        )}
      </div>
    </div>,
    document.body
  );
}

/** O logo num círculo; sem logo, as iniciais da marca no círculo da cor dela. */
function CirculoDaMarca({ nome, logoURL, cor, tamanho, branco = false, className = '' }) {
  const ini = iniciaisDaMarca(nome);
  const estilo = { width: tamanho, height: tamanho };
  if (logoURL) {
    return (
      <span style={estilo} className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-[12%] ${branco ? '' : 'ring-2 ring-border'} ${className}`}>
        <img src={logoURL} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }
  // Iniciais: no círculo BRANCO (tela cheia), na cor da marca; no círculo da
  // cor (metade), na letra que lê nela.
  const fundo = branco ? { backgroundColor: '#FFFFFF', color: cor?.primary } : cor ? { backgroundColor: cor.marca, color: cor.naMarca } : {};
  return (
    <span
      aria-hidden="true"
      style={{ ...estilo, ...fundo, fontSize: tamanho * 0.38 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${
        cor ? '' : branco ? 'bg-white text-primary' : 'bg-marca text-naMarca'
      } ${className}`}
    >
      {ini}
    </span>
  );
}

function Identidade({ nome, marca, cor, subtitulo }) {
  return (
    <>
      <CirculoDaMarca nome={nome} logoURL={marca?.logoURL} cor={cor} tamanho={96} />
      <div className="text-center">
        <p className="font-display text-2xl font-extrabold leading-tight text-text">{nome}</p>
        <p className="mt-0.5 text-[17px] leading-snug text-textBody">{subtitulo}</p>
      </div>
    </>
  );
}

// UM BOTÃO CHEIO POR FOLHA: o primeiro da lista (`acoesDaFolha`). O cheio é
// o dos botões principais do app (`bg-marca`/`text-naMarca`); o resto é
// contorno.
const CHEIO = 'tap flex min-h-[52px] w-full items-center justify-center rounded-xl bg-marca px-4 text-[17px] font-bold text-naMarca shadow-focus';
const CONTORNO = 'tap flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-[17px] font-bold text-text';

/** A METADE DO TIO: o cartão de visita e as três ações. */
function MetadeDoTio({ nome, marca, cor, perfil, uid, onFechar }) {
  const navigate = useNavigate();
  const [previa, setPrevia] = useState(false);
  const [cartao, previaAcao, trocar] = acoesDaFolha('tio');
  const mensagem = mensagemDoCartao({ marca: perfil?.marcaNome, uid });

  return (
    <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto px-5 pb-6 pt-1">
      <Identidade nome={nome} marca={marca} cor={cor} subtitulo={subtituloDoTio({ regiao: perfil?.regiao, city: perfil?.city })} />
      <div className="flex w-full flex-col gap-2.5">
        {/* Sem número: o WhatsApp abre para ELE escolher a família. */}
        <a href={linkDoZap('', mensagem)} target="_blank" rel="noreferrer" className={CHEIO}>
          {cartao.rotulo}
        </a>
        <button type="button" onClick={() => setPrevia(true)} className={CONTORNO}>
          {previaAcao.rotulo}
        </button>
        <button
          type="button"
          onClick={() => {
            onFechar();
            navigate('/tio/profile#sua-marca');
          }}
          className={CONTORNO}
        >
          {trocar.rotulo}
        </button>
      </div>

      <AppSheet open={previa} onClose={() => setPrevia(false)} title="Como as famílias veem" icon={Eye}>
        <PreviaDaFamilia nome={nome} logoURL={marca?.logoURL} cor={cor} genero={perfil?.gender} />
      </AppSheet>
    </div>
  );
}

/**
 * "VER COMO AS FAMÍLIAS ME VEEM" — o mínimo honesto: as duas peças da marca
 * dele que a família de fato vê, e nenhuma tela inventada. O topo do app
 * dela (a faixa na cor dele, com o logo na pastilha branca — com logo, só o
 * logo, como no `Header` dela) e o cartão da entrada (a cortina "Entrando",
 * pela mesma `marcaDaCortina`). Sem nome de criança nem dado nenhum da turma.
 */
function PreviaDaFamilia({ nome, logoURL, cor, genero }) {
  const tratamento = genero === 'male' ? 'Falar com tio' : genero === 'female' ? 'Falar com tia' : 'Falar';
  const faixa = cor
    ? { background: `linear-gradient(135deg, ${cor.marca}, ${cor.marcaEscuro})`, color: cor.naMarca }
    : undefined;
  const cortina = marcaDaCortina({ nome, logoURL });
  return (
    <div className="space-y-5 pb-2">
      <div className="space-y-2">
        <p className="text-base font-semibold text-text">O topo do app delas</p>
        <div aria-hidden="true" style={faixa} className={`flex h-16 items-center justify-between gap-3 rounded-2xl px-4 ${cor ? '' : 'border border-border bg-card text-text'}`}>
          {logoURL ? (
            <img src={logoURL} alt="" className="h-11 w-auto max-w-[120px] rounded-lg bg-white object-contain p-[3px]" />
          ) : (
            <span className="truncate font-display text-lg font-bold">{nome}</span>
          )}
          <span className="shrink-0 rounded-lg bg-white px-2.5 py-2 text-base font-semibold text-primary">{tratamento}</span>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-base font-semibold text-text">Quando elas entram no app</p>
        <div aria-hidden="true" className="flex flex-col items-center rounded-2xl bg-surface px-4 py-5">
          <div className="flex w-full flex-col items-center gap-3 rounded-[28px] bg-card px-5 py-6 shadow-rest">
            {cortina.tipo === 'motorista' ? (
              <img src={cortina.logoURL} alt="" className="h-24 w-24 rounded-3xl object-contain" />
            ) : (
              <LogoMark height={88} />
            )}
            {cortina.nome && <p className="text-center font-display text-xl font-extrabold text-text">{cortina.nome}</p>}
          </div>
          <p className="mt-4 font-display text-2xl font-extrabold text-text">Entrando</p>
          {cortina.tipo === 'motorista' && (
            <p className="mt-2 flex items-center gap-2 text-base text-textMuted">
              <LogoMark height={20} />
              Alô Buzinou
            </p>
          )}
        </div>
        {cortina.tipo !== 'motorista' && (
          <p className="text-base text-textBody">Com um logo, é ele que aparece neste cartão.</p>
        )}
      </div>
    </div>
  );
}

/**
 * A METADE DA AUXILIAR: a marca do tio da perua escolhida, desde quando ela
 * trabalha ali, falar com ele e o PIX da perua. Com dois tios, a troca de
 * perua mora AQUI (05/10/2026, decisão do dono — a barra do topo do Hoje
 * saiu): a mesma escolha de `usePeruaDaAuxiliar`, e a mesma trava com
 * criança dentro da perua (`rotaDaPeruaRodando` + `trocaDePerua`).
 */
function MetadeDaAuxiliar({ nome, marca, cor, ativos, motoristaUid, escolher, motorista, vinculoAtual }) {
  const [falar, pix] = acoesDaFolha('auxiliar', { marca: nome });
  // A turma da cópia, só enquanto a folha está aberta: é dela que sai se a
  // rota da perua escolhida está rodando (ela não lê `liveLocation`).
  const { criancas } = useTurmaDaAuxiliar(motoristaUid, getDateKey());
  const rodando = rotaDaPeruaRodando(criancas);
  const troca = trocaDePerua(ativos, motoristaUid, rodando, { marca: nome, genero: motorista?.gender });

  return (
    <div className="flex flex-1 flex-col items-center gap-3.5 overflow-y-auto px-5 pb-6 pt-1">
      <Identidade nome={nome} marca={marca} cor={cor} subtitulo={subtituloDaAuxiliar(vinculoAtual)} />
      <div className="flex w-full flex-col gap-2.5">
        <a href={linkDoZap(motorista?.phone)} target="_blank" rel="noreferrer" className={CHEIO}>
          {falar.rotulo}
        </a>
        <PixDaPerua
          perfil={motorista}
          gatilho={(abrir) => (
            <button type="button" onClick={abrir} className={CONTORNO}>
              {pix.rotulo}
            </button>
          )}
        />
      </div>

      {mostraTrabalhandoPara(ativos) && (
        <div className="flex w-full flex-col gap-2 rounded-2xl bg-surface p-3">
          <p className="text-base font-bold text-text">Trabalhando para</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Escolher a perua">
            {troca.botoes.map((botao) => (
              <BotaoDoTio
                key={botao.motoristaUid}
                botao={botao}
                rotulo={ativos.find((v) => v.motoristaUid === botao.motoristaUid)?.marcaDoMotorista || 'Motorista'}
                onEscolher={() => escolher(botao.motoristaUid)}
              />
            ))}
          </div>
          {troca.aviso && <p className="text-base font-semibold text-text">{troca.aviso}</p>}
          <p className="text-base text-textBody">Com criança na perua, a troca fica travada.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Um botão por tio, com a cor dele (a mesma `paletaDaMarca` do app, que
 * garante a leitura): o escolhido com borda grossa na cor da marca. O do
 * outro tio, com a rota da escolhida rodando, fica DESABILITADO e na tela —
 * sumir faria ela achar que ele a desativou; a frase acima diz por quê.
 */
function BotaoDoTio({ botao, rotulo, onEscolher }) {
  const { admin } = useAdminProfile(botao.motoristaUid);
  const cor = paletaDaMarca(admin?.marcaCor);
  const estilo = botao.escolhida && cor ? { borderColor: cor.marca } : undefined;
  return (
    <button
      type="button"
      aria-pressed={botao.escolhida}
      disabled={botao.travado}
      onClick={onEscolher}
      style={estilo}
      className={`tap flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-card px-2 text-base font-bold text-text disabled:opacity-50 ${
        botao.escolhida ? `border-[3px] ${cor ? '' : 'border-marca'}` : 'border-2 border-border'
      }`}
    >
      {!botao.escolhida && cor && (
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor.marca }} />
      )}
      <span className="truncate">{rotulo}</span>
    </button>
  );
}

/**
 * A TELA CHEIA — O SELO. Sem dado da turma e sem botão: a marca grande na
 * cor dela (a folha inteira já está pintada) e, embaixo, a faixa verde do
 * Alô Buzinou com os textos do adesivo da Platina. A faixa é a cor da
 * gráfica (`CORES_DO_ADESIVO`), não o tema: é a mesma em toda perua.
 */
function SeloDaMarca({ nome, logoURL, cor }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <span className="rounded-full" style={{ boxShadow: '0 0 0 10px rgba(255,255,255,.35)' }}>
          <CirculoDaMarca nome={nome} logoURL={logoURL} cor={cor} tamanho={210} branco />
        </span>
        <p className="text-center font-display text-[40px] font-extrabold leading-tight">{nome}</p>
        <p className="text-center text-lg font-semibold">Transporte escolar</p>
      </div>
      <div
        className="flex shrink-0 flex-col items-center gap-2 px-5 pt-[18px] text-white"
        style={{ backgroundColor: CORES_DO_ADESIVO.faixa, paddingBottom: 'calc(26px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark tone="onDark" height={40} />
          <span className="font-display text-2xl font-extrabold">{FAIXA_DO_SELO.marca}</span>
        </div>
        <p className="text-[17px] font-semibold">{FAIXA_DO_SELO.frase}</p>
        <p className="text-base" style={{ color: CORES_DO_ADESIVO.letraPequena }}>{FAIXA_DO_SELO.site}</p>
      </div>
    </>
  );
}
