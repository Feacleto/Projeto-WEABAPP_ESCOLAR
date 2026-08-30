import { Home, Bus, School, CheckCircle2 } from 'lucide-react';
import { horaDoMarco } from '../../services/ridesService';

/**
 * Tracker visual do trajeto da criança — estilo "rastreio de pedido"
 * (Mercado Livre / iFood). 4 etapas conectadas por linhas que mudam de cor
 * conforme o progresso.
 *
 * Mapeamento do status efetivo:
 *   home      → etapa 1 (em casa)
 *   onboard   → etapa 2 (na perua)
 *   atSchool  → etapa 3 (na escola)
 *   delivered → etapa 4 (voltou)
 *
 * Etapa atual: ponto colorido com anel pulsante.
 * Etapas anteriores: ponto verde com check.
 * Etapas futuras: ponto cinza.
 */

const STEPS = [
  { key: 'home', label: 'Em casa', icon: Home },
  { key: 'onboard', label: 'Na perua', icon: Bus },
  { key: 'atSchool', label: 'Na escola', icon: School },
  { key: 'delivered', label: 'Voltou', icon: CheckCircle2 },
];

/**
 * `ride` é opcional: quando vem, cada etapa cumprida ganha a hora em que
 * aconteceu de verdade. Sem ele o tracker segue como era — as quatro etapas
 * sem hora nenhuma, que é meio caminho entre informar e não informar.
 */
export default function RouteTracker({ status = 'home', compact = false, ride = null }) {
  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === status)
  );

  return (
    <div
      className={`bg-card rounded-2xl shadow-sm ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="relative flex items-start justify-between">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="relative flex flex-col items-center flex-1 min-w-0"
            >
              {/* Linha conectora pra trás (exceto no primeiro) */}
              {i > 0 && (
                <div
                  aria-hidden
                  className={`absolute top-4 right-1/2 w-full h-0.5 ${
                    i <= currentIdx ? 'bg-primary' : 'bg-border'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Ponto */}
              <div
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? 'bg-primary text-white shadow-focus'
                    : active
                    ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-neutro text-textMuted border-2 border-border'
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                )}
                <Icon size={16} className="relative" />
              </div>

              {/* Label */}
              <p
                className={`text-[10px] mt-1.5 font-semibold text-center leading-tight max-w-[60px] ${
                  done || active ? 'text-text' : 'text-textMuted'
                }`}
              >
                {step.label}
              </p>

              {/* A hora em que a etapa aconteceu. Só aparece pra etapa
                * cumprida: hora em etapa futura seria previsão disfarçada
                * de registro. */}
              {(done || active) && horaDoMarco(ride, step.key) && (
                <p className="text-[9px] mt-0.5 font-mono text-textMuted tabular-nums">
                  {horaDoMarco(ride, step.key)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
