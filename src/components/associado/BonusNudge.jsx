import { useEffect, useState } from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import BonusSheet from './BonusSheet';
import { useAuth } from '../../hooks/useAuth';
import { getMyEntryBonus } from '../../services/entryBonusService';

/**
 * O cartão que leva o associado à roleta — e desaparece pra sempre depois.
 *
 * POR QUE ELE EXISTE SEPARADO DA FOLHA
 * A roleta é uma vez por conta. Um cartão que fica no painel depois de girado
 * viraria enfeite, e enfeite que promete prêmio é pior que nada. Então quem
 * decide se há algo a oferecer é a LEITURA do documento: se `entryBonuses`
 * já tem registro, este componente não renderiza nada.
 *
 * Ele lê direto o documento (não a callable): é o que as rules liberam pro
 * dono, e ler não deve custar invocação de função.
 *
 * SILÊNCIO ENQUANTO NÃO SABE
 * Nada aparece antes da leitura voltar. Cartão que pisca e desaparece no meio
 * do painel é pior que cartão que demora meio segundo.
 */
export default function BonusNudge() {
  const { profile } = useAuth();
  const [precisaGirar, setPrecisaGirar] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    // Só associado (motorista). O responsável não tem taxa, então não tem
    // condição de entrada.
    if (profile?.role !== 'admin') return;

    let vivo = true;
    getMyEntryBonus()
      .then((b) => {
        if (vivo && !b) setPrecisaGirar(true);
      })
      .catch(() => {
        // Sem callable no ar ou sem permissão: o painel não deve quebrar por
        // causa de um brinde. Fica quieto.
      });
    return () => {
      vivo = false;
    };
  }, [profile?.role]);

  if (!precisaGirar) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ouro via-amber-500 to-warning p-4 text-white shadow-focus">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/20">
            <Gift size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold leading-tight tracking-tight">
              Você tem meses sem taxa pra girar
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/85">
              O sistema está em teste e você não começa pagando. Uma tentativa:
              de 1 a 4 meses.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAberto(true)}
          className="tap mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#0B1210]"
        >
          Girar agora
          <ArrowRight size={16} />
        </button>
      </div>

      <BonusSheet
        open={aberto}
        onClose={() => {
          setAberto(false);
          // Depois de girar, o cartão não volta: a folha já mostrou o
          // resultado e a leitura do documento passaria a devolvê-lo.
          getMyEntryBonus()
            .then((b) => {
              if (b) setPrecisaGirar(false);
            })
            .catch(() => {});
        }}
      />
    </>
  );
}
