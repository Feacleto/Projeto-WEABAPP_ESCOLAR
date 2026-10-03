import { useEffect, useState } from 'react';
import { FRENTE_FAMILIA } from '../dominio/vitrine/frentes';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  BadgeCheck,
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
import {
  getInvitePreview,
  normalizeInviteCode,
  MENSAGEM_DO_CONVITE_RECUSADO,
} from '../services/inviteCodeService';
import { redeemInvite } from '../services/authService';
import { formatCurrency, doDa } from '../compartilhado/formatters';
import {
  isInAppBrowser,
  isIOS,
  openForAuth,
  openInExternalBrowser,
} from '../compartilhado/browserEnv';

/* Marca que a ponte automática já foi tentada NESTA sessão da webview.
   Sem isso, quem escolheu ficar aqui seria empurrado de novo a cada
   recarga — e insistir depois de um 'não' é o que faz a pessoa fechar. */
const CHAVE_DA_PONTE = 'ab_ponte_tentada';

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

  /* ── A PONTE PRO NAVEGADOR DE VERDADE, AGORA AUTOMÁTICA ──────────────
   *
   * ESTE É O CAMINHO MAIS PERCORRIDO DO APP, e ele estava quebrado pela
   * metade. A mãe não guarda o endereço do site: ela volta na conversa do
   * WhatsApp e toca no MESMO link, semana após semana. E o WhatsApp abre
   * numa webview embutida, onde as duas coisas de que ela depende falham:
   *
   *   1. O Google recusa OAuth ali (`disallowed_useragent`) — e o Google é
   *      a base do app. Dentro da webview a porta principal está fechada,
   *      e o app chega a esconder o botão pra não entregar erro.
   *   2. O armazenamento é separado do Chrome. A sessão dela VIVE no
   *      Chrome, então aqui dentro ela aparece deslogada — e o app pedia
   *      login justamente na única tela onde o Google não aparece.
   *
   * Sair pro navegador de verdade resolve os dois de uma vez: lá a sessão
   * já existe, `preview.status` volta 'yours' e ela cai direto na criança,
   * sem digitar nada. Era esse o desfecho que a webview impedia.
   *
   * ⚠️ SEM `?auth=1`, DE PROPÓSITO. `openForAuth` leva pra folha de login,
   * e é o certo quando ela TOCOU numa ação. Aqui não: ela pode já estar
   * logada do outro lado, e abrir folha de login por cima de sessão válida
   * é pedir senha a quem não precisa de senha nenhuma.
   *
   * ⚠️ E É ANUNCIADA, NÃO SILENCIOSA. Trocar de app sozinho, num link sobre
   * o filho dela, parece golpe — e parte das pessoas fecha e não volta.
   * Um segundo dizendo o que vai acontecer transforma susto em
   * continuidade. Foi por isso que o redirecionamento no carregamento
   * tinha sido descartado; o aviso é o que o torna possível.
   *
   * ⚠️ NO IPHONE PODE NÃO SAIR DO LUGAR, e isso não tem conserto: a Apple
   * não tem equivalente do `intent://`, e `googlechrome://` só pega se o
   * Chrome estiver instalado. Por isso o prazo de 1,5s devolve a prévia
   * aqui mesmo — quem não saiu segue no fluxo normal, com a ponte manual
   * e o login por email, que funcionam dentro da webview. */
  const [saindoDaWebview, setSaindoDaWebview] = useState(() => {
    if (typeof window === 'undefined' || !isInAppBrowser()) return false;
    try {
      return sessionStorage.getItem(CHAVE_DA_PONTE) !== '1';
    } catch {
      // Modo privado ou storage bloqueado: tentar é melhor que não tentar.
      return true;
    }
  });

  useEffect(() => {
    if (!saindoDaWebview) return;
    try {
      sessionStorage.setItem(CHAVE_DA_PONTE, '1');
    } catch {
      /* Sem storage a única perda é tentar de novo numa recarga. */
    }
    openInExternalBrowser();
    const t = setTimeout(() => setSaindoDaWebview(false), 1500);
    return () => clearTimeout(t);
  }, [saindoDaWebview]);

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

  /* Antes de tudo, inclusive do erro: se o link está quebrado, a mensagem
     também é melhor lida no navegador onde ela vai ficar. */
  if (saindoDaWebview) return <SaindoDaWebview />;

  if (loadError) return <InviteBroken message={loadError} />;

  if (!preview || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner size={30} className="text-primary" />
        <p className="text-sm text-textMuted">Abrindo o convite...</p>
      </div>
    );
  }

  // A marca primeiro: é o nome que a família usa. `companyName` é o nome civil
  // do contrato, e "José Aparecido da Silva te convidou" soa a cobrança.
  const driverLabel =
    preview.marcaNome ||
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

  // ⚠️ O 'taken' SAIU (03/10/2026). O servidor respondia "vinculado a outra
  // conta" com o primeiro nome da criança a qualquer um — quem varria códigos
  // ganhava a confirmação e um nome. Agora "já usado", "não existe" e
  // "venceu" chegam como a MESMA recusa, e quem é a família voltando sem
  // sessão (limpou o navegador, trocou de celular) acha na tela de recusa o
  // "entre com sua conta" — `InviteBroken`, logo abaixo.

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
        childGender={preview.childGender}
        reason={pendingAction?.reason}
        onSuccess={() => finish(pendingAction?.destination)}
      />
    </>
  );
}

