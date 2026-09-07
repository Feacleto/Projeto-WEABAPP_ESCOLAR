import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import Spinner from '../common/Spinner';
import { carregarConsole, mesAtual } from '../../services/adminMetricsService';
import { watchChamados } from '../../services/supportService';
import { montarFila, resumirFila } from '../../dominio/associacao/fila.js';

/**
 * A FILA DO DIA — a primeira tela do painel.
 *
 * ── ELA NÃO TEM CONTEÚDO PRÓPRIO, E É ISSO QUE ELA É
 * Tudo aqui já está em outra aba: o degrau na carteira, o termômetro na ficha,
 * a espera na caixa de chamados, o fechamento na aba Mês. O que muda é a
 * FORMA: uma lista de coisas a fazer hoje, em vez de quatro telas que a pessoa
 * precisa lembrar de visitar.
 *
 * O painel abria em Motoristas desde 06/09/2026, e o motivo era esse mesmo —
 * relatório não pede ação. A fila é o passo seguinte da mesma ideia: a lista de
 * motoristas responde "com quem eu falo", e ainda exige que o dono varra a
 * carteira para descobrir com quem. A fila já responde.
 *
 * ── CADA LINHA É UM TOQUE E UM DESTINO
 * `destino` vem da régua (`dominio/associacao/fila.js`) e diz para qual aba a
 * linha leva, e com qual motorista aberto. Linha que só informa é relatório
 * outra vez.
 *
 * ── A FICHA JÁ ABRE NO MOTIVO
 * O bloco de risco é a primeira coisa dentro da ficha, acima de plano e
 * contrato. Então "abrir na seção certa" não precisou de âncora nem de rolagem
 * programada: a seção certa é o topo. Âncora dentro de uma tela que cabe numa
 * dobra é precisão falsa.
 *
 * ── VAZIA, ELA DIZ ISSO
 * Uma lista em branco é indistinguível de uma tela que não carregou. E o dia
 * sem pendência é uma informação boa — vale dizê-la.
 */
export default function FilaTab({ onIr }) {
  const [dados, setDados] = useState(null);
  const [chamados, setChamados] = useState(null);

  useEffect(() => {
    carregarConsole()
      .then(setDados)
      .catch((err) => {
        console.error('[admin] fila não carregou:', err);
        setDados(false);
      });
  }, []);

  // Os chamados vêm por assinatura viva porque é o único item da fila que pode
  // chegar enquanto a tela está aberta — os outros dependem do relógio ou de
  // uma ação do próprio dono.
  useEffect(() => watchChamados(setChamados, () => setChamados([])), []);

  const itens = useMemo(() => {
    if (!dados?.parceiros) return null;
    return montarFila({
      parceiros: dados.parceiros,
      faturas: dados.faturas,
      notas: dados.notas,
      chamados: Array.isArray(chamados) ? chamados : [],
      mes: mesAtual(),
      agora: new Date(),
    });
  }, [dados, chamados]);

  const resumo = useMemo(() => resumirFila(itens || []), [itens]);

  if (dados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra montar a fila.
      </p>
    );
  }
  if (itens === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!itens.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <CheckCircle2 size={24} className="mx-auto text-accent" />
        <p className="mt-3 text-sm font-bold text-text">Nada precisa de você hoje.</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-textMuted">
          Ninguém está de saída, nenhum teste acaba esta semana e não há chamado
          esperando. A carteira inteira continua em <strong>Motoristas</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
          Precisa de você hoje
        </h2>
        {/* O NÚMERO CONTA CONVERSAS, não sinais: um motorista com quatro
          * problemas é uma linha. É o que torna este número decidível — ele
          * responde "quanto tempo isto vai levar". */}
        <p className="font-mono text-xs tabular-nums text-textMuted">
          {resumo.total}
          {resumo.alto > 0 && (
            <span className="ml-2 text-dangerText">{resumo.alto} urgente{resumo.alto > 1 ? 's' : ''}</span>
          )}
        </p>
      </header>

      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onIr?.(i.destino)}
              className="tap flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary"
            >
              {/* O ponto repete o que a ORDEM já diz. Quem não distingue âmbar
                * de vermelho — e é gente demais para ignorar — lê de cima para
                * baixo e recebe a mesma prioridade. */}
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  i.nivel === 'alto'
                    ? 'bg-danger'
                    : i.nivel === 'medio'
                      ? 'bg-warning'
                      : 'bg-textMuted'
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-text">{i.titulo}</span>
                {i.detalhe && (
                  <span className="mt-0.5 block truncate text-[11px] text-textMuted">
                    {i.detalhe}
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="shrink-0 text-textMuted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
