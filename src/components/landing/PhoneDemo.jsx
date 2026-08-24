import { useState } from 'react';
import {
  Bell,
  Bus,
  Check,
  ChevronRight,
  Home as HomeIcon,
  MapPin,
  Plus,
  School,
  Search,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Demo de telas da home — o motorista VÊ o app antes de entrar.
 *
 * SÃO AS TELAS DELE, E SÓ AS DELE
 * A primeira versão misturava as telas do responsável ("o que o pai vê") com
 * a do motorista. Parecia generoso e era ruim: quem está decidindo se paga
 * uma taxa quer saber o que ELE vai usar todo dia, não o que a família vê.
 * O que a família ganha já é argumento em outro bloco da página. Aqui são as
 * quatro telas da rotina de quem dirige: início, mapa, crianças, financeiro.
 *
 * POR QUE MOCK EM CSS E NÃO SCREENSHOT
 * Screenshot de app real envelhece: muda uma cor, um espaçamento, e a home
 * passa a mostrar uma versão que não existe mais. Pior: print de tela de
 * produção carrega nome de criança, valor e endereço — dado que não pode
 * aparecer numa página pública. O mock desenhado em CSS é leve (nenhum
 * arquivo pra baixar), nítido em qualquer densidade de tela, e usa dados
 * fictícios óbvios ("Ana", "R$ 320,00"), então não há vazamento possível.
 *
 * COMO SE USA
 * As abas trocam a tela; o próprio "celular" é clicável e avança pra
 * próxima. Abaixo do celular, a explicação do que se faz NAQUELA tela: demo
 * sem legenda é bonito e não ensina nada.
 */

/* ─────────────── peças comuns dos mocks ─────────────── */

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-3 pt-2 pb-1">
      <span className="text-[7px] font-bold text-text/70 tabular-nums">
        07:12
      </span>
      <div className="flex items-center gap-[3px]" aria-hidden>
        <span className="w-[3px] h-[3px] rounded-full bg-text/30" />
        <span className="w-[3px] h-[3px] rounded-full bg-text/30" />
        <span className="w-3 h-[5px] rounded-[2px] border border-text/30" />
      </div>
    </div>
  );
}

/* Menu em pílula com a bolinha do item ativo — o mesmo desenho do app. */
const TIO_NAV = [
  { key: 'inicio', icon: HomeIcon },
  { key: 'rota', icon: Bus },
  { key: 'criancas', icon: Users },
  { key: 'financeiro', icon: Wallet },
];

