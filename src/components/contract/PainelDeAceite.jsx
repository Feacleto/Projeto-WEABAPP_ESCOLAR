import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { aceitarContrato } from '../../services/contratosDaFamiliaService';
import { notifyContractAccepted } from '../../services/notificationsService';

/**
 * O ACEITE: nome completo, a caixa marcada e o botão — fixo no rodapé.
 *
 * Usado no primeiro contrato (o portão que bloqueia o app) e no aditivo (a
 * tela do contrato, sem bloquear nada). Quem grava é o SERVIDOR
 * (`aceitarContrato`): o aceite e o hash não nascem no celular de ninguém.
 */
export default function PainelDeAceite({ child, contrato, adminUid, onNaoConcordo }) {
  const { profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.name || '');
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const nomeValido = nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  // ⚠️ PARA A FAMÍLIA NÃO EXISTE "MUDANÇA" (decisão do dono, 03/10/2026):
  // ela recebe um contrato novo e ASSINA, igual ao primeiro. Sem "aceito a
  // mudança" — o aditivo é coisa do motorista, que é quem decidiu mudar.
  const novo = contrato?.tipo === 'aditivo';

  const aceitar = async () => {
    if (!nomeValido) {
      toast.error('Digite seu nome completo (nome e sobrenome).');
      return;
    }
    if (!marcado) {
      toast.error('Marque o "Li e aceito" para continuar.');
      return;
    }
    setEnviando(true);
    try {
      await aceitarContrato({ childId: child.id, numero: contrato.numero, nome: nome.trim() });
      notifyContractAccepted({ adminUid, parentName: nome.trim(), childName: child.name });
      await refreshProfile?.();
      toast.success(novo ? 'Contrato assinado.' : 'Contrato assinado. Bem-vindo(a)!');
    } catch (err) {
      console.error('Falha ao aceitar contrato:', err);
      toast.error(
        err?.code === 'functions/failed-precondition'
          ? err.message
          : 'Não foi possível registrar o aceite. Tente de novo.'
      );
    } finally {
      setEnviando(false);
    }
  };

  // PORTAL PARA O <body>: dentro da tela, o painel ficava preso na camada do
  // conteúdo, e a barra de abas (que mora fora) cobria o botão de aceitar —
  // z-index não atravessa camadas (teste R2b).
  return createPortal(
    <div
      // z-50: ACIMA do aviso de cookies (z-40). Por baixo dele, o botão
      // "Aceitar contrato" sumia e a mãe não tinha como entrar (teste R1).
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-mobile space-y-3 border-t border-border bg-card p-4 shadow-rest print:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
    >
      <label htmlFor="aceite-nome" className="block text-sm font-semibold text-text">
        Seu nome completo
      </label>
      <input
        id="aceite-nome"
        type="text"
        placeholder="Nome e sobrenome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="h-12 w-full rounded-xl border-2 border-border px-4 text-base text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        autoComplete="name"
        disabled={enviando}
      />
      <label className="flex cursor-pointer items-start gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          disabled={enviando}
          className="mt-0.5 h-6 w-6 shrink-0 rounded accent-primary"
        />
        <span className="leading-snug">
          Li e aceito todas as cláusulas deste contrato de transporte escolar.
        </span>
      </label>
      <Button icon={CheckCircle2} loading={enviando} disabled={!nomeValido || !marcado} onClick={aceitar}>
        Assinar contrato
      </Button>
      <button
        type="button"
        onClick={onNaoConcordo}
        disabled={enviando}
        className="tap min-h-11 w-full text-sm font-semibold text-textMuted hover:text-text disabled:opacity-50"
      >
        Não concordo
      </button>
    </div>,
    document.body
  );
}
