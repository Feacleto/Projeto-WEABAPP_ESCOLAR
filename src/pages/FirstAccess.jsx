import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket, Mail, Lock, ArrowLeft, User } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import { signupWithInvite, signupWithGoogleInvite } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { isValidEmail, maskInviteCode, isValidInviteCode } from '../utils/masks';

export default function FirstAccess() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!isValidInviteCode(code)) {
      errs.code = 'Use o formato TN seguido de 4 dígitos (ex: TN4582).';
    }
    if (!name.trim()) errs.name = 'Informe seu nome.';
    if (!isValidEmail(email)) errs.email = 'Email inválido.';
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (password !== confirmPassword) errs.confirmPassword = 'As senhas não conferem.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Confira os campos destacados.');
      return;
    }

    setSubmitting(true);
    try {
      await signupWithInvite({ inviteCode: code, email, password, name });
      // signupWithInvite faz signup (auto-login) e cria o doc users/{uid} DEPOIS
      // do onAuthStateChanged disparar — o profile chega null. Forçamos refresh.
      await refreshProfile();
      toast.success('Conta criada! Bem-vindo(a).');
      navigate('/pai', { replace: true });
    } catch (err) {
      toast.error(err?.message || mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleSignup = async () => {
    if (!isValidInviteCode(code)) {
      setErrors((prev) => ({
        ...prev,
        code: 'Informe o código de convite antes de continuar com Google.',
      }));
      toast.error('Digite o código de convite primeiro.');
      return;
    }
    setGoogleSubmitting(true);
    try {
      await signupWithGoogleInvite({ inviteCode: code });
      await refreshProfile();
      toast.success('Conta criada com Google!');
      navigate('/pai', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err?.message || mapAuthError(err));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-text">Primeiro acesso</h1>
      <p className="text-sm text-textMuted mt-1 mb-6">
        Use o código de convite que o motorista te entregou para criar sua conta.
      </p>

      <Input
        label="Código de convite"
        placeholder="TN4582"
        icon={Ticket}
        value={code}
        onChange={(e) => setCode(maskInviteCode(e.target.value))}
        autoCapitalize="characters"
        maxLength={6}
        hint="Formato: TN seguido de 4 dígitos"
        error={errors.code}
        required
      />

      <div className="my-4">
        <Button
          variant="secondary"
          loading={googleSubmitting}
          onClick={onGoogleSignup}
        >
          {!googleSubmitting && <GoogleIcon size={18} />}
          Criar conta com Google
        </Button>
      </div>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg px-3 text-textMuted">ou crie com email/senha</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <Input
          label="Seu nome"
          placeholder="Nome completo"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          error={errors.name}
          required
        />
        <Input
          type="email"
          inputMode="email"
          label="Email"
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
          label="Crie uma senha"
          placeholder="Mínimo 6 caracteres"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          error={errors.password}
          required
        />
        <Input
          type="password"
          label="Confirme a senha"
          placeholder="Repita a senha"
          icon={Lock}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          error={errors.confirmPassword}
          required
        />
        <Button type="submit" loading={submitting}>
          Criar minha conta
        </Button>
      </form>
    </div>
  );
}

function mapAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este email já está em uso.';
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/weak-password':
      return 'Senha muito fraca.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    case 'auth/popup-blocked':
      return 'Popup bloqueado pelo navegador. Habilite e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe conta com outro método de login pra este email.';
    default:
      return 'Erro ao criar conta. Tente novamente.';
  }
}
