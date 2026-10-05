import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Landmark, TriangleAlert } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useIpca } from '../../hooks/useIpca';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import {
  MESES_PARA_ALTA,
  altaEm12Meses,
  custoMensal,
  custoPorCrianca,
  emDestaque,
  mensalidadeMedia,
  mesesSemCombustivel,
  proximaRenovacao,
} from '../../dominio/cobranca/precisoAumentar.js';
import { despesasNaJanela } from '../../dominio/cobranca/reservaDaPerua.js';
import { mesDaDespesa } from '../../dominio/cobranca/historicoDeDespesas.js';
import { TIPOS_DE_COMBUSTIVEL, rotuloDoTipo } from '../../dominio/cobranca/combustivel.js';

/**
 * PRECISO AUMENTAR? — /tio/finance/aumentar (03/10/2026, maquete aprovada,
 * tela 7). Atrás da senha do Financeiro, pelo caminho.
 *
 * A tela abre pela RESPOSTA, em reais por criança: quanto cada criança custa
 * por mês e quanto ele cobra, lado a lado. Depois, quanto esse custo subiu em
 * 12 meses, dividido em partes com nome. A economia do Brasil (o IPCA) fica
 * recolhida no fim, como contexto — ela não é a conta dele.
 *
 * ⚠️ INFORMAR, NÃO INDUZIR. Nenhum texto daqui sugere valor nem percentual de
 * reajuste. Um número sugerido viraria o número cobrado, e quanto cobrar
 * depende do bairro, da família apertada, de coisas que o app não vê. O
 * rodapé diz isso com todas as letras. Ver o cabeçalho de
 * `dominio/cobranca/precisoAumentar.js`.
 *
 * ⚠️ O NÚMERO SÓ É TÃO BOM QUANTO O QUE ELE LANÇOU, e a tela diz isso quando
 * sabe que falta: o aviso âmbar aparece quando há mês sem abastecimento
 * lançado, porque calado esse buraco faz a perua parecer mais barata do que
 * é. Sem 10 meses de dado, a alta em 12 meses não aparece — aparece quantos
 * meses ele já tem e quantos faltam.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const reais = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const reaisComCentavos = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/** 'janeiro', ou 'janeiro de 2028' quando falta mais de um ano. */
function mesDaRenovacao(data, hoje = new Date()) {
  if (!data) return '';
  const meses = (data.getFullYear() - hoje.getFullYear()) * 12 + (data.getMonth() - hoje.getMonth());
  return meses >= 12 ? `${MESES[data.getMonth()]} de ${data.getFullYear()}` : MESES[data.getMonth()];
}

/** 'AAAA-MM' → 'setembro de 2026'. */
function nomeDoMesComAno(chave) {
  const [a, m] = String(chave).split('-').map(Number);
  return a && m ? `${MESES[m - 1]} de ${a}` : chave;
}

