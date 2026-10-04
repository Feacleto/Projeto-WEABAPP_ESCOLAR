import { useState } from 'react';
import { BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
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
 * ── ⚠️ MORA SÓ NO PERFIL (04/10/2026, decisão do dono)
 * Ficava também no fim do sino. O sino virou só a caixa (modelo D), e as
 * chaves viraram interruptores, com "Rota e criança" travado em "Sempre
 * ligado" à vista — o que não se desliga também aparece, sem explicação.
 *
 * ⚠️ E O PERFIL É RELIDO DEPOIS DE SALVAR. O estado começa do `profile`, que
 * é lido uma vez: sem reler, a tela que montasse de novo mostrava a escolha
 * ANTIGA logo depois do "Pronto: desligado" (o print do dono, 04/10/2026).
 *
 * ── O AVISO CONTINUA NO SINO
 * A preferência silencia o TOQUE, não o registro: `push.js` desiste de mandar
 * a notificação, e o documento em `notifications` continua sendo escrito.
 * Quem pediu silêncio não pediu amnésia, e ela precisa poder conferir depois
 * o que foi dito sobre o dinheiro dela.
 */
export default function PreferenciasDeAviso() {
  const { user, profile, refreshProfile } = useAuth();
  const cobranca = useCobrancaLigada();
  const atuais = normalizarPreferencias(profile?.avisosDesligados);
  const [desligadas, setDesligadas] = useState(atuais);
  const [salvando, setSalvando] = useState(null);

  const alternar = async (especie, titulo) => {
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
      refreshProfile?.();
      // Salvar CONFIRMA. A caixinha muda na hora (otimista), e por isso
      // mesmo não prova nada: sem esta frase, ela não sabe se a escolha
      // ficou gravada ou se vai voltar sozinha na próxima abertura.
      const ficouLigada = !limpa.includes(especie);
      toast.success(`Pronto: aviso de ${titulo} ${ficouLigada ? 'ligado' : 'desligado'}.`, {
        duration: 2500,
      });
    } catch {
      setDesligadas(desligadas);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-2">
      <h2 className="inline-flex items-center gap-2 pt-2 text-base font-extrabold text-text">
        {/* Sino tocando, não sino cortado: o título é sobre o que PODE
          * tocar, e o sino riscado lia como "silenciado" antes de ela
          * escolher qualquer coisa. */}
        <BellRing size={18} />
        Avisos no celular
      </h2>

      <div className="flex min-h-16 items-center gap-3 border-b border-border">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">Rota e criança</span>
          <span className="block text-sm text-textMuted">Sempre ligado</span>
        </span>
        <Interruptor ligado travado />
      </div>

      {CHAVES_DE_AVISO.map(({ especie, titulo, descricao: comCobranca, descricaoSemCobranca }, i) => {
        const descricao = cobranca ? comCobranca : descricaoSemCobranca || comCobranca;
        const ligada = !desligadas.includes(especie);
        return (
          <button
            key={especie}
            type="button"
            role="switch"
            aria-checked={ligada}
            disabled={salvando === especie}
            onClick={() => alternar(especie, titulo)}
            className={`tap flex min-h-16 w-full items-center gap-3 py-2 text-left disabled:opacity-60 ${
              i < CHAVES_DE_AVISO.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-text">{titulo}</span>
              <span className="mt-0.5 block text-sm leading-snug text-textMuted">{descricao}</span>
            </span>
            <Interruptor ligado={ligada} />
          </button>
        );
      })}
    </section>
  );
}

/** O interruptor do design system: a bolinha desliza, o trilho acende. */
function Interruptor({ ligado, travado = false }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-7 w-[46px] shrink-0 rounded-full ${
        ligado ? 'bg-primary' : 'bg-borderStrong'
      } ${travado ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-rest transition-transform duration-estado ${
          ligado ? 'translate-x-[20px]' : 'translate-x-0.5'
        }`}
      />
    </span>
  );
}
