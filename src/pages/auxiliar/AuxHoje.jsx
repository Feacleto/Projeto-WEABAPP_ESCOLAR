import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, Phone, MessageCircle, School, Wallet } from 'lucide-react';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import { useMeusVinculos, useTurmaDaAuxiliar } from '../../hooks/useAuxiliares';
import { usePeruaDaAuxiliar } from '../../hooks/usePeruaDaAuxiliar';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { getEffectiveStatus } from '../../services/childrenService';
import { statusNaDirecao, getActionForStatus } from '../../services/routeStatusService';
import { marcarParadaPelaAuxiliar } from '../../services/auxiliarService';
import PixDaPerua from '../../components/route/PixDaPerua';
import ZonasDaRota from '../../components/route/ZonasDaRota';
import FichaRapidaDaAuxiliar from '../../components/route/FichaRapidaDaAuxiliar';
import { diaCompleto, blocoDoMomento, getDateKey, horaCurta, deMinutos, precisaDaPerua, ROTULO_ESTADO } from '../../dominio/rota/horarios';
import { zonasDaRota, viagemAoVivo, rotuloDaVez } from '../../dominio/rota/zonasDaRota.js';
import { pendentesEmOrdem, focoDaViagem } from '../../dominio/rota/focoDaViagem.js';
import { linkDoZap, rotaDaPeruaRodando, trocaDePerua } from '../../dominio/identidade/auxiliar.js';
import { paletaDaMarca } from '../../marca/corDaMarca.js';
import EstrelasParaOTio from '../../components/avaliacaoDaAuxiliar/EstrelasParaOTio';

/**
 * HOJE — a turma do dia da auxiliar (05/10/2026, fase 2).
 *
 * Ela lê a CÓPIA que o servidor mantém (`turmaDaAuxiliar`), nunca `children`:
 * só nome, foto, escola, horário, quem é a família e o status do dia. Nada de
 * mensalidade, contrato ou saúde — e `testar:auxiliar` reprova valor aqui.
 *
 * A ordem é a mesma do motorista (`diaCompleto`): as viagens do dia pela
 * hora, quem faltou riscado no lugar.
 *
 * FASE 3: cada criança tem o próximo passo dela (EMBARQUEI, ENTREGUEI NA
 * ESCOLA, ENTREGUEI), e a marcação vai pelo SERVIDOR
 * (`marcarParadaPelaAuxiliar`) — ela não escreve em `children`. Só para a
 * frente: desfazer um toque errado é do motorista. O "Mostrar PIX da perua"
 * mostra a chave DELE.
 *
 * DOIS TIOS (05/10/2026, vínculo por par): com dois vínculos ativos, o topo
 * ganha a troca de perua — um botão por tio, a escolha lembrada neste
 * aparelho — e a marcação vai com o tio escolhido. Com um tio, a tela é a de
 * sempre. O acesso encerrado só aparece quando NÃO sobra tio ativo: se um
 * desativa e o outro continua, ela só deixa de ver aquela perua.
 *
 * F4.1: a troca TRAVA com a rota da perua escolhida rodando (alguma criança
 * "Na perua" hoje, lida da cópia da turma — ela não lê `liveLocation`; ver
 * `rotaDaPeruaRodando`). O outro botão fica, desabilitado, com a frase. E
 * cada botão e a faixa ganham a cor do tio (`marcaCor` do doc dele, pela
 * mesma `paletaDaMarca` do app, que garante a leitura); sem cor, o verde.
 *
 * F1.5: "Foto da turma", em contorno, logo abaixo da turma — de manhã ela já
 * está aqui. Leva a /aux/foto, onde ela posta para as famílias da perua
 * escolhida no topo. O cheio da tela continua sendo a marcação.
 *
 * A ROTA AO VIVO (05/10/2026, decisão do dono): o foco dela são as CRIANÇAS
 * o dia todo — tocar numa criança abre a FICHA RÁPIDA dela
 * (`FichaRapidaDaAuxiliar`, só o que a cópia leva). Com a viagem ao vivo
 * (`viagemAoVivo`: alguém na perua hoje, ou a viagem do momento começando ou
 * rodando pelo relógio), a mesma tela ganha, no topo, o CARTÃO DA VEZ — o
 * protagonista, com o botão CHEIO na cor da marca do tio — e as zonas "Na
 * perua" e "Na escola" (`ZonasDaRota`), as mesmas que o tio vê.
 *
 * ⚠️ O "FALTOU" DELA NÃO EXISTE AINDA: o servidor só a deixa andar para a
 * frente (`passoValido`), e marcar falta pede decisão do dono, régua e rule.
 * O cartão da vez tem só o passo que ela já pode dar.
 */
