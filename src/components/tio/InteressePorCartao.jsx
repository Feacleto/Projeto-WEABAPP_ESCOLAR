import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { registrarInteresse, watchInteresse } from '../../services/interesseService';

/**
 * "QUERO RECEBER A MENSALIDADE POR CARTÃO" — uma pergunta, não um anúncio.
 *
 * ── ⚠️ ELA NÃO PROMETE NADA, E ESSA É A REGRA INTEIRA
 * `docs/negocio.md` é explícito: *"não anunciar antes de existir — prometer
 * data para um autônomo e não cumprir custa a confiança que é a visão da
 * empresa"*. Então o texto pergunta **interesse**, nunca anuncia recurso, e não
 * há data em lugar nenhum.
 *
 * Um "em breve" aqui seria a promessa mais barata de fazer e a mais cara de
 * quebrar: quem depende do dinheiro da mensalidade organiza o mês em cima dela.
 *
 * ── POR QUE PERGUNTAR ANTES DE CONSTRUIR
 * O caminho escolhido é **split, nunca escrow** — o dinheiro cai na subconta do
 * motorista, e a plataforma nunca retém, senão a frase "a mensalidade é sua"
 * vira falsa e o item 7 dos Termos cai junto.
 *
 * Só que boa parte dos PSPs exige **CNPJ** para subconta com split, e o modelo
 * decidiu que o motorista **não precisa de MEI**. Se nenhum aceitar pessoa
 * física, o recurso não existe para a maior parte da base — e esta pergunta é o
 * que diz se vale a pesquisa. Custo quase zero, e o resultado **mata ou
 * justifica uma fase inteira**.
 *
 * ── ELA NÃO PODE SER UM MODAL
 * Isto é curiosidade da plataforma, não necessidade dele. Interromper a
 * operação de alguém para fazer uma pesquisa é cobrar atenção por um benefício
 * que ainda não existe. Ela mora no fim da tela de Financeiro, onde a pergunta
 * já está na cabeça de quem está lá.
 */
export default function InteressePorCartao() {
  const { user } = useAuth();
  const [ja, setJa] = useState(undefined);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return watchInteresse(user.uid, setJa, () => setJa(null));
  }, [user?.uid]);

  if (ja === undefined) return null;

  const marcar = async () => {
    setSalvando(true);
    try {
      await registrarInteresse(user.uid, 'cartao');
      toast.success('Anotado. Obrigado!');
    } catch (err) {
      toast.error(err.message || 'Não deu pra registrar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-dashed border-border p-4">
      <h3 className="inline-flex items-center gap-1.5 text-xs font-bold text-text">
        <CreditCard size={13} />
        Uma pergunta rápida
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-textMuted">
        Algumas famílias pedem para pagar no cartão. Estamos <strong>estudando</strong>{' '}
        se dá para oferecer isso — o dinheiro continuaria caindo direto na sua
        conta, como o PIX cai hoje.
        {/* ⚠️ SEM DATA E SEM "EM BREVE". Prometer prazo para um autônomo e não
          * cumprir custa a confiança que é a visão da empresa. */}
        {' '}Ainda não existe, e não temos data — queremos só saber se te
        interessa.
      </p>

      {ja ? (
        <p className="mt-3 text-xs font-bold text-primary">
          Você já disse que tem interesse. A gente avisa se sair.
        </p>
      ) : (
        <button
          type="button"
          onClick={marcar}
          disabled={salvando}
          className="tap mt-3 h-9 rounded-xl border border-border px-3 text-xs font-bold text-text disabled:opacity-40"
        >
          {salvando ? 'Anotando…' : 'Tenho interesse'}
        </button>
      )}
    </section>
  );
}