function juntarComE(lista) {
  if (lista.length <= 1) return lista.join('');
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

export default function TioPrecisoAumentar() {
  const config = useConfigDoFinanceiro();
  const { despesas, carregando } = useDespesasDosUltimosMeses(12);
  const { criancas, loading: carregandoTurma } = useTurmaInteira();
  const { ipca, carregando: carregandoIpca } = useIpca();
  const { visiveis } = useValoresVisiveis();
  const [economiaAberta, setEconomiaAberta] = useState(false);

  const dinheiro = (v) => (visiveis ? reais(v) : VALOR_ESCONDIDO);
  const centavos = (v) => (visiveis ? reaisComCentavos(v) : VALOR_ESCONDIDO);
  const sinal = (v) => {
    if (!visiveis) return VALOR_ESCONDIDO;
    if (v > 0) return `+${reais(v)}`;
    if (v < 0) return `−${reais(-v)}`;
    return reais(0);
  };

  const pronto = config !== null && !carregando && !carregandoTurma;
  const hoje = useMemo(() => new Date(), []);

  const ativas = useMemo(() => criancas.filter((c) => c && c.active !== false), [criancas]);
  const conta = useMemo(() => {
    if (!pronto) return null;
    const custo = custoMensal({ despesas, planoDaTroca: config?.planoDaTroca, hoje });
    const mesesLancados = new Set(despesasNaJanela(despesas, hoje).map(mesDaDespesa).filter(Boolean)).size;
    return {
      custo,
      porCrianca: custoPorCrianca({ custo, criancas: ativas }),
      cobra: mensalidadeMedia(ativas),
      alta: altaEm12Meses({ despesas, criancas: ativas, hoje }),
      semCombustivel: mesesSemCombustivel(despesas, hoje),
      renovacao: proximaRenovacao(ativas, hoje),
      mesesLancados,
    };
  }, [pronto, despesas, config, ativas, hoje]);

  const tipo = config?.combustivelDaPerua || null;
  const unidade = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === tipo)?.unidade === 'm³' ? 'm³' : 'litro';
  const rotuloDoCombustivel = tipo ? rotuloDoTipo(tipo) : 'Combustível';

  return (
    <div className="pb-28">
      <Header title="Preciso aumentar?" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        {!conta ? (
          <>
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </>
        ) : (
          <>
            {/* ── A resposta: custa e cobra, lado a lado ── */}
            <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-rest">
              {conta.renovacao && (
                <span
                  className={
                    emDestaque(conta.renovacao, hoje)
                      ? 'self-start rounded-full bg-warningChip px-3 py-1 text-base font-bold text-warningText'
                      : 'text-base font-semibold text-textMuted'
                  }
                >
                  Seus contratos renovam em {mesDaRenovacao(conta.renovacao, hoje)}
                </span>
              )}

              {ativas.length === 0 ? (
                <p className="text-lg leading-snug text-text">
                  Cadastre a turma para ver quanto cada criança custa.
                </p>
              ) : conta.porCrianca === null ? (
                <p className="text-lg leading-snug text-text">
                  Lance as despesas da perua para ver quanto cada criança custa por mês.
                </p>
              ) : (
                <p className="font-display text-2xl font-bold leading-snug text-text">
                  Cada criança te custa <span className="text-primary">{dinheiro(conta.porCrianca)}</span> por mês.
                  {conta.cobra !== null && (
                    <>
                      {' '}Você cobra <span className="text-primary">{dinheiro(conta.cobra)}</span>.
                    </>
                  )}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <Numero rotulo="Custa" valor={conta.porCrianca === null ? null : dinheiro(conta.porCrianca)} />
                <Numero rotulo="Você cobra" valor={conta.cobra === null ? null : dinheiro(conta.cobra)} />
              </div>

              {conta.custo && ativas.length > 0 && (
                <p className="text-sm leading-snug text-textMuted">
                  Entrou na conta: {juntarComE(conta.custo.partes.map((p) => p.rotulo.toLowerCase()))}.
                  {' '}Média de {conta.custo.meses} {conta.custo.meses === 1 ? 'mês' : 'meses'} lançados.
                  {' '}{ativas.length} {ativas.length === 1 ? 'criança' : 'crianças'}.
                  {conta.cobra === null && ' Nenhuma criança tem mensalidade cadastrada.'}
                </p>
              )}
            </section>

            {/* ── A alta em 12 meses ── */}
            <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-rest">
              {conta.alta ? (
                <>
                  <h2 className="font-display text-xl font-bold leading-snug text-text">
                    {tituloDaAlta(conta.alta.total, dinheiro)}
                  </h2>
                  {conta.alta.partes.map((p) => (
                    <div key={p.chave} className="flex items-baseline justify-between gap-3 border-t border-neutro pt-3">
                      <span className="min-w-0 text-base text-textBody">
                        {p.chave === 'combustivel' ? rotuloDoCombustivel : p.rotulo}
                        {p.chave === 'combustivel' && conta.alta.dieselAntes !== null && conta.alta.dieselAgora !== null && (
                          <span className="block text-sm text-textMuted">
                            O {unidade} foi de {centavos(conta.alta.dieselAntes)} para {centavos(conta.alta.dieselAgora)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-lg font-bold tabular-nums text-text">{sinal(p.valor)}</span>
                    </div>
                  ))}
                  <p className="text-sm leading-snug text-textMuted">
                    O combustível conta o preço do {unidade}, não quanto você rodou a mais. Valores por criança, por mês.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold leading-snug text-text">Quanto subiu em 12 meses</h2>
                  <p className="text-base leading-snug text-textBody">
                    {ativas.length === 0
                      ? 'Aparece quando a turma estiver cadastrada.'
                      : textoDaFalta(conta.mesesLancados)}
                  </p>
                </>
              )}
            </section>

            {/* ── Quando falta lançamento, o custo sai menor ── */}
            {conta.semCombustivel.length > 0 && (
              <div className="flex gap-3 rounded-2xl border-2 border-warningBorder bg-warningSoft p-4">
                <TriangleAlert size={22} className="mt-0.5 shrink-0 text-warningText" aria-hidden />
                <p className="text-base leading-snug text-textBody">
                  {conta.semCombustivel.length === 1
                    ? `Em ${nomeDoMesComAno(conta.semCombustivel[0])} não há abastecimento lançado.`
                    : `Em ${conta.semCombustivel.length} meses não há abastecimento lançado: ${juntarComE(conta.semCombustivel.map(nomeDoMesComAno))}.`}
                  {' '}Faltando lançamento, o custo sai menor do que é.
                </p>
              </div>
            )}

            {/* ── A economia do Brasil, recolhida ── */}
            <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
              <button
                type="button"
                onClick={() => setEconomiaAberta((a) => !a)}
                aria-expanded={economiaAberta}
                className="tap flex min-h-16 w-full items-center gap-3.5 px-4 py-4 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                  <Landmark size={22} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-text">A economia do Brasil</span>
                  <span className="block text-sm text-textMuted">Inflação em 12 meses</span>
                </span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-textBody transition-transform duration-estado ${economiaAberta ? 'rotate-180' : ''}`}
                />
              </button>
              {economiaAberta && (
                <div className="border-t border-neutro px-4 py-4">
                  {carregandoIpca ? (
                    <Skeleton className="h-12 rounded-xl" />
                  ) : ipca ? (
                    <>
                      <p className="text-base leading-snug text-textBody">
                        A inflação (IPCA) foi de{' '}
                        <b className="text-text">{formatarPercentual(ipca.ipca12m)}</b> nos 12 meses até{' '}
                        {nomeDoMesComAno(ipca.mes)}.
                      </p>
                      <p className="mt-1 text-sm text-textMuted">Fonte: IBGE.</p>
                    </>
                  ) : (
                    <p className="text-base leading-snug text-textMuted">
                      O índice de inflação ainda não chegou. Tente de novo mais tarde.
                    </p>
                  )}
                  {/* A porta da "Economia do mês" (05/10/2026): juros,
                    * dólar e o litro dele, ao lado da inflação. */}
                  <Link
                    to="/tio/finance/economia"
                    className="tap mt-1 flex min-h-12 items-center text-base font-semibold text-primary underline underline-offset-4"
                  >
                    Ver a economia do mês
                  </Link>
                </div>
              )}
            </section>

            <p className="px-1 text-sm leading-snug text-textMuted">
              O app mostra a conta, e quanto cobrar é decisão sua. Só entra o que você lançou.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function tituloDaAlta(total, dinheiro) {
  if (total > 0) return `Em 12 meses, cada criança passou a custar ${dinheiro(total)} a mais`;
  if (total < 0) return `Em 12 meses, cada criança passou a custar ${dinheiro(-total)} a menos`;
  return 'Em 12 meses, o custo de cada criança ficou igual';
}

function textoDaFalta(meses) {
  const faltam = Math.max(1, MESES_PARA_ALTA - meses);
  const tem = meses === 0
    ? 'Você ainda não tem meses com despesa lançada.'
    : `Você tem ${meses} ${meses === 1 ? 'mês' : 'meses'} com despesa lançada.`;
  return `${tem} Faltam ${faltam} ${faltam === 1 ? 'mês' : 'meses'} para mostrar quanto o custo subiu.`;
}

function formatarPercentual(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

function Numero({ rotulo, valor }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3.5">
      <span className="text-sm text-textMuted">{rotulo}</span>
      {valor === null ? (
        <span className="text-base font-semibold text-textMuted">Sem dado</span>
      ) : (
        <b className="font-display text-3xl font-extrabold tabular-nums text-text">{valor}</b>
      )}
    </div>
  );
}
