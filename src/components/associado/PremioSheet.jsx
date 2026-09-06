import { useEffect, useState } from 'react';
import { Gift, PartyPopper, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA, SheetCard, SheetGhost } from '../common/Sheet';
import { girarPremio, meuPremio } from '../../services/premioService';
import { mensagemDeErro } from '../../services/callableError';
import { PREMIOS_DA_ROLETA } from '../../dominio/associacao/planos.js';

/**
 * A ROLETA — o prêmio de quem acabou de contratar.
 *
 * ── ELA MUDOU DE MOMENTO E DE PRÊMIO EM 06/09/2026
 * Girava no primeiro acesso e sorteava de 1 a 4 meses sem taxa, para o
 * motorista usar o app antes de existir cobrança. Esse papel virou do TESTE DE
 * TRÊS MESES — e as duas coisas juntas custavam até cinco meses e meio sem
 * receita por associado, comprando o que o teste já comprava sozinho.
 *
 * Agora são quatro prêmios de outra natureza (dois meses sem taxa, dois
 * descontos pelos 12 meses do contrato) e ela gira DEPOIS da contratação. O
 * prêmio deixou de ser isca e virou reconhecimento de quem decidiu.
 *
 * ── A ANIMAÇÃO ENCENA UM RESULTADO QUE JÁ EXISTE
 * O sorteio é do servidor: o toque chama a callable, ela grava o prêmio, APLICA
 * na conta e responde — e só então a roda gira e para naquele valor. Esta tela
 * nunca decide o número. Se decidisse, qualquer pessoa com o devtools aberto
 * tiraria o melhor prêmio. Por isso o serviço de propósito não expõe função que
 * gere número: não há como "adiantar" a animação.
 *
 * ── `novo: false` NÃO ANIMA
 * Quer dizer que a conta já tinha girado (a rede caiu no meio, ou ele voltou).
 * A tela mostra o valor guardado direto. Girar de novo daria a impressão de um
 * segundo sorteio que não houve — e faria o motorista achar que perdeu um
 * prêmio melhor.
 *
 * ── A MATEMÁTICA DA PARADA
 * Quatro fatias de 90°, ponteiro no topo. Para a fatia k parar sob o ponteiro,
 * a roda gira `voltas * 360 - (k * 90 + 45)`: o 45 centraliza a fatia, e as
 * voltas existem só pelo drama. Sem o sinal negativo, a roda pararia com a
 * fatia do outro lado — erro que só aparece quando alguém confere o prêmio
 * contra o desenho.
 *
 * O índice vem da POSIÇÃO do prêmio na régua, não do valor dele. Com prêmios
 * de duas naturezas (meses e percentual) não existe mais um número para
 * ordenar, e tentar derivar a fatia do valor foi o que quase fez a roda parar
 * na fatia errada.
 *
 * Em `prefers-reduced-motion` ela não gira: mostra o resultado. A informação é
 * a mesma; o que muda é o espetáculo.
 */

const VOLTAS = 5;
const DURACAO_MS = 3400;