function MockNav({ active }) {
  return (
    <div className="mt-auto px-3 pb-2.5">
      <div className="rounded-full bg-[#0B1210] px-2 py-1.5 flex items-center justify-around">
        {TIO_NAV.map(({ icon: Icon, key }) => (
          <span key={key} className="relative px-1.5 py-0.5">
            {key === active && (
              <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
            )}
            <Icon
              size={11}
              className={key === active ? 'text-white' : 'text-white/35'}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cabeçalho de tela interna do app. */
function MockHeader({ titulo, chip, chipTone = 'primary' }) {
  const skin =
    chipTone === 'live'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-primary/10 text-primary border-primary/15';
  return (
    <div className="px-3 flex items-center justify-between">
      <p className="text-[8px] font-extrabold text-text">{titulo}</p>
      {chip && (
        <span
          className={`text-[6px] font-bold rounded-full border px-1.5 py-[3px] ${skin}`}
        >
          {chip}
        </span>
      )}
    </div>
  );
}

/** Linha de criança: quadradinho de foto + nome + informação + chip. */
function MockRow({ nome, info, chip, chipClass, acao }) {
  return (
    <div className="rounded-lg bg-card px-2 py-1.5 flex items-center gap-1.5 shadow-sm">
      <span className="w-4 h-4 rounded-md bg-gradient-to-br from-emerald-500 to-primary shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[7px] font-semibold text-text leading-tight">
          {nome}
        </span>
        {info && (
          <span className="block text-[6px] text-textMuted leading-tight">
            {info}
          </span>
        )}
      </span>
      {chip && (
        <span
          className={`text-[6px] font-bold rounded-full px-1.5 py-[2px] shrink-0 ${chipClass}`}
        >
          {chip}
        </span>
      )}
      {acao ? (
        <span className="text-[6px] font-bold text-primary shrink-0">
          {acao}
        </span>
      ) : (
        <ChevronRight size={8} className="text-gray-300 shrink-0" />
      )}
    </div>
  );
}

/* ─────────────── 1. início do motorista ─────────────── */

function ScreenInicio() {
  return (
    <div className="h-full flex flex-col bg-bg">
      <StatusBar />

      <div className="px-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-[6.5px] text-textMuted leading-none">
            segunda, 7 de abril
          </p>
          <p className="text-[8px] font-extrabold text-text leading-none mt-[3px]">
            Bom dia, Nino!
          </p>
        </div>
        <Bell size={9} className="text-textMuted" />
      </div>

      {/* Hero: o único elemento dominante — tocar começa a rota. */}
      <div className="mx-3 mt-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-primary p-2.5 text-white shadow-sm">
        <p className="text-[6px] font-bold uppercase tracking-[0.14em] text-white/70">
          rota da manhã
        </p>
        <p className="text-[10px] font-extrabold leading-tight mt-0.5">
          12 crianças esperando
        </p>
        <div className="mt-2 rounded-lg bg-white/20 py-1.5 flex items-center justify-center gap-1">
          <Bus size={9} />
          <span className="text-[7px] font-bold">Continuar rota</span>
        </div>
      </div>

      <div className="mx-3 mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-card p-2 shadow-sm">
          <p className="text-[11px] font-extrabold text-text leading-none tabular-nums">
            12
          </p>
          <p className="text-[6px] text-textMuted leading-tight mt-[3px]">
            crianças hoje
          </p>
        </div>
        <div className="rounded-lg bg-card p-2 shadow-sm">
          <p className="text-[11px] font-extrabold text-primary leading-none tabular-nums">
            R$ 1.240
          </p>
          <p className="text-[6px] text-textMuted leading-tight mt-[3px]">
            a receber no mês
          </p>
        </div>
      </div>

      <div className="mx-3 mt-1.5 space-y-1">
        <MockRow
          nome="Ana"
          chip="na van"
          chipClass="bg-secondary text-white"
        />
        <MockRow
          nome="Bia"
          chip="entregue"
          chipClass="bg-emerald-600 text-white"
        />
        <MockRow nome="Téo" chip="faltou" chipClass="bg-gray-400 text-white" />
      </div>

      <MockNav active="inicio" />
    </div>
  );
}

/* ─────────────── 2. mapa da rota ─────────────── */

function ScreenMapa() {
  return (
    <div className="h-full flex flex-col bg-bg">
      <StatusBar />
      <MockHeader titulo="Rota no mapa" chip="ao vivo" chipTone="live" />

      {/* Mapa falso: quadras em CSS, rota em SVG, van animada por cima. */}
      <div className="mx-3 mt-1.5 rounded-2xl overflow-hidden border border-gray-200 bg-[#E8EDE9] relative h-[112px]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(#fff 3px, transparent 3px), linear-gradient(90deg, #fff 3px, transparent 3px)',
            backgroundSize: '26px 22px',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-[46%] h-[5px] bg-white"
        />

        {/* preserveAspectRatio="none" de propósito: o traçado tem que ESTICAR
          * até os cantos, porque os keyframes da van (em px) foram calculados
          * sobre o retângulo esticado. */}
        <svg
          viewBox="0 0 130 90"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <path
            d="M10 78 L50 58 L82 30 L118 16"
            fill="none"
            stroke="#1F5F3F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 5"
            className="demo-dash"
            opacity="0.75"
          />
        </svg>

        <span className="absolute left-[4px] bottom-[6px] w-4 h-4 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center shadow">
          <HomeIcon size={7} className="text-white" />
        </span>
        <span className="absolute right-[6px] top-[6px] w-4 h-4 rounded-full bg-violet-600 border-2 border-white flex items-center justify-center shadow">
          <School size={7} className="text-white" />
        </span>
        <div className="demo-van-map absolute top-0 left-0 w-5 h-5">
          <span className="absolute inset-0 rounded-full bg-secondary/40 demo-ping" />
          <span className="relative w-5 h-5 rounded-full bg-secondary border-2 border-white flex items-center justify-center shadow">
            <Bus size={9} className="text-white" />
          </span>
        </div>
      </div>

      <div className="mx-3 mt-1.5 rounded-xl bg-card p-2 flex items-center gap-1.5 shadow-sm">
        <MapPin size={9} className="text-primary shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[7px] font-bold text-text leading-tight">
            Próxima parada: Ana
          </span>
          <span className="block text-[6px] text-textMuted leading-tight">
            300 m · Rua das Acácias, 210
          </span>
        </span>
        <span className="text-[6px] font-bold text-primary shrink-0">
          embarcou
        </span>
      </div>

      <div className="mx-3 mt-1.5 rounded-xl bg-surface border border-gray-200 p-2">
        <p className="text-[6px] leading-relaxed text-textMuted">
          A família acompanha a mesma van no celular dela — sem te ligar.
        </p>
      </div>

      <MockNav active="rota" />
    </div>
  );
}

/* ─────────────── 3. crianças ─────────────── */

const CRIANCAS = [
  ['Ana Clara', '2º ano · manhã', 'manhã'],
  ['Bianca', '4º ano · manhã', 'manhã'],
  ['Lucas', '1º ano · tarde', 'tarde'],
  ['Téo', '3º ano · tarde', 'tarde'],
];

function ScreenCriancas() {
  return (
    <div className="h-full flex flex-col bg-bg">
      <StatusBar />
      <MockHeader titulo="Crianças" chip="12 ativas" />

      <div className="mx-3 mt-1.5 rounded-lg bg-card border border-gray-200 px-2 py-1.5 flex items-center gap-1.5">
        <Search size={8} className="text-textMuted" />
        <span className="text-[6.5px] text-textMuted">Buscar por nome…</span>
      </div>

      <div className="mx-3 mt-1.5 space-y-1">
        {CRIANCAS.map(([nome, info, turno]) => (
          <MockRow
            key={nome}
            nome={nome}
            info={info}
            chip={turno}
            chipClass={
              turno === 'manhã'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-indigo-100 text-indigo-700'
            }
          />
        ))}
      </div>

      <div className="mx-3 mt-2 rounded-xl bg-primary text-white py-2 flex items-center justify-center gap-1">
        <Plus size={9} />
        <span className="text-[7px] font-bold">Nova criança</span>
      </div>

      <MockNav active="criancas" />
    </div>
  );
}

/* ─────────────── 4. financeiro ─────────────── */

function ScreenFinanceiro() {
  return (
    <div className="h-full flex flex-col bg-bg">
      <StatusBar />
      <MockHeader titulo="Financeiro" chip="abril" />

      <div className="mx-3 mt-1.5 grid grid-cols-3 gap-1">
        {[
          ['R$ 2.880', 'recebido', 'text-emerald-600'],
          ['R$ 1.240', 'a receber', 'text-secondary'],
          ['R$ 320', 'atrasado', 'text-danger'],
        ].map(([valor, label, cor]) => (
          <div key={label} className="rounded-lg bg-card p-1.5 shadow-sm">
            <p
              className={`text-[8px] font-extrabold leading-none tabular-nums ${cor}`}
            >
              {valor}
            </p>
            <p className="text-[5.5px] text-textMuted leading-tight mt-[3px]">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="mx-3 mt-1.5 space-y-1">
        <MockRow
          nome="Ana Clara"
          info="R$ 320,00 · venceu dia 10"
          chip="atrasado"
          chipClass="bg-red-100 text-red-700"
          acao="cobrar"
        />
        <MockRow
          nome="Bianca"
          info="R$ 320,00 · vence dia 10"
          chip="em aberto"
          chipClass="bg-amber-100 text-amber-700"
          acao="PIX"
        />
        <MockRow
          nome="Lucas"
          info="R$ 320,00 · pago dia 6"
          chip="pago"
          chipClass="bg-emerald-100 text-emerald-700"
        />
        <MockRow
          nome="Téo"
          info="R$ 280,00 · pago dia 3"
          chip="pago"
          chipClass="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="mx-3 mt-2 rounded-xl bg-surface border border-gray-200 p-2 flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <Check size={7} className="text-emerald-600" />
        </span>
        <p className="text-[6px] leading-relaxed text-textMuted">
          A mensalidade de cada criança é gerada sozinha todo mês.
        </p>
      </div>

      <MockNav active="financeiro" />
    </div>
  );
}

/* ─────────────── as telas e a explicação de cada uma ─────────────── */

const SCREENS = [
  {
    id: 'inicio',
    tab: 'Início',
    role: 'a sua tela',
    title: 'O dia inteiro em uma tela',
    blurb:
      'Quantas crianças hoje, quanto entra no mês e a rota pronta pra começar. Um toque e você já está rodando.',
    Screen: ScreenInicio,
  },
  {
    id: 'mapa',
    tab: 'Mapa',
    role: 'a sua tela',
    title: 'A rota no mapa, com a próxima parada',
    blurb:
      'Você dirige e o app registra a posição enquanto a rota está aberta. A família acompanha a mesma van no celular dela.',
    Screen: ScreenMapa,
  },
  {
    id: 'criancas',
    tab: 'Crianças',
    role: 'a sua tela',
    title: 'O caderninho, com busca',
    blurb:
      'Foto, escola e período de cada criança no lugar certo. Cadastra uma vez e nunca mais procura papel.',
    Screen: ScreenCriancas,
  },
  {
    id: 'financeiro',
    tab: 'Financeiro',
    role: 'a sua tela',
    title: 'Quem pagou e quem falta',
    blurb:
      'Mensalidade calculada por criança, PIX pronto pra enviar e o atrasado em destaque. Cobrar deixa de ser conversa difícil.',
    Screen: ScreenFinanceiro,
  },
];

export default function PhoneDemo() {
  const [i, setI] = useState(0);
  const s = SCREENS[i];
  const Screen = s.Screen;
  const proxima = SCREENS[(i + 1) % SCREENS.length];

  return (
    <div>
      {/* Abas nomeadas pela TELA: o visitante já está pensando "quero ver o
        * financeiro", não "quero ver o módulo administrativo". */}
      <div
        className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1"
        role="tablist"
        aria-label="Telas do app"
      >
        {SCREENS.map((sc, idx) => (
          <button
            key={sc.id}
            type="button"
            role="tab"
            aria-selected={idx === i}
            onClick={() => setI(idx)}
            className={`tap shrink-0 rounded-full px-3 h-8 text-xs font-bold transition-colors ${
              idx === i
                ? 'bg-white text-[#0B1210] shadow-lg shadow-black/25'
                : 'bg-white/[0.07] border border-white/15 text-white/70 hover:bg-white/[0.12]'
            }`}
          >
            {sc.tab}
          </button>
        ))}
      </div>

      {/* O celular inteiro é um botão: toque avança pra próxima tela. */}
      <button
        type="button"
        onClick={() => setI((v) => (v + 1) % SCREENS.length)}
        aria-label={'Ver a próxima tela: ' + proxima.tab}
        className="tap block mx-auto mt-4 w-[214px]"
      >
        {/* Moldura sobre fundo escuro: preta com fio branco, senão o aparelho
          * desaparece dentro do próprio fundo da página. */}
        <div className="rounded-[1.9rem] bg-[#050908] border border-white/15 p-[6px] shadow-2xl shadow-black/50">
          <div className="relative rounded-[1.55rem] overflow-hidden bg-bg aspect-[9/17]">
            <span
              aria-hidden
              className="absolute top-[5px] left-1/2 -translate-x-1/2 w-10 h-[4px] rounded-full bg-black/60 z-10"
            />
            {/* key força o replay da animação de entrada a cada troca */}
            <div key={s.id} className="h-full animate-demo-screen-in">
              <Screen />
            </div>
          </div>
        </div>
      </button>

      <p className="mt-3 text-center text-[11px] text-white/50 flex items-center justify-center gap-2">
        toque na tela pra ver a próxima
        <span className="inline-flex gap-1" aria-hidden>
          {SCREENS.map((sc, idx) => (
            <span
              key={sc.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? 'w-4 bg-emerald-300' : 'w-1.5 bg-white/25'
              }`}
            />
          ))}
        </span>
      </p>

      {/* Explicação da tela aberta — o demo ensina, não só enfeita. */}
      <div key={s.id} className="mt-4 animate-demo-screen-in">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
          {s.role}
        </p>
        <h3 className="text-base font-extrabold tracking-tight mt-1">
          {s.title}
        </h3>
        <p className="text-sm text-white/70 leading-relaxed mt-1">{s.blurb}</p>
      </div>
    </div>
  );
}
