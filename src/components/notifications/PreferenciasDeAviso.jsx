import { useState } from 'react';
import { BellOff, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  CHAVES_DE_AVISO,
  normalizarPreferencias,
} from '../../dominio/identidade/avisos.js';
import { salvarPreferenciasDeAviso } from '../../services/notificationsService';

/**
 * AS DUAS CHAVES — o que a pessoa pode calar no aparelho.
 *
 * ── ⚠️ POR QUE ISTO PRECISOU EXISTIR
 * O app tinha 31 tipos de aviso e **nenhuma preferência**. Quem se irritasse
 * com uma peça comercial tinha uma opção só: desligar push no sistema
 * operacional — e aí perdia *"Lucas chegou em casa"*, que é o produto. Era o
 * maior risco do conjunto, e crescia a cada tipo novo.
 *
 * ── DUAS CHAVES, NUNCA TRINTA E UMA
 * Preferência por TIPO é uma tela que ninguém lê, e que envelhece sozinha: o
 * tipo novo nasceria ligado sem ninguém ter escolhido isso. Por ESPÉCIE, duas
 * linhas cobrem tudo e todo tipo futuro entra classificado — ver
 * `dominio/identidade/avisos.js`.
 *
 * ── O QUE NÃO APARECE AQUI, E ISSO É A DECISÃO
 * Chegada da criança, recado do motorista, rota atrasada, conta pausada. Não
 * há interruptor porque não deve haver: um é o produto acontecendo, o outro é
 * o app avisando que parou de conseguir prometer o que promete. Quem quer
 * desligar isso não quer silêncio, quer sair — e para sair existe cancelar.
 *
 * ── ⚠️ A FRASE QUE IMPEDE O MAL-ENTENDIDO CARO
 * "Desligar para o celular de tocar — a cobrança e o e-mail continuam." Sem
 * ela, alguém desliga Vencimentos achando que resolveu a dívida e descobre no
 * bloqueio. A frase mora na régua (`CHAVES_DE_AVISO`), não aqui, e o teste
 * exige que ela diga isso.
 *
 * ── O AVISO CONTINUA NO SINO
 * A preferência silencia o TOQUE, não o registro: `push.js` desiste de mandar
 * a notificação, e o documento em `notifications` continua sendo escrito.
 * Quem pediu silêncio não pediu amnésia, e ela precisa poder conferir depois
 * o que foi dito sobre o dinheiro dela.
 */
export default function PreferenciasDeAviso() {
  const { user, profile } = useAuth();
  const atuais = normalizarPreferencias(profile?.avisosDesligados);
  const [desligadas, setDesligadas] = useState(atuais);
  const [salvando, setSalvando] = useState(null);

  const alternar = async (especie) => {
    const proximas = desligadas.includes(especie)
      ? desligadas.filter((e) => e !== especie)
      : [...desligadas, especie];
    const limpa = normalizarPreferencias(proximas);

    // Otimista: o interruptor responde na hora. Se a gravação falhar, ele
    // volta — um botão que fica parado esperando a rede parece quebrado.
    setDesligadas(limpa);
    setSalvando(especie);
    try {
      await salvarPreferenciasDeAviso(user?.uid, limpa);
    } catch {
      setDesligadas(desligadas);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
        <BellOff size={15} />
        O que pode tocar no seu celular
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-textMuted">
        Avisos sobre a criança e sobre a rota chegam sempre — eles são o
        produto. Estes dois você escolhe.
      </p>

      <div className="mt-3 space-y-2">
        {CHAVES_DE_AVISO.map(({ especie, titulo, descricao }) => {
          const ligada = !desligadas.includes(especie);
          return (
            <button
              key={especie}
              type="button"
              role="switch"
              aria-checked={ligada}
              disabled={salvando === especie}
              onClick={() => alternar(especie)}
              className="tap flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left disabled:opacity-60"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  ligada
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-neutro text-transparent'
                }`}
              >
                <Check size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-text">{titulo}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-textMuted">
                  {descricao}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
