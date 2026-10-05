import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { loginWithGoogle } from '../services/authService';
import {
  verConviteDeAuxiliar,
  aceitarConviteDeAuxiliar,
  contaDeEmailDaAuxiliar,
} from '../services/auxiliarService';
import { LEGAL_VERSION } from './legal/legalContent';

/**
 * O CONVITE DA AUXILIAR — `/auxiliar/:codigo` (05/10/2026, simulação "Conta da
 * Auxiliar" aprovada pelo dono).
 *
 * A auxiliar abre o link que o motorista mandou pelo WhatsApp e vê QUEM a
 * chamou e o que ela vai poder fazer. Ela não escolhe papel: a conta nasce de
 * auxiliar, ligada a ele, pelo servidor (`aceitarConviteDeAuxiliar`).
 *
 * Link que não vale mais recebe UMA frase só, como o convite da família —
 * dizer "foi usado" ou "venceu" a quem tem o link na mão conta coisa demais.
 */
export default function ConviteAuxiliar() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [convite, setConvite] = useState(undefined);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    verConviteDeAuxiliar(codigo)
      .then((c) => { if (vivo) setConvite(c); })
      .catch(() => { if (vivo) setConvite({ vale: false, frase: 'Não deu para abrir o convite agora. Tente de novo.' }); });
    return () => { vivo = false; };
  }, [codigo]);

  // Já é auxiliar: o link aberto de novo leva direto ao app dela.
  useEffect(() => {
    if (profile?.role === 'auxiliar') navigate('/aux', { replace: true });
  }, [profile?.role, navigate]);

  async function aceitar() {
    setErro('');
    setEntrando(true);
    try {
      await aceitarConviteDeAuxiliar({ codigo, acceptedLegalVersion: LEGAL_VERSION });
      await refreshProfile?.();
      toast.success('Pronto. Você já é auxiliar.');
      navigate('/aux', { replace: true });
    } catch (err) {
      setErro(err?.message || 'Não deu para aceitar agora. Tente de novo.');
    } finally {
      setEntrando(false);
    }
  }

  async function comGoogle() {
    setErro('');
    try {
      await loginWithGoogle();
      await aceitar();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') setErro('Não deu para entrar com o Google. Tente de novo.');
    }
  }

  async function comEmail(e) {
    e.preventDefault();
    setErro('');
    if (!email.includes('@') || senha.length < 6) {
      setErro('Digite o seu e-mail e uma senha de 6 letras ou números.');
      return;
    }
    setEntrando(true);
    try {
      await contaDeEmailDaAuxiliar(email.trim(), senha);
      await aceitar();
    } catch {
      setErro('Não deu para entrar com este e-mail e senha.');
      setEntrando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="bg-primary px-5 pb-8 pt-10 text-white">
        <p className="rotulo text-menta">Convite</p>
        {convite === undefined ? (
          <p className="mt-2 font-display text-2xl font-extrabold">Abrindo o convite…</p>
        ) : convite?.vale ? (
          <h1 className="mt-2 font-display text-[28px] font-extrabold leading-tight">
            {convite.marca} te chamou para ser auxiliar
          </h1>
        ) : (
          <h1 className="mt-2 font-display text-[26px] font-extrabold leading-tight">{convite?.frase}</h1>
        )}
      </header>

      {convite?.vale && (
        <main className="-mt-4 space-y-4 rounded-t-3xl bg-card px-5 pb-10 pt-6">
          <section className="rounded-2xl bg-primarySoft p-4">
            <p className="text-base font-bold text-text">No seu celular você vai</p>
            <p className="mt-1 text-base text-textBody">
              Ver a turma e a rota de hoje, marcar embarque e entrega, ligar para as famílias e ver os pagamentos que
              {' '}{convite.marca} te fizer.
            </p>
          </section>

          {user ? (
            <>
              <Button onClick={aceitar} loading={entrando} className="shadow-focus">
                Aceitar o convite
              </Button>
              <p className="text-center text-sm text-textMuted">Ao aceitar, você aceita os Termos e a Política de Privacidade.</p>
            </>
          ) : (
            <>
              <Button onClick={comGoogle} loading={entrando} className="shadow-focus">
                Começar com Google
              </Button>
              <form onSubmit={comEmail} className="space-y-3">
                <Input label="Seu e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} semSalvar />
                <Input label="Crie uma senha" type="password" autoComplete="new-password" revealable value={senha} onChange={(e) => setSenha(e.target.value)} semSalvar />
                <Button type="submit" variant="secondary" loading={entrando}>
                  Usar e-mail
                </Button>
              </form>
              <p className="text-center text-sm text-textMuted">Ao entrar, você aceita os Termos e a Política de Privacidade.</p>
            </>
          )}
          {erro && <p className="text-base font-semibold text-dangerText">{erro}</p>}
        </main>
      )}
    </div>
  );
}