export default function PremioSheet({ open, onClose }) {
  const [premio, setPremio] = useState(null); // { premioId, meses, fracao }
  const [girando, setGirando] = useState(false);
  const [angulo, setAngulo] = useState(0);
  const [carregando, setCarregando] = useState(true);

  const reduzido =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Visita seguinte: lê o documento direto, sem gastar invocação de função.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    meuPremio()
      .then((p) => {
        if (!vivo) return;
        if (p) {
          setPremio(p);
          setAngulo(anguloDe(p.premioId));
        }
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [open]);

  const girar = async () => {
    setGirando(true);
    try {
      const r = await girarPremio();

      // Já tinha girado, ou o aparelho pede menos movimento: mostra o
      // resultado sem encenar sorteio.
      if (r.novo === false || reduzido) {
        setAngulo(anguloDe(r.premioId));
        setPremio(r);
        setGirando(false);
        return;
      }

      setAngulo(anguloDe(r.premioId));
      setTimeout(() => {
        setPremio(r);
        setGirando(false);
      }, DURACAO_MS);
    } catch (err) {
      setGirando(false);
      // "internal" na tela mandaria o motorista culpar a internet dele.
      toast.error(mensagemDeErro(err, 'girar a roleta'), { duration: 7000 });
    }
  };

  const rotulo = premio ? rotuloDe(premio.premioId) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={Gift}
      eyebrow="prêmio de associação"
      title={rotulo ? 'Seu prêmio está garantido' : 'Você tem um giro'}
      subtitle={
        rotulo
          ? 'Já está aplicado na sua conta — não precisa fazer nada.'
          : 'Você acabou de contratar. Gire uma vez.'
      }
    >
      <div className="flex flex-col items-center gap-5">
        {/* A roda: quatro fatias, ponteiro fixo no topo. */}
        <div className="relative flex h-52 w-52 items-center justify-center">
          <span
            aria-hidden
            className="absolute -top-1 z-20 h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-primary"
          />
          <div
            className="relative h-48 w-48 rounded-full border-4 border-primary/20 shadow-lg"
            style={{
              background:
                'conic-gradient(#1F5F3F 0deg 90deg, #52C41A 90deg 180deg, #F5A623 180deg 270deg, #143F2A 270deg 360deg)',
              transform: `rotate(${angulo}deg)`,
              transition: girando
                ? `transform ${DURACAO_MS}ms cubic-bezier(.12,.72,.06,1)`
                : 'none',
            }}
          >
            {/* CADA FATIA MOSTRA O PRÊMIO DELA, na ordem da régua — é essa
              * ordem que faz a roda parar no lugar certo. Dois prêmios são
              * meses e dois são desconto, e o rótulo curto separa os dois sem
              * explicação: "2M" e "30%" não se confundem. */}
            {PREMIOS_DA_ROLETA.map((p, k) => (
              <span
                key={p.id}
                aria-hidden
                className="absolute left-1/2 top-1/2 font-mono text-base font-bold text-white"
                style={{
                  transform: `rotate(${k * 90 + 45}deg) translateY(-3.6rem) rotate(${-(k * 90 + 45)}deg) translate(-50%,-50%)`,
                }}
              >
                {p.fracao ? `${Math.round(p.fracao * 100)}%` : `${p.meses}M`}
              </span>
            ))}
          </div>
          <span className="absolute z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 bg-card font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
            gire
          </span>
        </div>

        {rotulo ? (
          <>
            <SheetCard className="w-full !border-primaryBorder !bg-primarySoft text-center">
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
                <PartyPopper size={15} className="text-primary" />
                {rotulo}
              </p>
              {/* A DIFERENÇA QUE IMPORTA, dita: mês sem taxa é fatura que não
                * vem; desconto é fatura menor. Os dois chegam a menos dinheiro
                * e não são a mesma coisa na hora de conferir. */}
              <p className="mt-1 text-xs leading-relaxed text-primary/80">
                {premio.fracao
                  ? 'Já entrou no valor da sua mensalidade, pelos 12 meses do contrato.'
                  : 'Nesses meses não vem fatura nenhuma. Fica registrado na sua conta — ninguém precisa lembrar.'}
              </p>
            </SheetCard>

            <SheetGhost onClick={onClose}>Voltar ao app</SheetGhost>
          </>
        ) : (
          <>
            <SheetCTA
              icon={Sparkles}
              loading={girando || carregando}
              disabled={girando || carregando}
              onClick={girar}
            >
              {girando ? 'Girando…' : 'Girar uma vez'}
            </SheetCTA>
            <p className="text-center text-[11px] leading-relaxed text-textMuted">
              Uma vez por associado. O resultado é sorteado no servidor e
              aplicado antes de aparecer aqui — não tem como girar de novo pra
              melhorar, e não tem como perder se a internet cair.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Índice da fatia (0..3) — a POSIÇÃO do prêmio na régua, não o valor dele. */
function indiceDe(premioId) {
  const i = PREMIOS_DA_ROLETA.findIndex((p) => p.id === premioId);
  return i < 0 ? 0 : i;
}

/** Ângulo final que deixa a fatia do prêmio sob o ponteiro. */
function anguloDe(premioId) {
  return VOLTAS * 360 - (indiceDe(premioId) * 90 + 45);
}

/** O nome do prêmio, escrito como a pessoa vai contar para alguém. */
function rotuloDe(premioId) {
  return PREMIOS_DA_ROLETA.find((p) => p.id === premioId)?.rotulo || null;
}
