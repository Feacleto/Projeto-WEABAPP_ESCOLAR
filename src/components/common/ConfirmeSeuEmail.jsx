import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  estadoDaConfirmacaoDoEmail,
  reenviarVerificacaoDoEmail,
} from '../../services/authService';

/**
 * O LEMBRETE DE CONFIRMAR O E-MAIL — no Início do motorista e da família.
 *
 * ⚠️ É LEMBRETE, NÃO PORTÃO (decisão do dono, 03/10/2026). O app funciona
 * inteiro sem a confirmação; o cartão só existe para que o e-mail digitado
 * errado apareça HOJE, e não no dia em que a pessoa esquecer a senha e o link
 * de redefinir for parar na caixa de outra pessoa.
 *
 * Só para conta de SENHA: o Google já confirma o endereço de quem entra por
 * ele (`estadoDaConfirmacaoDoEmail` decide).
 *
 * O "Reenviar" espera um minuto entre um envio e outro. O Firebase tem cota
 * própria e responde `too-many-requests` — sem a espera aqui, o segundo toque
 * nervoso viraria uma mensagem de erro sobre um e-mail que provavelmente já
 * chegou.
 */
const ESPERA_MS = 60 * 1000;
const CHAVE = 'alobuzinou:verificacaoReenviadaEm';

function ultimoEnvio() {
  try {
    return Number(sessionStorage.getItem(CHAVE)) || 0;
  } catch {
    return 0;
  }
}

export default function ConfirmeSeuEmail({ className = '' }) {
  const { user } = useAuth();
  const [estado, setEstado] = useState({ pendente: false, email: null });
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [enviadoEm, setEnviadoEm] = useState(ultimoEnvio);

  const uid = user?.uid;
  useEffect(() => {
    let vivo = true;
    if (!uid) return undefined;
    estadoDaConfirmacaoDoEmail()
      .then((e) => vivo && setEstado(e))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const falta = Math.max(0, ESPERA_MS - (agora - enviadoEm));
  useEffect(() => {
    if (!falta) return undefined;
    const t = setTimeout(() => setAgora(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [falta, agora]);

  if (!estado.pendente) return null;

  const reenviar = async () => {
    if (falta || enviando) return;
    setEnviando(true);
    try {
      await reenviarVerificacaoDoEmail();
      const em = Date.now();
      setEnviadoEm(em);
      setAgora(em);
      try {
        sessionStorage.setItem(CHAVE, String(em));
      } catch {
        // Modo privado: a espera vale só enquanto a tela estiver aberta.
      }
      toast.success('Enviamos de novo. Olhe também o spam.');
    } catch (err) {
      toast.error(
        err?.code === 'auth/too-many-requests'
          ? 'Muitos envios seguidos. Tente daqui a pouco.'
          : 'Não deu para enviar agora. Tente de novo.'
      );
    } finally {
      setEnviando(false);
    }
  };

  /* ⚠️ UMA FAIXA, NÃO UM CARTÃO (05/10/2026, densidade aprovada pelo dono).
   * O cartão tinha 165 px no topo do Início, e era a primeira coisa que o tio
   * e a família viam todo dia. Ficou o essencial numa faixa: o pedido, o
   * endereço (numa linha, cortado se for longo — é ele que denuncia o e-mail
   * digitado errado, que é o motivo de o lembrete existir) e o "Reenviar". */
  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-border bg-card py-2 pl-3 pr-1 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primarySoft text-primary">
        <Mail size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate whitespace-nowrap text-base font-bold leading-tight text-text">Confirme seu e-mail</p>
        <p className="truncate text-base leading-tight text-textMuted" title={estado.email || ''}>
          {estado.email}
        </p>
      </div>
      <button
        type="button"
        onClick={reenviar}
        disabled={!!falta || enviando}
        className="tap inline-flex h-12 shrink-0 items-center rounded-xl px-2 text-base font-bold text-primary disabled:opacity-60"
      >
        {falta ? `${Math.ceil(falta / 1000)}s` : 'Reenviar'}
      </button>
    </div>
  );
}
