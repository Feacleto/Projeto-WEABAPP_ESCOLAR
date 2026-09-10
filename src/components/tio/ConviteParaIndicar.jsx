import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { valorDaIndicacao, PISO_DA_FATURA } from '../../dominio/associacao/planos.js';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';

/**
 * O CONVITE A INDICAR — o mesmo cartão, em cinco momentos diferentes.
 *
 * ── ⚠️ POR QUE ELE PRECISOU EXISTIR
 * O desconto de indicação estava INTEIRO no código — régua, carência,
 * registro por telefone, casamento nos dois caminhos de baixa, tela de
 * acompanhamento e aviso quando ativa — e **a oferta não existia em lugar
 * nenhum**. O único convite do produto era uma linha no fim da rolagem do
 * Início, dentro de uma folha: três toques a partir da tela inicial, para um
 * desconto que a plataforma quer que ele use.
 *
 * Cada tela passa o próprio `titulo`, porque o motivo de o convite aparecer
 * ali é diferente em cada uma. O que NÃO muda é o número — e é por isso que
 * ele mora aqui, e não copiado cinco vezes.
 *
 * ── ⚠️ O NÚMERO É A DIFERENÇA REAL, NUNCA "5% DA SUA CONTA"
 * `valorDaIndicacao` devolve quanto a PRÓXIMA indicação tira, passando pelo
 * piso. Para quem tem 8 crianças e 30% travado, a 7ª vale sessenta centavos e
 * a 8ª vale zero: dizer "5%" para essa pessoa é prometer quatro vezes o que
 * ela vai receber. A queixa que nasce daí — *"indiquei e não recebi"* — é a
 * que a coleção `indicacoes` inteira existe para evitar.
 *
 * ── OS TRÊS ESTADOS, E NENHUM DELES MENTE
 *
 *   1. **Sem plano** (está no teste). A fatura é isenta, então qualquer
 *      desconto vale R$ 0 — e o app NÃO pode dizer "sua conta cai R$ 5,90",
 *      porque ela não cai. A frase vai para o futuro, sem número.
 *   2. **No piso.** A conta dele já está no mínimo e novas indicações não
 *      descem mais. Isso é dito ANTES, aqui, e não depois, na fatura em que o
 *      desconto não veio — é a diferença entre uma regra e uma desculpa.
 *   3. **Valendo.** O valor em reais, do tamanho da operação dele.
 *
 * ── ONDE ELE NUNCA APARECE
 * No app da família (ela não indica motorista), durante a rota, no sino
 * durante os 90 dias, e **na tela de cancelamento** — desconto que só surge
 * quando ele ameaça sair prova que o preço era teatro.
 */
export default function ConviteParaIndicar({ titulo, className = '' }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const ativas = Number(profile?.indicacoesAtivas) || 0;
  const valor = valorDaIndicacao({
    criancas: Number(profile?.criancasAtivas) || 0,
    plano: profile?.plano,
    fundador: profile?.condicaoFundador || null,
    descontos: profile?.descontos,
    mes: getCurrentMonthKey(),
    numero: ativas + 1,
  });

  const frase =
    valor === null ? (
      // Ainda no teste: a data é verdadeira, o valor não seria.
      <>
        Cada motorista que você trouxer <strong>baixa a sua mensalidade</strong> a
        partir da sua primeira fatura, e continua baixando enquanto ele for cliente.
      </>
    ) : valor === 0 ? (
      // O piso comeu. Dizer aqui, não na fatura.
      <>
        Sua conta já está no valor mínimo de {formatCurrency(PISO_DA_FATURA)}, então
        novas indicações <strong>não descem mais</strong> — até sua operação crescer.
      </>
    ) : (
      <>
        Cada motorista que você trouxer tira <strong>{formatCurrency(valor)} por mês</strong>{' '}
        da sua conta, enquanto ele for cliente.
      </>
    );

  return (
    <section
      className={`rounded-2xl border border-primaryBorder bg-primarySoft p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primaryDark">
          <UserPlus size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight text-text">{titulo}</p>
          <p className="mt-1 text-sm leading-snug text-textMuted">{frase}</p>
          {ativas > 0 && (
            <p className="mt-1 text-xs text-textMuted">
              Você já tem {ativas}{' '}
              {ativas === 1 ? 'indicação valendo' : 'indicações valendo'}.
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('/tio/indicar')}
            className="tap mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
          >
            Indicar um colega
          </button>
        </div>
      </div>
    </section>
  );
}
