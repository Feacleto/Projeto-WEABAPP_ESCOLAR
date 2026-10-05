import { useState } from 'react';
import { Check, Clock, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import CampoDeValor from '../common/CampoDeValor';
import { usePagamentosDoMotorista } from '../../hooks/useAuxiliares';
import { anotarPagamentoDaAuxiliar } from '../../services/auxiliarService';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';
import {
  diaCurto,
  estadoDoRecibo,
  nomeDoMesDoPagamento,
  pagamentoDoMes,
} from '../../dominio/identidade/auxiliar.js';

/**
 * "PAGAMENTO DE OUTUBRO" — a seção do cartão de cada auxiliar ativa, do lado
 * do motorista (fase 4, 05/10/2026, desenho aprovado pelo dono).
 *
 * Ele anota que pagou; o servidor grava o recibo e a despesa "Auxiliar" do
 * mês no MESMO lote (`anotarPagamentoDaAuxiliar`), e ela confirma no app
 * dela. Aqui só se mostra em que pé o recibo está.
 *
 * ⚠️ O BOTÃO É DE CONTORNO: a tela `/tio/finance/auxiliar` já tem o verde cheio
 * ("Criar convite"), e a regra do app é um protagonista por tela.
 *
 * O valor vem do que ele disse no convite (`valorMensal` do vínculo). Sem
 * ele, ou quando o mês foi diferente, o campo de valor abre — anotar um
 * número que não foi o pago seria pior que não anotar.
 */
export default function PagamentoDaAuxiliar({ auxiliar }) {
  const pagamentos = usePagamentosDoMotorista();
  const mes = getCurrentMonthKey();
  const recibo = pagamentoDoMes(pagamentos, auxiliar.uid, mes);
  const estado = estadoDoRecibo(recibo);
  const primeiro = String(auxiliar.nome || '').split(' ')[0] || 'ela';
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(auxiliar.valorMensal ? String(auxiliar.valorMensal) : '');
  const [enviando, setEnviando] = useState(false);

  const pedirValor = editando || !auxiliar.valorMensal;

  async function anotar() {
    const numero = pedirValor ? Number(valor) : auxiliar.valorMensal;
    if (!(numero > 0)) return toast.error('Quanto você pagou?');
    setEnviando(true);
    try {
      await anotarPagamentoDaAuxiliar({ auxiliarUid: auxiliar.uid, mes, valor: numero });
      toast.success('Anotado. Já está nas despesas do mês.');
      setEditando(false);
    } catch (err) {
      toast.error(err?.message || 'Não deu para anotar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="flex items-center gap-2 text-base font-bold text-text">
        <Wallet size={20} className="text-primary" aria-hidden="true" />
        Pagamento de {nomeDoMesDoPagamento(mes)}
      </p>

      {pagamentos === null ? (
        <p className="text-base text-textMuted">Carregando…</p>
      ) : estado === 'sem_anotacao' ? (
        <>
          {pedirValor && (
            <CampoDeValor label="Quanto você pagou" value={valor} onChange={setValor} />
          )}
          <button
            type="button"
            onClick={anotar}
            disabled={enviando}
            className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary bg-card px-3 text-base font-extrabold text-primary disabled:opacity-60"
          >
            {enviando
              ? 'Anotando…'
              : pedirValor
                ? 'Anotar que paguei'
                : `Anotar que paguei · ${formatCurrency(auxiliar.valorMensal)}`}
          </button>
          {!pedirValor && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="tap min-h-12 w-full text-base font-semibold text-primary underline"
            >
              Paguei outro valor
            </button>
          )}
          <p className="text-sm text-textMuted">Vira a despesa &quot;Auxiliar&quot; do mês.</p>
        </>
      ) : (
        <>
          <p className="text-base text-textBody">
            Você anotou {formatCurrency(recibo.valor)} em {diaCurto(recibo.anotadoEm) || 'hoje'}.
          </p>
          {estado === 'confirmado' ? (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primaryChip px-3 text-base font-semibold text-accentText">
              <Check size={18} aria-hidden="true" />
              A {primeiro} confirmou
            </span>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-warningSoft px-3 text-base font-semibold text-warningText">
              <Clock size={18} aria-hidden="true" />
              Esperando a {primeiro} confirmar
            </span>
          )}
        </>
      )}
    </div>
  );
}
