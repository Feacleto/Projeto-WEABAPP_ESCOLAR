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
  resetPassword,
} from '../services/authService';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';

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

  // O E-MAIL SOBREVIVE À TROCA DE ESTADO, e é o que permite reenviar o link
  // sem perguntar nada. `email` é zerado nos ramos de sucesso; este guarda o
  // endereço do código que foi validado na montagem, para o caso de ele
  // expirar durante o preenchimento.
  const [emailParaReenvio, setEmailParaReenvio] = useState('');
  const [reenviando, setReenviando] = useState(false);

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
          setEmailParaReenvio(userEmail || '');
          setStatus('reset-form');
        } else if (mode === 'verifyEmail') {
          await applyAuthActionCode(oobCode);
          setStatus('verify-email-success');
        } else if (mode === 'recoverEmail') {
          const info = await inspectActionCode(oobCode);
          await applyAuthActionCode(oobCode);
          setEmail(info?.data?.email || '');
          setStatus('verify-email-success');
        } else if (mode === 'verifyAndChangeEmail') {
          // O Firebase moderno manda este `mode` na troca de endereço, e ele
          // caía no `else` como "não suportada". Só passa a ser alcançável
          // quando o Action URL do console apontar para cá.
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
        setErrorMsg(mensagemDeAuth(err, 'link'));
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
      const codigo = err?.code || '';
      toast.error(mensagemDeAuth(err, 'link'));
      // ⚠️ CÓDIGO MORTO ENTRE VALIDAR E SALVAR TIRA ELA DO FORMULÁRIO.
      //
      // O `catch` só dava um toast e o `status` continuava `reset-form`: com o
      // `oobCode` já expirado (1 hora) ou já usado, ela apertava "Salvar nova
      // senha" indefinidamente e só ganhava o mesmo aviso, sem nunca ser
      // levada a pedir outro link.
      //
      // E este é o caso COMUM, não a borda: quem abre o e-mail, é
      // interrompido, e volta uma hora depois.
      if (
        codigo === 'auth/expired-action-code' ||
        codigo === 'auth/invalid-action-code'
      ) {
        setStatus('error');
        setErrorMsg(mensagemDeAuth(err, 'link'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Pede outro link da própria tela de erro.
   *
   * As duas frases da tabela mandam "Solicite um novo email" — e não havia
   * como solicitar dali. O único alvo era voltar ao login, onde o campo de
   * e-mail nasce vazio e o botão de redefinir fica dentro de uma aba, abaixo
   * da senha: ela tinha que reconstruir o caminho inteiro sozinha, no caso
   * mais frequente de todos.
   *
   * `verifyResetCode` devolve o e-mail quando o código ainda era válido na
   * montagem (o caso de expirar durante o preenchimento), então normalmente
   * não precisamos perguntar nada.
   */
  const onPedirOutro = async () => {
    const alvo = String(emailParaReenvio || '').trim();
    if (!alvo) {
      navigate('/login', { replace: true });
      return;
    }
    setReenviando(true);
    try {
      await resetPassword(alvo);
      toast.success('Enviamos outro link. Confira o email (e o spam!).', {
        duration: 6000,
      });
    } catch (err) {
      toast.error(mensagemDeAuth(err, 'reset'));
    } finally {
      setReenviando(false);
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
          {emailParaReenvio ? (
            <div className="space-y-2">
              <Button onClick={onPedirOutro} loading={reenviando}>
                Enviar outro link
              </Button>
              <p className="text-xs text-textMuted">
                para <strong>{emailParaReenvio}</strong>
              </p>
              <Link to="/login" className="block pt-1">
                <button
                  type="button"
                  className="tap w-full text-sm font-semibold text-textMuted underline py-1"
                >
                  Voltar para o login
                </button>
              </Link>
            </div>
          ) : (
            <Link to="/login" className="block">
              <Button>Voltar para o login</Button>
            </Link>
          )}
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
          {/* ⚠️ VAI PARA `/login` COM O E-MAIL NA MÃO, E NÃO PARA `/`.
            *
            * Era `navigate('/')`, e `/` redireciona para `/login` — um salto a
            * mais, e o login nascia com os DOIS campos vazios. O e-mail que
            * esta tela já tem em estado era descartado, e é justamente o campo
            * que ela pode não lembrar qual usou (tem duas contas de e-mail e
            * cadastrou com uma delas).
            *
            * Não logamos automaticamente de propósito: quem redefiniu a senha
            * precisa exercitá-la uma vez, senão ela descobre que digitou algo
            * diferente do que pensou só na próxima troca de aparelho. */}
          <Button
            onClick={() =>
              navigate('/login', {
                replace: true,
                state: emailParaReenvio ? { email: emailParaReenvio } : undefined,
              })
            }
          >
            Entrar com a senha nova
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

