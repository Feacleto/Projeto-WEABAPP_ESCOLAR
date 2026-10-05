import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Fuel,
  Landmark,
  Minus,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import FolhaDeDespesa from '../../components/financeiro/FolhaDeDespesa';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useIndicesEconomicos } from '../../hooks/useIndicesEconomicos';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import {
  MOVIMENTO,
  PERGUNTAS_DO_ENTENDA,
  TEXTOS_DA_TELA,
  cartoesDaEconomia,
  custoNaEconomia,
  fraseDoCusto,
  percentualComSinal,
} from '../../dominio/cobranca/economia.js';

/**
 * ECONOMIA DO MÊS — /tio/finance/economia (05/10/2026, versão B aprovada
 * pelo dono). Embaixo de /tio/finance, então atrás da senha pelo caminho
 * (`trancaDoFinanceiro.js`), sem código novo.
 *
 * Quatro números (inflação, juros, dólar, o litro que ELE pagou), o que
 * isso fez no custo dele por criança, e três perguntas dobráveis. Todo texto
 * e toda decisão de "o que mostrar" moram em `dominio/cobranca/economia.js`;
 * aqui só se desenha.
 *
 * ⚠️ INFORMAR, NÃO INDUZIR: a tela mostra quanto o CUSTO subiu ao lado da
 * inflação e para aí — nunca um valor nem um percentual de reajuste da
 * mensalidade. `npm run testar:economia` lê este arquivo também.
 *
 * ⚠️ A SETA É NEUTRA (texto comum, sem âmbar): âmbar é aviso, e o dólar
 * descer não pede nada a ninguém.
 *
 * O botão verde é "Lançar despesa": a conta melhora com o que ele lança, e é
 * o único próximo passo que a tela tem. Abre a mesma folha do caixa.
 */

const reais = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const ICONES = {
  inflacao: FileText,
  juros: Landmark,
  dolar: CircleDollarSign,
  combustivel: Fuel,
};

const COR_DA_BARRA = {
  combustivel: 'bg-perua',
  manutencao: 'bg-primary',
  resto: 'bg-escola',
};

