import { FileText, Paperclip, TriangleAlert, Hourglass } from 'lucide-react';
import Button from '../common/Button';
import {
  formatCurrency,
  formatDateTime,
  formatMonthLabel,
  primeiroNome,
} from '../../compartilhado/formatters';

const METODO = { cash: 'Dinheiro', card: 'Cartão', pix: 'PIX' };

/**
 * "AGUARDANDO VOCÊ" — quem avisou que pagou, logo depois dos números.
 *
 * É o único estado que espera uma decisão DELE: a família fez a parte dela e
 * o mês dela só fecha quando ele confere. Na lista, essa linha ficava no meio
 * das outras com um botão verde; aqui ela sobe para logo abaixo do resumo,
 * no fundo âmbar do aviso, com o comprovante a um toque. Tarefa que mora no
 * meio de uma lista é a forma mais comum de uma tarefa não ser feita.
 *
 * ⚠️ AS AÇÕES SÃO AS QUE JÁ EXISTIAM: "Dar baixa" abre a mesma folha de
 * "Como você recebeu?", e "Anexar comprovante" abre o mesmo diálogo (que
 * confirma ao anexar, e diz isso antes). Não há "não caiu" — o app não tem
 * esse caminho do lado do motorista, e inventá-lo aqui seria um botão que
 * avisa a família de algo que nenhum registro guarda.
 *
 * Some quando não há ninguém: cartão âmbar vazio ensinaria a ignorar âmbar.
 */
export default function AguardandoVoce({ pagamentos, alertas = {}, onDarBaixa, onAnexar }) {
  if (!pagamentos.length) return null;

  return (
    <section className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="rotulo inline-flex items-center gap-1.5 !text-warningText">
          <Hourglass size={14} aria-hidden />
          Aguardando você
        </p>
        {pagamentos.length > 1 && (
          <p className="text-sm font-semibold tabular-nums text-warningText">
            {pagamentos.length}
          </p>
        )}
      </div>

      <div className="mt-1 divide-y divide-warningBorder">
        {pagamentos.map((p) => {
          const alerta = alertas[p.id];
          const quando = p.claimedAt ? formatDateTime(p.claimedAt) : null;
          return (
            <div key={p.id} className="py-3 last:pb-0">
              <div className="flex items-center gap-3">
                {/* O comprovante como objeto: um papel, que se toca para abrir. */}
                {p.receiptURL ? (
                  <a
                    href={p.receiptURL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver comprovante de ${p.childName || 'criança'}`}
                    className="tap flex h-14 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary"
                  >
                    <FileText size={20} />
                  </a>
                ) : (
                  <span
                    aria-hidden
                    className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-borderStrong bg-card text-textMuted"
                  >
                    <FileText size={20} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-snug text-text">
                    {primeiroNome(p.childName, 'A família')} avisou que pagou
                  </p>
                  <p className="text-sm leading-snug text-textBody">
                    {[
                      METODO[p.paymentMethod] || (p.paymentMethod ? 'PIX' : null),
                      quando,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {' · '}
                    <span className="font-semibold tabular-nums text-text">
                      {formatCurrency(p.amount)}
                    </span>
                  </p>
                  {!p.receiptURL && (
                    <p className="text-sm text-textMuted">Sem comprovante no app</p>
                  )}
                </div>
              </div>

              {alerta && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warningBorder bg-card px-2 py-1.5 text-xs font-semibold text-warningText">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Comprovante igual ao de{' '}
                    {alerta.month ? formatMonthLabel(alerta.month) : 'outro mês'}. Vale
                    conferir antes de confirmar.
                  </span>
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {p.receiptURL ? (
                  <a
                    href={p.receiptURL}
                    target="_blank"
                    rel="noreferrer"
                    className="tap inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-sm font-bold text-text"
                  >
                    <Paperclip size={16} />
                    Ver comprovante
                  </a>
                ) : (
                  <Button size="md" variant="secondary" onClick={() => onAnexar(p)}>
                    Anexar comprovante
                  </Button>
                )}
                <Button size="md" onClick={() => onDarBaixa(p)}>
                  Dar baixa
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
