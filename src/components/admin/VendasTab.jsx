import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, PauseCircle } from 'lucide-react';
import Spinner from '../common/Spinner';
import { formatCurrency } from '../../compartilhado/formatters';
import { parceirosDoDono } from '../../services/userService';
import { cobrancaLigada, watchPlatformConfig } from '../../services/platformConfigService';
import { mesAtual } from '../../services/adminMetricsService';
import {
  DIAS_DE_TESTE_PARA_CONVERSA,
  fechamentos,
  propostaDoPronto,
  prontosParaConversa,
  resumoDeVendas,
} from '../../dominio/associacao/vendasDoPainel.js';

/**
 * VENDAS — "quem está pronto para virar assinante" (05/10/2026).
 *
 * A lista é pensada para abrir uma conversa, não para medir: motorista que roda
 * agora, que já viu o app por duas semanas e ainda não escolheu plano. A conta
 * mora em `dominio/associacao/vendasDoPainel.js`; a mensagem é a MESMA da ficha
 * do motorista (`propostaDoPronto`), e o botão só abre o WhatsApp para o dono
 * LER antes de enviar.
 *
 * ⚠️ Onde o número não existe, "—", nunca zero.
 */
const ROTULO_DO_PLANO = { mensal: 'Mensal', anual: 'Anual', vitalicio: 'Vitalício' };

function Ficha({ rotulo, valor, detalhe }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <span className="text-xs text-textMuted">{rotulo}</span>
      <span className="font-display text-2xl font-extrabold tabular-nums text-text">{valor}</span>
      {detalhe && <span className="text-xs text-textMuted">{detalhe}</span>}
    </div>
  );
}

function dataCurta(d) {
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

export default function VendasTab() {
  const [parceiros, setParceiros] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    let vivo = true;
    parceirosDoDono()
      .then((l) => vivo && setParceiros(l))
      .catch((err) => {
        console.error('[admin] vendas não carregou:', err);
        if (vivo) setParceiros(false);
      });
    const parar = watchPlatformConfig((c) => vivo && setConfig(c));
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);

  const dados = useMemo(() => {
    if (!Array.isArray(parceiros)) return null;
    const agora = new Date();
    const mes = mesAtual();
    return {
      resumo: resumoDeVendas(parceiros, agora, mes),
      prontos: prontosParaConversa(parceiros, agora, mes).map((p) => ({
        ...p,
        proposta: propostaDoPronto(p.motorista, agora, mes),
      })),
      fechados: fechamentos(parceiros),
    };
  }, [parceiros]);

  if (parceiros === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar as vendas.
      </p>
    );
  }
  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const { resumo, prontos, fechados } = dados;

  return (
    <div className="space-y-5">
      {config && !cobrancaLigada(config) && (
        <p className="flex items-start gap-2 rounded-2xl border border-warningBorder bg-warningSoft p-4 text-sm font-semibold text-warningText">
          <PauseCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Cobrança desligada: a escada não corre.
            <span className="mt-0.5 block text-xs font-normal">
              O desconto de fechamento só desce quando a cobrança estiver ligada.
            </span>
          </span>
        </p>
      )}

      <section className="space-y-3" aria-labelledby="vendas-titulo">
        <h2 id="vendas-titulo" className="rotulo">
          Quem está pronto para virar assinante
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Ficha
            rotulo="Prontos para conversa"
            valor={resumo.prontos}
            detalhe={`rodam na semana e passaram de ${DIAS_DE_TESTE_PARA_CONVERSA} dias de teste`}
          />
          <Ficha rotulo="Assinantes com plano" valor={resumo.assinantes} />
          <Ficha
            rotulo="Do cadastro ao plano"
            valor={resumo.medianaDias === null ? '—' : `${resumo.medianaDias} dias`}
            detalhe="mediana"
          />
          <Ficha
            rotulo="Hora sua por fechado"
            valor="—"
            detalhe="o número que governa o negócio; ainda não é medido"
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="prontos-titulo">
        <h2 id="prontos-titulo" className="rotulo">
          Prontos para conversa
        </h2>
        {prontos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-textMuted">
            Ninguém ainda: precisa rodar na semana e ter passado de {DIAS_DE_TESTE_PARA_CONVERSA} dias de teste.
          </p>
        ) : (
          <ul className="space-y-2">
            {prontos.map((p) => (
              <li key={p.uid} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-text">{p.nome}</p>
                    <p className="mt-0.5 text-xs text-textMuted">
                      {[
                        p.lugar,
                        `roda há ${p.diasRodando} dias`,
                        `${p.criancas} ${p.criancas === 1 ? 'criança' : 'crianças'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-extrabold tabular-nums text-text">
                      {p.pagaria === null ? '—' : formatCurrency(p.pagaria)}
                    </p>
                    <p className="text-xs text-textMuted">pagaria por mês</p>
                  </div>
                </div>
                <div className="mt-3">
                  {p.proposta.link ? (
                    <a
                      href={p.proposta.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white"
                    >
                      <MessageSquare size={15} /> Mandar proposta
                    </a>
                  ) : (
                    <span className="inline-flex min-h-[40px] items-center rounded-xl bg-neutro px-3 text-xs text-textMuted">
                      Sem telefone cadastrado
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="fechamentos-titulo">
        <h2 id="fechamentos-titulo" className="rotulo">
          Fechamentos
        </h2>
        {fechados.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-textMuted">
            Ninguém fechou plano ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {fechados.map((f) => (
              <li key={f.uid} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="font-semibold text-text">{f.nome}</span>
                <span className="text-xs text-textMuted">
                  {ROTULO_DO_PLANO[f.plano] || f.plano} · {dataCurta(f.em)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
