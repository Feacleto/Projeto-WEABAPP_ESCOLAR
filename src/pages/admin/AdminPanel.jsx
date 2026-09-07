import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  BarChart3,
  CircleDollarSign,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../../components/common/Spinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import TaxaTab from './TaxaTab';
import FilaTab from '../../components/admin/FilaTab';
import MotoristasTab from '../../components/admin/MotoristasTab';
import ChamadosTab from '../../components/admin/ChamadosTab';
import SelosTab from '../../components/admin/SelosTab';
import IndicacoesTab from '../../components/admin/IndicacoesTab';
import { listarInteresses } from '../../services/interesseService';
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
import { logout } from '../../services/authService';
import { CLOUD_FUNCTIONS_ENABLED } from '../../config/capabilities';

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
 * OITO ABAS, E O QUE CADA UMA RESPONDE
 * 0. Hoje: a fila do dia. Não tem conteúdo próprio — é a soma das outras,
 *    apresentada como trabalho. Cada linha é um toque e leva à aba onde a
 *    coisa se resolve.
 * 1. Motoristas: a lista e a FICHA de cada associado — plano, contrato,
 *    faturas, nota das famílias, nota interna, e o botão de propor. É onde se
 *    navega a carteira inteira.
 * 2. Chamados: quem pediu ajuda e há quanto tempo espera. `supportTickets`
 *    recebia desde sempre e NENHUMA tela do dono lia — quem pede ajuda e não
 *    recebe resposta cancela sem dizer por quê.
 * 3. Mês: a régua da casa e o fechamento das faturas. É o trabalho mensal.
 * 4. Números: a carteira, o MRR e o funil. É a leitura do negócio.
 * 5. Selos: os alvarás para conferir e os adesivos para postar. É a ÚNICA
 *    aba que põe você no caminho crítico — e é de propósito: valor não vem de
 *    preço, vem de exigência, e conferir é o que faz o selo valer.
 * 6. Indicações: quem trouxe quem, e em que pé está cada uma. Ela existe
 *    porque as duas falhas possíveis produzem a MESMA queixa — "indiquei e
 *    não recebi" — e sem uma tela que mostre o estado, não há como responder.
 * 7. Pesquisa: o que os usuários responderam — inclusive as avaliações de
 *    responsável, que nunca vão pra home mas dizem se o app está servindo a
 *    ponta que não paga pela ferramenta.
 *
 * ── A ABA PADRÃO ANDOU DUAS VEZES, E PELO MESMO MOTIVO
 * Era "Visão geral", um relatório — e relatório não pede ação. Virou
 * "Motoristas" em 06/09/2026, que muda a pergunta de "como vai o negócio" para
 * "com quem eu preciso falar hoje".
 *
 * Só que a lista de motoristas ainda EXIGE que o dono varra a carteira para
 * descobrir com quem. A fila já responde, então ela virou a primeira. A lista
 * continua sendo onde se navega a carteira inteira — o que mudou é que ela
 * deixou de ser o único caminho até uma conversa.
 *
 * ⚠️ E A FILA PRECISA ESVAZIAR. Uma que nunca zera deixa de ser lida, e depois
 * disso não volta a ser lida no dia em que tiver algo grave. Por isso só entra
 * o que tem ação possível hoje, e por isso a régua está em
 * `dominio/associacao/fila.js`, com teste.
 *
 * ERAM CINCO EM 06/09/2026, E DUAS SUMIRAM COM O MODELO ANTIGO.
 * **Fila** era os motoristas pedindo acesso — ninguém pede mais, ele entra
 * sozinho. **Funil** era a prospecção em colunas e o orçamento que nascia
 * dela; sem negociação não há orçamento a montar. As duas descreviam o
 * trabalho de uma pessoa no meio do caminho, e o caminho deixou de ter meio.
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
 * O GATE É `role: 'owner'`, E ELE VALE NAS RULES TAMBÉM
 * Este parágrafo dizia `superAdmin: true` e que "todo usuário com role 'admin'
 * já pode ler estes dados pelas rules" — as duas metades ficaram falsas em
 * 06/09/2026. O legado `superAdmin` saiu, e o que decide é `isOwner()`, que
 * sempre checou o PAPEL: dono pode ser mais de um, e é assim que se cria o
 * segundo.
 *
 * E a leitura foi escopada ANTES de a porta abrir: com o autoatendimento,
 * `isAdmin()` passou a significar "tem uma conta", então `allow list` de
 * `users`, `faturasParceiro`, `feedbacks` e `supportTickets` são de dono. A
 * tela esconde por UX; quem impede são as rules.
 */
