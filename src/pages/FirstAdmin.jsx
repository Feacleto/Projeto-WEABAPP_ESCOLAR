import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, User, Phone, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import GoogleIcon from '../components/common/GoogleIcon';
import LegalAcceptCheckbox from '../components/legal/LegalAcceptCheckbox';
import {
  createFirstAdmin,
  createFirstAdminWithGoogle,
} from '../services/authService';
import { acceptTerms } from '../services/consentService';
import { adminExists } from '../services/inviteCodeService';
import { useAuth } from '../hooks/useAuth';
import {
  maskPhone,
  isValidPhone,
  isValidEmail,
  unmaskPhone,
} from '../compartilhado/masks';

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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [acceptedLegal, setAcceptedLegal] = useState(false);

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

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Informe seu nome.';
    if (phone && !isValidPhone(phone)) {
      errs.phone = 'Telefone inválido. Use 10 ou 11 dígitos com DDD.';
    }
    if (!isValidEmail(email)) errs.email = 'Email inválido.';
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (!acceptedLegal)
      errs.legal = 'Você precisa aceitar os termos e a política de privacidade.';
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
      const user = await createFirstAdmin({
        email,
        password,
        name,
        phone: unmaskPhone(phone),
      });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success('Administrador criado!');
      navigate('/tio', { replace: true });
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar administrador.');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleAdminSignup = async () => {
    if (phone && !isValidPhone(phone)) {
      setErrors((prev) => ({
        ...prev,
        phone: 'Telefone inválido. Use 10 ou 11 dígitos com DDD.',
      }));
      toast.error('Confira o telefone.');
      return;
    }
    if (!acceptedLegal) {
      setErrors((prev) => ({
        ...prev,
        legal: 'Você precisa aceitar os termos antes de continuar.',
      }));
      toast.error('Aceite os termos antes de continuar.');
      return;
    }
    setGoogleSubmitting(true);
    try {
      const user = await createFirstAdminWithGoogle({ phone: unmaskPhone(phone) });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success('Administrador criado com Google!');
      navigate('/tio', { replace: true });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err?.message || 'Erro ao criar administrador.');
      }
    } finally {
      setGoogleSubmitting(false);
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

      <Input
        label="Telefone (opcional)"
        placeholder="(11) 99999-9999"
        icon={Phone}
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
        autoComplete="tel"
        inputMode="tel"
        error={errors.phone}
      />

      <div className="mt-4">
        <LegalAcceptCheckbox
          checked={acceptedLegal}
          onChange={setAcceptedLegal}
          error={errors.legal}
        />
      </div>

      <div className="my-4">
        <Button
          variant="secondary"
          loading={googleSubmitting}
          onClick={onGoogleAdminSignup}
        >
          {!googleSubmitting && <GoogleIcon size={18} />}
          Criar admin com Google
        </Button>
      </div>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-bg px-3 text-textMuted">ou crie com email/senha</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <Input
          label="Nome"
          placeholder="Seu nome"
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
          label="Senha"
          placeholder="Mínimo 6 caracteres"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          error={errors.password}
          required
        />
        <Button type="submit" loading={submitting}>
          Criar administrador
        </Button>
      </form>
    </div>
  );
}
