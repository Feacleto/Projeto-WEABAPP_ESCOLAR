import StackedBar from '../charts/StackedBar';
import { ESTADOS_DO_MES, nomeDoMes } from './estadoDaMensalidade';
import { formatCurrency } from '../../compartilhado/formatters';

/**
 * O CARTÃO VERDE: quanto entrou, e de quanto.
 *
 * O número grande continua sendo UM só — o Recebido. O que voltou foi o
 * denominador, pequeno, embaixo dele: "de R$ 3.780 esperados". Ele já foi
 * herói ("Pra receber", grande e verde) e saiu por isso: previsão no dia 3 do
 * mês é quase o faturamento inteiro, e um número grande e verde que não é
 * dinheiro fazia o motorista fechar o mês achando que recebeu menos do que o
 * painel prometeu. Como denominador ele não promete nada — ele dá escala ao
 * número de cima, e é a escala que a barra limão desenha.
 *
 * É o único bloco verde da tela (D7: uma sombra colorida por tela).
 */
export default function ResumoDoMes({ monthKey, recebido, esperado, quantidade, pagas }) {
  const mes = nomeDoMes(monthKey);
  const pct = esperado > 0 ? Math.round((recebido / esperado) * 100) : null;
  const largura = esperado > 0 ? Math.min(100, (recebido / esperado) * 100) : 0;
  const fechado = quantidade > 0 && pagas === quantidade;

  return (
    <section className="rounded-2xl bg-primary p-5 text-white shadow-focus">
      <div className="flex items-baseline justify-between gap-3">
        <p className="rotulo !text-menta">Recebido em {mes}</p>
        {pct != null && (
          <p className="font-mono text-sm font-semibold tabular-nums text-primaryChip">
            {pct}%
          </p>
        )}
      </div>
      <p className="mt-1.5 font-display text-4xl font-extrabold leading-none tracking-tight tabular-nums">
        {formatCurrency(recebido)}
      </p>
      <p className="mt-1.5 font-mono text-sm font-semibold tabular-nums text-primaryChip">
        {quantidade === 0
          ? 'Nenhuma mensalidade neste mês'
          : fechado
            ? `Mês fechado · ${pagas} de ${quantidade} famílias`
            : `de ${formatCurrency(esperado)} esperados`}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-festa ease-freio"
          style={{ width: `${largura}%` }}
        />
      </div>
    </section>
  );
}

/**
 * "COMO ESTÁ <MÊS>": os quatro estados lado a lado, com quantidade e valor.
 *
 * O cartão verde responde "quanto entrou"; este responde "e o resto, onde
 * está?" — quanto é conferência (avisaram que pagaram), quanto é calendário
 * (ainda não venceu) e quanto é cobrança (venceu). São três trabalhos
 * diferentes, e somá-los num "falta" esconderia qual deles é o de hoje.
 */
export function ComoEstaOMes({ monthKey, contagem, soma }) {
  const total = ESTADOS_DO_MES.reduce((n, e) => n + (contagem[e.chave] || 0), 0);
  if (!total) return null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-rest">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-bold text-text">
          Como está {nomeDoMes(monthKey)}
        </h2>
        <p className="rotulo whitespace-nowrap">
          {total} mensalidade{total > 1 ? 's' : ''}
        </p>
      </div>
      <div className="mt-3">
        <StackedBar
          segments={ESTADOS_DO_MES.map((e) => ({
            ...e,
            quantidade: contagem[e.chave] || 0,
            valor: soma[e.chave] || 0,
          }))}
        />
      </div>
    </section>
  );
}
