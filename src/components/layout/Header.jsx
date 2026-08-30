import { useState } from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { usePaymentsByParent } from '../../hooks/usePayments';
import ProfileMenu from './ProfileMenu';
import NotificationsSheet from '../notifications/NotificationsSheet';
import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';

/**
 * Header sticky comum às páginas autenticadas.
 *
 * Renderiza automaticamente bell (notificações) + menu de perfil no canto
 * direito quando há usuário logado. Pages podem passar `action` extra que
 * aparece ANTES dos ícones globais.
 *
 * Props:
 *   - title:        string
 *   - showBack:     bool — mostra seta de voltar (usa navigate(-1))
 *   - action:       ReactNode — botão/ícone custom à direita (opcional)
 *   - showGlobal:   bool (default true) — exibe bell + perfil
 */
export default function Header({
  title,
  showBack = false,
  // DE ONDE ELE VEIO, escrito. Uma seta sozinha diz "dá pra voltar", não diz
  // pra ONDE — e quem tem pouca familiaridade com app não arrisca um botão
  // cujo destino não está escrito: fica na tela, ou sai pela aba de baixo e
  // perde a rolagem e o filtro no caminho.
  backLabel = null,
  // Destino de EMERGÊNCIA, não destino padrão.
  //
  // `navigate(-1)` presume que existe história, e ela não existe quando a
  // pessoa chegou por notificação, link do WhatsApp ou recarregando a página:
  // ali a seta ou não faz nada, ou joga ela pra FORA do app.
  //
  // MAS NAVEGAR PRO DESTINO SEMPRE É PIOR, e foi o que esta tela fez desde que
  // o `backTo` entrou: `navigate(destino)` EMPILHA uma entrada nova. O
  // histórico virava Início → Escolas → Início, e o botão físico do Android
  // levava de volta pra Escolas — a pessoa apertava "voltar" e reencontrava a
  // tela de onde tinha acabado de sair. Voltar que anda pra frente é pior que
  // voltar que não funciona, porque ela tenta de novo.
  //
  // Agora o destino só entra quando não há história pra consumir.
  backTo = null,
  action = null,
  showGlobal = true,
  // A MARCA NO LUGAR DO TÍTULO — só onde a tela é "a casa" da pessoa.
  //
  // Nas duas telas iniciais o título era "Início", que não informa nada: a
  // pessoa sabe que está no início porque acabou de abrir o app. O espaço
  // rende mais mostrando de quem é o transporte — logo e nome que o motorista
  // escolheu. Nas telas internas o título continua sendo o nome da tela,
  // porque ali a pergunta volta a ser "onde eu estou".
  marca = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const isAuthed = !!user;
  const role = profile?.role;
  const basePath = role === 'admin' ? '/tio' : '/pai';

  // Hooks só rodam quando autenticado pra não disparar subscribes em /login
  return (
    /* O RECORTE DA TELA FAZ PARTE DO CABEÇALHO.
     *
     * O index.html declara `viewport-fit=cover`: o app pinta até a borda
     * física do aparelho. Sem devolver a faixa do sistema, no iPhone
     * instalado como app o título e o rosto do perfil ficam POR BAIXO do
     * relógio e da bateria — some justamente a linha que diz onde a pessoa
     * está. Em Android e desktop o env() vale 0 e nada muda.
     *
     * A faixa é padding do <header>, não do conteúdo: a barra continua
     * grudada no topo e a tarja do sistema fica com a cor do cabeçalho. */
    <header
      className="sticky top-0 z-20 bg-card border-b border-gray-100 print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div className="h-14 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={() => {
                // `history.state.idx` é o contador do React Router: 0 (ou
                // ausente) significa que esta é a primeira tela desta aba do
                // navegador — não há o que consumir com `navigate(-1)`.
                const temHistoria = (window.history.state?.idx ?? 0) > 0;
                if (temHistoria) navigate(-1);
                else if (backTo) navigate(backTo, { replace: true });
                else navigate(-1);
              }}
              aria-label={backLabel ? `Voltar para ${backLabel}` : 'Voltar'}
              className="-ml-1 py-1 pl-1 pr-1.5 tap text-textMuted inline-flex items-center gap-1 shrink-0"
            >
              <ArrowLeft size={22} />
              {backLabel && (
                /* Some abaixo de 400px: com título longo, o rótulo empurraria
                 * o nome da tela pras reticências — e saber ONDE ESTOU vem
                 * antes de saber de onde vim. */
                <span className="hidden min-[400px]:inline text-sm font-medium">
                  {backLabel}
                </span>
              )}
            </button>
          )}
          {marca ? (
            <MarcaOuTitulo titulo={title} />
          ) : (
            <h1 className="text-base font-semibold text-text truncate">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {action}
          {showGlobal && isAuthed && (
            <GlobalActions
              role={role}
              basePath={basePath}
              currentPath={location.pathname}
            />
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * A marca do motorista, com o título como rede de segurança.
 *
 * SUBCOMPONENTE PELO MESMO MOTIVO DO `GlobalActions`: o hook lê o perfil do
 * motorista (e, no lado do pai, abre uma assinatura). Chamado direto no
 * `Header`, isso rodaria em toda tela do app, inclusive nas que passam
 * `marca={false}` — a maioria. Aqui só roda quando a marca é pedida.
 *
 * SEM MARCA CADASTRADA, VOLTA O TÍTULO. O motorista que ainda não configurou
 * não pode ficar com um cabeçalho vazio, e as famílias dele muito menos.
 */
function MarcaOuTitulo({ titulo }) {
  const { nome, logoURL } = useMarcaDoTio();

  if (!nome && !logoURL) {
    return (
      <h1 className="text-base font-semibold text-text truncate">{titulo}</h1>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {logoURL && (
        <img
          src={logoURL}
          alt=""
          /* `alt` VAZIO de propósito: o nome vem escrito ao lado, e um leitor
           * de tela anunciando "logo da Tio Nino, Tio Nino" repete sem
           * acrescentar. Quando não há nome, o logo sozinho também não é
           * informação nova — o app inteiro é dele. */
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
      )}
      <h1 className="text-base font-semibold text-text truncate">
        {nome || titulo}
      </h1>
    </div>
  );
}

/**
 * Subcomponente que executa hooks somente quando autenticado — evita que o
 * Header dispare subscribes do Firestore em rotas públicas.
 */
function GlobalActions({ role, basePath, currentPath }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const isParent = role === 'parent';
  const { payments } = usePaymentsByParent(isParent ? user?.uid : null);
  const { unreadCount } = useNotifications({
    userId: user?.uid,
    payments: isParent ? payments : [],
    deriveFor: isParent ? 'parent' : 'admin',
  });

  const isOnNotifications = currentPath === `${basePath}/notifications`;
  const isOnProfile = currentPath === `${basePath}/profile`;

  return (
    <>
      {/* O SINO ABRE FOLHA, NÃO OUTRA TELA.
        * Ele existe no cabeçalho de todas as telas; navegar daqui custava a
        * rolagem, o filtro e o lugar de quem só queria dar uma olhada. A
        * exceção é quando ele JÁ está na página de notificações (chegou por
        * push ou link): ali a folha seria uma cópia do que está atrás. */}
      <button
        onClick={() =>
          isOnNotifications
            ? navigate(`${basePath}/notifications`)
            : setNotifOpen(true)
        }
        aria-label="Notificações"
        aria-haspopup="dialog"
        className={`relative p-2 tap rounded-lg ${
          isOnNotifications ? 'text-primary bg-primary/10' : 'text-textMuted'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {/* O rosto abre MENU, não outra tela: as ações que a pessoa vem
       * buscar aqui (sair, tutorial, suporte) cabem num menu, e ela não
       * perde o lugar onde estava. Ver ProfileMenu. */}
      <ProfileMenu role={role} basePath={basePath} active={isOnProfile} />

      <NotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
      />
    </>
  );
}
