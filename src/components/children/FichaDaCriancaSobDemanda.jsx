import { Suspense, lazy, useState } from 'react';

/**
 * A FICHA DA CRIANÇA, BAIXADA SÓ QUANDO ALGUÉM ABRE (04/10/2026).
 *
 * O Início dos dois papéis importava `ChildDetailSheet` direto — e a ficha
 * puxa o seletor de mapa (Leaflet) e o gerador de QR code do convite. Eram
 * 155 kB baixados e lidos em TODO Início, num Android barato, para uma folha
 * que a maioria das aberturas nunca abre.
 *
 * Mesma interface da `ChildDetailSheet` (open, childId, onClose…). Na primeira
 * abertura o pedaço é baixado (o Suspense não mostra nada — a folha sobe
 * quando chega); depois disso fica montada, para fechar com a animação dela.
 */
const ChildDetailSheet = lazy(() =>
  import('../../pages/ChildDetail').then((m) => ({ default: m.ChildDetailSheet }))
);

export default function FichaDaCriancaSobDemanda(props) {
  const [usada, setUsada] = useState(false);
  // Marcar durante o render é o jeito do React de derivar estado de prop sem
  // um efeito que desenharia a tela duas vezes.
  if (props.open && !usada) setUsada(true);
  if (!usada) return null;
  return (
    <Suspense fallback={null}>
      <ChildDetailSheet {...props} />
    </Suspense>
  );
}
