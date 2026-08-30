import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowRight,
  Bus,
  CalendarX2,
  Clock,
  Check,
  Link2,
  MapPin,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { functions } from '../firebase/config';
import { comPiso } from '../config/vitrine';
import { DEV_CITY, DEV_CNPJ } from '../config/developer';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../utils/papeis';
import Logo from '../components/common/Logo';
import Spinner from '../components/common/Spinner';
import LoginSheet from '../components/landing/LoginSheet';
import { FRENTE_FAMILIA, lembrarFrente } from '../utils/frentes';

/**
 * A PORTA DA FAMÍLIA — a home do responsável.
 *
 * POR QUE ELA EXISTE SEPARADA DA HOME DO MOTORISTA
 * As duas frentes do produto falam com públicos opostos. A home (`/`) vende
 * associação: taxa, vaga limitada, credibilidade de negócio, depoimento de
 * outro motorista. É a página certa pra quem está decidindo se entra como
 * parceiro.
 *
 * O responsável não está decidindo nada disso. Ele já tem motorista, já tem
 * filho na perua, e chega aqui em um de três estados: saiu da conta, errou a
 * URL, ou perdeu o link do WhatsApp. Nos três, o que ele precisa é ENTRAR —
 * não ser convencido. Mostrar "vaga limitada" pra ele é pior que inútil:
 * sugere que o lugar do filho dele está em risco.
 *
 * O QUE NÃO ENTRA AQUI, E É REGRA
 * Taxa, vaga, roleta, associação, contagem de associados, depoimento de
 * motorista — nada disso. E principalmente: NENHUMA ESCASSEZ. Sem prazo, sem
 * "últimas vagas", sem nada que sugira que o lugar do filho dele pode acabar.
 * Na home do motorista a escassez constrói credibilidade; aqui ela produz
 * medo sobre a vaga de uma criança.
 *
 * O registro é TRANQUILIDADE, não oportunidade. Frase curta, verbo no
 * presente, nada de superlativo.
 *
 * A EXCEÇÃO: O CONTADOR DE RESPONSÁVEIS (29/08/2026)
 * Esta regra dizia "sem contador", e valia pra qualquer número. O que faltava
 * era separar ESCASSEZ de PROVA SOCIAL, que não fazem a mesma coisa com quem
 * lê: "restam 2 vagas" assusta o pai porque fala da vaga DELE; "N responsáveis
 * usam" não fala da vaga de ninguém — diz que ele está no lugar certo, que é
 * a mesma tranquilidade que o resto da página persegue.
 *
 * O que continua proibido é número COM PRAZO ou COM LIMITE. Contador que sobe
 * é registro; contador que desce é ameaça, e ameaça aqui é sobre uma criança.
 *
 * O número tem piso — ver [src/config/vitrine.js](../config/vitrine.js), que
 * é onde a decisão está escrita e onde ela se desfaz.
 *
 * O QUE ENTRA, NESTA ORDEM
 *   1. Reconhecimento — a marca do motorista, não a da plataforma. A primeira
 *      linha diz que a perua do filho dele fica aqui. Fecha com o contador,
 *      que é prova ANTES do pedido, do mesmo jeito que a home do motorista faz.
 *   2. Entrar, grande e primeiro.
 *   3. "Perdi o link" — o modo de falha REAL dele. Ele não decora endereço de
 *      site; ele volta pelo link do WhatsApp. A resposta honesta é que o link
 *      não vence nem se gasta, então pedir de novo resolve.
 *   4. O que tem dentro, como tranquilidade e não como lista de recursos.
 *
 * ESTA PORTA É CLARA. A DO MOTORISTA É ESCURA. NÃO É DESCUIDO.
 *
 * Ela já foi escura, com o mesmo quase-preto e o mesmo cartão de vidro da
 * home do motorista, e o comentário aqui defendia isso como coerência: mesmo
 * produto, mesmo material. O argumento tinha um furo que só aparece quando se
 * olha o caminho dela em vez do código: ELA NUNCA VÊ A HOME DO MOTORISTA. A
 * comparação que a coerência servia não existe pra ninguém — o sistema ficava
 * coerente pra quem lê o repositório.
 *
 * O que ela vê é isto, e só isto: um link no WhatsApp, esta tela, e o app.
 * Então a única coerência que a alcança é entre a PORTA e o APP — e o app
 * dela é claro. A porta escura prometia visualmente um produto que não é o
 * que abre em seguida.
 *
 * E tem o motivo mais duro, que o index.html já reconhece pro preview do
 * link: mensagem de terceiro, link pelado, página escura e um botão pedindo
 * login é a forma exata de um golpe. Ela não precisa saber nomear isso pra
 * hesitar.
 *
 * As duas portas continuam com temperaturas diferentes, agora de propósito e
 * pelo motivo certo: a temperatura serve quem lê a porta, não o sistema. O
 * motorista está COMPRANDO — escuro, negócio, decisão. Ela está ENTRANDO EM
 * CASA.
 *
 * O ÂMBAR SAIU E NÃO VOLTA: `secondary` e `warning` eram o MESMO hex
 * (#F5A623). Âmbar é aviso no app inteiro — fatura vencida, criança sem
 * horário, falta marcada. Gastá-lo como enfeite na porta de entrada é queimar
 * um sinal que tem outro trabalho.
 */

