import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, User, Phone, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import { createFirstAdmin } from '../services/authService';
import { adminExists } from '../services/inviteCodeService';
import { useAuth } from '../hooks/useAuth';

/**
 * Bootstrap do primeiro admin do app.
 * Esta tela só fica acessível enquanto não houver nenhum admin no Firestore.
 * Após o primeiro cadastro, qualquer tentativa de acessar esta rota redireciona
 * para o login.
 */
export default function FirstAdmin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [checking, setChecking] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    adminExists()
      .then((exists) => {
        if (exists) {
          toast.error('Já existe um administrador.');
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        // Em erro de rede, assumimos que pode existir e bloqueamos por segurança
        toast.error('Não foi possível verificar. Tente mais tarde.');
        navigate('/login', { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await createFirstAdmin({ email, password, name, phone });
      await refreshProfile();
      toast.success('Administrador criado!');
      navigate('/tio', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar administrador.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} className="text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
        <ShieldCheck size={28} className="text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-text">Primeiro administrador</h1>
      <p className="text-sm text-textMuted mt-1 mb-6">
        Crie a conta principal do app. Esta tela só está disponível enquanto
        não houver nenhum admin cadastrado.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nome"
          placeholder="Seu nome"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
        <Input
          label="Telefone"
          placeholder="(11) 99999-9999"
          icon={Phone}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          inputMode="tel"
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
          label="Senha"
          placeholder="Mínimo 6 caracteres"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          required
        />
        <Button type="submit" loading={submitting}>
          Criar administrador
        </Button>
      </form>
    </div>
  );
}
