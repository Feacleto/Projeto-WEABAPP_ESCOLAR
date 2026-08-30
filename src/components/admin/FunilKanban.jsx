import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, TrendingUp, UserPlus, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import {
  ETAPAS,
  ETAPA_PERDIDO,
  watchFunil,
  moverEtapa,
  registrarPerda,
  metricasDoFunil,
} from '../../services/funilService';
import { formatBRL } from '../../services/contractService';

/**
 * O FUNIL COMERCIAL, EM COLUNAS.
 *
 * Colunas de verdade a partir de `lg` — este painel é de mesa. Abaixo disso
 * elas empilham em seções, porque cinco colunas num celular dariam 60px cada.
 *
 * Sem arrastar, nas duas larguras. No celular o arrasto entre colunas erra
 * mais do que acerta; no monitor ele funcionaria, mas manter dois modos de
 * mover cartão custa mais do que rende — e o botão continua sendo o caminho
 * que funciona no teclado e no leitor de tela. Cada cartão tem o de avançar e
 * o de perder.
 *
 * PERDIDO NÃO É A ÚLTIMA COLUNA. Ele é saída lateral, e fica numa lista
 * separada embaixo: tratá-lo como fim do caminho faria o funil parecer que
 * todo mundo termina lá.
 */
export default function FunilKanban({ onOrcar }) {
  const [leads, setLeads] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  useEffect(() => watchFunil(setLeads, () => setLeads([])), []);

  const m = useMemo(() => metricasDoFunil(leads || []), [leads]);
  const perdidos = (leads || []).filter((l) => l.etapa === ETAPA_PERDIDO);

  const avancar = async (lead) => {
    const i = ETAPAS.findIndex((e) => e.id === lead.etapa);
    const proxima = ETAPAS[i + 1];
    if (!proxima) return;
    setOcupado(lead.id);
    try {
      await moverEtapa(lead.id, proxima.id, lead);
    } catch (err) {
      // A recusa de fechar sem proposta vem do serviço, com a frase pronta.
      toast.error(err.message, { duration: 7000 });
    } finally {
      setOcupado(null);
    }
  };

  const perder = async (lead) => {
    const motivo = window.prompt(
      `Por que ${lead.nome} não fechou?\n\nSem isso o funil só conta; com isso, ele ensina.`,
      ''
    );
    if (motivo === null) return;
    setOcupado(lead.id);
    try {
      await registrarPerda(lead.id, motivo);
    } catch {
      toast.error('Não deu pra registrar.');
    } finally {
      setOcupado(null);
    }
  };

  if (leads === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Nenhum motorista no funil"
        description="Quem se inscrever pela página pública entra aqui automaticamente."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica rotulo="No funil" valor={m.ativos} nota="em negociação" />
        <Metrica
          rotulo="Com orçamento"
          valor={m.comProposta}
          nota="proposta na mesa"
        />
        <Metrica
          rotulo="Ticket médio"
          valor={formatBRL(m.ticketMedioProposto)}
          nota="por parceiro/mês"
        />
        <Metrica
          rotulo="Conversão"
          valor={`${Math.round(m.conversao)}%`}
          nota="inscrito → fechado"
        />
      </div>

      {m.pipeline > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
          <TrendingUp size={16} className="mt-0.5 shrink-0 text-indigo-700" />
          <p className="text-[12.5px] leading-relaxed text-indigo-900">
            <strong>{formatBRL(m.pipeline)}/mês</strong> é o que entraria se
            tudo que está na mesa fechasse.{' '}
            <span className="text-indigo-700">
              Isso é expectativa — nunca some com receita real.
            </span>
          </p>
        </div>
      )}

      {/* AS COLUNAS SÓ EXISTEM DE FATO A PARTIR DE `lg`.
        *
        * Cinco etapas lado a lado num celular dariam 60px de largura cada —
        * cartão nenhum cabe. Empilhado, o funil vira uma lista com títulos, que
        * é a leitura certa pra tela estreita. Na tela larga, que é onde este
        * painel mora, ele volta a ser o que o nome promete: dá pra ver de
        * relance onde o negócio empaca.  */}
      <div className="space-y-3 lg:grid lg:grid-cols-5 lg:items-start lg:gap-3 lg:space-y-0">
        {ETAPAS.map((etapa) => {
          const daEtapa = leads.filter((l) => l.etapa === etapa.id);
          // Etapa vazia SOME no celular e FICA na web.
          //
          // Empilhado, um título com nada embaixo é só linha desperdiçada. Em
          // colunas é o contrário: a coluna vazia é a informação — some ela e
          // "Negociando" com zero vira indistinguível de uma etapa que não
          // existe, e o buraco do funil deixa de aparecer.
          return (
            <section
              key={etapa.id}
              className={daEtapa.length ? undefined : 'hidden lg:block'}
            >
              <p className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-textMuted">
                {etapa.rotulo}
                <span className="font-bold text-text">{daEtapa.length}</span>
              </p>
              <div className="space-y-2">
                {daEtapa.map((l) => (
                  <Cartao
                    key={l.id}
                    lead={l}
                    ultima={etapa.id === 'fechado'}
                    ocupado={ocupado === l.id}
                    onAvancar={() => avancar(l)}
                    onPerder={() => perder(l)}
                    onOrcar={() => onOrcar?.(l)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {perdidos.length > 0 && (
        <section>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-textMuted">
            Perdidos · {perdidos.length}
          </p>
          <div className="space-y-1.5">
            {perdidos.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-gray-200 bg-surface px-3 py-2"
              >
                <p className="text-[13px] font-semibold text-textMuted">
                  {l.nome}
                </p>
                {l.motivoPerda && (
                  <p className="text-[11.5px] text-textMuted">{l.motivoPerda}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-textMuted">
            Os motivos aqui são o que diz se o problema é preço, produto ou
            momento — e é a única parte do funil que ensina a vender melhor.
          </p>
        </section>
      )}
    </div>
  );
}

function Cartao({ lead, ultima, ocupado, onAvancar, onPerder, onOrcar }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-text">{lead.nome}</p>
          <p className="text-[11.5px] text-textMuted">
            {[lead.cidade, lead.criancasEstimadas && `${lead.criancasEstimadas} crianças`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {lead.propostaMensal > 0 && (
            <p className="mt-1 font-mono text-[11px] font-semibold text-primary">
              {formatBRL(lead.propostaMensal)}/mês proposto
            </p>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onOrcar}
          className="tap rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11.5px] font-semibold text-textMuted"
        >
          {lead.propostaMensal ? 'Rever orçamento' : 'Orçar'}
        </button>
        {!ultima && (
          <button
            type="button"
            onClick={onAvancar}
            disabled={ocupado}
            className="tap inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-[11.5px] font-bold text-primary disabled:opacity-50"
          >
            Avançar <ArrowRight size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={onPerder}
          disabled={ocupado}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-textMuted disabled:opacity-50"
        >
          <XCircle size={12} /> Perdi
        </button>
      </div>
    </div>
  );
}

function Metrica({ rotulo, valor, nota }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-card p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-textMuted">
        {rotulo}
      </p>
      <p className="mt-1 text-[19px] font-extrabold tabular-nums tracking-tight text-text">
        {valor}
      </p>
      <p className="text-[10.5px] leading-tight text-textMuted">{nota}</p>
    </div>
  );
}
