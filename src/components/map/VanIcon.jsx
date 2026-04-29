import L from 'leaflet';

// SVGs inline em string — usados como HTML do L.divIcon. Optamos por divIcon
// em vez do Marker padrão pra evitar o problema de bundling dos PNGs default
// do Leaflet com Vite (que exigem configuração extra).

const VAN_SVG = `
<svg width="42" height="42" viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="21" cy="38" rx="14" ry="2.5" fill="#000" fill-opacity="0.18"/>
  <rect x="6" y="14" width="30" height="18" rx="3.5" fill="#F5A623"/>
  <rect x="9" y="17" width="6.5" height="5.5" rx="1" fill="#FFFFFF"/>
  <rect x="17.5" y="17" width="6.5" height="5.5" rx="1" fill="#FFFFFF"/>
  <rect x="26" y="17" width="6.5" height="5.5" rx="1" fill="#FFFFFF"/>
  <rect x="6" y="25" width="30" height="2" fill="#D48816"/>
  <circle cx="13" cy="33" r="3.2" fill="#1F2937" stroke="#fff" stroke-width="1.5"/>
  <circle cx="29" cy="33" r="3.2" fill="#1F2937" stroke="#fff" stroke-width="1.5"/>
</svg>`;

const HOME_SVG = `
<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="18" cy="33" rx="11" ry="2" fill="#000" fill-opacity="0.18"/>
  <path d="M5 19 L18 7 L31 19 V30 H5 Z" fill="#1F5F3F"/>
  <path d="M4 19.5 L18 6.5 L32 19.5" stroke="#143F2A" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
  <rect x="14" y="21" width="8" height="9" fill="#FFFFFF"/>
  <circle cx="20.5" cy="25.5" r="0.8" fill="#143F2A"/>
</svg>`;

// Wrapper centralizado pro divIcon — passamos className: '' pra remover
// estilos default ('.leaflet-div-icon': fundo branco e borda cinza).
function buildDivIcon(html, size, anchor) {
  return L.divIcon({
    html,
    className: 'tn-marker',
    iconSize: size,
    iconAnchor: anchor,
  });
}

export function createVanIcon() {
  return buildDivIcon(VAN_SVG, [42, 42], [21, 21]);
}

export function createHomeIcon() {
  // Anchor em [18, 30] alinha a "base" da casa com o ponto exato da coord
  return buildDivIcon(HOME_SVG, [36, 36], [18, 30]);
}
