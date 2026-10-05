import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { mensagemDeIndicarParceiro } from '../../marca/mensagensDoLink.js';
import { avisarParceiroIndicado } from '../../services/comunidadeService';

/**
 * INDICAR UM PARCEIRO PARA UMA FAMÍLIA (etapa 2, 05/10/2026, aprovada pelo
 * dono) — o tio escolhe uma das famílias dele e abre o WhatsApp DELA com o
 * nome e o contato do colega.
 *
 * ⚠️ É INDICAÇÃO, NÃO TRANSFERÊNCIA. Nada da família vai para o outro tio:
 * ela recebe a mensagem e decide se chama. Se chamar, o colega cadastra a
 * criança e manda o convite dele, como sempre — e o histórico (contrato,
 * mensalidades) fica com o tio de antes. É por isso que este componente não
 * grava nada.
 *
 * Família sem o WhatsApp no cadastro aparece apagada: não há para onde
 * mandar.
 *
 * O PARCEIRO É AVISADO (fase 1 da rede) de que foi indicado, sem nada da
 * família: nem nome, nem criança. Um aviso por dia por parceiro.
 */
export default function IndicarParceiro({ parceiro }) {
  const { profile } = useAuth();
  const { children } = useChildren();
  const [aberto, setAberto] = useState(false);
  const texto = mensagemDeIndicarParceiro({ marca: profile?.marcaNome, parceiro });

  const familias = [...children].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const mandar = (c) => {
    const fone = String(c.parentPhone || '').replace(/\D/g, '');
    const numero = fone.startsWith('55') ? fone : `55${fone}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    avisarParceiroIndicado(parceiro.uid);
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary text-base font-bold text-primary"
      >
        <Send size={18} aria-hidden="true" />
        Indicar para uma família
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-bg p-3">
      <p className="text-base font-semibold text-text">Para qual família?</p>
      <p className="text-sm text-textMuted">
        Abre o WhatsApp dela com o contato de {parceiro.marca}. Ela decide se chama.
      </p>
      {familias.map((c) => {
        const temFone = String(c.parentPhone || '').replace(/\D/g, '').length >= 10;
        return (
          <button
            key={c.id}
            type="button"
            disabled={!temFone}
            onClick={() => mandar(c)}
            className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 border-border bg-card px-3 text-left text-base disabled:opacity-60"
          >
            <span className="font-bold text-text">{c.parentName || `Família de ${c.name}`}</span>
            <span className="text-sm text-textMuted">{temFone ? c.name : 'Sem WhatsApp'}</span>
          </button>
        );
      })}
      <button type="button" onClick={() => setAberto(false)} className="min-h-12 w-full text-base font-semibold text-textMuted">
        Fechar
      </button>
    </div>
  );
}