const ROTULO_DO_STATUS = {
  home: 'Em casa',
  onboard: 'Na perua',
  atSchool: 'Na escola',
  delivered: 'Entregue em casa',
};

export default function AuxHoje() {
  const navigate = useNavigate();
  const { vinculos, ativos } = useMeusVinculos();
  const { motoristaUid, escolher } = usePeruaDaAuxiliar(ativos);
  const { admin: motorista } = useAdminProfile(motoristaUid);
  const vinculoAtual = ativos.find((v) => v.motoristaUid === motoristaUid);
  const marca = motorista?.marcaNome || motorista?.name || vinculoAtual?.marcaDoMotorista || 'o motorista';
  const hoje = getDateKey();
  const { criancas, faltas } = useTurmaDaAuxiliar(motoristaUid, hoje);

  const blocos = useMemo(
    () => (criancas ? diaCompleto(criancas, { declaracoes: faltas, escolasPorId: {} }) : []),
    [criancas, faltas]
  );
  const [marcando, setMarcando] = useState(null);
  const [aberta, setAberta] = useState(null); // id da criança da ficha rápida
  async function marcar(child, acao) {
    setMarcando(child.id);
    try {
      const r = await marcarParadaPelaAuxiliar(child.id, acao.nextStatus, motoristaUid);
      toast.success(r?.avisou ? 'Marcado. A família foi avisada.' : 'Marcado.');
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      toast.error(err?.message || 'Não deu para marcar. Tente de novo.');
    } finally {
      setMarcando(null);
    }
  }
  const rodando = rotaDaPeruaRodando(criancas);
  const troca = trocaDePerua(ativos, motoristaUid, rodando, { marca, genero: motorista?.gender });
  const cor = paletaDaMarca(motorista?.marcaCor);
  // A VIAGEM DO MOMENTO, com a mesma régua do tio (`blocoDoMomento` +
  // `focoDaViagem`): o cartão da vez dela e o rodapé dele apontam a mesma
  // criança, salvo quando ele tocou noutra.
  const filaDe = (b) => {
    const dir = b.direcao === 'ida' ? 'pickup' : 'dropoff';
    return b.paradas.map((p) => {
      const st = statusNaDirecao(p.child, faltas[p.child.id], dir);
      return { ...p, status: st, action: precisaDaPerua(p.estado) ? getActionForStatus(st, dir) : null };
    });
  };
  const agora = new Date();
  const blocoAgora = blocoDoMomento(blocos, agora, (b) => filaDe(b).some((q) => q.action));
  const filaAgora = blocoAgora ? filaDe(blocoAgora) : [];
  const aoVivo = viagemAoVivo(blocoAgora, agora.getHours() * 60 + agora.getMinutes(), rodando);
  const vez = aoVivo ? focoDaViagem(pendentesEmOrdem(filaAgora)) : null;
  const zonas = aoVivo && blocoAgora ? zonasDaRota(filaAgora, { direcao: blocoAgora.direcao }) : null;
  // A ficha lê o item da viagem de AGORA quando a criança está nela (o lugar
  // muda na hora se o tio marcar com a folha aberta); senão, o da viagem em
  // que ela aparece primeiro no dia.
  const fichaNaViagem = (() => {
    if (!aberta) return null;
    const agoraItem = filaAgora.find((q) => q.child.id === aberta);
    if (agoraItem) return { item: agoraItem, direcao: blocoAgora.direcao };
    for (const b of blocos) {
      const q = filaDe(b).find((x) => x.child.id === aberta);
      if (q) return { item: q, direcao: b.direcao };
    }
    return null;
  })();
  const vaoHoje = new Set(blocos.flatMap((b) => b.paradas.filter((p) => precisaDaPerua(p.estado)).map((p) => p.child.id))).size;

  if (vinculos?.length > 0 && ativos.length === 0) {
    return (
      <>
        <Header title="Hoje" />
        <div className="space-y-4 p-4">
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <h2 className="font-display text-xl font-bold text-text">Seu acesso foi encerrado</h2>
            <p className="mt-2 text-base text-textBody">Você não vê mais a turma nem a rota. Obrigado pelo trabalho.</p>
          </section>
          {/* A nota ao tio: o fim do acesso é quando ela mais tem o que dizer. */}
          {vinculos.map((v) => (
            <EstrelasParaOTio key={v.motoristaUid} motoristaUid={v.motoristaUid} marca={v.marcaDoMotorista} />
          ))}
          {/* Os pagamentos continuam dela depois do acesso encerrado (fase 4). */}
          <button
            type="button"
            onClick={() => navigate('/aux/pagamentos')}
            className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
          >
            <Wallet size={20} aria-hidden="true" />
            Ver os meus pagamentos
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Hoje" />
      <div className="space-y-4 p-4">
        {ativos.length > 1 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Escolher a perua">
              {troca.botoes.map((b) => (
                <BotaoDaPerua key={b.motoristaUid} botao={b} onEscolher={() => escolher(b.motoristaUid)} />
              ))}
            </div>
            {troca.aviso && <p className="px-1 text-base font-semibold text-textBody">{troca.aviso}</p>}
          </div>
        )}
        <section
          className={`rounded-2xl p-5 ${cor ? '' : 'bg-primary text-white'}`}
          style={cor ? { backgroundColor: cor.marca, color: cor.naMarca } : undefined}
        >
          <p className={`rotulo ${cor ? 'opacity-80' : 'text-menta'}`} style={cor ? { color: cor.naMarca } : undefined}>Perua de {marca}</p>
          <p className="mt-1 font-display text-2xl font-extrabold leading-tight">
            {criancas === null ? 'Carregando a turma…' : blocos.length === 0 ? 'Sem viagem hoje' : `${vaoHoje} ${vaoHoje === 1 ? 'criança vai' : 'crianças vão'} hoje`}
          </p>
        </section>

        {criancas === null && <Skeleton className="h-40 rounded-2xl" />}

        {aoVivo && blocoAgora && (
          <CartaoDaVez
            item={vez}
            direcao={blocoAgora.direcao}
            cor={cor}
            marcando={vez ? marcando === vez.child.id : false}
            onMarcar={() => vez && marcar(vez.child, vez.action)}
            onAbrir={() => vez && setAberta(vez.child.id)}
          />
        )}
        {zonas && (
          <ZonasDaRota zonas={zonas} vez={vez?.child?.id || null} onTocar={(q) => setAberta(q.child.id)} />
        )}

        {blocos.map((b) => (
          <section key={`${b.direcao}-${b.inicio}`} className="space-y-2">
            <h2 className="px-1 font-display text-lg font-bold text-text">
              {b.direcao === 'ida' ? 'Ida' : 'Volta'} · sai {horaCurta(deMinutos(b.inicio))}
            </h2>
            {b.paradas.map((p) => {
              const fora = !precisaDaPerua(p.estado);
              const status = ROTULO_DO_STATUS[getEffectiveStatus(p.child)] || 'Em casa';
              const dir = b.direcao === 'ida' ? 'pickup' : 'dropoff';
              const acao = fora ? null : getActionForStatus(statusNaDirecao(p.child, faltas[p.child.id], dir), dir);
              return (
                <div key={p.child.id} className={`rounded-2xl bg-card px-3 py-2.5 shadow-rest ${fora ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-base font-semibold tabular-nums text-textBody">{horaCurta(p.hora)}</span>
                  <button
                    type="button"
                    onClick={() => setAberta(p.child.id)}
                    aria-label={`${p.child.name}: abrir a ficha`}
                    className="tap flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar photoURL={p.child.photoURL} gender={p.child.gender} seed={p.child.id} kind="child" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-base font-bold ${fora ? 'text-textMuted line-through' : 'text-text'}`}>{p.child.name}</span>
                      <span className={`block text-sm ${fora ? 'font-semibold text-warningText' : 'text-textMuted'}`}>
                        {fora ? ROTULO_ESTADO[p.estado] || 'Fora hoje' : status}
                      </span>
                    </span>
                  </button>
                  {!fora && p.child.parentPhone && (
                    <span className="flex shrink-0 gap-1.5">
                      <a href={`tel:${p.child.parentPhone}`} aria-label={`Ligar para a família de ${p.child.name}`} className="tap flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary">
                        <Phone size={20} aria-hidden="true" />
                      </a>
                      <a href={linkDoZap(p.child.parentPhone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp da família de ${p.child.name}`} className="tap flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary">
                        <MessageCircle size={20} aria-hidden="true" />
                      </a>
                    </span>
                  )}
                </div>
                {acao && (
                  <button
                    type="button"
                    disabled={marcando === p.child.id}
                    onClick={() => marcar(p.child, acao)}
                    className="tap mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary bg-card text-base font-extrabold text-primary disabled:opacity-60"
                  >
                    {marcando === p.child.id ? 'Marcando…' : acao.shortLabel}
                  </button>
                )}
                </div>
              );
            })}
            {b.escolas?.length > 0 && (
              <p className="flex min-h-12 items-center gap-2 rounded-xl bg-escolaSoft px-3 text-base font-semibold text-escola">
                <School size={18} aria-hidden="true" />
                {b.escolas.map((e) => e.nome).join(' · ')}
              </p>
            )}
          </section>
        ))}

        <button
          type="button"
          onClick={() => navigate('/aux/foto')}
          className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
        >
          <Camera size={20} aria-hidden="true" />
          Foto da turma
        </button>

        <PixDaPerua perfil={motorista} />
        {fichaNaViagem && (
          <FichaRapidaDaAuxiliar
            item={fichaNaViagem.item}
            direcao={fichaNaViagem.direcao}
            onClose={() => setAberta(null)}
          />
        )}
        <p className="px-1 text-sm text-textMuted">
          O que você marca, {marca} vê na hora. Para desfazer um toque errado, fale com ele.
        </p>
      </div>
    </>
  );
}

/**
 * Um botão da troca de perua, na cor DAQUELE tio. O doc dele vem pela mesma
 * escuta de `useAdminProfile` que a tela já usa (ela lê o doc do tio só com
 * o vínculo ativo); um componente por botão porque o número de tios varia e
 * hook não mora em laço. Escolhido: contorno e fundo claro na cor dele.
 * Travado: desabilitado, mas na tela — a frase embaixo diz por quê.
 */
function BotaoDaPerua({ botao, onEscolher }) {
  const { admin } = useAdminProfile(botao.motoristaUid);
  const cor = paletaDaMarca(admin?.marcaCor);
  const estilo = botao.escolhida && cor
    ? { borderColor: cor.primary, backgroundColor: cor.primarySoft, color: cor.primary }
    : undefined;
  return (
    <button
      type="button"
      aria-pressed={botao.escolhida}
      disabled={botao.travado}
      onClick={onEscolher}
      style={estilo}
      className={`tap flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-2 text-base font-bold disabled:opacity-50 ${
        botao.escolhida ? (cor ? '' : 'border-primary bg-primarySoft text-primary') : 'border-border bg-card text-text'
      }`}
    >
      {!botao.escolhida && cor && (
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor.marca }} />
      )}
      {botao.rotulo}
    </button>
  );
}

/**
 * O CARTÃO DA VEZ — o protagonista da tela dela com a viagem ao vivo
 * (05/10/2026). A criança da vez (a mesma régua do foco do tio) e UM botão
 * CHEIO na cor da marca do tio, com o passo que ela pode dar. Tocar no rosto
 * abre a ficha rápida. Sem ninguém a marcar, diz que a viagem acabou e que
 * quem encerra a rota é ele.
 */
function CartaoDaVez({ item, direcao, cor, marcando, onMarcar, onAbrir }) {
  if (!item) {
    return (
      <section className="rounded-2xl bg-card p-4 shadow-rest">
        <p className="font-display text-xl font-bold text-text">{direcao === 'ida' ? 'Todos na escola.' : 'Todos entregues.'}</p>
        <p className="mt-1 text-base text-textBody">A viagem acabou. Quem encerra a rota é o motorista.</p>
      </section>
    );
  }
  const rotulo = rotuloDaVez(item.action?.nextStatus) || item.action?.shortLabel;
  const detalhe = [item.child.turma, item.child.school].filter(Boolean).join(' · ');
  return (
    <section className="rounded-2xl border-2 border-perua bg-card p-4 shadow-rest">
      <p className="text-base font-semibold text-textMuted">Agora{item.hora ? ` · ${horaCurta(item.hora)}` : ''}</p>
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${item.child.name}: abrir a ficha`}
        className="tap mt-1 flex min-h-12 w-full items-center gap-3 text-left"
      >
        <Avatar photoURL={item.child.photoURL} gender={item.child.gender} seed={item.child.id} kind="child" size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-2xl font-bold leading-tight text-text">{String(item.child.name || '').split(' ')[0]}</span>
          {detalhe && <span className="block truncate text-base text-textBody">{detalhe}</span>}
        </span>
      </button>
      <button
        type="button"
        disabled={marcando}
        onClick={onMarcar}
        style={cor ? { backgroundColor: cor.marca, color: cor.naMarca } : undefined}
        className={`tap mt-3 flex h-14 w-full items-center justify-center rounded-xl text-lg font-extrabold shadow-focus disabled:opacity-60 ${cor ? '' : 'bg-marca text-naMarca'}`}
      >
        {marcando ? 'Marcando…' : rotulo}
      </button>
    </section>
  );
}
