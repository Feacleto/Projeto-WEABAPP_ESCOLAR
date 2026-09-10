import { useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { formatDateTime } from '../../compartilhado/formatters';
import { montarTrilha } from '../../dominio/cobranca/trilhaDoPagamento';
import { listPaymentEvents } from '../../services/paymentAuditService';

/**
 * O HISTÓRICO DE UM PAGAMENTO, PARA OS DOIS LADOS.
 *
 * ── POR QUE ELE APARECE AQUI E NÃO NUMA TELA DO DONO
 * A discussão sobre pagamento não acontece entre o dono e ninguém: acontece
 * entre o motorista e a família, no WhatsApp, sobre um mês que passou. As
 * rules já deixavam **os dois** lerem a trilha ("os dois lados precisam poder
 * consultar a mesma trilha", diz o comentário lá) — o que faltava era a tela.
 * Como o cartão de pagamento é o mesmo componente nas duas telas, mostrar
 * aqui entrega os dois de uma vez, com o mesmo texto.
 *
 * ── FECHADO POR PADRÃO, E BUSCA SÓ AO ABRIR
 * São `getDocs` por pagamento; montado aberto numa lista de doze meses, seria
 * uma dúzia de consultas para uma informação que quase ninguém pede. Fechado,
 * custa zero até alguém discordar de alguma coisa — que é quando ele serve.
 *
 * ── E ELE NÃO É BOTÃO DE AÇÃO
 * Nada aqui desfaz nem corrige nada. É leitura, e a subcoleção é append-only
 * nas rules: nem o dono apaga uma linha. Um histórico que se edita não vale
 * como prova, vale como versão.
 */
export default function TrilhaDoPagamento({ payment }) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [linhas, setLinhas] = useState(null);

  const alternar = async () => {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    // Recarrega a cada abertura: a trilha só cresce, e uma lista velha é a
    // única forma de esta tela mentir.
    setCarregando(true);
    try {
      const eventos = await listPaymentEvents(payment?.id);
      setLinhas(montarTrilha({ payment, eventos }));
    } finally {
      setCarregando(false);
    }
  };

  if (!payment?.id) return null;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="tap flex w-full items-center gap-1.5 text-[11px] font-semibold text-textMuted hover:text-text"
      >
        <History size={13} />
        Histórico deste pagamento
        {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {aberto && (
        <div className="mt-2 space-y-1.5">
          {carregando && (
            <p className="text-[11px] text-textMuted">Carregando…</p>
          )}

          {/* ⚠️ LISTA VAZIA TEM TEXTO PRÓPRIO, e ele não acusa ninguém.
            * Pagamento antigo é anterior à trilha, e ausência de linha não é
            * ausência de fato — dizer "nada aconteceu" transformaria um
            * buraco do nosso lado em argumento contra alguém. */}
          {!carregando && linhas && linhas.length === 0 && (
            <p className="text-[11px] leading-relaxed text-textMuted">
              Sem registros para este pagamento. O histórico começou a ser
              guardado depois que ele foi gerado.
            </p>
          )}

          {!carregando &&
            linhas?.map((linha, i) => (
              <div
                key={`${linha.tipo}-${i}`}
                className="flex items-baseline justify-between gap-3 text-[11px]"
              >
                <span className="text-text">
                  {linha.rotulo}
                  {linha.nota ? (
                    <span className="text-textMuted"> · {linha.nota}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-textMuted">
                  {linha.quando ? formatDateTime(linha.quando) : 'agora'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
