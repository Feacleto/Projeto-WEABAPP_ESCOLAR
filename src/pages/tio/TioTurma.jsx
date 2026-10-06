import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff, Plus, Send } from 'lucide-react';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import AppSheet from '../../components/common/AppSheet';
import EditarCombinadoSheet from '../../components/contract/EditarCombinadoSheet';
import Avatar from '../../components/common/Avatar';
import { ChildDetailSheet } from '../ChildDetail';
import PeruaDoMes from '../../components/perua/PeruaDoMes';
import { nomeDoMes } from '../../components/payments/estadoDaMensalidade';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useContratos } from '../../hooks/useContratos';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { useAuth } from '../../hooks/useAuth';
import {
  INICIO_DAS_SAIDAS,
  criancasDoMovimento,
  frasesDoMovimento,
  movimentoDaTurma,
} from '../../dominio/identidade/movimentoDaTurma.js';
import {
  dataBR,
  estadoDoContrato,
  vigenciaDaCrianca,
} from '../../dominio/cobranca/contratoDaFamilia.js';
import {
  diasDeCalendario,
  formatCurrency,
  formatDate,
  getCurrentMonthKey,
} from '../../compartilhado/formatters';
import { inviteUrl } from '../../dominio/identidade/inviteUrl.js';
import { linkDoLembreteDoContrato } from '../../marca/lembreteDoContrato.js';

/**
 * TURMA E CONTRATOS — /tio/finance/turma (03/10/2026, protótipo aprovado).
 *
 * A porta do caixa que responde duas perguntas de dinheiro sobre a turma:
 * "quem entrou e quem saiu" (é o que explica a mensalidade a mais ou a menos
 * no mês) e "quanto cada família paga, e se o contrato está assinado".
 *
 * O "Mudar" de cada contrato abre a MESMA folha da ficha da criança
 * ([EditarCombinadoSheet](../../components/contract/EditarCombinadoSheet.jsx)):
 * depois do aceite, mudar é um contrato novo que a família assina. Não há
 * segunda maneira de mudar o combinado, e é isso que a mantém verdadeira.
 *
 * ⚠️ QUEM ESPERA A FAMÍLIA GANHA "LEMBRAR A FAMÍLIA NO WHATSAPP" (04/10/2026,
 * item 18). O selo dizia "Aguardando a família" e o único botão da linha era
 * "Mudar" — o que estava parado era ela, e a tela oferecia mexer no
 * combinado. O lembrete é o verde do cartão; "Mudar" fica de link, e
 * "Cadastrar nova criança" desceu para secundário: nesta tela o trabalho é
 * fechar os contratos da turma que já existe. A frase mora em
 * `marca/lembreteDoContrato.js`, e é uma família por vez — nunca em massa.
 *
 * ⚠️ A MISTURA B + C (04/10/2026, escolhida pelo dono nos artifacts "Turma e
 * contratos em três modelos" e "Turma: a mistura B e C"). Faixa verde no topo
 * — a mesma porta da senha do Financeiro — com o placar (turma, quanto soma
 * por mês, quantos esperando) e o olho; filtros Todos / Esperando /
 * Assinados; quem espera a família é um CARTÃO com os três valores e o
 * lembrete; os assinados são LADRILHOS de dois por linha, que abrem o mesmo
 * cartão numa folha; no fim, o gráfico de entradas e saídas, e o toque no mês
 * mostra quem, com foto, e abre a ficha.
 *
 * ⚠️ SAÍDA SÓ TEM DATA DESDE OUTUBRO DE 2026 (`children.inativadoEm`). Antes
 * disso o gráfico não desenha saída, e o mês aberto diz de quando em diante
 * as saídas são contadas — ver `movimentoDaTurma.js`.
 */

const SITUACAO = {
  aceito: 'Assinado',
  mudanca: 'Contrato novo aguardando a família',
  aguardando: 'Aguardando a família',
  'sem-contrato': 'Contrato ainda não emitido',
};

/** Quem entra no grupo "Esperando a família" (o resto é assinado). */
const ESPERA = new Set(['aguardando', 'mudanca', 'sem-contrato']);
const ENVIADO = new Set(['aguardando', 'mudanca']);

const comMaiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const porNome = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');

