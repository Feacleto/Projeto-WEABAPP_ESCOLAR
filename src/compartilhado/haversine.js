// Haversine distance — distância "em linha reta" entre dois pontos na
// superfície da Terra, em km. Suficiente pra alertas de proximidade
// (não considera topologia das ruas, então a distância real é maior).
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // raio da Terra em km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distância em km
}