/* O cartão desta porta é o mesmo cartão do app dela: branco sobre o cinza da
 * página. O vidro ficou só na home do motorista, junto com o escuro. */
const CARTAO = 'bg-card border border-border rounded-3xl shadow-sm';

/**
 * O que ele encontra dentro. Quatro, não seis: é o que ele realmente abre o
 * app pra fazer. Cada linha é uma frase, no presente, sem adjetivo.
 *
 * A ORDEM MUDOU, E ERA UM DESENCONTRO DE VERDADE.
 *
 * A lista prometia mensalidade, recados, avisar falta e contrato — e deixava
 * de fora as DUAS coisas que o app lidera. O cabeçalho do `HorarioDoDia` diz,
 * com essas palavras, que o horário é "a pergunta que traz o responsável até
 * aqui"; o painel da perua é o único bloco presente nos três estados do dia.
 * Nenhum dos dois estava aqui.
 *
 * A porta vendia contrato e comprovante; o app entrega "que horas eu desço" e
 * "onde está meu filho agora". Quem entra esperando uma coisa encontra outra
 * — e ela é melhor, o que é o tipo de desalinhamento de que ninguém reclama e
 * que todo mundo sente.
 *
 * Saíram "os recados" e "o contrato". Os dois continuam no app, e nenhum dos
 * dois é motivo de abrir o app amanhã de manhã.
 *
 * `destaque` marca as duas linhas que respondem "está tudo certo com meu
 * filho?" — as outras duas são consequência, não motivo.
 *
 * ATENÇÃO AO TEXTO DO RASTREIO: "onde a perua está agora", nunca "quantos
 * minutos faltam". A porta não pode prometer o número que o painel se recusa
 * a mostrar — foi por inventar esse minuto que a estimativa por linha reta
 * saiu do app duas vezes.
 */
const DENTRO = [
  {
    Icon: Clock,
    titulo: 'A hora de estar na porta',
    texto: 'O horário que o motorista combinou com você, para hoje.',
    destaque: true,
  },
  {
    Icon: Bus,
    titulo: 'Onde a perua está agora',
    texto: 'E um aviso no celular quando ela estiver chegando.',
    destaque: true,
  },
  {
    Icon: CalendarX2,
    titulo: 'Avisar que hoje não vai',
    texto: 'Sem depender de alguém ler mensagem no meio da rota.',
  },
  {
    Icon: Receipt,
    titulo: 'A mensalidade e o comprovante',
    texto: 'O que está pago, o que está em aberto, e o PIX pronto.',
  },
];

