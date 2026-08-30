import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  LogIn,
  Lock,
  Mail,
  Ticket,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import GoogleIcon from '../components/common/GoogleIcon';
import Logo from '../components/common/Logo';
import LegalAcceptCheckbox from '../components/legal/LegalAcceptCheckbox';
import { authenticateAndRedeem, googleAndRedeem } from '../services/authService';
import { acceptTerms } from '../services/consentService';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../utils/papeis';
import {
  CENA_ABERTURA,
  CENA_ENTRADA,
  estadoDaTravessia,
} from '../utils/travessia';
import { isValidEmail, maskInviteCode, isValidInviteCode } from '../utils/masks';

/**
 * Primeiro acesso do responsável — /first-access
 *
 * ESTA TELA SÓ CRIA CONTA. NÃO É PORTA DE LOGIN.
 * Quem chega aqui é quem ainda não existe no app: o responsável que recebeu
 * um convite do motorista. Ela tinha duas abas ("já tenho conta" / "criar
 * conta") e a de login era um convite ao erro — porque login não resolve o
 * problema de quem chega aqui:
 *
 *   "ENTRAR com Google" não dá acesso a ninguém. Sem doc em `users/{uid}` o
 *   app desloga na hora, e é isso que tem que acontecer: acesso de
 *   responsável nasce do VÍNCULO com uma criança, e o vínculo nasce do
 *   convite do motorista. Um botão que parece resolver e devolve erro é pior
 *   que um botão que não existe.
 *
 *   "CRIAR CONTA com Google" dá acesso, porque vai junto com o código
 *   (`googleAndRedeem`): resgata o convite e cria o vínculo no mesmo passo.
 *   Esse fica — e fica em destaque, porque é o caminho sem digitar nada, que
 *   é o que serve pra quem tem pouca familiaridade com teclado de celular.
 *
 * Quem já tem conta encontra um link discreto pro /login no fim. É a minoria
 * aqui, e mandar essa pessoa pra tela certa custa um toque.
 *
 * O CÓDIGO É A EXCEÇÃO, NÃO A REGRA
 * O caminho natural do responsável é o LINK que o motorista mandou: ele já
 * carrega o convite e a conta se cria por lá, sem código. Então a tela abre
 * dizendo isso, e o campo de código só aparece pra quem toca em "tenho um
 * código". Colocar o código na frente ensinava a coisa errada.
 *
 * O FORMULÁRIO APARECE EM PASSOS
 * Nome → email → senha → botão, cada campo entrando quando o anterior recebe
 * o dedo. O formulário é o mesmo; o que muda é a sensação: em vez de um muro
 * de campos, uma pergunta por vez.
 */
