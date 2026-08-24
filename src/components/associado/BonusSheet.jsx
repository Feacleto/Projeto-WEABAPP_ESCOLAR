import { useEffect, useState } from 'react';
import { Gift, PartyPopper, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA, SheetCard, SheetGhost } from '../common/Sheet';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyEntryBonus,
  spinEntryBonus,
} from '../../services/entryBonusService';
import { salesWhatsAppLink } from '../../config/developer';

/**
 * A roleta dos meses sem taxa — o primeiro acesso do associado.
 *
 * A ANIMAÇÃO ENCENA UM RESULTADO QUE JÁ EXISTE
 * O sorteio é do servidor: o toque chama a callable, ela grava o prêmio e
 * responde, e só então a roda gira e para NAQUELE valor. Esta tela nunca
 * decide o número — se decidisse, qualquer pessoa com o devtools aberto
 * tiraria quatro meses. Por isso o serviço de propósito não expõe função que
 * gere número: não há como "adiantar" a animação.
 *
 * `novo: false` NÃO ANIMA
 * Quer dizer que a conta já tinha girado (rede caiu no meio, ou ele voltou).
 * Nesse caso a tela mostra o valor guardado direto. Girar de novo daria a
 * impressão de um segundo sorteio que não houve — e faria o motorista achar
 * que perdeu um prêmio melhor.
 *
 * A MATEMÁTICA DA PARADA
 * Quatro fatias de 90°, ponteiro no topo. Pra a fatia k parar sob o ponteiro,
 * a roda gira `voltas * 360 - (k * 90 + 45)`: o 45 centraliza a fatia, e as
 * voltas existem só pelo drama. Sem o `-`, a roda pararia com a fatia do
 * outro lado — erro que só aparece quando alguém confere o número contra o
 * desenho.
 *
 * Em prefers-reduced-motion ela não gira: mostra o resultado. A informação é
 * a mesma; o que muda é o espetáculo.
 */

const VOLTAS = 5;
const DURACAO_MS = 3400;

export default function BonusSheet({ open, onClose }) {
  const { profile } = useAuth();

  const [bonus, setBonus] = useState(null); // { meses } quando revelado
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
    getMyEntryBonus()
      .then((b) => {
        if (!vivo) return;
        if (b) {
          setBonus(b);
          setAngulo(anguloDe(b.meses));
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
      const r = await spinEntryBonus();

      // Já tinha girado: mostra o guardado, sem encenar sorteio.
      if (r.novo === false) {
        setAngulo(anguloDe(r.meses));
        setBonus({ meses: r.meses });
        setGirando(false);
        return;
      }

      if (reduzido) {
        setAngulo(anguloDe(r.meses));
        setBonus({ meses: r.meses });
        setGirando(false);
        return;
      }

      setAngulo(VOLTAS * 360 - (indiceDe(r.meses) * 90 + 45));
      setTimeout(() => {
        setBonus({ meses: r.meses });
        setGirando(false);
      }, DURACAO_MS);
    } catch (err) {
      setGirando(false);
      toast.error(
        err?.message ||
          'Não deu pra girar agora. Tente de novo em alguns instantes.'
      );
    }
  };

  const meses = bonus?.meses;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={Gift}
      eyebrow="condição de entrada"
      title={meses ? 'Sua condição está garantida' : 'Seus meses sem taxa'}
      subtitle={
        meses
          ? 'Registrado na sua conta — não precisa fazer nada.'
          : 'O sistema está em teste, e você não começa pagando. Gire uma vez.'
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
            {/* Os números acompanham a rotação da roda — cada um no centro da
              * sua fatia (45°, 135°, 225°, 315°). */}
            {[1, 2, 3, 4].map((n, k) => (
              <span
                key={n}
                aria-hidden
                className="absolute left-1/2 top-1/2 font-mono text-lg font-bold text-white"
                style={{
                  transform: `rotate(${k * 90 + 45}deg) translateY(-3.6rem) rotate(${-(k * 90 + 45)}deg) translate(-50%,-50%)`,
                }}
              >
                {n}
              </span>
            ))}
          </div>
          <span className="absolute z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 bg-card font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
            meses
          </span>
        </div>

        {meses ? (
          <>
            <SheetCard className="w-full !border-emerald-200 !bg-emerald-50 text-center">
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
                <PartyPopper size={15} className="text-primary" />
                {meses} {meses === 1 ? 'mês' : 'meses'} sem taxa
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                Vale a partir do primeiro mês em que a taxa passaria a ser
                cobrada. Fica registrado na sua conta — ninguém precisa lembrar.
              </p>
            </SheetCard>

            <a
              href={salesWhatsAppLink(
                `Oi! Sou ${profile?.name?.split(' ')[0] || 'associado'} do Alô Buzinou e tirei ${meses} ${meses === 1 ? 'mês' : 'meses'} sem taxa no primeiro acesso.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="tap inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-card text-sm font-bold text-text"
            >
              <WhatsAppIcon size={16} colored={false} />
              Avisar o consultor
            </a>

            <SheetGhost onClick={onClose}>Começar a usar</SheetGhost>
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
              Uma tentativa por associado. O resultado é sorteado no servidor e
              gravado antes de aparecer aqui — não tem como girar de novo pra
              melhorar, e não tem como perder se a internet cair.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Índice da fatia (0..3) do prêmio de N meses. */
function indiceDe(meses) {
  return Math.min(3, Math.max(0, Number(meses) - 1));
}

/** Ângulo final que deixa a fatia do prêmio sob o ponteiro. */
function anguloDe(meses) {
  return VOLTAS * 360 - (indiceDe(meses) * 90 + 45);
}