export default function Familia() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [loginAberto, setLoginAberto] = useState(false);
  const [vitrine, setVitrine] = useState(null);

  // Quem já tem sessão não precisa de porta — vai direto pro painel dele.
  // Inclui o motorista que caiu aqui por engano: ele vai pro /tio, não fica
  // lendo uma página escrita pra outra pessoa.
  // ESTA É A PORTA DELE — e o atalho instalado precisa saber disso.
  //
  // O manifesto do PWA tem um `start_url` só, `/`. O responsável instala daqui
  // e o atalho abre na página que vende associação: com sessão a home o
  // reencaminha, sem sessão ele fica lá. Registrar a porta na chegada resolve
  // o caso sem classificar ninguém — `/` continua sendo `/` pra quem digitar.
  useEffect(() => {
    lembrarFrente(FRENTE_FAMILIA);
  }, []);

  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(painelDe(profile), { replace: true });
    }
  }, [loading, profile, navigate]);

  // A vitrine é a mesma que a home do motorista usa, e traz duas coisas pra cá:
  // o nome do motorista (o reconhecimento da primeira linha — "a perua do Tio
  // Nino" diz muito mais a ele que "Alô Buzinou") e a contagem de responsáveis.
  //
  // Guardamos a RESPOSTA INTEIRA, não só o motorista. Extrair um pedaço aqui
  // foi o que fez a contagem precisar de uma segunda chamada quando ela
  // chegou; a resposta inteira no estado deixa o próximo dado ser só uma
  // linha de leitura.
  //
  // Falhar aqui não pode quebrar a porta: sem a vitrine, a página cai no texto
  // genérico, esconde o contador, e continua deixando ele entrar — que é a
  // única coisa que esta página precisa fazer.
  useEffect(() => {
    let vivo = true;
    httpsCallable(functions, 'getShowcase')()
      .then((res) => vivo && setVitrine(res.data || null))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size={32} className="text-primary" />
      </div>
    );
  }

  // Sessão sem doc de usuário (conta recém-criada, ou órfã) — deixa o fluxo
  // normal de login resolver em vez de mostrar a porta pra quem já entrou.
  // Leva a frente junto: sem isso o /login mostra as portas do motorista a
  // quem estava na porta da família.
  if (user && !profile) {
    return (
      <Navigate to="/login" replace state={{ frente: FRENTE_FAMILIA }} />
    );
  }

  const nomeMotorista = vitrine?.drivers?.[0]?.driverFirstName;

  // RESPONSÁVEIS COM CONTA — não é o número de famílias, e confundir os dois
  // faz esta tela e a home do motorista se contradizerem na frente de quem
  // abrir as duas.
  //
  // `families` (na home) conta CRIANÇA ativa. Este conta GENTE com login. O
  // segundo é sempre menor, por duas razões que o app tem de propósito: a mãe
  // de dois irmãos é UM responsável com DUAS crianças (`childIds`), e criança
  // cadastrada pelo motorista existe antes do pai resgatar o convite.
  //
  // `comPiso` devolve null quando a vitrine não respondeu — e é assim que o
  // contador some em vez de inventar número com o backend fora do ar.
  const responsaveis = comPiso(vitrine ? vitrine.responsaveis : null);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-mobile px-5 pb-16 pt-7">
        <header className="flex items-center justify-between">
          <Logo tone="color" height={26} />
        </header>

        {/* ── 1. RECONHECIMENTO ────────────────────────────────────────── */}
        <section className="mt-11">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-textMuted">
            área da família
          </p>
          <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.08] tracking-tight text-balance">
            {nomeMotorista ? (
              <>
                A perua do Tio {nomeMotorista}
                <br />
                fica aqui.
              </>
            ) : (
              <>
                A perua do seu filho
                <br />
                fica aqui.
              </>
            )}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-textMuted">
            Entre para ver a hora de hoje e acompanhar a perua. É a mesma
            conta que você criou pelo link do motorista.
          </p>

          {/* O contador. Quieto de propósito: uma linha, sem número gigante e
            * sem animação de contagem.
            *
            * A home do motorista anima o dela (`useCountUp`) porque lá o
            * número é ARGUMENTO — ele precisa ser notado por quem está
            * decidindo se compra. Aqui ele é só companhia pra quem já é
            * cliente e só quer entrar. Um número saltando na cara de quem veio
            * ver a mensalidade do filho é a página tentando vender algo que
            * ela não tem pra vender.
            *
            * Sem vitrine, não aparece nada — nem a linha, nem o traço. */}
          {responsaveis !== null && (
            <p className="mt-5 flex items-center gap-2.5 border-t border-border pt-4 text-[13px] leading-snug text-textMuted">
              <Users size={15} className="shrink-0 text-primary" />
              <span>
                <strong className="font-bold tabular-nums text-text">
                  {responsaveis}
                </strong>{' '}
                responsáveis acompanham a perua do filho por aqui.
              </span>
            </p>
          )}
        </section>

        {/* ── 2. ENTRAR ────────────────────────────────────────────────── */}
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setLoginAberto(true)}
            className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-lg shadow-primary/25"
          >
            Entrar na minha conta
            <ArrowRight size={18} />
          </button>
        </section>

        {/* ── 3. PERDI O LINK — o modo de falha real dele ───────────────── */}
        <section className={`mt-4 ${CARTAO} p-5`}>
          <p className="flex items-center gap-2 text-sm font-bold">
            <Link2 size={16} className="text-primary" />
            Perdeu o link?
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-textMuted">
            Pode pedir de novo sem preocupação: o link do convite não vence e
            não se gasta. É o mesmo link, sempre — e ele abre a sua conta
            direto, sem senha.
          </p>
          {/* SEM BOTÃO DE WHATSAPP AQUI, e é decisão, não falta.
            *
            * Pra ter o botão, `getShowcase` teria que devolver o telefone do
            * motorista — e ela é callable PÚBLICA, que roda sem login.
            * Telefone em endpoint aberto é telefone raspável, e essa mesma
            * função já teve que parar de devolver a foto de perfil dele pelo
            * mesmo motivo.
            *
            * E não faz falta: quem chega aqui recebeu o link pelo WhatsApp do
            * motorista, então já tem o contato. O que ele não tem é a certeza
            * de que pode pedir de novo — e é isso que o texto resolve. */}
          <p className="mt-3 flex items-center gap-2 text-[13px] text-textMuted">
            <MessageCircle size={14} className="shrink-0" />
            Chame o motorista no WhatsApp e peça o link de novo.
          </p>

          {/* QUEM NUNCA TEVE CONTA NÃO TINHA FRASE NENHUMA.
            *
            * "Perdeu o link?" atende quem já teve. A mãe que ouviu falar do
            * app e procurou sozinha caía num beco: tentava "Entrar" com um
            * email que não existe, recebia erro de login, e concluía que o
            * app está quebrado.
            *
            * A conta dela só pode nascer pelo convite — `redeemInvite` é o
            * único caminho, e é assim de propósito (foi por aí que a
            * auto-promoção se fechou). Então a saída não é um cadastro: é
            * dizer, sem rodeio, quem consegue criar a conta dela. */}
          <p className="mt-4 border-t border-border pt-3 text-[13px] leading-relaxed text-textMuted">
            <strong className="font-semibold text-text">
              Ainda não tem conta?
            </strong>{' '}
            Só o seu motorista pode criar a sua — peça o link pra ele. Não
            existe cadastro por aqui, e isso protege os dados do seu filho.
          </p>
        </section>

        {/* ── 4. O QUE TEM DENTRO — tranquilidade, não recurso ──────────── */}
        <section className="mt-9">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-textMuted">
            o que você encontra
          </h2>
          <ul className="mt-4 space-y-3">
            {DENTRO.map(({ Icon, titulo, texto, destaque }) => (
              <li
                key={titulo}
                className={`flex gap-3.5 rounded-3xl border p-4 ${
                  destaque
                    ? 'border-primaryBorder bg-primarySoft'
                    : 'border-border bg-surface'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    destaque ? 'bg-primaryChip' : 'bg-neutro'
                  }`}
                >
                  <Icon size={18} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{titulo}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-textMuted">
                    {texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── O RODAPÉ LEGAL, QUE FALTAVA JUSTAMENTE AQUI ────────────────
          *
          * A porta do motorista tinha LGPD, Termos, Privacidade e CNPJ. Esta
          * não tinha NADA — e é aqui que está a pessoa cujos dados, e os do
          * filho (endereço, foto, escola), vivem no sistema. Estava invertido
          * em relação a quem mais precisa da informação.
          *
          * Continua sem "seja parceiro" e sem link pra `/`: o responsável não
          * é público de aquisição, e essa regra vale no rodapé também. O que
          * entra é o que a lei e a confiança pedem, nada de venda. */}
        <footer className="mt-10 space-y-5 border-t border-border pt-7">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-textMuted">
              Todos os dados são tratados conforme a LGPD. Endereço e
              localização só aparecem pra quem tem vínculo.
            </p>
          </div>

          <div className="space-y-1.5 text-[11px] text-textMuted">
            <p className="flex items-center gap-2">
              <MapPin size={13} className="shrink-0 text-primary" />
              {DEV_CITY}
            </p>
            <p className="flex items-center gap-2">
              <Check size={13} className="shrink-0 text-primary" />
              <span className="font-mono">CNPJ {DEV_CNPJ}</span>
            </p>
          </div>

          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-3 text-[11px] text-textMuted">
              <Link to="/termos" className="hover:underline">
                Termos de Uso
              </Link>
              <span aria-hidden>·</span>
              <Link to="/privacidade" className="hover:underline">
                Privacidade
              </Link>
            </div>
            <p className="text-[12px] leading-relaxed text-textMuted">
              Alô Buzinou — o transporte escolar do seu filho, organizado.
            </p>
          </div>
        </footer>
      </div>

      {/* publico="familia" é o que impede a folha de oferecer o cadastro
        * de motorista a quem entrou pela porta do responsável. */}
      <LoginSheet
        open={loginAberto}
        onClose={() => setLoginAberto(false)}
        publico="familia"
      />
    </div>
  );
}
