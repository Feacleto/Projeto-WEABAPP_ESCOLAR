import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import { LogoMark } from '../components/common/Logo';
import {
  verifyResetCode,
  confirmReset,
  applyAuthActionCode,
  inspectActionCode,
} from '../services/authService';

/**
 * Handler in-app dos links de ação do Firebase Auth.
 *
 * O Firebase manda emails (reset de senha, verificação de email, etc.) com
 * URL do tipo: /auth-action?mode=resetPassword&oobCode=XXXX&apiKey=YYYY
 *
 * Esta página lê os params, valida o código e mostra a UI apropriada em PT-BR
 * — assim o pai não sai do app pra concluir o fluxo (e não vê tela em inglês).
 */
export default function AuthAction() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  // 'verifying' | 'reset-form' | 'reset-success' | 'verify-email-success' | 'error'
  const [status, setStatus] = useState('verifying');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form de nova senha
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Valida o código assim que a página monta
  useEffect(() => {
    if (!mode || !oobCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setErrorMsg('Link inválido. Solicite um novo email.');
      return;
    }

    (async () => {
      try {
        if (mode === 'resetPassword') {
          const userEmail = await verifyResetCode(oobCode);
          setEmail(userEmail);
          setStatus('reset-form');
        } else if (mode === 'verifyEmail') {
          await applyAuthActionCode(oobCode);
          setStatus('verify-email-success');
        } else if (mode === 'recoverEmail') {
          const info = await inspectActionCode(oobCode);
          await applyAuthActionCode(oobCode);
          setEmail(info?.data?.email || '');
          setStatus('verify-email-success');
        } else {
          setStatus('error');
          setErrorMsg('Tipo de ação não suportada.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg(mapAuthError(err));
      }
    })();
  }, [mode, oobCode]);

  const validate = () => {
    const errs = {};
    if (password.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (password !== confirmPassword)
      errs.confirmPassword = 'As senhas não conferem.';
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
      await confirmReset(oobCode, password);
      setStatus('reset-success');
      toast.success('Senha redefinida com sucesso!');
    } catch (err) {
      toast.error(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Loader inicial enquanto valida o oobCode
  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <Spinner size={32} className="text-primary" />
        <p className="text-sm text-textMuted mt-4">Validando link...</p>
      </div>
    );
  }

  // Erro: link inválido/expirado/já usado
  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-10">
        <div className="flex-1 flex flex-col justify-center text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-danger/10 mb-4 mx-auto">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <h1 className="text-2xl font-bold text-text">Link inválido</h1>
          <p className="text-sm text-textMuted mt-2 mb-6">{errorMsg}</p>
          <Link to="/login" className="block">
            <Button>Voltar para o login</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Sucesso: senha redefinida
  if (status === 'reset-success') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-10">
        <div className="flex-1 flex flex-col justify-center text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 mx-auto">
            <CheckCircle2 size={32} className="text-accentText" />
          </div>
          <h1 className="text-2xl font-bold text-text">Senha redefinida!</h1>
          <p className="text-sm text-textMuted mt-2 mb-6">
            Sua nova senha já está ativa. Use ela pra entrar.
          </p>
          <Button onClick={() => navigate('/', { replace: true })}>
            Voltar para a entrada
          </Button>
        </div>
      </div>
    );
  }

  // Sucesso: email verificado / recuperado
  if (status === 'verify-email-success') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-10">
        <div className="flex-1 flex flex-col justify-center text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4 mx-auto">
            <CheckCircle2 size={32} className="text-accentText" />
          </div>
          <h1 className="text-2xl font-bold text-text">Email confirmado!</h1>
          <p className="text-sm text-textMuted mt-2 mb-6">
            {email
              ? `O email ${email} foi confirmado.`
              : 'Seu email foi confirmado com sucesso.'}
          </p>
          <Button onClick={() => navigate('/', { replace: true })}>
            Voltar para a entrada
          </Button>
        </div>
      </div>
    );
  }

  // Form de nova senha (mode=resetPassword, código válido)
  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Cancelar
      </Link>

      <div className="text-center mb-6">
        <LogoMark height={72} className="mx-auto mb-4" label="Alô Buzinou" />
        <h1 className="text-2xl font-bold text-text">Redefinir senha</h1>
        <p className="text-sm text-textMuted mt-1">
          Crie uma nova senha para <span className="font-medium">{email}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="password"
          label="Nova senha"
          placeholder="Mínimo 6 caracteres"
          icon={Lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          error={errors.password}
          required
          autoFocus
        />
        <Input
          type="password"
          label="Confirme a nova senha"
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
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}

function mapAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/expired-action-code':
      return 'O link expirou. Solicite um novo email de redefinição.';
    case 'auth/invalid-action-code':
      return 'Link inválido ou já utilizado. Solicite um novo email.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada. Entre em contato com o motorista.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use ao menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    default:
      return 'Não foi possível concluir. Tente novamente.';
  }
}
