import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { createVanIcon, createHomeIcon } from './VanIcon';

/**
 * Ajusta o viewport do mapa quando van/home mudam de posição.
 *
 * - Os dois conhecidos: fitBounds incluindo ambos com padding
 * - Só home ou só van: setView centrado nesse ponto
 * - Nenhum: deixa como está (não deveria acontecer porque LiveMap
 *   só renderiza quando há pelo menos home)
 */
function AutoFit({ van, home }) {
  const map = useMap();
  useEffect(() => {
    if (van && home) {
      const bounds = [
        [home.lat, home.lng],
        [van.lat, van.lng],
      ];
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (home) {
      map.setView([home.lat, home.lng], 15);
    } else if (van) {
      map.setView([van.lat, van.lng], 15);
    }
    // Re-fit quando coordenadas mudam (van se move a cada update)
  }, [map, van?.lat, van?.lng, home?.lat, home?.lng]);
  return null;
}

/**
 * Mapa em tempo real com marcadores de casa e perua.
 *
 * Props:
 *   - van:  { lat, lng } | null  (perua — null quando rota inativa)
 *   - home: { lat, lng } | null  (casa do pai)
 *
 * Renderizar dentro de um container com altura definida (h-[XYZ]px ou h-full).
 */
export default function LiveMap({ van, home, className = '' }) {
  // Recriar os ícones a cada render é desperdício; memoiza.
  const vanIcon = useMemo(() => createVanIcon(), []);
  const homeIcon = useMemo(() => createHomeIcon(), []);

  const initialCenter = home
    ? [home.lat, home.lng]
    : van
    ? [van.lat, van.lng]
    : [-23.55, -46.63]; // fallback: centro de SP (não deveria ocorrer na prática)

  return (
    <MapContainer
      center={initialCenter}
      zoom={14}
      scrollWheelZoom
      className={`w-full h-full ${className}`}
      // attributionControl em rodapé minúsculo é OK; OSM exige atribuição.
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} />}
      {van && <Marker position={[van.lat, van.lng]} icon={vanIcon} />}
      <AutoFit van={van} home={home} />
    </MapContainer>
  );
}
