import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
import GoogleIcon from '../common/GoogleIcon';
import {
  authenticateAndRedeem,
  googleAndRedeem,
  resetPassword,
} from '../../services/authService';

/**
 * Folha de autenticação que aparece na PRIMEIRA AÇÃO do responsável.
 *
 * A ideia do fluxo: ele abre o link, navega pela prévia à vontade, e só
 * quando tenta FAZER algo (pagar, ler recado, ver detalhe) é que a conta é
 * pedida. Assim ele já sabe pra que serve antes de decidir se cria.
 *
 * DUAS DECISÕES DE PRODUTO AQUI
 *
 * 1. Não perguntamos "criar conta" ou "entrar". Metade dos pais não lembra
 *    se já cadastrou, e essa escolha é a origem da burocracia que a gente
 *    quer eliminar. O sistema tenta criar; se o email já existe, entra com a
 *    mesma senha.
 *
 * 2. Google vem primeiro, grande, com o texto dizendo que não precisa
 *    digitar nada. Email/senha fica escondido atrás de um link — é o caminho
 *    de quem não tem Google, não o caminho padrão.
 *
 * Props:
 *   - open, onClose
 *   - inviteCode:   código do link (vinculado no ato do login)
 *   - childName:    primeiro nome, usado no texto
 *   - reason:       o que ele tentou fazer ("pagar", "ler o recado"...)
 *   - onSuccess:    () => void — chamado depois de autenticar E vincular
 */
export default function AuthSheet({
  open,
  onClose,
  inviteCode,
  childName,
  reason,
  onSuccess,
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Fecha com Esc — a folha cobre a tela inteira no celular.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onGoogle = async () => {
    setGoogleBusy(true);
    try {
      await googleAndRedeem({ inviteCode });
      toast.success('Tudo pronto!');
      onSuccess();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'Não foi possível entrar com Google.');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Confira o email.';
    }
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setWrongPassword(false);
    try {
      await authenticateAndRedeem({ inviteCode, email, password });
      toast.success('Tudo pronto!');
      onSuccess();
    } catch (err) {
      const code = String(err?.code || '');
      if (
        code.includes('wrong-password') ||
        code.includes('invalid-credential')
      ) {
        // Email já existe e a senha não bate: é o caminho de quem esqueceu.
        setWrongPassword(true);
        setErrors({ password: 'Essa senha não confere com a conta deste email.' });
      } else if (code.includes('weak-password')) {
        setErrors({ password: 'Senha muito curta.' });
      } else {
        toast.error(err.message || 'Não foi possível entrar.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    if (!email.trim()) {
      toast.error('Escreva seu email primeiro.');
      return;
    }
    try {
      await resetPassword(email.trim());
      toast.success('Enviamos um link pra redefinir sua senha. Olhe o email.', {
        duration: 6000,
      });
    } catch {
      toast.error('Não conseguimos enviar agora.');
    }
  };

  const who = childName ? ` do ${childName}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Fundo: fechar aqui devolve pra prévia, não expulsa do app */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <div className="relative w-full max-w-mobile bg-card rounded-t-3xl p-6 pb-8 space-y-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="tap absolute right-4 top-4 w-9 h-9 rounded-full text-textMuted flex items-center justify-center"
        >
          <X size={20} />
        </button>

        <div className="space-y-1.5 pr-10">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            <ShieldCheck size={22} />
          </div>
          <h2 className="text-xl font-bold text-text leading-tight">
            {reason ? `Pra ${reason}, entre na sua conta` : 'Entre na sua conta'}
          </h2>
          <p className="text-sm text-textMuted">
            É rápido e protege os dados{who}. Só você vê.
          </p>
        </div>

        {/* Caminho principal: nada pra digitar */}
        <div className="space-y-2">
          <Button
            loading={googleBusy}
            onClick={onGoogle}
            className="!bg-white !text-text !border-2 !border-gray-300 hover:!bg-gray-50 shadow-md"
          >
            {!googleBusy && <GoogleIcon size={22} />}
            Continuar com Google
          </Button>
          <p className="text-[11px] text-textMuted text-center">
            Sem digitar nada. Se você usa Gmail no celular, é um toque.
          </p>
        </div>

        {!showEmail ? (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="tap w-full text-sm text-textMuted underline py-1"
          >
            Não uso Google — entrar com email
          </button>
        ) : (
          <form onSubmit={onEmailSubmit} className="space-y-3">
            <Input
              type="email"
              inputMode="email"
              label="Seu email"
              placeholder="seu@email.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              error={errors.email}
              required
            />
            <Input
              type="password"
              revealable
              label="Sua senha"
              placeholder="Mínimo 6 caracteres"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="current-password"
              error={errors.password}
              hint={
                wrongPassword
                  ? undefined
                  : 'Se você ainda não tem conta, criamos com esses dados.'
              }
              required
            />
            <Button type="submit" loading={busy}>
              Continuar
            </Button>
            {wrongPassword && (
              <button
                type="button"
                onClick={onForgot}
                className="tap w-full text-sm font-semibold text-primary underline py-1"
              >
                Esqueci minha senha
              </button>
            )}
          </form>
        )}

        <p className="text-[11px] text-textMuted text-center leading-relaxed">
          Ao continuar você aceita os{' '}
          <Link to="/termos" target="_blank" className="underline text-primary">
            Termos
          </Link>{' '}
          e a{' '}
          <Link
            to="/privacidade"
            target="_blank"
            className="underline text-primary"
          >
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
