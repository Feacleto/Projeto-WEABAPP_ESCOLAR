import { useEffect, useRef, useState } from 'react';
import { FileText, NotebookPen, CircleSlash } from 'lucide-react';
import Avatar from '../common/Avatar';
import CampoDeValor from '../common/CampoDeValor';
import NovaEscolaSheet from './NovaEscolaSheet';
import PassarParaOutroTio from '../transferencia/PassarParaOutroTio';
import { ConviteEnxuto } from './InviteShare';
import CampoDaRua from './CampoDaRua';
import { CampoQueSalva, EscolhaQueSalva, RotuloDoCampo } from './CamposDaLinha';
import { useSalvarNaLista } from '../../hooks/useSalvarNaLista';
import { useValorDoCampo } from '../../hooks/useValorDoCampo';
import { useAuth } from '../../hooks/useAuth';
import { camposDaEscola, salvarMensalidadeNaLista } from '../../services/listaDaTurmaService';
import { atualizarContratoEsperando } from '../../services/contratosDaFamiliaService';
import {
  fraseDeEstado,
  resumoDaLinha,
  NOME_DA_FALTA,
  FALTA,
  mensalidadeTravada,
  valorParaConferir,
} from '../../dominio/escola/listaDaTurma.js';
import { valorDoCampoFalta } from '../../dominio/cobranca/valorDaMensalidade.js';
import { formatCurrency } from '../../compartilhado/formatters';
import { ROTULOS, confiraOValor } from '../../marca/textosDaLista.js';

/**
 * UMA CRIANÇA DA LISTA DA TURMA (RC2) — fechada no padrão do WhatsApp, aberta
 * NO LUGAR, como acordeão. Abrir nunca troca de tela: o que ele sabe de
 * cabeça se preenche aqui, e cada campo grava sozinho ao sair dele.
 *
 * FECHADA: o rosto, o nome, escola · hora · rua, uma frase do que falta — só
 * "falta hora de pegar" em âmbar, porque é ela que decide a rota; o resto é
 * neutro (falta de dado não é alarme) — e o convite à direita.
 *
 * ABERTA: os campos na ordem em que ele os sabe — nome, menino ou menina,
 * escola, hora de pegar, nome da mãe, rua e número, WhatsApp da mãe (se
 * souber) e mensalidade (obrigatória desde 14/11/2026: apagar não grava zero). Sem botão "Salvar" e sem "tem certeza?".
 *
 * ⚠️ DUAS COISAS NÃO SE MEXEM DAQUI, E A FICHA CONTINUA SENDO O CAMINHO:
 *  - o RESPONSÁVEL de quem já entrou no app (a ficha também só deixa editar
 *    antes de a família entrar — depois, o número é dela);
 *  - a MENSALIDADE com contrato ASSINADO (`mensalidadeTravada`): mudar ali é
 *    reajuste, que vira aditivo assinado pela família. Um campo que grava ao
 *    sair seria o reajuste de um toque que o dono recusou. Com a versão só
 *    ESPERANDO aceite, o campo grava e a versão é reemitida no mesmo lote
 *    (`salvarMensalidadeNaLista`).
 *
 * ⚠️ O ESTADO DE "SALVO" NÃO É DA LINHA: é do salvador da tela (`salvador`,
 * de `TioChildren`), por criança e por campo — fechar a linha ou ela pular de
 * grupo não apaga "Não salvou", nem o que ele digitou.
 */
