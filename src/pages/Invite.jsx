import { useEffect, useState } from 'react';
import { FRENTE_FAMILIA } from '../utils/frentes';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Bus,
  Lock,
  MessageSquare,
  Wallet,
  MapPin,
  ChevronRight,
  HeartHandshake,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import AuthSheet from '../components/auth/AuthSheet';
import { useAuth } from '../hooks/useAuth';
import { getInvitePreview, normalizeInviteCode } from '../services/inviteCodeService';
import { redeemInvite } from '../services/authService';
import { formatCurrency } from '../utils/formatters';
import { isInAppBrowser, openForAuth } from '../utils/browserEnv';

/**
 * Convite por link — /convite/:codigo
 *
 * O FLUXO
 * O tio manda o link no WhatsApp. O pai abre e vê o app: o nome do filho, a
 * mensalidade em aberto, quantos recados esperam por ele. Navega à vontade,
 * sem conta, sem código, sem senha. Na primeira AÇÃO — pagar, ler recado,
 * ver detalhe — a folha de autenticação sobe, ele entra com Google num toque,
 * e a conta é vinculada à criança do link.
 *
 * POR QUE ASSIM E NÃO "ACESSO DIRETO SEM LOGIN"
 * Sem sessão do Firebase não existe nada pras Security Rules autorizarem;
 * cada leitura teria que passar por uma Cloud Function e o tempo real morre.
 * Além disso, sem senha, qualquer pessoa com o celular na mão vê os dados da
 * criança. A prévia resolve a percepção ("já estou dentro") e o login resolve
 * a proteção — cada um no seu lugar.
 *
 * A prévia vem do servidor (`getInvitePreview`) e é deliberadamente magra:
 * primeiro nome, valor da mensalidade, CONTAGEM de recados. Nada de endereço,
 * escola, coordenada ou texto de recado.
 */
export default function Invite() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const {
    user,
    profile,
    loading: authLoading,
    refreshProfile,
    setActiveChildId,
  } = useAuth();

  const code = normalizeInviteCode(codigo);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // O que ele tentou fazer antes de a conta ser pedida — usado no texto da
  // folha e pra levar ele ao lugar certo depois de entrar.
  const [pendingAction, setPendingAction] = useState(null);
  const [searchParams] = useSearchParams();

  // Chegou com ?auth=1 → veio da webview pra entrar. Sobe a folha na hora,
  // pra a troca de app parecer continuação e não recomeço.
  const resumeAuth = searchParams.get('auth') === '1';

  useEffect(() => {
    if (!resumeAuth) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingAction({ reason: 'acompanhar seu filho', destination: '/pai' });
  }, [resumeAuth]);

  /**
   * Uma ação da prévia foi tocada.
   *
   * Dentro da webview do WhatsApp, tentamos PRIMEIRO abrir o Chrome já no
   * estado de login. No Android isso resolve num toque só. Se não sair do
   * lugar (iOS sem Chrome, webview que bloqueia o intent), a folha sobe
   * aqui mesmo com a ponte manual dentro dela — o pai nunca fica travado.
   */
  const onAction = (action) => {
    if (isInAppBrowser()) {
      openForAuth();
      // A folha sobe de qualquer forma: se o Chrome abriu, esta tela some;
      // se não abriu, ela é o plano B com a instrução manual.
      setTimeout(() => setPendingAction(action), 1200);
      return;
    }
    setPendingAction(action);
  };

  useEffect(() => {
    let alive = true;
    getInvitePreview(code)
      .then((data) => alive && setPreview(data))
      .catch((err) => alive && setLoadError(err.message));
    return () => {
      alive = false;
    };
  }, [code]);

  // Motorista logado não vira responsável — manda pro painel dele.
  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') {
      toast.error('Você está logado como motorista. Saia da conta pra usar um convite.');
      navigate('/tio', { replace: true });
    }
  }, [authLoading, profile, navigate]);

  // ESTE É O CAMINHO MAIS PERCORRIDO DO APP.
  //
  // O pai não guarda o endereço do site e não pede link novo ao tio: ele
  // volta na conversa do WhatsApp e toca no MESMO link, semana após semana.
  // Antes isso caía numa tela dizendo "Este convite já foi usado" — ou seja,
  // o único atalho que ele tem pro app respondia com erro. Agora, se o
  // convite é dele, entramos direto na criança certa.
  useEffect(() => {
    if (preview?.status !== 'yours') return;
    if (preview.childId) setActiveChildId(preview.childId);
    navigate('/pai', { replace: true });
  }, [preview, navigate, setActiveChildId]);

  const finish = async (destination) => {
    await refreshProfile();
    navigate(destination || '/pai', { replace: true });
  };

  if (loadError) return <InviteBroken message={loadError} />;

  if (!preview || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner size={30} className="text-primary" />
        <p className="text-sm text-textMuted">Abrindo o convite...</p>
      </div>
    );
  }

  const driverLabel =
    preview.companyName ||
    (preview.driverFirstName ? `Tio ${preview.driverFirstName}` : 'seu motorista');

  // O convite é dele: o efeito acima já está navegando. Só um respiro
  // visual pra não piscar a prévia no meio do caminho.
  if (preview.status === 'yours') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner size={30} className="text-primary" />
        <p className="text-sm text-textMuted">Abrindo o app...</p>
      </div>
    );
  }

  // Vinculado a OUTRA conta, e quem abriu não está logado. Isso é
  // esmagadoramente o pai que limpou o navegador ou trocou de aparelho —
  // não um invasor. Então a tela é uma porta ('entre'), não um alarme.
  if (preview.status === 'taken' && !user) {
    return (
      <SignInToContinue
        childFirstName={preview.childFirstName}
        driverLabel={driverLabel}
      />
    );
  }

  // Pai JÁ logado abrindo o link: nada de prévia, só confirmar o vínculo.
  if (user && profile?.role === 'parent') {
    return (
      <LinkToExistingAccount
        code={code}
        preview={preview}
        driverLabel={driverLabel}
        onDone={() => finish('/pai')}
      />
    );
  }

  // Vinculado a outra conta com alguém logado: explica sem assustar.
  if (preview.status === 'taken') {
    return <AlreadyUsed childFirstName={preview.childFirstName} />;
  }

  return (
    <>
      <PreviewScreen
        preview={preview}
        driverLabel={driverLabel}
        onAction={onAction}
      />
      <AuthSheet
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        inviteCode={code}
        childName={preview.childFirstName}
        reason={pendingAction?.reason}
        onSuccess={() => finish(pendingAction?.destination)}
      />
    </>
  );
}

