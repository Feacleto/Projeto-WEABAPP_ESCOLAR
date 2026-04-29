import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket, Mail, Lock, ArrowLeft, User } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { signupWithInvite } from '../services/authService';
import { useAuth } from '../hooks/useAuth';

export default function FirstAccess() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não conferem.');
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

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Código de convite"
          placeholder="TN4582"
          icon={Ticket}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          hint="Formato: TN seguido de 4 dígitos"
          required
        />
        <Input
          label="Seu nome"
          placeholder="Nome completo"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
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
    default:
      return 'Erro ao criar conta. Tente novamente.';
  }
}
