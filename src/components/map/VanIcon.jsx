import L from 'leaflet';

// Ícones SVG inline como L.divIcon — evita bundling de PNGs do Leaflet
// com Vite. Os 3 ícones (perua, casa, escola) seguem mesma linguagem:
// círculo colorido + glyph branco + sombra suave + halo pulsante na perua.

// ─────────────── PERUA (Tio) ───────────────
// Círculo âmbar, ícone de van branco, halo animado em CSS (ao vivo).
const VAN_HTML = `
<div class="tn-pin tn-pin-van">
  <span class="tn-pin-halo"></span>
  <span class="tn-pin-dot">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/>
      <path d="M15 6v6"/>
      <path d="M2 12h19.6"/>
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
      <circle cx="7" cy="18" r="2"/>
      <circle cx="16" cy="18" r="2"/>
    </svg>
  </span>
</div>`;

// ─────────────── CASA (Pai) ───────────────
// Círculo verde, ícone de casa branco.
const HOME_HTML = `
<div class="tn-pin tn-pin-home">
  <span class="tn-pin-dot">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9.5 12 2l9 7.5"/>
      <path d="M5 9v12h14V9"/>
      <path d="M9 21v-6h6v6"/>
    </svg>
  </span>
</div>`;

// ─────────────── ESCOLA ───────────────
// Círculo violeta, ícone de prédio com bandeira branco.
const SCHOOL_HTML = `
<div class="tn-pin tn-pin-school">
  <span class="tn-pin-dot">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 22v-4a2 2 0 0 0-4 0v4"/>
      <path d="M18 10v12H6V10"/>
      <path d="M3 10h18"/>
      <path d="M12 2v8"/>
      <path d="M12 4h5l-2 2 2 2h-5"/>
    </svg>
  </span>
</div>`;

function buildDivIcon(html, size, anchor) {
  return L.divIcon({
    html,
    className: 'tn-marker',
    iconSize: size,
    iconAnchor: anchor,
  });
}

export function createVanIcon() {
  return buildDivIcon(VAN_HTML, [48, 48], [24, 24]);
}

export function createHomeIcon() {
  return buildDivIcon(HOME_HTML, [44, 44], [22, 22]);
}

export function createSchoolIcon() {
  return buildDivIcon(SCHOOL_HTML, [44, 44], [22, 22]);
}