export default function LinhaDaTurma({
  child,
  escolas,
  aberta,
  onAlternar,
  tocou,
  agora,
  salvador,
  onEnviado,
  onLinkNovo,
  onPedirValor,
  onAbrirFicha,
  onRecado,
  onTirar,
}) {
  const frase = fraseDeEstado(child);
  // A escola já está no cabeçalho do grupo: a linha diz hora · rua.
  const sub = resumoDaLinha({ ...child, school: '' });
  const segunda = frase.texto || sub;
  const esperando = salvador.esperandoSinal(`${child.id}:`) > 0;
  return (
    <li id={`linha-${child.id}`} className={aberta ? 'bg-surface' : ''}>
      <div className="flex items-center gap-2 pl-2 pr-2">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberta}
          className="tap flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        >
          <Avatar photoURL={child.photoURL} gender={child.gender} seed={child.id} kind="child" size="sm" />
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block truncate text-base font-bold text-text">{child.name}</span>
            {(frase.faltaHora || segunda || esperando) && (
              <span className="block truncate text-sm text-textBody">
                {frase.faltaHora && (
                  <span className="font-semibold text-warningText">
                    <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-warning align-middle" />
                    falta {NOME_DA_FALTA[FALTA.HORA]}
                  </span>
                )}
                {frase.faltaHora && segunda ? ' · ' : ''}
                {segunda}
                {esperando && <span className="font-semibold"> · {ROTULOS.esperandoSinal}</span>}
              </span>
            )}
          </span>
        </button>
        <ConviteEnxuto
          crianca={child}
          tocou={tocou}
          agora={agora}
          onEnviado={onEnviado}
          onLinkNovo={onLinkNovo}
          onPedirValor={onPedirValor}
        />
      </div>
      {aberta && (
        <CorpoDaLinha
          child={child}
          escolas={escolas}
          salvador={salvador}
          onAbrirFicha={onAbrirFicha}
          onRecado={onRecado}
          onTirar={onTirar}
        />
      )}
    </li>
  );
}

