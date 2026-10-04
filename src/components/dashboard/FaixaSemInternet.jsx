import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * "SEM INTERNET" — STATUS DE VERDADE, NÃO ENFEITE (03/10/2026).
 *
 * Sem rede, o Início e o mapa continuam mostrando o último estado que
 * chegou: "Na perua", "a perua está a 800 m". Nada na tela muda, e é isso
 * que engana — ela lê como agora o que pode ser de meia hora atrás, num
 * ponto de ônibus sem sinal. A faixa diz o que o app não sabe, que é a regra
 * de toda a tela dela: o app nunca afirma o que não sabe.
 *
 * `navigator.onLine` só erra para o lado otimista (diz "online" com Wi-Fi sem
 * saída), nunca o contrário — então quando ela aparece, é verdade.
 */
function assinar(avisar) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

const estaOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

function useEstaOnline() {
  return useSyncExternalStore(assinar, estaOnline, () => true);
}

export default function FaixaSemInternet({ className = '' }) {
  const online = useEstaOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-2xl border border-border bg-sunken px-4 py-3 ${className}`}
    >
      <WifiOff size={20} className="shrink-0 text-textMuted" />
      <p className="text-sm font-semibold leading-snug text-text">
        Sem internet — o que está na tela pode estar desatualizado.
      </p>
    </div>
  );
}
