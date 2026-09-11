import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Check, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import Logo from '../components/common/Logo';
import {
  verifyResetCode,
  confirmReset,
  applyAuthActionCode,
  inspectActionCode,
  resetPassword,
} from '../services/authService';
import { mensagemDeAuth } from '../dominio/identidade/authErrors';
import { mascararEmail } from '../compartilhado/formatters';
import { COMPANY_INFO } from './legal/legalContent';
import { SENHA_MINIMA } from '../dominio/identidade/authErrors';

/**
 * Handler in-app dos links de ação do Firebase Auth.
 *
 * O Firebase manda emails (reset de senha, verificação de email, etc.) com
 * URL do tipo: /auth-action?mode=resetPassword&oobCode=XXXX&apiKey=YYYY
 *
 * Esta página lê os params, valida o código e mostra a UI apropriada em PT-BR
 * — assim o pai não sai do app pra concluir o fluxo (e não vê tela em inglês).
 */
/**
 * O ENDEREÇO EM QUE A PESSOA ESTÁ, ESCRITO DENTRO DA TELA.
 *
 * ⚠️ ELE É LIDO DO NAVEGADOR, NUNCA ESCRITO À MÃO — e essa é a única forma
 * que presta. Uma constante `'alobuzinou.com'` continuaria dizendo
 * "alobuzinou.com" numa cópia hospedada em outro domínio, ou seja: ajudaria
 * o golpe em vez de denunciá-lo. Lido do `location`, o selo diz a verdade em
 * qualquer lugar onde a página for servida.
 *
 * Ele existe porque no celular a barra de endereço some ao rolar, e esta é a
 * tela em que a pessoa mais precisa conferir onde está: ela chegou por um
 * link de e-mail e vai digitar uma senha.
 */
function SeloDoDominio() {
  const host = typeof window === 'undefined' ? '' : window.location.host;
  if (!host) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primaryChip px-3 py-1 text-xs font-semibold text-primaryDark">
      <Lock size={12} strokeWidth={2.6} />
      {host}
    </span>
  );
}

/**
 * A regra da senha, marcada ENQUANTO ela digita.
 *
 * Substitui o erro vermelho depois do envio: a pessoa descobre o que falta
 * antes de tentar, e não depois de falhar. `validate()` continua existindo —
 * é ele que impede o envio; isto aqui é o que evita chegar lá.
 */
function Regra({ ok, children }) {
  return (
    <span
      className={`flex items-center gap-2 text-xs ${
        ok ? 'text-primaryDark' : 'text-textMuted'
      }`}
    >
      <span
        className={`grid h-4 w-4 flex-none place-items-center rounded-full ${
          ok ? 'bg-primaryChip text-primaryDark' : 'bg-border text-card'
        }`}
      >
        <Check size={10} strokeWidth={3.5} />
      </span>
      {children}
    </span>
  );
}

/**
 * QUEM É A EMPRESA — e este é o sinal mais forte de toda a tela.
 *
 * Layout, cor e logotipo uma página falsa copia numa tarde. Razão social e
 * CNPJ ela não copia: publicar o CNPJ de outra empresa numa página que pede
 * senha deixa de ser design e vira falsidade ideológica, com trilha de quem
 * registrou o domínio.
 *
 * Vale nos QUATRO estados, não só no formulário: a tela de "link inválido" é
 * onde a pessoa mais desconfia, porque alguma coisa acabou de dar errado.
 *
 * ⚠️ Os dados saem de `COMPANY_INFO`, nunca digitados aqui. É o mesmo objeto
 * que os Termos e a Política usam — um lugar pra mudar, todas as telas mudam.
 * O e-mail é o canal do Encarregado que a Política publica: se ele mudar lá e
 * não aqui, esta tela passa a oferecer um canal que ninguém lê.
 */