/** "dez/2026" a partir de 'AAAA-MM-DD'. */
function mesCurto(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '—';
  return `${nomeDoMes(`${m[1]}-${m[2]}`).slice(0, 3)}/${m[1]}`;
}

function haQuantosDias(data) {
  const d = diasDeCalendario(data);
  if (d == null) return '';
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

export default function TioTurma() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { criancas, loading } = useTurmaInteira();
  const { visiveis, alternar } = useValoresVisiveis();
  const [mudando, setMudando] = useState(null);
  // A FICHA abre por cima — e o contrato está nela ("Ver contrato").
  const [fichaDe, setFichaDe] = useState(null);
  // O ladrilho de um assinado abre o MESMO cartão, numa folha.
  const [cartaoDe, setCartaoDe] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  const mesAtual = getCurrentMonthKey();
  const movimento = useMemo(
    () => movimentoDaTurma({ criancas, mesAtual, meses: 6 }),
    [criancas, mesAtual]
  );
  const [mesAberto, setMesAberto] = useState(mesAtual);
  const ativas = useMemo(() => criancas.filter((c) => c.active === true), [criancas]);
  const esperando = useMemo(
    () => ativas.filter((c) => ESPERA.has(estadoDoContrato(c))).sort(porNome),
    [ativas]
  );
  const assinados = useMemo(
    () => ativas.filter((c) => !ESPERA.has(estadoDoContrato(c))).sort(porNome),
    [ativas]
  );
  const porMes = ativas.reduce((s, c) => s + (Number(c.monthlyFee) || 0), 0);
  const valor = (v) => (visiveis ? formatCurrency(v) : VALOR_ESCONDIDO);

  const lembreteDe = (c) =>
    linkDoLembreteDoContrato({
      telefone: c.parentPhone,
      responsavel: c.parentName,
      crianca: c.name,
      assinatura: profile?.marcaNome || profile?.name || '',
      familiaEntrou: !!c.parentUid,
      linkDoConvite: c.inviteStatus === 'pending' && c.inviteCode && !c.cadastroRapido ? inviteUrl(c.inviteCode) : null,
    });

  const acoes = { valor, lembreteDe, onMudar: setMudando, onFicha: setFichaDe };
  const naFolha = cartaoDe ? ativas.find((c) => c.id === cartaoDe) : null;

  return (
    <div className="min-h-[100dvh] bg-primary">
      <header
        className="px-5 pb-9 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/tio/finance')}
              className="tap -ml-2 inline-flex min-h-12 items-center gap-1 px-2 text-base font-semibold text-menta"
            >
              <ChevronLeft size={22} aria-hidden="true" />
              Voltar
            </button>
            <button
              type="button"
              onClick={alternar}
              aria-pressed={!visiveis}
              className="tap -mr-2 inline-flex min-h-12 items-center gap-2 px-2 text-base font-semibold text-menta"
            >
              {visiveis ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              {visiveis ? 'Esconder valores' : 'Mostrar valores'}
            </button>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight">Turma e contratos</h1>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Placar rotulo="Na turma" valor={loading ? '—' : ativas.length} />
            <Placar rotulo="Por mês" valor={loading ? '—' : valor(porMes)} />
            <Placar rotulo="Esperando" valor={loading ? '—' : esperando.length} />
          </div>
        </div>
      </header>

      <main className="-mt-5 rounded-t-[22px] bg-bg px-4 pb-28 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          {loading ? (
            <Skeleton className="h-64 rounded-3xl" />
          ) : ativas.length === 0 ? (
            <p className="rounded-3xl bg-card p-4 text-base text-textMuted shadow-rest">
              Nenhuma criança na turma ainda. Os contratos aparecem aqui quando você cadastrar.
            </p>
          ) : (
            <>
              <PeruaDoMes criancas={criancas} mes={mesAtual} />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Mostrar">
                {[
                  ['todos', 'Todos'],
                  ['esperando', 'Esperando'],
                  ['assinados', 'Assinados'],
                ].map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filtro === id}
                    onClick={() => setFiltro(id)}
                    className={`tap h-12 rounded-full border-2 px-4 text-base font-bold ${
                      filtro === id
                        ? 'border-primary bg-primarySoft text-primaryDark'
                        : 'border-border bg-card text-textBody'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {filtro !== 'assinados' && (
                <section className="flex flex-col gap-3">
                  <Grupo cor="bg-warningText" titulo={`Esperando a família (${esperando.length})`} />
                  {esperando.length === 0 ? (
                    <p className="rounded-2xl bg-card p-4 text-center text-base text-textMuted shadow-rest">
                      Nenhum contrato esperando. Tudo assinado.
                    </p>
                  ) : (
                    esperando.map((c) => <CartaoDaCrianca key={c.id} child={c} {...acoes} />)
                  )}
                </section>
              )}

              {filtro !== 'esperando' && (
                <section className="flex flex-col gap-3">
                  <Grupo
                    cor="bg-accentText"
                    titulo={`Assinados (${assinados.length})`}
                    dica={assinados.length ? 'toque para abrir' : null}
                  />
                  {assinados.length === 0 ? (
                    <p className="rounded-2xl bg-card p-4 text-center text-base text-textMuted shadow-rest">
                      Nenhum contrato assinado ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {assinados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCartaoDe(c.id)}
                          aria-label={`Abrir ${c.name}`}
                          className="tap flex min-h-16 min-w-0 items-center gap-2 rounded-2xl bg-card p-2.5 text-left shadow-rest"
                        >
                          <Avatar photoURL={c.photoURL} gender={c.gender} seed={c.id} kind="child" size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-base font-bold text-text">{c.name}</span>
                            <span className="block text-sm tabular-nums text-textMuted">
                              {c.monthlyFee ? valor(c.monthlyFee) : 'Sem valor'} · dia {c.dueDay || 10}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <GraficoDoMovimento
                movimento={movimento}
                criancas={criancas}
                mesAberto={mesAberto}
                onMes={setMesAberto}
                onAbrir={setFichaDe}
              />
            </>
          )}

          <Button variant="secondary" icon={Plus} onClick={() => navigate('/tio/children/new')}>
            Cadastrar nova criança
          </Button>
        </div>
      </main>

      <AppSheet open={!!naFolha} onClose={() => setCartaoDe(null)} title={naFolha?.name || ''}>
        {naFolha && (
          <CartaoDaCrianca
            child={naFolha}
            naFolha
            {...acoes}
            onMudar={(c) => {
              setCartaoDe(null);
              setMudando(c);
            }}
            onFicha={(id) => {
              setCartaoDe(null);
              setFichaDe(id);
            }}
          />
        )}
      </AppSheet>

      <ChildDetailSheet open={!!fichaDe} childId={fichaDe} onClose={() => setFichaDe(null)} />

      {mudando && (
        <MudarCombinado
          key={mudando.id}
          child={ativas.find((c) => c.id === mudando.id) || mudando}
          onClose={() => setMudando(null)}
        />
      )}
    </div>
  );
}

function Placar({ rotulo, valor }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/10 px-2.5 py-2 text-sm font-semibold text-menta">
      {rotulo}
      <b className="block truncate font-display text-xl leading-tight tabular-nums text-white">{valor}</b>
    </div>
  );
}

function Grupo({ cor, titulo, dica = null }) {
  return (
    <h2 className="mx-1 flex items-center gap-2 text-lg font-bold text-text">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cor}`} aria-hidden="true" />
      {titulo}
      {dica && <span className="ml-auto text-sm font-semibold text-textMuted">{dica}</span>}
    </h2>
  );
}

/**
 * O CARTÃO DA CRIANÇA — foto, nome, a situação do contrato, os três valores
 * e a ação. Quem espera a família ganha o lembrete (o verde da tela); quem
 * assinou só tem "Mudar" e "Ver a ficha", de contorno. A data do envio vem
 * da versão que espera aceite, e por isso a escuta das versões mora neste
 * cartão: só existe para quem tem versão enviada — o assinado não escuta nada.
 */
function CartaoDaCrianca({ child: c, naFolha = false, valor, lembreteDe, onMudar, onFicha }) {
  const estado = estadoDoContrato(c);
  const espera = ESPERA.has(estado);
  const enviado = ENVIADO.has(estado);
  const { aguardando } = useContratos(enviado ? c : null);
  const vig = vigenciaDaCrianca(c);
  const novoValor = estado === 'mudanca' ? aguardando?.novosValores?.monthlyFee : null;

  let situacao = SITUACAO[estado] || SITUACAO['sem-contrato'];
  if (enviado && aguardando?.emitidoEm) {
    situacao = `${estado === 'mudanca' ? 'Contrato novo enviado' : 'Contrato enviado'} ${haQuantosDias(aguardando.emitidoEm)}`;
  } else if (estado === 'aceito') {
    const em = c.contratoVigente?.aceitoEm || c.contractAcceptedAt;
    situacao = em ? `Assinado em ${formatDate(em)}` : 'Assinado';
  }
  const lembrete = enviado ? lembreteDe(c) : null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-card p-3.5 ${naFolha ? '' : 'shadow-rest'} ${
        espera ? 'border-warningBorder' : 'border-primaryBorder'
      }`}
    >
      <button
        type="button"
        onClick={() => onFicha(c.id)}
        aria-label={`Abrir a ficha de ${c.name}`}
        className="tap flex min-h-12 items-center gap-3 text-left"
      >
        <Avatar photoURL={c.photoURL} gender={c.gender} seed={c.id} kind="child" size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold text-text">{c.name}</span>
          <span className="block text-base text-textMuted">{situacao}</span>
        </span>
      </button>

      <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-1.5 rounded-xl bg-surface px-3 py-2.5">
        <Valor rotulo="Mensalidade" texto={c.monthlyFee ? valor(c.monthlyFee) : '—'} />
        <Valor rotulo="Vence" texto={`dia ${c.dueDay || 10}`} />
        <Valor rotulo="Até" texto={mesCurto(vig.fim)} titulo={dataBR(vig.fim)} />
      </div>

      {novoValor != null && (
        <p className="text-sm font-semibold text-warningText">
          Contrato novo: {valor(novoValor)}. Até a família assinar, vale o de agora.
        </p>
      )}

      {lembrete && (
        <a
          href={lembrete}
          target="_blank"
          rel="noopener noreferrer"
          className="tap flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca shadow-focus"
        >
          <Send size={18} aria-hidden="true" />
          Lembrar a família no WhatsApp
        </a>
      )}

      {espera ? (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => onMudar(c)}
            className="tap h-12 px-1 text-base font-bold text-primary underline"
          >
            Mudar
          </button>
          <button
            type="button"
            onClick={() => onFicha(c.id)}
            className="tap h-12 px-1 text-base font-bold text-primary underline"
          >
            Ver a ficha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMudar(c)}
            className="tap h-12 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
          >
            Mudar
          </button>
          <button
            type="button"
            onClick={() => onFicha(c.id)}
            className="tap h-12 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
          >
            Ver a ficha
          </button>
        </div>
      )}
    </div>
  );
}

function Valor({ rotulo, texto, titulo }) {
  return (
    <div className="min-w-0 text-sm text-textMuted">
      {rotulo}
      <b className="block truncate text-base tabular-nums text-text" title={titulo}>
        {texto}
      </b>
    </div>
  );
}

/**
 * ENTRADAS E SAÍDAS EM GRÁFICO — barra verde para cima quando entrou,
 * vermelha para baixo quando saiu, ponto quando nada mudou. Tocar no mês
 * mostra quem, com foto (o toque abre a ficha). Antes de outubro de 2026 as
 * saídas não têm data, e o gráfico não desenha saída nenhuma ali.
 */
function GraficoDoMovimento({ movimento, criancas, mesAberto, onMes, onAbrir }) {
  const base = 92;
  const passo = 22;
  const teto = 70;
  const dx = 300 / movimento.length;
  const aberto = movimento.find((m) => m.mes === mesAberto) || movimento[movimento.length - 1];
  const quem = criancasDoMovimento({ criancas, mes: aberto.mes });
  const frases = frasesDoMovimento({
    entraram: aberto.entraram.length,
    sairam: aberto.saidasContadas ? aberto.sairam.length : null,
  });
  const [ano] = aberto.mes.split('-');

  return (
    <section className="rounded-3xl bg-card p-4 shadow-rest">
      <h2 className="font-display text-xl font-bold text-text">Entradas e saídas</h2>
      <p className="text-sm text-textMuted">Últimos 6 meses. Toque num mês para ver quem.</p>
      <svg viewBox="0 0 320 180" className="mt-2 block h-auto w-full" role="group" aria-label="Entradas e saídas por mês">
        <line x1="10" y1={base} x2="310" y2={base} stroke="var(--cor-borderStrong)" strokeWidth="1.5" />
        {movimento.map((m, i) => {
          const cx = 10 + dx * i + dx / 2;
          const ent = m.entraram.length;
          const sai = m.saidasContadas ? m.sairam.length : 0;
          const ativo = m.mes === aberto.mes;
          const altE = Math.min(ent * passo, teto);
          const altS = Math.min(sai * passo, teto - 10);
          const escolher = () => onMes(m.mes);
          return (
            <g
              key={m.mes}
              role="button"
              tabIndex={0}
              aria-label={`${nomeDoMes(m.mes)}: ${frasesDoMovimento({ entraram: ent, sairam: m.saidasContadas ? sai : null }).entraram}`}
              aria-pressed={ativo}
              onClick={escolher}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  escolher();
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={cx - dx / 2 + 2}
                y="2"
                width={dx - 4}
                height="174"
                rx="8"
                className={ativo ? 'fill-primarySoft' : 'fill-transparent'}
              />
              {ent > 0 && (
                <>
                  <rect x={cx - 15} y={base - altE} width="30" height={altE} rx="5" className="fill-primary" />
                  <text x={cx} y={base - altE - 7} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-accentText">
                    +{ent}
                  </text>
                </>
              )}
              {sai > 0 && (
                <>
                  <rect x={cx - 15} y={base} width="30" height={altS} rx="5" fill="var(--cor-dangerText)" />
                  <text x={cx} y={base + altS + 16} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--cor-dangerText)">
                    −{sai}
                  </text>
                </>
              )}
              {ent === 0 && sai === 0 && <circle cx={cx} cy={base} r="4" fill="var(--cor-borderStrong)" />}
              <text
                x={cx}
                y="168"
                textAnchor="middle"
                fontSize="14"
                fontWeight={ativo ? 800 : 600}
                className={ativo ? 'fill-primaryDark' : 'fill-textMuted'}
              >
                {nomeDoMes(m.mes).slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-sm text-textBody">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary" aria-hidden="true" />
          Entrou
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-dangerText" aria-hidden="true" />
          Saiu
        </span>
      </div>

      <div className="mt-3 border-t border-neutro pt-3">
        <p className="text-base font-bold text-text">
          {comMaiuscula(nomeDoMes(aberto.mes))} {ano}: <span className="text-accentText">{frases.entraram}</span>
          {frases.sairam && (
            <>
              <span className="text-textMuted"> · </span>
              <span className="text-dangerText">{frases.sairam}</span>
            </>
          )}
        </p>
        <QuemMudou rotulo="Entrou" criancas={quem.entraram} onAbrir={onAbrir} />
        {aberto.saidasContadas ? (
          <QuemMudou rotulo="Saiu" criancas={quem.sairam} onAbrir={onAbrir} />
        ) : (
          <p className="mt-1 text-sm text-textMuted">
            Saídas contadas a partir de {nomeDoMes(INICIO_DAS_SAIDAS)} de {INICIO_DAS_SAIDAS.split('-')[0]}.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * A folha de mudar o combinado precisa das versões do contrato DAQUELA
 * criança — a escuta só existe enquanto a folha está aberta.
 */
function MudarCombinado({ child, onClose }) {
  const { contratos } = useContratos(child);
  return <EditarCombinadoSheet open onClose={onClose} child={child} contratos={contratos} />;
}

/** "Entrou:" e as crianças daquele mês, cada uma com foto e nome tocáveis. */
function QuemMudou({ rotulo, criancas, onAbrir }) {
  if (!criancas.length) return null;
  return (
    <div className="mt-1 space-y-1.5">
      <p className="text-sm font-semibold text-textMuted">{rotulo}:</p>
      {criancas.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAbrir(c.id)}
          className="tap flex min-h-12 w-full items-center gap-3 rounded-xl py-1 text-left"
        >
          <Avatar photoURL={c.photoURL} gender={c.gender} seed={c.id} kind="child" size="md" />
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">
            {c.name || 'Sem nome'}
          </span>
          <span className="shrink-0 text-sm font-bold text-primary">Ver ficha</span>
        </button>
      ))}
    </div>
  );
}
