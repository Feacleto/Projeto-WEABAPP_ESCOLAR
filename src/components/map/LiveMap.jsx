import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} />}
      {school && (
        <Marker position={[school.lat, school.lng]} icon={schoolIcon} />
      )}
      {van && <Marker position={[van.lat, van.lng]} icon={vanIcon} />}
      <AutoFit van={van} home={home} school={school} />
    </MapContainer>
  );
}
