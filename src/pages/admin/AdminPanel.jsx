import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  BarChart3,
  Bus,
  Check,
  CircleDollarSign,
  LogOut,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  X,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import AguardandoAprovacao from '../../components/admin/AguardandoAprovacao';
import TaxaTab from './TaxaTab';
import FunilTab from '../../components/admin/FunilTab';
import { functions } from '../../firebase/config';
import { Stars } from '../../components/landing/ReviewsBlock';
import { labelDaOpcao } from '../../components/feedback/surveyOptions';
import { useAuth } from '../../hooks/useAuth';
import {
  watchPlatformConfig,
  setReviewWindow,
  janelaAberta,
} from '../../services/platformConfigService';
import {
  getPlatformOverview,
  getSurveyResults,
  mesAtual,
} from '../../services/adminMetricsService';
import { setLeadStatus, watchDriverLeads } from '../../services/waitlistService';
import { logout } from '../../services/authService';
import { CLOUD_FUNCTIONS_ENABLED } from '../../config/capabilities';
import { devWhatsAppLink } from '../../config/developer';

/**
 * Painel do dono — /admin
 *
 * A ÚNICA TELA DE MESA DO PRODUTO.
 * O app inteiro é mobile-first porque motorista e responsável o usam em pé, na
 * rua, com uma mão. Esta tela não: é onde se negocia taxa, se fecha o mês e se
 * abre número numa reunião — trabalho sentado, em monitor. Então aqui a ordem
 * se inverte: o layout é pensado pra largura, e o celular é o caso que precisa
 * continuar funcionando (dá pra aprovar um parceiro no ônibus), não o que
 * manda no desenho.
 *
 * Na prática: conteúdo dentro de `max-w-6xl` centralizado — texto que ocupa
 * 1.900px de largura não se lê, se varre —, abas numa fileira só a partir de
 * `sm`, e as fichas de número abrindo em quatro colunas em `lg`.
 *
 * CINCO ABAS, E O QUE CADA UMA RESPONDE
 * 1. Visão geral: o tamanho real da coisa (usuários, crianças, dinheiro que
 *    passou pelo app). É o que se leva pra uma conversa de investimento.
 * 2. Funil: a prospecção comercial em colunas, e o orçamento que nasce dela —
 *    salvar a negociação já emite o contrato pro associado aceitar.
 * 3. Taxa: a régua da casa, a negociação de cada parceiro e o fechamento das
 *    faturas do mês. É aqui que a receita da plataforma deixa de ser zero.
 * 4. Fila: os motoristas pedindo acesso (`waitlistDrivers`), com
 *    pendente → contatado → aprovado / recusado. NÃO é o funil da aba 2: ali
 *    é registro comercial, aqui é a porta do app. Separadas de propósito —
 *    ver o cabeçalho de `funilService`.
 * 5. Pesquisa: o que os usuários responderam — inclusive as avaliações de
 *    responsável, que nunca vão pra home mas dizem se o app está servindo a
 *    ponta que não paga pela ferramenta.
 *
 * GMV NÃO É RECEITA — e o painel não deixa confundir
 * O dinheiro que passa entre pai e motorista dentro do app é GMV (volume).
 * A receita do Alô Buzinou é a taxa de associação que ele cobra do motorista,
 * e ela é outra coisa e outro sentido. Somar as duas numa métrica só é o erro
 * clássico de valuation de marketplace, e é exatamente o número que um
 * investidor sério vai pedir pra abrir.
 *
 * A receita continua ZERO enquanto nenhuma fatura for fechada na aba Taxa: o
 * cartão amarelo da Visão geral lê `faturasParceiro`, não a negociação. Acordo
 * combinado e não faturado não é receita — e o painel não antecipa.
 *
 * O GATE AQUI É DE PRODUTO, NÃO DE SEGURANÇA
 * Esta tela só aparece pra quem tem `superAdmin: true` no doc de usuário. Só
 * que TODO usuário com role 'admin' já pode ler estes dados pelas rules —
 * então esconder a tela não protege nada, só evita mostrar o negócio inteiro
 * pra um parceiro. Segurança de verdade é custom claim + rules dedicadas:
 * está no brief de arquitetura.
 */