export default function FirstAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: authLoading, refreshProfile } = useAuth();

  const [abriuCodigo, setAbriuCodigo] = useState(false);
  const [abriuSenha, setAbriuSenha] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [tocou, setTocou] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Já autenticado? Vai pro painel — inclusive quem cair aqui por link antigo.
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = painelDe(profile);
      navigate(location.state?.from || target, { replace: true });
    }
  }, [authLoading, profile, navigate, location.state]);

  const marcar = (campo) => () =>
    setTocou((p) => (p[campo] ? p : { ...p, [campo]: true }));

  const codigoOk = isValidInviteCode(code);
  // Os passos: cada campo entra quando o anterior recebeu o dedo. Uso FOCO e
  // não "está válido" de propósito — validar antes de a pessoa terminar de
  // digitar é o jeito mais rápido de irritar.
  const mostraEmail = tocou.nome || name.length > 0;
  const mostraSenha = mostraEmail && (tocou.email || email.length > 0);
  const mostraBotao = mostraSenha && (tocou.senha || password.length > 0);

  const validate = () => {
    const errs = {};
    if (!codigoOk) {
      errs.code = 'Confira o código com o motorista — ele começa com TN.';
    }
    if (!name.trim()) errs.name = 'Informe seu nome.';
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
      // Mesma função do fluxo por link: tenta criar, e se o email já existir,
      // entra com a mesma senha. O responsável não escolhe entre "criar
      // conta" e "entrar" — o sistema descobre.
      const { user, created } = await authenticateAndRedeem({
        inviteCode: code,
        email,
        password,
        name,
      });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success(
        created ? 'Conta criada! Bem-vindo(a).' : 'Pronto! Criança vinculada.'
      );
      // `created` é o que separa as duas cenas: conta NOVA ganha a abertura
      // (o balão vira a porta), conta que já existia e só vinculou mais uma
      // criança ganha a entrada normal. A abertura é cara e existe pra um
      // único momento na vida da pessoa — o instante em que ela descobre se
      // aquele link do WhatsApp era um produto de verdade.
      navigate('/pai', {
        replace: true,
        state: estadoDaTravessia(
          created ? CENA_ABERTURA : CENA_ENTRADA,
          'parent'
        ),
      });
    } catch (err) {
      toast.error(err?.message || mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleSignup = async () => {
    if (!codigoOk) {
      setErrors((p) => ({ ...p, code: 'Informe o código antes de continuar.' }));
      toast.error('Digite o código de convite primeiro.');
      return;
    }
    if (!acceptedLegal) {
      setErrors((p) => ({
        ...p,
        legal: 'Você precisa aceitar os termos antes de continuar.',
      }));
      toast.error('Aceite os termos antes de continuar.');
      return;
    }
    setGoogleSubmitting(true);
    try {
      const { user, created } = await googleAndRedeem({ inviteCode: code });
      try {
        await acceptTerms(user.uid);
      } catch (err) {
        console.error('Falha ao registrar aceite:', err);
      }
      await refreshProfile();
      toast.success(
        created ? 'Conta criada com Google!' : 'Pronto! Criança vinculada.'
      );
      // `created` é o que separa as duas cenas: conta NOVA ganha a abertura
      // (o balão vira a porta), conta que já existia e só vinculou mais uma
      // criança ganha a entrada normal. A abertura é cara e existe pra um
      // único momento na vida da pessoa — o instante em que ela descobre se
      // aquele link do WhatsApp era um produto de verdade.
      navigate('/pai', {
        replace: true,
        state: estadoDaTravessia(
          created ? CENA_ABERTURA : CENA_ENTRADA,
          'parent'
        ),
      });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error(err?.message || mapAuthError(err));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* ── tampa escura: a marca, no mesmo material da home ── */}
      <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-6 pb-7 pt-5 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-80 animate-glow-drift"
            style={{
              background:
                'radial-gradient(110% 80% at 10% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60 animate-glow-drift-slow"
            style={{
              background:
                'radial-gradient(90% 70% at 100% 10%, rgba(82,196,26,.2) 0%, rgba(11,18,16,0) 58%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] animate-grid-drift"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        <div className="relative">
          {/* Voltar vai pra porta da FAMÍLIA, não pra "/". Esta tela existe
            * só pra criar conta de responsável — quem está aqui está no
            * caminho dele, e Voltar tem que devolver ele pra frente dele.
            * Antes apontava pra home do motorista, que vende associação. */}
          <Link
            to="/familia"
            className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar
          </Link>

          <div className="mt-3 text-center">
            <Logo
              variant="stacked"
              tone="onDark"
              height={80}
              className="mx-auto"
            />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-onNightAccent/80">
              primeiro acesso
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Criar sua conta
            </h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-white/65">
              Sua conta nasce do convite do motorista — é ele que liga seu filho
              a você.
            </p>
          </div>
        </div>
      </header>

      {/* Costura entre a marca e o produto. */}
      <div
        aria-hidden
        className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary"
      />

      <main className="flex flex-1 flex-col px-6 py-5">
        {/* O caminho fácil primeiro: quem tem o link não precisa de nada disso. */}
        <div className="rounded-2xl border border-primaryBorder bg-primarySoft p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
            <Link2 size={15} className="text-primary" />
            O motorista te mandou um link?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-primary/80">
            Então abre o link — ele já vem com o convite dentro, e sua conta se
            cria por lá. <strong>Você não precisa de código nenhum.</strong>
          </p>
        </div>

        {/* O CÓDIGO É EXCEÇÃO, E AGORA TEM O TAMANHO DE UMA EXCEÇÃO
          * Ele era um cartão do mesmo peso do aviso do link — e dois blocos
          * do mesmo tamanho lado a lado leem como duas opções equivalentes,
          * quando na verdade 9 de 10 responsáveis chegam pelo link. Virou uma
          * linha de texto: continua a um toque, mas não disputa a tela com a
          * resposta que quase todo mundo precisa. */}
        {!abriuCodigo ? (
          <button
            type="button"
            onClick={() => setAbriuCodigo(true)}
            className="tap mt-3 inline-flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-textMuted hover:text-text"
          >
            <Ticket size={14} />
            Tenho um código de convite
          </button>
        ) : (
          <div className="animate-step-in mt-4 space-y-4">
            <Input
              label="Código de convite"
              placeholder="TN2K9F4B"
              icon={Ticket}
              value={code}
              onChange={(e) => setCode(maskInviteCode(e.target.value))}
              autoCapitalize="characters"
              maxLength={8}
              hint="8 caracteres, começa com TN."
              error={errors.code}
              required
            />

            {/* Só depois do código a criação de conta faz sentido: sem ele não
              * há criança pra vincular, e conta de responsável sem criança é
              * conta órfã. */}
            {codigoOk ? (
              <div className="animate-step-in space-y-4">
                <LegalAcceptCheckbox
                  checked={acceptedLegal}
                  onChange={setAcceptedLegal}
                  error={errors.legal}
                />

                {/* O Google aqui CRIA a conta (resgata o convite junto), e é o
                  * caminho sem digitar nada. */}
                <button
                  type="button"
                  onClick={onGoogleSignup}
                  disabled={googleSubmitting}
                  className="tap cta-shine relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl border-2 border-borderStrong bg-card text-base font-bold text-text shadow-md hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                >
                  <GoogleIcon size={22} />
                  {googleSubmitting ? 'Um instante…' : 'Criar conta com Google'}
                </button>
                <p className="-mt-2 text-center text-[11px] text-textMuted">
                  sem digitar nada
                </p>

                {!abriuSenha ? (
                  <button
                    type="button"
                    onClick={() => setAbriuSenha(true)}
                    className="tap flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-textMuted hover:text-text"
                  >
                    Criar com email e senha
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <form onSubmit={onSubmit} className="animate-step-in space-y-4">
                    <Input
                      label="Seu nome"
                      placeholder="Nome completo"
                      icon={User}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={marcar('nome')}
                      autoComplete="name"
                      error={errors.name}
                      required
                    />

                    {mostraEmail && (
                      <div className="animate-step-in">
                        <Input
                          type="email"
                          inputMode="email"
                          label="Email"
                          placeholder="seu@email.com"
                          icon={Mail}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={marcar('email')}
                          autoComplete="email"
                          error={errors.email}
                          required
                        />
                      </div>
                    )}

                    {/* Um campo só: o olho de revelar substitui o "confirme a
                      * senha". Digitar a senha duas vezes num teclado de
                      * celular gera mais erro do que evita. */}
                    {mostraSenha && (
                      <div className="animate-step-in">
                        <Input
                          type="password"
                          revealable
                          label="Crie uma senha"
                          placeholder="Mínimo 6 caracteres"
                          icon={Lock}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={marcar('senha')}
                          minLength={6}
                          autoComplete="new-password"
                          error={errors.password}
                          hint="Toque no olho pra conferir o que digitou."
                          required
                        />
                      </div>
                    )}

                    {mostraBotao && (
                      <div className="animate-step-in">
                        <Button type="submit" loading={submitting}>
                          Criar minha conta
                          <ArrowRight size={17} />
                        </Button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-textMuted">
                Digite o código pra continuar. Se não tiver, peça o{' '}
                <strong>link</strong> pro motorista — é mais rápido pros dois.
              </p>
            )}
          </div>
        )}

        {/* AS DUAS SAÍDAS, EM UMA LINHA
          * Quem errou a tela e quem é motorista precisam de porta — mas eram
          * dois cartões grandes no pé, do tamanho do conteúdo principal, e
          * empurravam o assunto da tela pra cima. Como par de links discretos
          * eles continuam acháveis por quem procura, sem competir com quem
          * está aqui pelo motivo certo. */}
        <div className="mt-auto flex items-center justify-center gap-3 pt-8 text-sm font-semibold text-textMuted">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="tap inline-flex items-center gap-1.5 py-2 hover:text-text"
          >
            <LogIn size={14} />
            Já tenho conta
          </button>
          {/* O "Sou motorista" SAIU daqui.
            *
            * Esta tela existe só pra criar conta de responsável, e o link
            * levava ele direto pro cadastro de parceiro — a porta do outro
            * público oferecida dentro da tela dele. A regra é assimétrica:
            * o motorista pode ver coisa de responsável, o responsável não
            * pode ver coisa de motorista.
            *
            * Quem é motorista e caiu aqui por engano tem "Já tenho conta" ao
            * lado, e a home em "/" — que é a frente dele e onde ele chega
            * naturalmente. Ninguém fica sem porta. */}
        </div>

        <div className="flex items-center justify-center gap-3 pt-4 text-[11px] text-textMuted">
          <Link to="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </main>
    </div>
  );
}

function mapAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Email inválido.';
    case 'auth/email-already-in-use':
      return 'Este email já tem conta. Use "Já tenho conta".';
    case 'auth/weak-password':
      return 'Senha muito curta. Use ao menos 6 caracteres.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet.';
    case 'auth/popup-blocked':
      return 'Popup bloqueado pelo navegador. Habilite e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'Login cancelado.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe conta com outro método de login pra este email.';
    default:
      return err?.message || 'Erro. Tente novamente.';
  }
}