/**
 * O segundo em que o app avisa que vai trocar de navegador.
 *
 * Não é tela de espera — é o aviso que impede a troca de app de parecer
 * golpe. Diz O QUE vai acontecer antes do POR QUÊ, porque o motivo sozinho
 * não prepara ninguém pra ver outro aplicativo abrir sozinho.
 *
 * E o motivo é dito no ganho dela ('seu acesso fica salvo'), não no nosso
 * ('a webview tem armazenamento separado'), que não quer dizer nada pra
 * quem está com o filho na porta da escola.
 */
function SaindoDaWebview() {
  /* No Android abrimos o Chrome nominalmente. No iPhone depende do que ela
     tem instalado, e prometer 'Safari' seria mentira quando o
     `googlechrome://` pega — então lá a frase não promete marca. */
  const destino = isIOS() ? 'no navegador do celular' : 'no Chrome';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center">
      <Spinner size={30} className="text-primary" />
      <div className="space-y-1.5">
        <p className="text-base font-bold text-text">Abrindo {destino}</p>
        <p className="text-sm text-textMuted leading-relaxed">
          É lá que sua conta do Google funciona — e é onde seu acesso fica
          salvo pra próxima vez.
        </p>
      </div>
    </div>
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
      <header className="bg-gradient-to-br from-primary via-primary to-primaryDark text-white px-6 pt-9 pb-7">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 border border-white/25 rounded-full px-3 py-1">
          <Bus size={13} />
          {driverLabel}
        </span>
        <h1 className="text-2xl font-extrabold leading-tight mt-4">
          O transporte {preview.childFirstName ? doDa(preview.childFirstName, preview.childGender) : 'do seu filho'}, aqui no celular
        </h1>
        <p className="text-white/85 mt-2 text-sm leading-relaxed">
          {driverLabel} te convidou pra acompanhar mensalidade e recados num
          lugar só.
        </p>

        {/* O SELO — decisão 6, e é aqui que ela encosta na família.
          *
          * ⚠️ A AUSÊNCIA NÃO VIRA AVISO, e isso é a metade importante da
          * regra. Quem não enviou o alvará NÃO é suspeito: o modelo parte de
          * que esta família já conhece este motorista offline — a plataforma
          * não apresenta ninguém a ninguém. Um alerta aqui cobraria dela uma
          * desconfiança que não é dela, e faria a plataforma de avalista de
          * quem ela não conhece.
          *
          * Então: tem selo, aparece. Não tem, não aparece NADA. A pressão é
          * social — quem tem, exibe, e é isso que faz o vizinho querer o dele.
          *
          * E ele NÃO afirma segurança. A plataforma não inspeciona van, não
          * confere CNH e não treina ninguém; ela conferiu um papel, numa data,
          * e é exatamente isso que a frase diz. Ver `marca/promessas.js`. */}
        {preview.selo && (
          <p className="mt-4 inline-flex items-start gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs leading-relaxed text-white">
            <BadgeCheck size={14} className="mt-0.5 shrink-0" />
            <span>
              {preview.selo.texto}
              {preview.selo.conferidoEm && (
                <span className="block text-white/70">
                  conferido pela plataforma em {preview.selo.conferidoEm}
                </span>
              )}
            </span>
          </p>
        )}
      </header>

      <main className="flex-1 px-6 py-6 space-y-4">
        {/* O gancho: a conta DELE, concreta */}
        {p ? (
          <button
            type="button"
            onClick={() =>
              onAction({ reason: 'ver e pagar a mensalidade', destination: '/pai/finance' })
            }
            className="tap w-full text-left bg-card rounded-2xl p-4 shadow-rest space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primaryChip text-primary flex items-center justify-center shrink-0">
                <Wallet size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="rotulo">
                  mensalidade em aberto
                </p>
                <p className="text-2xl font-extrabold text-text leading-tight mt-0.5">
                  {formatCurrency(p.amount)}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    p.overdue ? 'text-dangerText font-semibold' : 'text-textMuted'
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
            <div className="bg-card rounded-2xl p-4 shadow-rest">
              <p className="rotulo">
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
          className="tap w-full text-left bg-card rounded-2xl p-4 shadow-rest flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-warningChip text-warningText flex items-center justify-center shrink-0">
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
        <div className="bg-sunken border border-border rounded-2xl p-4 space-y-2.5">
          <p className="rotulo">
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
        <p className="text-xs text-textMuted text-center">
          Um toque com o Google. Não precisa digitar código nenhum.
        </p>
      </main>

      <footer className="px-6 py-5 border-t border-border text-center">
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

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 justify-center gap-6">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary text-white text-3xl font-bold flex items-center justify-center shadow-rest">
          {(preview.childFirstName || '?')[0].toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-text leading-tight">
          Adicionar {preview.childFirstName} à sua conta?
        </h1>
        <p className="text-sm text-textMuted">Convite de {driverLabel}</p>
      </div>
      <div className="bg-card rounded-2xl p-4 text-sm text-text shadow-rest">
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

/* ─────────────── Estado de recusa ─────────────── */

/**
 * O convite não abriu — e a tela não diz POR QUÊ, de propósito (03/10/2026).
 *
 * O servidor dá a mesma resposta para link que não existe, que já foi usado
 * e que venceu (15 dias): dizer qual dos três era confirmava a quem varre
 * códigos que ele acertou um. Então a tela serve aos dois casos reais ao
 * mesmo tempo:
 *
 *  - a família que ainda não entrou: pede um link novo ao motorista, que
 *    gera na hora, na ficha da criança;
 *  - a família que JÁ entrou e voltou sem sessão (limpou o navegador, trocou
 *    de celular, abriu fora do WhatsApp): é só entrar com a conta dela. Esse
 *    era o caso mais comum do antigo "já foi usado", e ele continua tendo
 *    porta — o botão maior da tela.
 */
function InviteBroken({ message }) {
  const recusado = message === MENSAGEM_DO_CONVITE_RECUSADO;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-warningChip flex items-center justify-center">
        <HeartHandshake size={30} className="text-warningText" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text">
          {recusado ? 'Este convite não vale mais' : 'Não conseguimos abrir'}
        </h1>
        <p className="text-base text-textMuted max-w-xs">
          {recusado
            ? 'Peça um link novo ao motorista — ele gera na hora, na ficha da criança.'
            : message}
        </p>
      </div>
      {/* Com a frente: este é o caminho do responsável, e a tela de erro é
        * onde ele já está frustrado — não é hora de oferecer associação. */}
      <div className="w-full max-w-xs space-y-2">
        <Link
          to="/login"
          state={{ frente: FRENTE_FAMILIA }}
          className="tap w-full h-14 rounded-2xl bg-primary text-white font-semibold inline-flex items-center justify-center shadow-focus"
        >
          Entrar com minha conta
        </Link>
        <p className="text-sm text-textMuted">
          Se você já entrou antes, é só entrar com sua conta.
        </p>
      </div>
    </div>
  );
}