function RodapeLegal() {
  return (
    <p className="mt-auto pt-6 text-center text-xs leading-relaxed text-textMuted">
      {COMPANY_INFO.razaoSocial} · CNPJ {COMPANY_INFO.cnpj}
      <br />
      <a href={`mailto:${COMPANY_INFO.email}`} className="underline">
        {COMPANY_INFO.email}
      </a>
    </p>
  );
}

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
    if (password.length < SENHA_MINIMA)
      errs.password = `Mínimo ${SENHA_MINIMA} caracteres.`;
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
        <RodapeLegal />
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
        <RodapeLegal />
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
        <RodapeLegal />
      </div>
    );
  }

  // ── O FORMULÁRIO (mode=resetPassword, código válido) ──────────────────
  //
  // ⚠️ ESTA TELA TEM UM PROBLEMA QUE NÃO É DE USABILIDADE, É DE CONFIANÇA.
  //
  // Quem chega aqui chegou pelo pior caminho possível: perdeu a senha, clicou
  // num link que veio por e-mail, e vai digitar uma senha nova numa página
  // que nunca viu. É exatamente a forma de um golpe — e a desconfiança dela
  // está CERTA. Um formulário bonito não responde a isso; o que responde é a
  // tela dizer coisas que uma página falsa não consegue dizer:
  //
  //   o domínio  → lido do navegador (`SeloDoDominio`), some no celular
  //   o e-mail   → mascarado, para RECONHECER sem expor
  //   o escopo   → o link vale uma vez, e isso é verdade verificável
  //   a saída    → não foi você? fechar não muda nada
  //   as regras  → marcadas antes do erro, não depois
  //   a empresa  → razão social e CNPJ (`RodapeLegal`)
  //
  // As frases são todas conferíveis de propósito. Nada de "conexão segura",
  // "criptografado" ou "protegido" genérico: promessa que a linha ao lado não
  // prova é o defeito recorrente deste projeto, e numa tela sobre segurança
  // ela custa mais que em qualquer outra.
  const senhaLonga = password.length >= SENHA_MINIMA;
  const senhasIguais = password.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/login"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap"
      >
        <ArrowLeft size={16} /> Cancelar
      </Link>

      {/* O LOGOTIPO COMPLETO, não só o símbolo.
        *
        * Era `<LogoMark />` — a perua sem a palavra. Numa tela de entrada,
        * quem só viu a marca no cabeçalho do app não reconhece o símbolo
        * isolado, e reconhecimento é a aposta inteira desta tela. */}
      <div className="text-center mb-6 flex flex-col items-center gap-3">
        <Logo variant="stacked" height={92} />
        <SeloDoDominio />
        <div className="mt-1">
          <h1 className="text-2xl font-bold text-text">Criar uma nova senha</h1>
          {/* "Criar" e não "Redefinir": redefinir é palavra de sistema. */}
          {email && (
            <p className="text-sm text-textMuted mt-1">
              Você pediu isso para{' '}
              <span className="font-semibold text-text">{mascararEmail(email)}</span>
            </p>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="password"
          label="Nova senha"
          placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
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
          label="Repetir a senha"
          placeholder="Repita para conferir"
          icon={Lock}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          error={errors.confirmPassword}
          required
        />

        <div className="flex flex-col gap-1.5">
          <Regra ok={senhaLonga}>Pelo menos {SENHA_MINIMA} caracteres</Regra>
          <Regra ok={senhasIguais}>As duas precisam ser iguais</Regra>
        </div>

        {/* "Salvar e entrar" e não "Salvar nova senha": o botão diz o que
          * acontece. Ela não fica sem saber se vai precisar logar de novo. */}
        <Button type="submit" loading={submitting}>
          Salvar e entrar
        </Button>

        <div className="flex items-start gap-2 rounded-xl border border-primaryBorder bg-primarySoft p-3 text-xs leading-relaxed text-primaryDark">
          <ShieldCheck size={14} className="mt-0.5 flex-none" />
          <span>
            <strong className="font-semibold">Este link funciona uma vez só.</strong>{' '}
            Se não foi você que pediu, pode fechar esta página — sua senha
            continua a mesma.
          </span>
        </div>
      </form>

      <RodapeLegal />
    </div>
  );
}
