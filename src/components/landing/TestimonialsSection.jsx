import { useEffect, useState } from 'react';
import { Star, Quote, Bus, Users } from 'lucide-react';
import Avatar from '../common/Avatar';
import {
  listPublicTestimonials,
  getPublicRatingStats,
} from '../../services/feedbackService';

/**
 * Seção de prova social na landing — exibe depoimentos vindos do
 * formulário de avaliação dentro do app (somente os que o usuário
 * autorizou publicar). Estilo de scroll horizontal com cards.
 *
 * Quando ainda não há depoimentos reais, mostra um placeholder
 * "depoimento de exemplo" pra a página não ficar vazia.
 *
 * O cabeçalho mostra a média de estrelas dos clientes que recomendam
 * (apenas dos que autorizaram aparecer — consistente com o que é
 * exibido logo abaixo).
 */
export default function TestimonialsSection() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ count: 0, average: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listPublicTestimonials(12), getPublicRatingStats()])
      .then(([t, s]) => {
        if (!alive) return;
        setItems(t);
        setStats(s);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Sempre garante algo na tela: se ainda não há depoimentos reais, exibe
  // um exemplo (com tag "exemplo" pra não enganar). Quando aparecer
  // depoimento de verdade, ele tira o placeholder de cena.
  const showPlaceholder = loaded && items.length === 0;
  const list = showPlaceholder ? [PLACEHOLDER_TESTIMONIAL] : items;

  // Se há depoimentos reais, usa a média real. Senão mostra 5 (placeholder).
  const displayAverage =
    stats.count > 0 ? stats.average : PLACEHOLDER_TESTIMONIAL.rating;
  const displayCount = stats.count > 0 ? stats.count : 0;

  return (
    <section className="py-8">
      <div className="px-6 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
          Quem usa, recomenda
        </h2>
        <p className="text-2xl font-bold text-text leading-tight">
          O que motoristas e pais andam falando.
        </p>

        {/* Cabeçalho com média de estrelas */}
        <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5">
          <Stars value={displayAverage} />
          <div>
            <p className="text-lg font-bold text-text leading-tight tabular-nums">
              {displayAverage.toFixed(1)}
            </p>
            <p className="text-[10px] text-textMuted leading-tight">
              {displayCount > 0
                ? `${displayCount} ${
                    displayCount === 1 ? 'avaliação' : 'avaliações'
                  }`
                : 'em breve'}
            </p>
          </div>
        </div>
      </div>

      {/* Carrossel de cards */}
      <div className="mt-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-3 px-6 pb-2">
          {list.map((t) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              isPlaceholder={showPlaceholder}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial, isPlaceholder }) {
  const { firstName, photoURL, rating, comment, role } = testimonial;
  const isAdmin = role === 'admin';

  return (
    <div className="snap-center shrink-0 w-72 bg-card rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col">
      <Quote size={20} className="text-primary/50 mb-2" />
      <p className="text-sm text-text leading-relaxed flex-1">
        &ldquo;{comment}&rdquo;
      </p>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
        <Avatar
          photoURL={photoURL}
          kind={isAdmin ? 'admin' : 'adult'}
          name={firstName}
          seed={testimonial.id}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text leading-tight flex items-center gap-1.5">
            {firstName}
            {isPlaceholder && (
              <span className="text-[9px] font-semibold uppercase tracking-widest text-textMuted bg-gray-100 px-1.5 py-0.5 rounded">
                exemplo
              </span>
            )}
          </p>
          <p className="text-[11px] text-textMuted inline-flex items-center gap-1 mt-0.5">
            {isAdmin ? (
              <>
                <Bus size={11} /> Motorista
              </>
            ) : (
              <>
                <Users size={11} /> Pai · Mãe
              </>
            )}
          </p>
        </div>
        <Stars value={rating} size={14} />
      </div>
    </div>
  );
}

/**
 * Linha de estrelas amber (preenchidas até `value`). Aceita fração
 * (ex: 4.7 mostra 4 cheias + 1 meio cheia) usando overlay.
 */
function Stars({ value, size = 16 }) {
  const full = Math.floor(value);
  const partial = value - full;
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        if (n <= full) {
          return (
            <Star
              key={n}
              size={size}
              className="text-amber-400 fill-amber-400"
            />
          );
        }
        if (n === full + 1 && partial > 0) {
          return (
            <span key={n} className="relative inline-flex">
              <Star size={size} className="text-gray-300 fill-gray-200" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${partial * 100}%` }}
              >
                <Star
                  size={size}
                  className="text-amber-400 fill-amber-400"
                />
              </span>
            </span>
          );
        }
        return (
          <Star
            key={n}
            size={size}
            className="text-gray-300 fill-gray-200"
          />
        );
      })}
    </div>
  );
}

// Depoimento fictício pra ocupar a seção enquanto não há reviews reais.
// É exibido com a tag "exemplo" pra ser honesto com o visitante.
const PLACEHOLDER_TESTIMONIAL = {
  id: 'placeholder',
  firstName: 'Tio Nino',
  photoURL: null,
  rating: 5,
  comment:
    'Mudou minha rotina. Os pais sabem onde eu tô, eu sei quem faltou, e a mensalidade tá organizada sem caderninho. Parece bobo, mas faz uma diferença danada no dia a dia.',
  role: 'admin',
};
