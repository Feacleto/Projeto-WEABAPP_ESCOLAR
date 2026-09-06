import { useEffect, useState } from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import PremioSheet from './PremioSheet';
import { useAuth } from '../../hooks/useAuth';
import { meuPremio } from '../../services/premioService';

/**
 * O cartão que leva o associado à roleta — e desaparece para sempre depois.
 *
 * ── ELE SÓ APARECE PARA QUEM JÁ CONTRATOU (06/09/2026)
 * A roleta era de ENTRADA: aparecia no topo do painel de quem acabou de criar
 * conta, oferecendo meses sem taxa antes de existir qualquer acordo. Ela virou
 * prêmio de CONVERSÃO, e a condição aqui é `profile.planoId` — a faixa que só
 * a callable `contratarPlano` escreve.
 *
 * A diferença não é de ordem, é de sentido: no topo do painel de quem está
 * conhecendo o app, um brinde é a primeira coisa que ele lê e desloca a rota
 * do dia. Depois de contratar, é a última coisa boa de uma decisão que ele
 * acabou de tomar.
 *
 * ── POR QUE ELE EXISTE SEPARADO DA FOLHA
 * A roleta é uma vez por conta. Um cartão que fica no painel depois de girado
 * viraria enfeite, e enfeite que promete prêmio é pior que nada. Quem decide se
 * há algo a oferecer é a LEITURA do documento: se `premios/{uid}` já tem
 * registro, este componente não renderiza nada.
 *
 * Ele lê direto o documento, não a callable: é o que as rules liberam para o
 * dono, e ler não deve custar invocação de função.
 *
 * ── SILÊNCIO ENQUANTO NÃO SABE
 * Nada aparece antes da leitura voltar. Cartão que pisca e some no meio do
 * painel é pior que cartão que demora meio segundo.
 */
export default function PremioNudge() {
  const { profile } = useAuth();
  const [precisaGirar, setPrecisaGirar] = useState(false);
  const [aberto, setAberto] = useState(false);

  const contratou = Boolean(profile?.planoId);

  useEffect(() => {
    // Só motorista, e só depois de contratar. O responsável não paga taxa, e
    // quem está em teste ainda não tem prêmio a receber.
    if (profile?.role !== 'admin' || !contratou) return;

    let vivo = true;
    meuPremio()
      .then((p) => {
        if (vivo && !p) setPrecisaGirar(true);
      })
      .catch(() => {
        // Sem callable no ar ou sem permissão: o painel não deve quebrar por
        // causa de um prêmio. Fica quieto.
      });
    return () => {
      vivo = false;
    };
  }, [profile?.role, contratou]);

  if (!precisaGirar) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ouro via-warning to-warning p-4 text-white shadow-focus">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/20">
            <Gift size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold leading-tight tracking-tight">
              Você tem um giro pra dar
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/85">
              Bem-vindo à associação. Uma tentativa: meses sem taxa ou desconto
              pelos 12 meses do contrato.
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

      <PremioSheet
        open={aberto}
        onClose={() => {
          setAberto(false);
          // Depois de girar, o cartão não volta: a folha já mostrou o
          // resultado, e a leitura do documento passa a devolvê-lo.
          meuPremio()
            .then((p) => {
              if (p) setPrecisaGirar(false);
            })
            .catch(() => {});
        }}
      />
    </>
  );
}
