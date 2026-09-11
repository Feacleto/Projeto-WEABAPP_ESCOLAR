import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { MAPA } from '../../config/mapa';
import { PRECISAO_DO_MAPA_M } from '../../dominio/rota/proximidade';
import 'leaflet/dist/leaflet.css';
import { createVanIcon, createHomeIcon, createSchoolIcon } from './VanIcon';

/**
 * Ajusta o viewport pra englobar os marcadores presentes.
 * Re-fit acontece quando van se move OU quando muda visibilidade.
 */
function AutoFit({ van, home, school }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (home) points.push([home.lat, home.lng]);
    if (school) points.push([school.lat, school.lng]);
    if (van) points.push([van.lat, van.lng]);

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [60, 60], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [
    map,
    van?.lat,
    van?.lng,
    home?.lat,
    home?.lng,
    school?.lat,
    school?.lng,
  ]);
  return null;
}

/**
 * Mapa em tempo real.
 *
 * Props:
 *   - home:   { lat, lng } | null
 *   - school: { lat, lng } | null  — opcional. Quando passado, mostra pin da escola.
 *   - van:    { lat, lng } | null  — só renderizado se passado (privacidade).
 *
 * Render dentro de container com altura definida.
 */
export default function LiveMap({ van, home, school, className = '' }) {
  const vanIcon = useMemo(() => createVanIcon(), []);
  const homeIcon = useMemo(() => createHomeIcon(), []);
  const schoolIcon = useMemo(() => createSchoolIcon(), []);

  const initialCenter = home
    ? [home.lat, home.lng]
    : school
    ? [school.lat, school.lng]
    : van
    ? [van.lat, van.lng]
    : [-23.55, -46.63];

  return (
    <MapContainer
      center={initialCenter}
      zoom={14}
      scrollWheelZoom
      className={`w-full h-full ${className}`}
    >
      {/* O provedor de tiles e a atribuição saem de
        * [config/mapa.js](../../config/mapa.js), nunca escritos aqui: a URL
        * do OSM estava duplicada nos dois mapas, e a política de uso que ela
        * viola valia para os dois. Um lugar pra mudar, os dois mapas mudam. */}
      <TileLayer
        attribution={MAPA.attribution}
        url={MAPA.url}
        maxZoom={MAPA.maxZoom}
      />
      {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} />}
      {school && (
        <Marker position={[school.lat, school.lng]} icon={schoolIcon} />
      )}
      {/* ⚠️ O CÍRCULO VEM ANTES DO ALFINETE, E ELE NÃO É ENFEITE.
        *
        * A posição publicada é encaixada numa grade de 150 m no aparelho do
        * motorista — ela diz a QUADRA, nunca a porta. Desenhar só um alfinete
        * sobre um dado aproximado é a interface MENTINDO: quem olha lê "ele
        * está exatamente aqui", e é a leitura errada que faz a mãe descer com
        * a criança na hora errada.
        *
        * O raio é o mesmo do arredondamento, lido da régua — número escrito à
        * mão aqui viraria um círculo que não corresponde a nada. */}
      {van && (
        <Circle
          center={[van.lat, van.lng]}
          radius={PRECISAO_DO_MAPA_M}
          pathOptions={{ className: 'perua-referencia', weight: 1 }}
        />
      )}
      {van && <Marker position={[van.lat, van.lng]} icon={vanIcon} />}
      <AutoFit van={van} home={home} school={school} />
    </MapContainer>
  );
}
