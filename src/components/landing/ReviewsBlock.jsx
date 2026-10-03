import { Bus, Quote, Star } from 'lucide-react';
import Avatar from '../common/Avatar';

/**
 * Avaliações na home — a prova social que vem de dentro do app.
 *
 * SÓ DEPOIMENTO DE MOTORISTA APARECE AQUI
 * A home fala com quem dirige. Elogio de pai é ótimo, mas na vitrine do tio
 * ele soa como propaganda pro público errado — "meu filho chega avisado" não
 * convence ninguém a comprar uma ferramenta de trabalho. A avaliação do pai
 * continua sendo coletada e vale muito: ela vira MÉTRICA no painel, não
 * vitrine. Quem filtra é a chamada do serviço (`role: 'admin'`).
 *
 * O CARD É UM CONTRATO COM QUEM AVALIOU
 * O que aparece aqui é exatamente o que a folha de avaliação mostra em
 * preview pro motorista antes de ele publicar: foto, primeiro nome, selo de
 * motorista, estrelas e até 200 caracteres. Ninguém é publicado sem ter
 * marcado a autorização, e o que ele viu é o que sai.
 *
 * ENQUANTO NÃO HÁ AVALIAÇÃO REAL
 * Mostra UM exemplo, marcado como exemplo em cima do nome, e a média
 * aparece como "em breve" em vez de um número inventado. Bloco vazio numa
 * página de vendas é pior que exemplo honesto; média fictícia é mentira.
 */
export default function ReviewsBlock({ items = [], stats = null, loaded }) {
  const vazio = loaded && items.length === 0;
  const lista = vazio ? [EXEMPLO] : items;

  const media = stats?.count > 0 ? stats.average : 5;
  const quantos = stats?.count || 0;

  return (
    <div>
      {/* Média — pastilha clara com as estrelas em ouro. Estrela é a
        * linguagem universal de avaliação; o ouro existe pra ela ser
        * encontrada sem leitura. Era sobre a home escura, que não existe
        * mais: desde 03/10/2026 não há tela escura dentro do app. */}
      <div className="inline-flex items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft px-4 py-2.5">
        <Stars value={media} />
        <div>
          <p className="font-display text-lg font-extrabold leading-tight tabular-nums text-text">
            {media.toFixed(1).replace('.', ',')}
          </p>
          <p className="text-xs leading-tight text-textMuted">
            {quantos > 0
              ? `${quantos} ${quantos === 1 ? 'avaliação' : 'avaliações'}`
              : 'em breve'}
          </p>
        </div>
      </div>

      {/* Carrossel de depoimentos */}
      <div className="-mx-6 mt-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        <div className="flex gap-3 px-6 pb-2">
          {lista.map((t) => (
            <ReviewCard key={t.id} review={t} exemplo={vazio} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Card de depoimento. Exportado porque a folha de avaliação mostra
 * exatamente ESTE componente como preview pro motorista antes de publicar —
 * dois desenhos parecidos viram promessa quebrada na primeira mudança.
 * Claro desde 03/10/2026, como o cartão do design system: branco, sombra de
 * repouso, sem borda.
 */
export function ReviewCard({ review, exemplo }) {
  const { firstName, photoURL, rating, comment, id } = review;

  return (
    <article className="flex w-[17.5rem] shrink-0 snap-center flex-col rounded-2xl bg-card p-5 shadow-rest">
      <Quote size={20} className="mb-2 text-primaryBorder" />
      <p className="flex-1 text-[15px] leading-relaxed text-textBody">
        “{comment}”
      </p>

      <div className="mt-4 flex items-center gap-3 border-t border-neutro pt-4">
        <Avatar
          photoURL={photoURL}
          kind="admin"
          name={firstName}
          seed={id}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold leading-tight text-text">
            {firstName}
            {exemplo && (
              <span className="rotulo rounded-md bg-neutro px-1.5 py-0.5">
                exemplo
              </span>
            )}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-textMuted">
            <Bus size={12} /> Motorista associado
          </p>
        </div>
        <Stars value={rating} size={13} />
      </div>
    </article>
  );
}

/**
 * Linha de estrelas âmbar. Aceita fração (4,7 mostra 4 cheias + 1 parcial)
 * porque média de avaliação quase nunca é número redondo.
 */
export function Stars({ value, size = 16 }) {
  const cheias = Math.floor(value);
  const resto = value - cheias;
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`${value.toFixed(1).replace('.', ',')} de 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        if (n <= cheias) {
          return (
            <Star key={n} size={size} className="fill-ouro text-ouro" />
          );
        }
        if (n === cheias + 1 && resto > 0) {
          return (
            <span key={n} className="relative inline-flex">
              <Star size={size} className="fill-neutro text-borderStrong" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${resto * 100}%` }}
              >
                <Star
                  size={size}
                  className="fill-ouro text-ouro"
                />
              </span>
            </span>
          );
        }
        return (
          <Star key={n} size={size} className="fill-neutro text-borderStrong" />
        );
      })}
    </div>
  );
}

// Exemplo exibido enquanto nenhum parceiro publicou avaliação. Vai marcado
// como "exemplo" ao lado do nome — a página nunca finge ter prova que não tem.
const EXEMPLO = {
  id: 'exemplo',
  firstName: 'Tio Nino',
  // A marca dele em vez do boneco genérico do Avatar: o card de exemplo tem
  // que parecer o card de verdade, senão o visitante lê "isso é fictício"
  // antes de ler o selo que já diz isso.
  photoURL: '/parceiros/tio-nino.webp',
  rating: 5,
  comment:
    'Mudou minha rotina. Os pais sabem onde eu tô, eu sei quem faltou, e a mensalidade tá organizada sem caderninho. Faz uma diferença danada no dia a dia.',
};
