import WhatsAppIcon from '../common/WhatsAppIcon';
import { salesWhatsAppLink } from '../../config/developer';

/**
 * "Pedir ajuda a um consultor" — o humano a um toque.
 *
 * O rótulo era "Falar com um consultor", e "falar" soa como etapa de venda:
 * quem já desconfia que vai ouvir uma proposta não toca. "Pedir ajuda" diz o
 * que ele de fato ganha do outro lado — alguém que configura o app com ele —
 * e é a mesma promessa que o pitch faz na última tela.
 *
 * POR QUE ELE EXISTE, E ONDE
 * A página explica a associação, o custo e a taxa. Isso responde a dúvida
 * geral, mas não responde A dúvida DELE: "quanto vai ficar na MINHA
 * mensalidade?". Essa conversa não caberia num texto — ela é uma negociação.
 * Então o botão aparece exatamente nos dois momentos em que a pergunta
 * nasce: depois de ver como começa, e ao lado da vaga.
 *
 * Ele PULSA porque é uma segunda opção: quem já decidiu aperta o botão
 * principal, quem travou precisa que algo se mexa no canto do olho. Respira
 * devagar (2,8s) em vez de piscar — e para de vez em prefers-reduced-motion.
 *
 * O número vem do canal comercial (`salesWhatsAppLink`), não do suporte
 * técnico, e a mensagem já vai escrita: o motorista só aperta enviar. Cada
 * tela passa o seu `assunto`, então a conversa começa com o contexto de onde
 * ele estava — quem atende não precisa perguntar "de onde você veio?".
 */
export default function ConsultorButton({
  assunto = 'a vaga de associado',
  tone = 'dark',
  className = '',
}) {
  const skin =
    tone === 'light'
      ? 'border-primary/25 bg-primary/5 text-primary'
      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200';

  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden
        className="cta-ring absolute inset-0 rounded-full border border-emerald-400/40"
      />
      <span
        aria-hidden
        className="cta-ring cta-ring-2 absolute inset-0 rounded-full border border-emerald-400/30"
      />
      <a
        href={salesWhatsAppLink(
          `Olá! Vi o Alô Buzinou e quero falar com um consultor sobre ${assunto}.`
        )}
        target="_blank"
        rel="noopener noreferrer"
        className={`tap animate-talk-pulse relative flex h-12 w-full items-center justify-center gap-2 rounded-full border text-sm font-bold ${skin}`}
      >
        <WhatsAppIcon size={17} colored={false} />
        Pedir ajuda a um consultor
      </a>
    </div>
  );
}