export default function TioEconomia() {
  const config = useConfigDoFinanceiro();
  const { despesas, carregando } = useDespesasDosUltimosMeses(12);
  const { criancas, loading: carregandoTurma } = useTurmaInteira();
  const { indices, carregando: carregandoIndices } = useIndicesEconomicos();
  const { visiveis } = useValoresVisiveis();
  const [despesaAberta, setDespesaAberta] = useState(false);
  const hoje = useMemo(() => new Date(), []);

  const dinheiro = (v) => (visiveis ? reais(v) : VALOR_ESCONDIDO);
  const sinal = (v) => {
    if (!visiveis) return VALOR_ESCONDIDO;
    if (v > 0) return `+${reais(v)}`;
    if (v < 0) return `−${reais(-v)}`;
    return reais(0);
  };

  const pronto = config !== null && !carregando && !carregandoTurma && !carregandoIndices;

  const cartoes = useMemo(
    () => (pronto ? cartoesDaEconomia({ indices, despesas, tipo: config?.combustivelDaPerua || null, hoje }) : []),
    [pronto, indices, despesas, config, hoje],
  );
  const custo = useMemo(
    () =>
      pronto
        ? custoNaEconomia({ despesas, planoDaTroca: config?.planoDaTroca, criancas, ipca: indices.ipca, hoje })
        : null,
    [pronto, despesas, config, criancas, indices, hoje],
  );

  return (
    <div className="pb-28">
      <Header title={TEXTOS_DA_TELA.titulo} showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-6 p-4">
        <p className="-mt-2 text-base text-textBody">{TEXTOS_DA_TELA.subtitulo}</p>

        {!pronto ? (
          <>
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
          </>
        ) : (
          <>
            {/* ── 1. Os quatro números ── */}
            <section className="grid grid-cols-1 gap-3 min-[361px]:grid-cols-2" aria-label="Os números do mês">
              {cartoes.map((c) => (
                <CartaoDoIndice key={c.chave} cartao={c} />
              ))}
            </section>

            {/* ── 2. O que isso faz no custo dele ── */}
            <section className="space-y-3" aria-labelledby="titulo-do-custo">
              <div>
                <h2 id="titulo-do-custo" className="font-display text-xl font-bold text-text">
                  {TEXTOS_DA_TELA.tituloDoCusto}
                </h2>
                <p className="text-base text-textBody">{TEXTOS_DA_TELA.linhaDoCusto}</p>
              </div>

              <div className="flex flex-col gap-4 rounded-3xl bg-card p-4 shadow-rest">
                {custo.estado !== 'pronto' ? (
                  <p className="text-base leading-snug text-textBody">{custo.texto}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Comparacao
                        rotulo="Seu custo por criança"
                        valor={visiveis ? percentualComSinal(custo.variacao) : VALOR_ESCONDIDO}
                        destaque
                      />
                      <Comparacao
                        rotulo="Inflação do Brasil"
                        valor={custo.inflacao === null ? null : percentualComSinal(custo.inflacao)}
                      />
                    </div>
                    <p className="text-lg font-semibold leading-snug text-text">{fraseDoCusto(custo, dinheiro)}</p>

                    <div className="space-y-3" aria-label="De onde veio a diferença por criança">
                      {custo.partes.map((p) => (
                        <div key={p.chave} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-3 text-base">
                            <span className="min-w-0 text-textBody">{p.rotulo}</span>
                            <b className="shrink-0 tabular-nums text-text">{sinal(p.valor)}</b>
                          </div>
                          <div className="h-3.5 overflow-hidden rounded-full bg-sunken">
                            <span
                              className={`block h-full rounded-full ${COR_DA_BARRA[p.chave]}`}
                              style={{ width: `${p.largura}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-neutro pt-2.5 text-base font-bold tabular-nums text-text">
                        <span>Diferença por criança</span>
                        <span>{sinal(custo.total)}</span>
                      </div>
                    </div>
                    <p className="text-sm leading-snug text-textMuted">{TEXTOS_DA_TELA.notaDoCombustivel}</p>
                  </>
                )}

                <div className="flex items-start gap-2.5 rounded-2xl bg-primarySoft p-3 text-base text-textBody">
                  <ShieldCheck size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <span>{TEXTOS_DA_TELA.decisao}</span>
                </div>
                <Link
                  to="/tio/finance/aumentar"
                  className="tap -my-1 flex min-h-12 items-center text-base font-semibold text-primary underline underline-offset-4"
                >
                  Ver Preciso aumentar?
                </Link>
              </div>
            </section>

            {/* ── 3. Entenda ── */}
            <section className="space-y-3" aria-labelledby="titulo-entenda">
              <h2 id="titulo-entenda" className="font-display text-xl font-bold text-text">
                {TEXTOS_DA_TELA.tituloDoEntenda}
              </h2>
              {PERGUNTAS_DO_ENTENDA.map((p) => (
                <Pergunta key={p.chave} pergunta={p.pergunta} resposta={p.resposta} />
              ))}
            </section>

            {/* ── O único botão cheio ── */}
            <div className="space-y-2">
              <Button icon={Plus} onClick={() => setDespesaAberta(true)}>
                {TEXTOS_DA_TELA.botao}
              </Button>
              <p className="text-center text-sm text-textMuted">{TEXTOS_DA_TELA.rodape}</p>
            </div>
          </>
        )}
      </div>

      <FolhaDeDespesa open={despesaAberta} onClose={() => setDespesaAberta(false)} comValores />
    </div>
  );
}

function CartaoDoIndice({ cartao: c }) {
  const Icone = ICONES[c.chave] || FileText;
  const Seta = c.movimento === MOVIMENTO.SUBIU ? ArrowUp : c.movimento === MOVIMENTO.DESCEU ? ArrowDown : Minus;
  return (
    <article className="flex min-w-0 flex-col gap-1.5 rounded-3xl bg-card p-3.5 shadow-rest">
      <div className="flex items-center gap-2 text-base font-bold text-textBody">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
          <Icone size={18} aria-hidden />
        </span>
        <span className="min-w-0 truncate">{c.nome}</span>
      </div>

      {c.numero === null ? (
        <p className="text-base font-semibold leading-snug text-textMuted">
          {c.semDado?.texto}
          {c.semDado?.rota && (
            <>
              {' '}
              <Link to={c.semDado.rota} className="text-primary underline underline-offset-4">
                {c.semDado.rotulo}
              </Link>
            </>
          )}
        </p>
      ) : (
        <b className="font-display text-3xl font-extrabold leading-tight tabular-nums text-text">
          {c.prefixo && <small className="text-base font-bold">{c.prefixo}</small>}
          {c.numero}
          {c.sufixo && <small className="text-base font-bold">{c.sufixo}</small>}
        </b>
      )}

      {c.textoDoMovimento && (
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-textBody">
          <Seta size={16} aria-hidden />
          {c.textoDoMovimento}
        </span>
      )}
      <p className="text-base leading-snug text-textBody">{c.frase}</p>
      <p className="mt-auto border-t border-neutro pt-1.5 text-sm text-textMuted">{c.fonte}</p>
    </article>
  );
}

function Comparacao({ rotulo, valor, destaque = false }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3">
      <span className="text-sm font-semibold text-textMuted">{rotulo}</span>
      {valor === null ? (
        <span className="text-base font-semibold text-textMuted">Sem dado</span>
      ) : (
        <b className={`font-display text-3xl font-extrabold tabular-nums ${destaque ? 'text-primary' : 'text-text'}`}>
          {valor}
        </b>
      )}
    </div>
  );
}

function Pergunta({ pergunta, resposta }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-rest">
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        className="tap flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-base font-bold text-text"
      >
        <span className="min-w-0">{pergunta}</span>
        <ChevronDown
          size={20}
          aria-hidden
          className={`shrink-0 text-textBody transition-transform duration-estado ${aberta ? 'rotate-180' : ''}`}
        />
      </button>
      {aberta && <p className="px-4 pb-4 text-base leading-snug text-textBody">{resposta}</p>}
    </div>
  );
}