/* ─────────────── Prévia navegável ─────────────── */

function PreviewScreen({ preview, driverLabel, onAction }) {
  const p = preview.nextPayment;
  const notices = preview.notices?.count || 0;

  const dueLabel = !p
    ? null
    : p.overdue
    ? `atrasada há ${Math.abs(p.daysUntilDue)} ${Math.abs(p.daysUntilDue) === 1 ? 'dia' : 'dias'}`
    : p.daysUntilDue === 0
    ? 'vence hoje'
    : `vence em ${p.daysUntilDue} ${p.daysUntilDue === 1 ? 'dia' : 'dias'}`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Quem está chamando */}
      <header className="bg-gradient-to-br from-emerald-600 via-primary to-primaryDark text-white px-6 pt-9 pb-7">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 border border-white/25 rounded-full px-3 py-1">
          <Bus size={13} />
          {driverLabel}
        </span>
        <h1 className="text-2xl font-extrabold leading-tight mt-4">
          O transporte {preview.childFirstName ? `do ${preview.childFirstName}` : 'do seu filho'}, aqui no celular
        </h1>
        <p className="text-white/85 mt-2 text-sm leading-relaxed">
          {driverLabel} te convidou pra acompanhar mensalidade e recados num
          lugar só.
        </p>
      </header>

      <main className="flex-1 px-6 py-6 space-y-4">
        {/* O gancho: a conta DELE, concreta */}
        {p ? (
          <button
            type="button"
            onClick={() =>
              onAction({ reason: 'ver e pagar a mensalidade', destination: '/pai/finance' })
            }
            className="tap w-full text-left bg-card border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wallet size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                  mensalidade em aberto
                </p>
                <p className="text-2xl font-extrabold text-text leading-tight mt-0.5">
                  {formatCurrency(p.amount)}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    p.overdue ? 'text-danger font-semibold' : 'text-textMuted'
                  }`}
                >
                  {p.monthLabel} · {dueLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              Pagar com PIX <ChevronRight size={16} />
            </div>
          </button>
        ) : (
          preview.monthlyFee > 0 && (
            <div className="bg-card border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                mensalidade combinada
              </p>
              <p className="text-2xl font-extrabold text-text leading-tight mt-0.5">
                {formatCurrency(preview.monthlyFee)}
              </p>
              <p className="text-xs text-textMuted mt-0.5">
                Nada a pagar agora — a cobrança aparece aqui quando abrir.
              </p>
            </div>
          )
        )}

        {/* Recados: contagem visível, conteúdo trancado */}
        <button
          type="button"
          onClick={() =>
            onAction({ reason: 'ler os recados', destination: '/pai' })
          }
          className="tap w-full text-left bg-card border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-secondary/15 text-secondaryDark flex items-center justify-center shrink-0">
            <MessageSquare size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text leading-tight">
              {notices === 0
                ? 'Recados do motorista'
                : notices === 1
                ? '1 recado esperando você'
                : `${notices} recados esperando você`}
            </p>
            <p className="text-xs text-textMuted mt-0.5 flex items-center gap-1">
              <Lock size={11} />
              Entre pra ler
            </p>
          </div>
          <ChevronRight size={18} className="text-textMuted shrink-0" />
        </button>

        {/* O que mais tem lá dentro — expectativa honesta */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
            também no app
          </p>
          <Feature
            icon={MapPin}
            title="Onde o seu filho está"
            desc="Status da rota e aviso quando a perua estiver chegando."
          />
          <Feature
            icon={Wallet}
            title="Comprovante direto no app"
            desc="Sem mandar print no WhatsApp e sem perguntar se chegou."
          />
        </div>

        <Button
          onClick={() => onAction({ reason: 'acompanhar seu filho', destination: '/pai' })}
        >
          Entrar e acompanhar
        </Button>
        <p className="text-[11px] text-textMuted text-center">
          Um toque com o Google. Não precisa digitar código nenhum.
        </p>
      </main>

      <footer className="px-6 py-5 border-t border-gray-200 text-center">
        <p className="text-xs text-textMuted">
          Não é você? Fale com {driverLabel} — o convite é pessoal.
        </p>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className="text-textMuted shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted leading-snug">{desc}</p>
      </div>
    </div>
  );
}

/* ─────────────── Pai já logado ─────────────── */

function LinkToExistingAccount({ code, preview, driverLabel, onDone }) {
  const [submitting, setSubmitting] = useState(false);

  const onLink = async () => {
    setSubmitting(true);
    try {
      await redeemInvite({ inviteCode: code });
      toast.success(`${preview.childFirstName} foi adicionado à sua conta!`);
      await onDone();
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  };

  if (preview.status === 'taken') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-lg font-bold text-text">Este convite já foi usado</p>
        <p className="text-sm text-textMuted max-w-xs">
          Se {preview.childFirstName} já está na sua conta, ele aparece na tela
          de início.
        </p>
        <Link to="/pai" className="text-sm font-semibold text-primary underline">
          Ir pro início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 justify-center gap-6">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white text-3xl font-bold flex items-center justify-center shadow-lg shadow-emerald-500/25">
          {(preview.childFirstName || '?')[0].toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-text leading-tight">
          Adicionar {preview.childFirstName} à sua conta?
        </h1>
        <p className="text-sm text-textMuted">Convite de {driverLabel}</p>
      </div>
      <div className="bg-card border border-gray-200 rounded-2xl p-4 text-sm text-text">
        Você já está logado. Depois de adicionar, você troca entre as crianças
        na tela de início.
      </div>
      <div className="space-y-2">
        <Button loading={submitting} onClick={onLink}>
          Sim, adicionar {preview.childFirstName}
        </Button>
        <Link to="/pai" className="block text-center text-sm text-textMuted py-2">
          Agora não
        </Link>
      </div>
    </div>
  );
}

/* ─────────────── Estados de erro ─────────────── */

/**
 * O link é de uma conta que já existe, e quem abriu não está logado.
 *
 * Na prática este é o pai voltando: limpou o navegador, trocou de celular,
 * ou abriu o link no Chrome depois de ter entrado dentro do WhatsApp (as
 * duas sessões têm armazenamento separado). Tratar isso como erro de
 * segurança seria errar o diagnóstico na maioria dos casos.
 */
function SignInToContinue({ childFirstName, driverLabel }) {
  return (
    <div className="min-h-screen flex flex-col px-6 py-8 justify-center gap-6">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white text-3xl font-bold flex items-center justify-center shadow-lg shadow-emerald-500/25">
          {(childFirstName || '?')[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text leading-tight">
            Entre pra ver {childFirstName || 'seu filho'}
          </h1>
          <p className="text-sm text-textMuted mt-1.5">
            Sua conta já existe. É só entrar pra continuar acompanhando.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Link
          to="/login"
          className="tap w-full h-14 rounded-xl bg-primary text-white font-semibold inline-flex items-center justify-center"
        >
          Entrar na minha conta
        </Link>
        <p className="text-[11px] text-textMuted text-center">
          Use o mesmo Google ou email da primeira vez.
        </p>
      </div>

      <p className="text-xs text-textMuted text-center">
        Não consegue entrar? Fale com {driverLabel} — ele gera um link novo.
      </p>
    </div>
  );
}

function AlreadyUsed({ childFirstName }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
        <HeartHandshake size={30} className="text-emerald-700" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-text">Este convite já foi usado</h1>
        <p className="text-sm text-textMuted max-w-xs">
          Alguém já criou a conta {childFirstName ? `do ${childFirstName}` : ''}{' '}
          com este link. Se foi você, entre com a sua conta.
        </p>
      </div>
      <Link
        to="/login"
        className="text-sm font-semibold text-primary underline"
      >
        Entrar na minha conta
      </Link>
      <p className="text-xs text-textMuted max-w-xs">
        Se não foi você, avise o motorista — ele gera um link novo.
      </p>
    </div>
  );
}

function InviteBroken({ message }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
        <HeartHandshake size={30} className="text-amber-700" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-text">Não conseguimos abrir</h1>
        <p className="text-sm text-textMuted max-w-xs">{message}</p>
        <p className="text-sm text-textMuted max-w-xs">
          Peça um link novo pro motorista — ele gera na hora, na ficha da
          criança.
        </p>
      </div>
      {/* Com a frente: este é o caminho do responsável, e a tela de erro é
        * onde ele já está frustrado — não é hora de oferecer associação. */}
      <Link
        to="/login"
        state={{ frente: FRENTE_FAMILIA }}
        className="text-sm font-semibold text-primary underline"
      >
        Já tenho conta, quero entrar
      </Link>
    </div>
  );
}
