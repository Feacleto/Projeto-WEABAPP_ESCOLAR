import { useState } from 'react';
import { Bus, Users } from 'lucide-react';

/**
 * Carrossel horizontal de screenshots da aplicação (Tio + Pai).
 *
 * Tabs separam os dois públicos. Dentro de cada tab, scroll-snap horizontal
 * pra navegação por swipe (mobile) ou drag/setas (desktop). Cada slide tem:
 *   - Moldura "celular" (rounded + border)
 *   - Imagem (carregada de /screens/{slug}.png)
 *   - Título e descrição abaixo
 *
 * Fallback: se a imagem não existir ainda em /public/screens/, mostra um
 * placeholder gracioso. Útil enquanto a pasta está vazia — basta subir
 * os PNGs com os nomes esperados e o carrossel passa a exibi-los.
 */

const TIO_SCREENS = [
  {
    src: '/telas/inicioTio.jpeg',
    title: 'Início',
    description:
      'Em uma olhada: quantas crianças hoje, ausentes, próximos pagamentos e o atalho pra começar a rota.',
  },
  {
    src: '/telas/RotaTio.jpeg',
    title: 'Rota do dia',
    description:
      'Kanban de embarque e entrega. Arrasta pra reordenar e marca cada etapa com um toque.',
  },
  {
    src: '/telas/CriancasTio.jpeg',
    title: 'Crianças',
    description:
      'Lista completa com foto, escola e período. Cadastra rápido com convite por código.',
  },
  {
    src: '/telas/FinanceiroTio.jpeg',
    title: 'Financeiro',
    description:
      'Mensalidade automática todo mês. Marca quem pagou, quem deve, e exporta relatório.',
  },
];

const PAI_SCREENS = [
  {
    src: '/telas/InicioPai.jpeg',
    title: 'Início',
    description:
      'Onde tá seu filho agora — em casa, na perua, na escola. Foto e status em tempo real.',
  },
  {
    src: '/telas/MapaPai.jpeg',
    title: 'Mapa ao vivo',
    description:
      'Vê a perua chegando perto da sua casa. Alerta automático nos últimos minutos.',
  },
  {
    src: '/telas/FinanceiroPai.jpeg',
    title: 'Mensalidade',
    description:
      'Quanto, quando e como pagar. PIX direto da tela ou marca como pago em dinheiro.',
  },
];

export default function ScreensCarousel() {
  const [tab, setTab] = useState('tio');
  const screens = tab === 'tio' ? TIO_SCREENS : PAI_SCREENS;

  return (
    <section className="py-8">
      <div className="px-6 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
          Como é por dentro
        </h2>
        <p className="text-2xl font-bold text-text leading-tight">
          Passe pra ver as telas.
        </p>
        <p className="text-textMuted mt-2 text-sm">
          Arraste pro lado pra conhecer o que aparece pro motorista e pro pai.
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 max-w-md mx-auto mt-5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setTab('tio')}
            className={`tap py-2.5 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'tio'
                ? 'bg-card text-emerald-700 shadow-sm'
                : 'text-textMuted'
            }`}
          >
            <Bus size={16} /> Telas do motorista
          </button>
          <button
            type="button"
            onClick={() => setTab('pai')}
            className={`tap py-2.5 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors ${
              tab === 'pai'
                ? 'bg-card text-indigo-700 shadow-sm'
                : 'text-textMuted'
            }`}
          >
            <Users size={16} /> Telas do pai
          </button>
        </div>
      </div>

      {/* Trilha de slides — scroll-snap horizontal */}
      <div className="mt-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-4 px-6 pb-2">
          {screens.map((s) => (
            <ScreenCard key={`${tab}-${s.src}`} screen={s} />
          ))}
        </div>
      </div>

      {/* Dica visual de scroll (bolinhas indicadoras) */}
      <div className="px-6 mt-3 flex justify-center gap-1.5">
        {screens.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-300"
            aria-hidden
          />
        ))}
      </div>
    </section>
  );
}

function ScreenCard({ screen }) {
  return (
    <div className="snap-center shrink-0 w-72">
      {/* Moldura "celular" — escura, com a imagem dentro em aspect 9:16 */}
      <div className="rounded-3xl bg-slate-900 p-2 shadow-xl shadow-slate-900/20">
        <div className="rounded-2xl bg-gray-100 overflow-hidden aspect-[9/16]">
          <img
            src={screen.src}
            alt={screen.title}
            className="w-full h-full object-cover"
            decoding="async"
          />
        </div>
      </div>

      {/* Legenda abaixo do "celular" */}
      <div className="mt-3 px-1">
        <p className="text-sm font-bold text-text leading-tight">
          {screen.title}
        </p>
        <p className="text-xs text-textMuted mt-1 leading-relaxed">
          {screen.description}
        </p>
      </div>
    </div>
  );
}