export default function AdminPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('hoje');
  // O MOTORISTA QUE A FILA MANDOU ABRIR. Ele sobe até aqui porque quem escolhe
  // deixou de ser só a lista: a linha da fila está em OUTRA aba, e um estado
  // que mora dentro da `MotoristasTab` não é alcançável de fora dela.
  const [motoristaAlvo, setMotoristaAlvo] = useState(null);

  const [ov, setOv] = useState(null);
  const [survey, setSurvey] = useState(null);

  useEffect(() => {
    let alive = true;
    getPlatformOverview()
      .then((d) => alive && setOv(d))
      .catch(() => alive && setOv(false));
    getSurveyResults()
      .then((d) => alive && setSurvey(d))
      .catch(() => alive && setSurvey(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    /* O PISO DE TEXTO DESTA TELA É 12px (`text-xs`), e não é preferência.
     *
     * O app inteiro é de bolso: o motorista e o responsável leem a 30cm do
     * olho. Esta tela é de MESA — negociar taxa, fechar o mês, abrir um
     * número numa reunião — e a 60cm o mesmo 11px tem metade do tamanho
     * aparente. A largura já tinha sido corrigida aqui (é o que a regra
     * abaixo faz); a escala tinha ficado a do celular, e quem negocia
     * contrato num monitor estava lendo letra de bula.
     *
     * Não existe escala tipográfica própria pro painel — seria um segundo
     * sistema por cima do do Tailwind, e isso é burocracia. É só um piso:
     * nada abaixo de `text-xs`. O ContratoDoc é a exceção, e por outro
     * motivo: ele é IMPRESSO, e 11px no papel é corpo de contrato.
     *
     * `data-painel="web"` é o que solta o teto de 480px do #root — a regra
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
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-primary/80">
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
          * número numa reunião.
          *
          * ERAM CINCO ABAS E VIRARAM TRÊS, então a quebra em duas fileiras
          * saiu junto: ela existia porque cinco rótulos em 320px viram texto
          * ilegível, e a saída comum — a tira que rola — esconde o fim, que é
          * como a Taxa ficou invisível por tanto tempo. Com três, cabem. */}
        {/* CINCO ABAS, E ELAS QUEBRAM EM DUAS LINHAS NO CELULAR.
          *
          * `flex-wrap` em vez da tira que rola: tira esconde o fim, e quem não
          * arrasta nunca descobre que existe mais — foi assim que a Taxa ficou
          * invisível por tanto tempo. Duas linhas ocupam mais espaço e não
          * escondem nada. */}
        <div className="mb-5 flex flex-wrap gap-1 rounded-2xl bg-neutro p-1">
          {[
            ['hoje', 'Hoje'],
            ['motoristas', 'Motoristas'],
            ['chamados', 'Chamados'],
            ['mes', 'Mês'],
            ['numeros', 'Números'],
            ['selos', 'Selos'],
            ['indicacoes', 'Indicações'],
            ['pesquisa', 'Pesquisa'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`tap min-w-[5.5rem] flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                tab === id ? 'bg-card text-primary shadow-sm' : 'text-textMuted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'hoje' && (
          <FilaTab
            onIr={(destino) => {
              setMotoristaAlvo(destino?.uid || null);
              setTab(destino?.aba || 'motoristas');
            }}
          />
        )}
        {tab === 'motoristas' && (
          // A `key` remonta a aba quando a fila manda abrir outro motorista.
          // Sem ela, a lista já montada ignoraria o alvo novo — o estado
          // inicial de um componente só é lido uma vez.
          <MotoristasTab key={motoristaAlvo || 'lista'} inicial={motoristaAlvo} />
        )}
        {tab === 'chamados' && <ChamadosTab />}
        {tab === 'mes' && <TaxaTab />}
        {tab === 'numeros' && <Geral ov={ov} />}
        {tab === 'selos' && <SelosTab />}
        {tab === 'indicacoes' && <IndicacoesTab />}
        {tab === 'pesquisa' && <Pesquisa s={survey} />}
      </main>
    </div>
  );
}

/* ─────────────── aba 3: números ─────────────── */

/**
 * QUEM QUER RECEBER A MENSALIDADE POR CARTÃO — a pesquisa, e só isso.
 *
 * ⚠️ ELA MOSTRA **QUEM**, NÃO SÓ QUANTOS. Um contador responde "quantos
 * querem" e para aí; o que decide a fase é quem — cinco interessados que são os
 * cinco maiores da base é uma conversa, cinco de uma criança cada é outra.
 *
 * O caminho é split, nunca escrow: o dinheiro cairia na subconta do motorista,
 * e a plataforma nunca reteria — senão "a mensalidade é sua" vira falsa e o
 * item 7 dos Termos cai junto. O risco que esta pesquisa mede é outro: boa
 * parte dos PSPs exige CNPJ para subconta com split, e o modelo decidiu que o
 * motorista não precisa de MEI. Se ninguém aceitar pessoa física, o recurso não
 * existe para a maior parte da base.
 *
 * Custo quase zero, e o resultado mata ou justifica uma fase inteira.
 */
function InteressePorCartaoResumo() {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    listarInteresses()
      .then(setLista)
      .catch(() => setLista([]));
  }, []);

  // Sem ninguém, a linha não aparece: zero interessados numa pesquisa que
  // acabou de subir é ruído, não resultado.
  if (!lista?.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
        Querem receber por cartão
      </h3>
      <p className="mt-1 text-sm font-extrabold text-text">
        {lista.length} {lista.length === 1 ? 'motorista' : 'motoristas'}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-textMuted">
        Pesquisa, não recurso. Antes de qualquer promessa, é preciso achar um
        PSP que abra subconta com split para <strong>pessoa física sem
        CNPJ</strong> — o modelo decidiu que o motorista não precisa de MEI.
      </p>
      <ul className="mt-2 space-y-0.5 text-[11px] text-textMuted">
        {lista.slice(0, 12).map((i) => (
          <li key={i.id} className="font-mono">
            {i.tioUid}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Geral({ ov }) {
  if (ov === null) return <Carregando />;
  if (ov === false) return <Erro />;

  return (
    <div className="space-y-5">
      <InteressePorCartaoResumo />
      {/* A CARTEIRA — em que degrau cada associado está.
        *
        * Esta seção não existia: o painel media o tamanho da base e o dinheiro
        * que passou, e nenhum dos dois diz como o NEGÓCIO vai. O caminho que
        * passou a existir tem quatro degraus, e cada um é um campo:
        * cadastrou → rodou a 1ª rota → contratou → pagou. */}
      <section>
        <Titulo icon={TrendingUp}>A carteira</Titulo>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Em teste" value={ov.carteira.emTeste} />
          <Tile label="Contratados" value={ov.carteira.contratados} tone="emerald" />
          <Tile label="Bloqueados" value={ov.carteira.bloqueados} tone="warning" />
          <Tile label="Ainda não rodaram" value={ov.carteira.naoComecou} />
        </div>

        {/* O AVISO QUE PEDE AÇÃO, e por isso só aparece quando há ação a
          * tomar. Linha permanente de "0 acabando" vira ruído que se aprende a
          * pular — e aí não é vista no dia em que tem número. */}
        {ov.carteira.acabandoEm7 > 0 && (
          <p className="mt-2 rounded-xl bg-warningSoft p-3 text-xs leading-relaxed text-warningText">
            <strong>
              {ov.carteira.acabandoEm7}{' '}
              {ov.carteira.acabandoEm7 === 1 ? 'associado está' : 'associados estão'} a
              menos de 7 dias do fim do teste.
            </strong>{' '}
            É a semana em que a decisão acontece — e quem contrata antes do fim
            leva metade pelos 12 meses.
          </p>
        )}
      </section>

      <section>
        <Titulo icon={CircleDollarSign}>A receita da plataforma</Titulo>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {/* O MRR OLHA PRA FRENTE. `receitaPropria`, logo abaixo, é soma de
            * fatura quitada: olha pra trás. Os dois são receita e respondem
            * perguntas diferentes — quanto entra por mês, e quanto já entrou. */}
          <Tile label="MRR (por mês)" value={moeda(ov.carteira.mrr)} tone="emerald" />
          <Tile
            label="Ticket por associado"
            value={naoMedido(ov.carteira.ticketPorAssociado, moeda)}
          />
          <Tile
            label="Desconto médio"
            value={naoMedido(ov.carteira.descontoMedio, pct)}
          />
          <Tile
            label="Conversão pós-teste"
            value={naoMedido(ov.carteira.conversao, pct)}
          />
        </div>

        {/* A DIFERENÇA ENTRE A TABELA E O MRR É O QUE A PLATAFORMA ABRE MÃO, e
          * este número não existia em lugar nenhum. Só aparece quando há
          * desconto — sem ninguém pagando, ele não tem o que dizer. */}
        {ov.carteira.mrrDeTabela > 0 && ov.carteira.descontoMedio > 0 && (
          <p className="mt-2 rounded-xl border border-border bg-card p-3 text-xs leading-relaxed text-textMuted">
            De <strong>{moeda(ov.carteira.mrrDeTabela)}</strong> de tabela, entram{' '}
            <strong>{moeda(ov.carteira.mrr)}</strong>. A diferença é fundador,
            indicação, antecipação e roleta somados.
            {ov.carteira.antecipados > 0 && (
              <>
                {' '}
                {ov.carteira.antecipados}{' '}
                {ov.carteira.antecipados === 1 ? 'contratou' : 'contrataram'} antes
                do fim do teste.
              </>
            )}
          </p>
        )}
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
              Ainda é zero porque nenhuma fatura foi fechada. A régua da casa
              e a faixa de cada parceiro vivem na aba <strong>Taxa</strong>; a
              receita recebida começa a existir quando o mês é fechado lá.
            </p>
          )}
        </div>
      </section>

      {/* O TAMANHO DA BASE SAIU DA MANCHETE EM 06/09/2026, e virou contexto.
        *
        * "Usuários no app" e "Motoristas parceiros" eram números de vaidade:
        * não decidem nada, e o segundo agora é a carteira lá em cima, com o
        * degrau de cada um. Ficaram os dois que dão escala ao GMV logo acima —
        * crianças, que é a unidade de cobrança, e responsáveis, que é quanta
        * gente o produto alcança do outro lado. */}
      <section>
        <Titulo icon={Users}>Tamanho da base</Titulo>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Crianças ativas" value={ov.criancas} />
          <Tile label="Responsáveis" value={ov.responsaveis} />
        </div>
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
        <span className="text-xs font-semibold uppercase tracking-wide text-textMuted">
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

      <p className="mt-2 text-xs text-textMuted">
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
          <p className="mt-3 rounded-xl border border-primaryBorder bg-primarySoft px-3 py-2 text-xs font-semibold text-primary">
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
                  className={`tabular-nums ${aCorrigir > 0 ? 'text-warning' : 'text-accentText'}`}
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
              <p className="mt-1.5 text-xs text-textMuted">
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

        <p className="mt-2 text-xs leading-relaxed text-textMuted">
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
                <Star size={11} className="fill-ouro text-ouro" />
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
                  className={`rounded px-1.5 py-0.5 font-mono text-xs uppercase tracking-widest ${
                    c.papel === 'admin'
                      ? 'bg-primarySoft text-primary'
                      : 'bg-infoSoft text-infoText'
                  }`}
                >
                  {c.papel === 'admin' ? 'motorista' : 'responsável'}
                </span>
                {c.publico && (
                  <span className="rounded bg-warningSoft px-1.5 py-0.5 font-mono text-xs uppercase tracking-widest text-warningText">
                    na home
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-text">“{c.texto}”</p>
              <p className="mt-1.5 text-xs text-textMuted">
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

/* ─────────────── peças ─────────────── */

function Titulo({ icon: Icon, children }) {
  return (
    <h2 className="mb-2 inline-flex items-center gap-1.5 px-1 font-mono text-xs uppercase tracking-[0.18em] text-textMuted">
      <Icon size={12} />
      {children}
    </h2>
  );
}

/**
 * ONDE O NÚMERO NÃO EXISTE, A TELA DIZ "não medimos" — NUNCA ZERO.
 *
 * Num painel que alguém abre para decidir, zero e ausência são opostos: um diz
 * que ninguém converteu, o outro diz que ninguém terminou o teste ainda. No
 * primeiro mês de operação, 0% de conversão pareceria fracasso onde não houve
 * nem tentativa.
 */
function naoMedido(valor, formatar) {
  if (valor === null || valor === undefined) return '—';
  return formatar(valor);
}

/** Fração para porcentagem inteira. */
function pct(f) {
  return `${Math.round((Number(f) || 0) * 100)}%`;
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
      <p className="mt-0.5 text-xs leading-tight text-textMuted">{label}</p>
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