function CorpoDaLinha({ child, escolas, salvador, onAbrirFicha, onRecado, onTirar }) {
  const { profile } = useAuth();
  const { estado, salvar, tentarDeNovo, atual, mexeu } = useSalvarNaLista(child, salvador);
  const [novaEscola, setNovaEscola] = useState(false);
  const comFamilia = !!child.parentUid;
  const travada = mensalidadeTravada(child);
  const campo = (nome) => ({ estado: estado(nome), onTentar: () => tentarDeNovo(nome) });

  // ⚠️ A VERSÃO DO CONTRATO ESPERANDO ACEITE ACOMPANHA A FICHA AO FECHAR
  // (achado M2). Cada campo salvo reemitia uma versão; agora é UMA conferência
  // por abertura da linha, e só se algo foi gravado. A primeira emissão é do
  // toque de "Convidar".
  const admin = useRef(profile);
  useEffect(() => {
    admin.current = profile;
  });
  useEffect(
    () => () => {
      if (!mexeu.current) return;
      const c = { ...atual.current, ...mexeu.current };
      atualizarContratoEsperando({ child: c, admin: admin.current }).catch((err) =>
        console.error('[lista da turma] contrato não conferido:', err?.code || 'erro')
      );
    },
    [atual, mexeu]
  );

  return (
    <div className="space-y-4 px-3 pb-4 pt-1">
      <CampoQueSalva
        rotulo={ROTULOS.nome}
        valorSalvo={child.name}
        onSalvar={(v, digitado) => salvar('nome', { name: v }, { digitado })}
        {...campo('nome')}
      />

      <EscolhaQueSalva
        rotulo={ROTULOS.meninoOuMenina}
        opcoes={[
          { value: 'male', label: ROTULOS.menino },
          { value: 'female', label: ROTULOS.menina },
        ]}
        valor={child.gender}
        onSalvar={(v) => salvar('genero', { gender: v })}
        {...campo('genero')}
      />

      <div>
        <RotuloDoCampo rotulo={ROTULOS.escola} {...campo('escola')} />
        <div className="flex flex-wrap gap-2">
          {escolas.map((e) => {
            const marcada = child.schoolId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={marcada}
                onClick={() => !marcada && salvar('escola', camposDaEscola(e))}
                className={`tap min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                  marcada ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
                }`}
              >
                {e.nome}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNovaEscola(true)}
            className="tap min-h-12 rounded-full border-2 border-dashed border-borderStrong bg-card px-4 text-base font-semibold text-primary"
          >
            {ROTULOS.novaEscola}
          </button>
        </div>
        {!child.schoolId && child.school && (
          <p className="mt-1 text-sm text-textMuted">{child.school}</p>
        )}
      </div>

      <CampoQueSalva
        rotulo={ROTULOS.horaDePegar}
        tipo="hora"
        valorSalvo={child.horaPega || ''}
        onSalvar={(v, digitado) => salvar('hora', { horaPega: v }, { digitado })}
        {...campo('hora')}
      />

      {comFamilia ? (
        <p className="text-base text-textBody">{child.parentName || ''}</p>
      ) : (
        <CampoQueSalva
          rotulo={ROTULOS.nomeDaMae}
          tipo="textoOpcional"
          valorSalvo={child.parentName || ''}
          onSalvar={(v, digitado) => salvar('mae', { parentName: v }, { digitado })}
          {...campo('mae')}
        />
      )}

      <CampoDaRua crianca={child} salvar={salvar} {...campo('rua')} />

      {!comFamilia && (
        <CampoQueSalva
          rotulo={ROTULOS.whatsappDaMae}
          extra={ROTULOS.seSouber}
          tipo="telefone"
          valorSalvo={child.parentPhone || ''}
          onSalvar={(v, digitado) => salvar('fone', { parentPhone: v }, { digitado })}
          {...campo('fone')}
        />
      )}

      {travada ? (
        <div>
          <RotuloDoCampo rotulo={ROTULOS.mensalidade} />
          <p className="text-base text-textBody">
            {Number(child.monthlyFee) > 0 ? formatCurrency(child.monthlyFee) : '—'} · <button type="button" onClick={onAbrirFicha} className="tap min-h-11 font-semibold text-primary underline">{ROTULOS.abrirFicha}</button>
          </p>
        </div>
      ) : (
        <CampoDaMensalidade
          child={child}
          onSalvar={(n, digitado) =>
            salvar('mensalidade', { monthlyFee: n }, { digitado, executar: (c) => salvarMensalidadeNaLista(c, n, admin.current) })
          }
          {...campo('mensalidade')}
        />
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <AcaoDaLinha icone={FileText} onClick={onAbrirFicha}>{ROTULOS.abrirFicha}</AcaoDaLinha>
        <AcaoDaLinha icone={NotebookPen} onClick={onRecado}>{ROTULOS.mandarRecado}</AcaoDaLinha>
        <AcaoDaLinha icone={CircleSlash} perigo onClick={onTirar}>{ROTULOS.tirarDaTurma}</AcaoDaLinha>
      </div>
      {/* Só aparece quando a passagem é possível — a peça decide. */}
      <PassarParaOutroTio child={child} />

      <NovaEscolaSheet
        open={novaEscola}
        onClose={() => setNovaEscola(false)}
        onCriada={(e) => {
          setNovaEscola(false);
          salvar('escola', camposDaEscola({ ...e, telefone: e.telefone || '' }));
        }}
      />
    </div>
  );
}

/**
 * A mensalidade grava ao sair do campo; o extenso embaixo é a conferência.
 * OBRIGATÓRIA (decisão do dono): apagar o valor não grava zero — a linha diz
 * "Diga o valor da mensalidade." e o valor salvo continua.
 *
 * ⚠️ VALOR MUITO BAIXO GANHA UM "CONFIRA", SEM BLOQUEAR (achado M1). O campo
 * é de caixa eletrônico: "350" digitado vira R$ 3,50. Abaixo de
 * `VALOR_PARA_CONFERIR` a linha repete o valor com "? Confira." — e grava,
 * porque um valor baixo pode ser verdade (irmão, combinado de família).
 */
function CampoDaMensalidade({ child, onSalvar, estado, onTentar }) {
  const doBanco = Number(child.monthlyFee) > 0 ? Number(child.monthlyFee).toFixed(2) : '';
  const { valor, setValor, setEditando } = useValorDoCampo(doBanco, estado);
  const [erro, setErro] = useState('');
  const sair = () => {
    setEditando(false);
    if (valorDoCampoFalta(valor)) {
      setErro(ROTULOS.erroSemValor);
      return;
    }
    setErro('');
    if (valor === doBanco) return;
    onSalvar(Number(valor), valor);
  };
  return (
    <div onFocus={() => setEditando(true)} onBlur={sair}>
      <RotuloDoCampo rotulo={ROTULOS.mensalidade} estado={estado} onTentar={onTentar} />
      <CampoDeValor value={valor} onChange={(v) => { setErro(''); setValor(v); }} error={erro} />
      {!erro && valorParaConferir(valor) && (
        <p role="status" className="mt-1 text-base font-bold text-text">
          {confiraOValor(formatCurrency(Number(valor)))}
        </p>
      )}
    </div>
  );
}

function AcaoDaLinha({ icone: Icone, perigo = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-base font-semibold ${
        perigo ? 'border-dangerBorder bg-card text-dangerText' : 'border-border bg-card text-text'
      }`}
    >
      <Icone size={18} aria-hidden="true" />
      {children}
    </button>
  );
}