export default function AdminPanel() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('geral');

  const [ov, setOv] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    let alive = true;
    getPlatformOverview()
      .then((d) => alive && setOv(d))
      .catch(() => alive && setOv(false));
    getSurveyResults()
      .then((d) => alive && setSurvey(d))
      .catch(() => alive && setSurvey(false));
    const unsub = watchDriverLeads(
      (l) => alive && setLeads(l),
      () => alive && setLeads([])
    );
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const marcar = async (lead, status) => {
    try {
      await setLeadStatus(lead.id, status, user?.uid);
      toast.success(
        status === 'approved'
          ? 'Marcado como aprovado. Falta provisionar a conta.'
          : 'Atualizado.'
      );
    } catch (err) {
      toast.error(err.message || 'Não deu pra atualizar.');
    }
  };

  return (
    /* `data-painel="web"` é o que solta o teto de 480px do #root — a regra
     * mora em index.css, junto do teto que ela abre. Ver lá o porquê. */
    <div data-painel="web" className="min-h-screen flex flex-col bg-bg">
      {/* Tampa escura — mesma regra das outras portas do produto. */}
      <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-5 pb-6 pt-5 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-80 animate-glow-drift"
            style={{
              background:
                'radial-gradient(110% 80% at 10% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
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

        <div className="relative mx-auto w-full max-w-6xl">
          {/* SAIR, E NÃO "PAINEL DO MOTORISTA".
            * Aqui havia um link pro /tio, e ele virou porta fechada quando o
            * dono deixou de ser motorista: o `PrivateRoute` devolve ele pra
            * cá, então o toque não fazia nada — o pior tipo de botão.
            *
            * Trocar por "sair" não é só tapar o buraco. O /admin é a ÚNICA
            * tela do dono: ele não tem /tio, não tem aba de perfil, e sem
            * isto não existia caminho pra encerrar a sessão sem limpar o
            * navegador. */}
          <button
            type="button"
            onClick={async () => {
              try {
                await logout();
                navigate('/login', { replace: true });
              } catch {
                toast.error('Não deu pra sair. Tente de novo.');
              }
            }}
            className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
          >
            <LogOut size={15} /> Sair
          </button>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">
            só pra você
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Painel do dono
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {profile?.name ? `Oi, ${profile.name.split(' ')[0]}. ` : ''}
            Parceiros, motoristas, uso da plataforma e pesquisa.
          </p>
        </div>
      </header>

      <div
        aria-hidden
        className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary"
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-5 sm:px-6">
        {/* Abas — UMA FILEIRA NA WEB, DUAS NO CELULAR.
          *
          * Esta tela é de mesa: é onde se negocia, se fecha mês e se abre
          * número numa reunião. Em tela larga as cinco abas cabem numa linha
          * e é assim que elas ficam.
          *
          * No celular, cinco rótulos em 320px viram texto ilegível — e a saída
          * comum, a tira que rola, esconde o fim: quem não arrasta nunca
          * descobre que existe mais. Foi assim que a taxa e o funil ficaram
          * invisíveis por tanto tempo, só que ali eles nem estavam na tela.
          *
          * A quebra separa o que É o negócio (o dinheiro e quem vai pagar) do
          * que CHEGA nele (a fila de inscritos e o que os usuários responderam). */}
        <div className="mb-5 space-y-1 rounded-2xl bg-neutro p-1 sm:flex sm:space-y-0 sm:gap-1">
          {[
            [
              ['geral', 'Visão geral'],
              ['funil', 'Funil'],
              ['taxa', 'Taxa'],
            ],
            [
              ['parceiros', 'Fila'],
              ['pesquisa', 'Pesquisa'],
            ],
          ].map((fileira, i) => (
            <div
              key={i}
              // `flex-[3]` e `flex-[2]` e não `flex-1`: lado a lado, as duas
              // fileiras têm 3 e 2 abas, então dividir o espaço meio a meio
              // deixaria as duas da direita mais largas que as três da
              // esquerda. Proporcional ao número de abas, todas ficam iguais.
              className={`grid gap-1 ${
                fileira.length === 3
                  ? 'grid-cols-3 sm:flex-[3]'
                  : 'grid-cols-2 sm:flex-[2]'
              }`}
            >
              {fileira.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`tap rounded-xl py-2.5 text-xs font-bold transition-colors ${
                    tab === id
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-textMuted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {tab === 'geral' && <Geral ov={ov} onVerFila={() => setTab('parceiros')} />}
        {tab === 'funil' && <FunilTab />}
        {tab === 'taxa' && <TaxaTab />}
        {tab === 'pesquisa' && <Pesquisa s={survey} />}
        {tab === 'parceiros' && <Parceiros leads={leads} onMarcar={marcar} />}
      </main>
    </div>
  );
}

/* ─────────────── aba 1: visão geral ─────────────── */

function Geral({ ov, onVerFila }) {
  if (ov === null) return <Carregando />;
  if (ov === false) return <Erro />;

  return (
    <div className="space-y-5">
      <section>
        <Titulo icon={Users}>Tamanho da base</Titulo>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Usuários no app" value={ov.usuarios} />
          <Tile label="Crianças ativas" value={ov.criancas} />
          <Tile label="Motoristas parceiros" value={ov.motoristas} tone="emerald" />
          <Tile label="Responsáveis" value={ov.responsaveis} />
        </div>
      </section>

      <section>
        <Titulo icon={CircleDollarSign}>Dinheiro que passou pelo app</Titulo>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="GMV total" value={moeda(ov.gmvTotal)} tone="emerald" />
          <Tile label={`GMV de ${mesAtual()}`} value={moeda(ov.gmvMes)} />
          <Tile label="Ticket médio / criança" value={moeda(ov.ticketMedio)} />
          <Tile
            label="Receita Alô Buzinou"
            value={moeda(ov.receitaPropria)}
            tone="warning"
          />
        </div>

        {/* A distinção que decide valuation. Fica escrita na tela pra não
          * depender de alguém lembrar dela na hora da reunião. */}
        <div className="mt-2 rounded-2xl border border-warningBorder bg-warningSoft p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
            <TrendingUp size={15} className="text-warning" />
            GMV não é receita
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warningText/80">
            <strong>{moeda(ov.gmvTotal)}</strong> é o volume que passou entre
            pai e motorista dentro do app — é o que prova que o produto está no
            meio de uma transação real. A receita do Alô Buzinou é{' '}
            <strong>{moeda(ov.receitaPropria)}</strong>: a taxa de associação
            que os parceiros já pagaram — o modelo apresentado a eles, que
            cobre a administração e a manutenção da estrutura. Os dois números
            importam pra valuation por motivos diferentes: GMV mostra o mercado
            que você já toca; a taxa mostra que você sabe capturar parte dele.
          </p>

          {/* FATURADO NÃO É RECEBIDO, e a diferença aparece só quando existe.
            * Num painel que se abre pra decidir, uma linha permanente de
            * "R$ 0,00 em aberto" vira ruído que se aprende a pular — e aí ela
            * não é vista no dia em que passa a ter número. */}
          {ov.receitaEmAberto > 0 && (
            <p className="mt-2 border-t border-warningBorder/70 pt-2 text-xs leading-relaxed text-warningText/80">
              Mais <strong>{moeda(ov.receitaEmAberto)}</strong> estão faturados
              e não recebidos. Não entram na receita porque o dinheiro não caiu
              — é a mesma linha que separa “o pai disse que pagou” de “o
              pagamento entrou”.
            </p>
          )}
          {ov.receitaPropria === 0 && ov.receitaEmAberto === 0 && (
            <p className="mt-2 border-t border-warningBorder/70 pt-2 text-xs leading-relaxed text-warningText/80">
              Ainda é zero porque nenhuma fatura foi fechada. A régua e a
              negociação vivem na aba <strong>Taxa</strong>; a receita começa a
              existir quando o mês é fechado lá.
            </p>
          )}
        </div>
      </section>

      <section>
        <Titulo icon={Bus}>Fila de parceiros</Titulo>
        {/* Número que não leva a lugar nenhum é número que ninguém usa:
          * saber que há 3 motoristas esperando só serve se der pra abrir
          * a fila e decidir sobre eles.
          *
          * TROCA DE ABA, e não navega. A fila tinha duas casas — esta ficha
          * levava pra /admin/parceiros enquanto a aba ao lado mostrava a
          * mesma coleção. Uma tela só: o dono decide sem sair de onde está. */}
        <button
          type="button"
          onClick={onVerFila}
          className="tap w-full text-left"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex-1">
              <p className="text-xl font-extrabold tabular-nums tracking-tight text-text">
                {ov.filaParceiros}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-textMuted">
                Motoristas pedindo acesso — toque pra aprovar ou recusar
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-textMuted" />
          </div>
        </button>
      </section>

      <section>
        <Titulo icon={ShieldCheck}>Manutenção</Titulo>
        <PeriodoDeAvaliacao />
        {/* A limpeza de privacidade é `httpsCallable`, e não existe function
          * no ar neste projeto (Cloud Functions API desativada). Com o botão
          * visível, "Verificar" só produz um toast de erro — e erro em botão
          * de manutenção faz quem aperta desconfiar do DADO, não do ambiente.
          * A janela de avaliação acima FICA: ela é Firestore direto. */}
        {CLOUD_FUNCTIONS_ENABLED && <PrivacidadeDosDepoimentos />}
      </section>
    </div>
  );
}

/**
 * Recolher nome completo e foto sem consentimento dos depoimentos antigos.
 *
 * POR QUE ISTO EXISTE COMO BOTÃO
 * A correção do vazamento (o serviço passou a gravar só o primeiro nome)
 * valia da correção pra frente. Documento gravado ANTES continua com nome
 * completo — e depoimento público é legível sem login, então o dado antigo
 * seguia exposto. A limpeza é uma Cloud Function (as rules proíbem update em
 * `feedbacks` pra TODOS, inclusive admin, então só o Admin SDK apaga campo).
 *
 * Só que callable admin-only não se chama pelo console do Firebase. Sem um
 * botão, a correção existia e ninguém podia rodar — que é o mesmo que não
 * existir. Este é o botão.
 *
 * DUAS REGRAS QUE ELE SEGUE
 * 1. Verificar antes de aplicar, sempre. A função é dry-run por padrão e o
 *    "aplicar" só aparece depois de existir um número.
 * 2. Nenhum nome aparece aqui. O relatório da função devolve de propósito só
 *    o que SERÁ feito, sem os nomes — repetir o dado vazado na tela e no log
 *    criaria um terceiro lugar com o vazamento, com retenção própria.
 */
/**
 * O PERÍODO DE AVALIAÇÃO — o interruptor que o dono liga e desliga.
 *
 * POR QUE ISTO É UMA JANELA, E NÃO UM PEDIDO PERMANENTE
 * O convite pra avaliar ficava no topo do painel do motorista o ano inteiro.
 * Pedido que nunca sai vira paisagem: ele aprende a não ler aquele pedaço da
 * tela, e junto com o pedido some tudo que a gente colocar ali depois. Com
 * janela, o cartão volta a ser evento — aparece quando há campanha e some
 * quando ela acaba.
 *
 * O PRAZO NÃO É ENFEITE
 * Sem data-limite, um período aberto e esquecido é exatamente o estado
 * anterior, só que com mais passos. O campo aceita vazio ("deixa aberto até
 * eu fechar"), mas o caminho fácil é pôr uma data.
 *
 * Escrever aqui exige `isOwner()` nas rules. Motorista não alcança.
 */
function PeriodoDeAvaliacao() {
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => watchPlatformConfig(setConfig), []);

  const aberta = !!config?.reviewOpen;
  const ativa = janelaAberta(config);
  const ateISO = (() => {
    const d = config?.reviewUntil?.toDate?.() || config?.reviewUntil;
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
  })();

  const salvar = async (patch) => {
    setSalvando(true);
    try {
      await setReviewWindow({ aberta, ate: ateISO || null, ...patch });
      toast.success('Período atualizado.');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Você é o dono desta conta?');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">Período de avaliação</p>
          <p className="mt-1 text-xs leading-relaxed text-textMuted">
            Enquanto estiver fechado, ninguém vê o convite pra avaliar — nem
            motorista, nem responsável.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aberta}
          aria-label="Abrir período de avaliação"
          disabled={salvando || config === null}
          onClick={() => salvar({ aberta: !aberta })}
          className={`tap relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            aberta ? 'bg-primary' : 'bg-borderStrong'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              aberta ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      <label className="mt-3 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-textMuted">
          Fecha sozinho em
        </span>
        <input
          type="date"
          value={ateISO}
          disabled={salvando}
          onChange={(e) => salvar({ ate: e.target.value || null })}
          className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <p className="mt-2 text-[11px] text-textMuted">
        {ativa
          ? ateISO
            ? `Aberto — fecha sozinho em ${ateISO.split('-').reverse().join('/')}.`
            : 'Aberto por tempo indeterminado.'
          : aberta
            ? 'O prazo já passou: o convite não aparece mais.'
            : 'Fechado — o convite não aparece pra ninguém.'}
      </p>
    </div>
  );
}

function PrivacidadeDosDepoimentos() {
  const [relatorio, setRelatorio] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [feito, setFeito] = useState(null);

  const chamar = async (apply) => {
    setRodando(true);
    try {
      const fn = httpsCallable(functions, 'backfillTestimonialPrivacy');
      const { data } = await fn({ apply });
      if (apply) {
        setFeito(data);
        setRelatorio(null);
        toast.success(
          data.corrigidos > 0
            ? `${data.corrigidos} depoimento(s) corrigido(s).`
            : 'Nada a corrigir.'
        );
      } else {
        setRelatorio(data);
      }
    } catch (err) {
      toast.error(err?.message || 'Não deu pra rodar a verificação.');
    } finally {
      setRodando(false);
      setConfirmando(false);
    }
  };

  const aCorrigir = relatorio?.aCorrigir || 0;
  const comNome =
    relatorio?.detalhes?.filter((d) => d.removeNomeCompleto).length || 0;
  const comFoto =
    relatorio?.detalhes?.filter((d) => d.removeFotoSemConsentimento).length || 0;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-bold text-text">
          Privacidade dos depoimentos antigos
        </p>
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Depoimento publicado antes da correção pode ter <strong>nome
          completo</strong> ou <strong>foto sem autorização</strong> no
          documento — e depoimento público é legível sem login. Isto recolhe os
          dois, preservando o primeiro nome pra não perder a atribuição do
          card.
        </p>

        {feito && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
            {feito.corrigidos > 0
              ? `Corrigidos ${feito.corrigidos} de ${feito.avaliados} depoimentos públicos.`
              : `Nada a corrigir — ${feito.avaliados} depoimentos públicos, todos limpos.`}
          </p>
        )}

        {relatorio && !feito && (
          <div className="mt-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-textMuted">
              <span>
                públicos:{' '}
                <strong className="tabular-nums text-text">
                  {relatorio.avaliados}
                </strong>
              </span>
              <span>
                a corrigir:{' '}
                <strong
                  className={`tabular-nums ${aCorrigir > 0 ? 'text-warning' : 'text-emerald-600'}`}
                >
                  {aCorrigir}
                </strong>
              </span>
              {aCorrigir > 0 && (
                <>
                  <span>
                    nome completo:{' '}
                    <strong className="tabular-nums text-text">
                      {comNome}
                    </strong>
                  </span>
                  <span>
                    foto sem consentimento:{' '}
                    <strong className="tabular-nums text-text">
                      {comFoto}
                    </strong>
                  </span>
                </>
              )}
            </div>
            {aCorrigir === 0 && (
              <p className="mt-1.5 text-[11px] text-textMuted">
                Nada exposto. Não precisa aplicar nada.
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => chamar(false)}
            disabled={rodando}
            className="tap inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-text disabled:opacity-60"
          >
            {rodando && !confirmando ? <Spinner size={14} /> : null}
            Verificar
          </button>
          {aCorrigir > 0 && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={rodando}
              className="tap inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white disabled:opacity-60"
            >
              Aplicar correção
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-textMuted">
          A verificação não muda nada. Aplicar apaga campos e não tem desfazer.
        </p>
      </div>

      <ConfirmDialog
        open={confirmando}
        title={`Recolher dados de ${aCorrigir} depoimento(s)?`}
        description="Apaga o nome completo e a foto sem autorização dos documentos públicos, preservando o primeiro nome. Não tem desfazer."
        confirmLabel="Aplicar"
        loading={rodando}
        onConfirm={() => chamar(true)}
        onCancel={() => setConfirmando(false)}
      />
    </>
  );
}

/* ─────────────── aba 2: pesquisa ─────────────── */

function Pesquisa({ s }) {
  if (s === null) return <Carregando />;
  if (s === false) return <Erro />;
  if (!s.total) {
    return (
      <Vazio
        icon={MessageSquare}
        titulo="Nenhuma avaliação ainda"
        texto="Assim que motoristas e responsáveis responderem, as respostas aparecem aqui."
      />
    );
  }

  const usos = ordenar(s.usos);
  const desejos = ordenar(s.desejos);
  const maxEstrela = Math.max(...Object.values(s.estrelas), 1);

  return (
    <div className="space-y-5">
      <section>
        <Titulo icon={Star}>Notas</Titulo>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Geral" value={nota(s.mediaGeral)} tone="emerald" />
          <Tile label="Motorista" value={nota(s.mediaMotorista)} />
          <Tile label="Responsável" value={nota(s.mediaResponsavel)} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Tile
            label="Deram 4 ou 5"
            value={`${Math.round(s.satisfeitos * 100)}%`}
          />
          <Tile label="Publicados na home" value={s.publicados} />
        </div>
      </section>

      <section>
        <Titulo icon={BarChart3}>Distribuição</Titulo>
        <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="inline-flex w-8 shrink-0 items-center gap-0.5 text-xs font-bold text-textMuted">
                {n}
                <Star size={11} className="fill-estrela text-estrela" />
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutro">
                <span
                  className="block h-full rounded-full bg-warning"
                  style={{ width: `${(s.estrelas[n] / maxEstrela) * 100}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-textMuted">
                {s.estrelas[n]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Titulo icon={TrendingUp}>O que mais usam</Titulo>
        <Ranking itens={usos} vazio="Ninguém respondeu essa parte ainda." />
      </section>

      <section>
        <Titulo icon={MessageSquare}>O que mais pedem</Titulo>
        <Ranking itens={desejos} vazio="Ninguém respondeu essa parte ainda." />
      </section>

      <section>
        <Titulo icon={MessageSquare}>Comentários</Titulo>
        <div className="space-y-2">
          {s.comentarios.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Stars value={c.nota} size={12} />
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                    c.papel === 'admin'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {c.papel === 'admin' ? 'motorista' : 'responsável'}
                </span>
                {c.publico && (
                  <span className="rounded bg-warningSoft px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-warningText">
                    na home
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-text">“{c.texto}”</p>
              <p className="mt-1.5 text-[11px] text-textMuted">
                {c.nome || 'anônimo'}
                {c.em ? ` · ${c.em.toLocaleDateString('pt-BR')}` : ''}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Ranking({ itens, vazio }) {
  if (!itens.length) {
    return <p className="text-xs text-textMuted">{vazio}</p>;
  }
  const max = itens[0][1] || 1;
  return (
    <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
      {itens.map(([valor, n]) => (
        <div key={valor} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">
            {labelDaOpcao(valor)}
          </span>
          <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-neutro">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(n / max) * 100}%` }}
            />
          </span>
          <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-textMuted">
            {n}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── aba 3: parceiros ─────────────── */

const STATUS_LABEL = {
  pending: 'na fila',
  contacted: 'contatado',
  approved: 'aprovado',
  rejected: 'recusado',
};

const STATUS_SKIN = {
  pending: 'bg-neutro text-textMuted',
  contacted: 'bg-warningSoft text-warningText',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-dangerSoft text-dangerText',
};

/**
 * A FILA — e as duas coisas diferentes que moram nela.
 *
 * `AguardandoAprovacao` vem primeiro porque é outra urgência: ali são CONTAS
 * que já existem e estão vendo a sala de espera NESTE momento; abaixo são
 * LEADS, gente que deixou contato. Quem espera na porta vem antes de quem
 * deixou recado — a ordem veio da tela `/admin/parceiros`, que esta aba
 * substituiu.
 *
 * Ele se esconde sozinho quando não há ninguém esperando (devolve `null`), e é
 * por isso que aparece nos dois galhos sem precisar de condição aqui.
 */
function Parceiros({ leads, onMarcar }) {
  if (leads === null) return <Carregando />;
  if (!leads.length) {
    return (
      <div className="space-y-4">
        <AguardandoAprovacao />
        <Vazio
          icon={Bus}
          titulo="Ninguém na fila"
          texto="Quando um motorista entrar na lista pela home, ele aparece aqui."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AguardandoAprovacao />
      {leads.map((l) => {
        const status = l.status || (l.contacted ? 'contacted' : 'pending');
        return (
          <article
            key={l.id}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text">
                  {l.name || 'sem nome'}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-textMuted">
                  {l.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {l.city}
                    </span>
                  )}
                  {l.criancas > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Bus size={11} />
                      {l.criancas} {l.criancas === 1 ? 'criança' : 'crianças'}
                    </span>
                  )}
                  {l.position != null && (
                    <span className="font-mono">#{l.position}</span>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${STATUS_SKIN[status]}`}
              >
                {STATUS_LABEL[status]}
              </span>
            </div>

            {l.message && (
              <p className="mt-2 rounded-xl bg-surface p-3 text-xs leading-relaxed text-textMuted">
                “{l.message}”
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {l.phone && (
                <a
                  href={devWhatsAppLink(
                    `Oi ${(l.name || '').split(' ')[0]}! Aqui é do Alô Buzinou, sobre sua vaga de associado.`
                  ).replace('/5511969170709', `/${l.phone}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-text"
                >
                  <Phone size={13} />
                  WhatsApp
                </a>
              )}
              {status !== 'contacted' && status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => onMarcar(l, 'contacted')}
                  className="tap inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3 text-xs font-bold text-white"
                >
                  Marcar contatado
                </button>
              )}
              {status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => onMarcar(l, 'approved')}
                  className="tap inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white"
                >
                  <Check size={13} />
                  Aprovar
                </button>
              )}
              {status !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => onMarcar(l, 'rejected')}
                  className="tap inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-textMuted"
                >
                  <X size={13} />
                  Recusar
                </button>
              )}
            </div>

            {status === 'approved' && (
              <p className="mt-2 text-[11px] leading-relaxed text-textMuted">
                Aprovado é <strong>decisão</strong>, não acesso: criar a conta
                dele precisa da função de provisionamento (Admin SDK). Sem ela,
                a conta ainda é criada à mão.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ─────────────── peças ─────────────── */

function Titulo({ icon: Icon, children }) {
  return (
    <h2 className="mb-2 inline-flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
      <Icon size={12} />
      {children}
    </h2>
  );
}

function Tile({ label, value, tone = 'neutral' }) {
  const cor =
    tone === 'emerald'
      ? 'text-primary'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-text';
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className={`text-xl font-extrabold tabular-nums tracking-tight ${cor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-textMuted">{label}</p>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-textMuted">
      <Spinner size={18} />
      carregando
    </div>
  );
}

function Erro() {
  return (
    <div className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4">
      <p className="text-sm font-bold text-text">Não deu pra ler os números</p>
      <p className="mt-1 text-xs leading-relaxed text-dangerText/80">
        As regras do Firestore precisam liberar leitura destas coleções pra
        este usuário. Confira se o seu doc em <code>users</code> tem{' '}
        <code>role: &quot;admin&quot;</code>.
      </p>
    </div>
  );
}

function Vazio({ icon: Icon, titulo, texto }) {
  return (
    <div className="rounded-2xl border border-dashed border-borderStrong p-6 text-center">
      <Icon size={22} className="mx-auto mb-2 text-textMuted" />
      <p className="text-sm font-bold text-text">{titulo}</p>
      <p className="mx-auto mt-1 max-w-[20rem] text-xs leading-relaxed text-textMuted">
        {texto}
      </p>
    </div>
  );
}

function ordenar(mapa) {
  return Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]);
}

function moeda(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function nota(v) {
  return v > 0 ? v.toFixed(1).replace('.', ',') : '—';
}
