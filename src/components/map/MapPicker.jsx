import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair, X } from 'lucide-react';
import Button from '../common/Button';
import { createHomeIcon, createSchoolIcon } from './VanIcon';

// Fallback quando não há nem GPS nem coordenada prévia: centro de SP.
const DEFAULT_CENTER = [-23.55, -46.63];

/**
 * Captura o toque no mapa e devolve a coordenada.
 * Precisa ser filho do MapContainer pra ter acesso ao contexto do Leaflet.
 */
function TapCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Recentraliza quando o pai manda uma coordenada nova (ex: "usar meu local"). */
function Recenter({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView([point.lat, point.lng], 17);
  }, [map, point?.lat, point?.lng]);
  return null;
}

/**
 * Sheet de seleção manual de coordenada.
 *
 * Existe porque o Nominatim não conhece boa parte dos endereços de
 * periferia — sem isto, o tio que mora numa rua não mapeada simplesmente
 * não consegue cadastrar a criança.
 *
 * Props:
 *   - kind: 'home' | 'school'  — muda só o ícone e os textos
 *   - initial: { lat, lng } | null
 *   - addressLabel: string     — mostrado como referência do que ele procura
 *   - onConfirm({ lat, lng })
 *   - onClose()
 */
export default function MapPicker({
  kind = 'home',
  initial = null,
  addressLabel = '',
  onConfirm,
  onClose,
}) {
  const [point, setPoint] = useState(initial);
  const [recenterTo, setRecenterTo] = useState(null);
  const [locating, setLocating] = useState(false);

  const icon = useMemo(
    () => (kind === 'school' ? createSchoolIcon() : createHomeIcon()),
    [kind]
  );

  const center = initial ? [initial.lat, initial.lng] : DEFAULT_CENTER;

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPoint(next);
        setRecenterTo(next);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col max-w-mobile mx-auto">
      <header className="px-5 pt-4 pb-3 bg-card border-b border-border space-y-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap -ml-1 p-1 text-textMuted"
          >
            <X size={20} />
          </button>
          <p className="font-bold text-text flex-1">
            {kind === 'school' ? 'Marcar a escola' : 'Marcar onde ela mora'}
          </p>
        </div>
        <p className="text-xs text-textMuted">
          Toque no mapa em cima do lugar certo. Dá pra ajustar depois.
        </p>
        {addressLabel && (
          <p className="text-xs text-textMuted truncate">
            Procurando: <span className="text-text">{addressLabel}</span>
          </p>
        )}
      </header>

      <div className="flex-1 relative">
        <MapContainer center={center} zoom={initial ? 17 : 12} scrollWheelZoom className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {point && <Marker position={[point.lat, point.lng]} icon={icon} />}
          <TapCapture onPick={setPoint} />
          <Recenter point={recenterTo} />
        </MapContainer>

        {!point && (
          <div className="absolute inset-x-4 top-4 z-[400] bg-card/95 border border-border rounded-xl px-4 py-3 shadow-lg pointer-events-none">
            <p className="text-sm text-text font-semibold">Toque no mapa</p>
            <p className="text-xs text-textMuted">
              Pode aproximar com dois dedos pra acertar a casa.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2 bg-card border-t border-border">
        <Button
          type="button"
          variant="secondary"
          icon={Crosshair}
          onClick={useMyLocation}
          loading={locating}
        >
          Estou na porta agora — usar meu local
        </Button>
        <Button
          type="button"
          icon={MapPin}
          disabled={!point}
          onClick={() => point && onConfirm(point)}
        >
          {point ? 'Confirmar este ponto' : 'Toque no mapa primeiro'}
        </Button>
      </div>
    </div>
  );
}
