import { useState } from 'react';
import { ArrowLeft, Bell, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotificacoesDaSessao } from '../../hooks/useNotifications';
import ProfileMenu from './ProfileMenu';
import NotificationsSheet from '../notifications/NotificationsSheet';
import AppSheet from '../common/AppSheet';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';
import { useAvisosDoCabecalho } from '../../context/AvisosDoCabecalhoContext';

/**
 * Header sticky comum às páginas autenticadas.
 *
 * Renderiza automaticamente bell (notificações) + menu de perfil no canto
 * direito quando há usuário logado.
 *
 * ⚠️ A BARRA SÓ TEM A NAVEGAÇÃO, E O TÍTULO MORA NA PÁGINA (04/10/2026,
 * aprovado pelo dono). A barra tinha uma linha só e chegava a seis peças —
 * Voltar, título, selo, a ação da tela, Falar, sino e perfil —, e como o lado
 * direito nunca encolhe, quem perdia era sempre o título: "Fin…" no
 * Financeiro, "Histó…" no histórico, dez letras de "Indicar outro motorista"
 * no celular de 320 px. Agora:
 *   - na barra, à esquerda, "← Voltar" (telas internas) ou a marca do
 *     motorista (abas); à direita, só o que existe em toda tela;
 *   - logo abaixo, o TÍTULO GRANDE da tela, que quebra a linha em vez de
 *     cortar, com a `action` da tela ao lado dele — ela é da tela, não do app.
 * O Início (`marca`) continua com a marca na barra e sem título grande.
 * `tituloNaBarra` é a exceção da ROTA, onde cada pixel de altura é da lista
 * de paradas e a barra tem folga para a palavra "Rota".
 *
 * Props:
 *   - title:        string
 *   - showBack:     bool — mostra seta de voltar (usa navigate(-1))
 *   - action:       ReactNode — a ação da tela, ao lado do título grande
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
  tituloNaBarra = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const isAuthed = !!user;
  const role = profile?.role;
  const basePath = role === 'admin' ? '/tio' : '/pai';
  // Os avisos do motorista (cobrança, teste, push) moram LOGO ABAIXO do
  // cabeçalho, não acima — ver `AvisosDoCabecalhoContext`. Fora do /tio é null.
  const avisos = useAvisosDoCabecalho();
  // Onde o título mora: na barra (Início e rota) ou na página (o resto).
  const tituloEmCima = marca || tituloNaBarra;

  // Hooks só rodam quando autenticado pra não disparar subscribes em /login
  return (
    <>
    {/* O RECORTE DA TELA FAZ PARTE DO CABEÇALHO.
     *
     * O index.html declara `viewport-fit=cover`: o app pinta até a borda
     * física do aparelho. Sem devolver a faixa do sistema, no iPhone
     * instalado como app o título e o rosto do perfil ficam POR BAIXO do
     * relógio e da bateria — some justamente a linha que diz onde a pessoa
     * está. Em Android e desktop o env() vale 0 e nada muda.
     *
     * A faixa é padding do <header>, não do conteúdo: a barra continua
     * grudada no topo e a tarja do sistema fica com a cor do cabeçalho. */}
    <header
      className={`filete-da-marca sticky top-0 z-20 bg-card border-b border-neutro print:hidden ${
        marca ? 'cabecalho-da-marca' : ''
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      {/* O TÍTULO É BRICOLAGE (`font-display`), como todo título de tela do
        * design system — e escrito na classe, não só herdado do `h1` do
        * index.css: a marca do motorista também mora aqui e precisa da mesma
        * voz quando vier num `h1` que alguém troque por `span`. */}
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
              // 48×48: é o botão mais usado de toda tela interna.
              className="-ml-2 tap text-primary inline-flex min-h-12 min-w-12 items-center justify-center gap-1 shrink-0"
            >
              <ArrowLeft size={22} />
              {/* SEMPRE "VOLTAR", NUNCA O NOME DA TELA (03/10/2026, decisão do
                * dono). A seta sozinha o público de 40+ não lê como botão, e
                * "← Financeiro" lia como um título a mais. "← Voltar" é a
                * palavra que ele procura. O `backLabel` continua só no
                * aria-label, para o leitor de tela dizer para onde vai. */}
              <span className="text-base font-semibold">Voltar</span>
            </button>
          )}
          {marca ? (
            <MarcaOuTitulo titulo={title} />
          ) : tituloNaBarra ? (
            <h1 className="font-display text-lg font-bold text-text truncate">
              {title}
            </h1>
          ) : (
            !showBack && isAuthed && <MarcaNaBarra />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {tituloEmCima && action}
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
    {avisos}
    {!tituloEmCima && title && (
      <div className="flex items-start justify-between gap-3 px-4 pt-4 print:hidden">
        <h1 className="min-w-0 font-display text-2xl font-extrabold leading-tight text-text">
          {title}
        </h1>
        {action && <div className="-mt-1 flex shrink-0 items-center gap-1">{action}</div>}
      </div>
    )}
    </>
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
 *
 * ⚠️ O SELO DO NÍVEL SAIU DAQUI (04/10/2026, decisão do dono): ele comia o
 * nome da marca e agora mora no menu do perfil (`ProfileMenu`).
 */
function MarcaOuTitulo({ titulo }) {
  const { nome, logoURL } = useMarcaDoTio();
  const { role } = useAuth();

  if (!nome && !logoURL) {
    return <h1 className="font-display text-lg font-bold text-text truncate">{titulo}</h1>;
  }

  // ⚠️ NO LADO DO RESPONSÁVEL, COM LOGO, SÓ A LOGO. "Falar com tia" ocupa o
  // espaço que o nome teria: com os dois, sobrava "T…" — medido em 390 px.
  // A logo é a marca; o nome vai para o leitor de tela.
  const soLogo = role === 'parent' && !!logoURL;

  return (
    <div className="flex items-center gap-2 min-w-0">
      {logoURL && <LogoDaMarca src={logoURL} />}
      <h1
        className={soLogo ? 'sr-only' : 'na-marca font-display text-lg font-bold text-text truncate'}
      >
        {nome || titulo}
      </h1>
    </div>
  );
}

/**
 * A marca nas ABAS sem Voltar (Financeiro, Mapa): a logo, ou o nome quando
 * não há logo. Não é título — o título da tela está logo abaixo, grande —,
 * então vai em `<span>`. Sem marca nenhuma, a barra fica só com os botões.
 */
function MarcaNaBarra() {
  const { nome, logoURL } = useMarcaDoTio();
  if (logoURL) return <LogoDaMarca src={logoURL} alt={nome || ''} />;
  if (nome) {
    return <span className="font-display text-lg font-bold text-text truncate">{nome}</span>;
  }
  return null;
}

/**
 * ⚠️ INTEIRA, NUNCA RECORTADA (03/10/2026). Era um quadrado de 32px com
 * `object-cover`: logo larga perdia as pontas ("racomr" no lugar do nome).
 * A altura é fixa e a largura acompanha a imagem até 72px (era 96 até
 * 04/10/2026; com o Falar ao lado não sobrava nome) — logo quadrada continua
 * quadrada, logo comprida aparece inteira, menor.
 *
 * `alt` VAZIO quando o nome vem escrito ao lado: um leitor de tela dizendo
 * "Tio Nino, Tio Nino" repete sem acrescentar.
 */
function LogoDaMarca({ src, alt = '' }) {
  // ⚠️ MAIOR DESDE 04/10/2026 (pedido do dono): 44 px de altura e até 120
  // de largura — era 32 e 72, e a marca quase não aparecia. Na faixa da cor
  // ela ganha uma pastilha branca (index.css), para logo de qualquer cor ler.
  return (
    <img
      src={src}
      alt={alt}
      className="pastilha-do-logo h-11 w-auto max-w-[120px] shrink-0 rounded-lg object-contain"
    />
  );
}

/**
 * Subcomponente que executa hooks somente quando autenticado — evita que o
 * Header dispare subscribes do Firestore em rotas públicas.
 */
function GlobalActions({ role, basePath, currentPath }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const isParent = role === 'parent';
  // ⚠️ O CABEÇALHO SÓ LÊ (03/10/2026). A escuta, o cartão do aviso novo
  // (`avisoNaTela`), o som e o push do aparelho moram no
  // `NotificacoesProvider`, montado no layout: aqui, cada troca de tela
  // derrubava a escuta e relia as 100 mais recentes do zero.
  const { unreadCount } = useNotificacoesDaSessao();

  const isOnNotifications = currentPath === `${basePath}/notifications`;
  const isOnProfile = currentPath === `${basePath}/profile`;

  return (
    <>
      {/* FALAR COM O MOTORISTA — só do lado do responsável, e no cabeçalho.
        *
        * É a saída de emergência dela, e emergência não pode ROLAR nem mudar
        * de lugar conforme o estado do dia. Estava num bloco no meio do
        * Início: quando ela mais precisa — a perua atrasou, o filho não foi
        * marcado como entregue — é justamente quando ela não vai procurar.
        * Aqui fica no mesmo pixel em toda tela dela, inclusive em `/pai/faltas`
        * e `/pai/map`, onde não existia.
        *
        * NUNCA DESABILITADO. Sem telefone cadastrado, o botão de antes ficava
        * a 50% de opacidade e não fazia nada — ela toca, nada acontece, e a
        * leitura é "o app travou". Agora ele sempre responde: ou abre o
        * WhatsApp, ou explica por que não dá e o que fazer. */}
      {isParent && <FalarComOMotorista />}
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
        // 44×44 de área de toque: era 36, abaixo do mínimo para quem toca
        // com o dedo grosso e com pressa.
        className={`relative flex h-12 w-12 items-center justify-center tap rounded-lg ${
          isOnNotifications ? 'text-primary bg-primaryChip' : 'na-marca text-textMuted'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center">
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

/**
 * O BOTÃO DE FALAR COM O MOTORISTA, no cabeçalho do responsável.
 *
 * O telefone vem do doc do motorista DELA — o `adminUid` da criança ativa.
 * Se ela tem filhos com motoristas diferentes, trocar de filho troca o
 * destino, que é o comportamento certo.
 *
 * SEM TELEFONE, ELE NÃO APAGA: explica. Botão desabilitado não é resposta —
 * ela toca, nada acontece, e conclui que o app travou. Pior, fica sem
 * NENHUM caminho até o motorista dentro do app, e é exatamente no dia ruim
 * que ela precisa dele.
 */
export function FalarComOMotorista({
  // GRANDE: o mesmo botão em largura cheia, para o pé de uma tela (o mapa).
  // Mesma regra do pequeno — nunca desabilitado; sem telefone, explica.
  grande = false,
}) {
  const { child } = useActiveChild();
  const { admin } = useAdminProfile(child?.adminUid);
  const [semTelefone, setSemTelefone] = useState(false);

  const digitos = String(admin?.phone || '').replace(/\D/g, '');
  const nome = admin?.marcaNome?.trim() || admin?.name?.split(' ')[0] || 'o motorista';
  // "FALAR COM TIO" OU "FALAR COM TIA" (04/10/2026, pedido do dono): é como
  // a família chama o motorista no portão. O gênero vem do primeiro acesso
  // dele; sem ele, fica só "Falar".
  const tratamento = tratamentoDoMotorista(admin?.gender);

  const tocar = () => {
    if (!digitos) {
      setSemTelefone(true);
      return;
    }
    const numero = digitos.startsWith('55') ? digitos : `55${digitos}`;
    window.open(`https://wa.me/${numero}`, '_blank', 'noopener');
  };

  return (
    <>
      {grande ? (
        <button
          type="button"
          onClick={tocar}
          className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-marca px-4 text-lg font-bold text-naMarca"
        >
          <MessageCircle size={22} />
          <span className="truncate">Falar com {nome}</span>
        </button>
      ) : (
      <button
        type="button"
        onClick={tocar}
        aria-label={`Falar com ${nome}`}
        // ⚠️ ÍCONE SOZINHO NÃO SE LÊ COMO "FALAR COM O MOTORISTA" (03/10/2026):
        // o balão é o mesmo desenho de "comentários" em mil apps. A palavra
        // fica SEMPRE; abaixo de 360px só o "com tio" cede, senão o botão
        // não cabe ao lado do "← Voltar". 48px de altura sempre, e nunca
        // desabilitado.
        className="tap flex h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primaryChip px-2.5 text-primary"
      >
        <MessageCircle size={20} />
        <span aria-hidden className="whitespace-nowrap text-base font-semibold">
          Falar
          {tratamento && <span className="hidden min-[360px]:inline"> com {tratamento}</span>}
        </span>
      </button>
      )}

      <AppSheet
        open={semTelefone}
        onClose={() => setSemTelefone(false)}
        title="Sem telefone cadastrado"
        icon={MessageCircle}
      >
        <div className="space-y-3 pb-1">
          <p className="text-sm leading-relaxed text-text">
            {nome} ainda não cadastrou o telefone dele aqui no app.
          </p>
          <p className="text-sm leading-relaxed text-textMuted">
            Por enquanto, fale com ele no WhatsApp — é o mesmo número que te
            mandou o link do convite.
          </p>
        </div>
      </AppSheet>
    </>
  );
}

/** 'tio' ou 'tia' pelo gênero do perfil do motorista; null sem ele. */
function tratamentoDoMotorista(gender) {
  if (gender === 'male') return 'tio';
  if (gender === 'female') return 'tia';
  return null;
}
