/**
 * AS ZONAS DA ROTA AO VIVO — onde cada criança da viagem está agora
 * (05/10/2026, protótipo "A auxiliar marca, o tio vê" aprovado pelo dono).
 *
 * São TRÊS lugares, e a viagem é o caminho entre eles:
 *   ida    Ainda em casa  →  Na perua  →  Na escola
 *   volta  Na escola      →  Na perua  →  Entregues em casa
 *
 * A régua não inventa status: ela recebe a FILA da viagem como a tela da rota
 * já monta (`{ child, hora, estado, status }`, com `status` vindo de
 * `statusNaDirecao` — o status de HOJE, com o "pai leva" já aplicado) e só
 * separa por lugar. Por isso a tela do tio, a da auxiliar e a linha do tempo
 * nunca discordam sobre onde a Ana está.
 *
 * ⚠️ QUEM NÃO VAI HOJE (falta, o pai leva, o pai busca) NÃO ENTRA EM ZONA
 * NENHUMA: vai em `fora`, e a tela o mostra riscado junto da fila de casa
 * (ida) ou das entregas (volta). Pô-lo "em casa" faria o tio esperar na porta
 * de quem avisou que não vem; sumir com ele faria a falta marcada por engano
 * passar sem ninguém ver.
 *
 * ⚠️ O "EM CASA" DA VOLTA conta como "Na escola". Na volta, `home` só aparece
 * quando ninguém marcou a ida (a criança foi com o pai sem aviso, ou o tio não
 * tocou no app de manhã). A volta começa na escola — é lá que a perua vai
 * buscar —, e a linha do tempo também não oferece passo para ela; mostrá-la
 * "em casa" na volta seria dizer que ela já chegou.
 *
 * Pura, sem import: roda no Node (`npm run testar:rota-ao-vivo`).
 */

function porHora(a, b) {
  const ha = String(a?.hora || '');
  const hb = String(b?.hora || '');
  if (ha !== hb) return ha < hb ? -1 : 1;
  return String(a?.child?.name || '').localeCompare(String(b?.child?.name || ''), 'pt-BR');
}

/** A chave e o nome da escola de uma criança — o mesmo critério de `escolasDoBloco`. */
export function escolaDaCrianca(child, escolasPorId = {}) {
  const c = child || {};
  const chave = c.schoolId || String(c.school || '').trim().toLowerCase() || '?';
  const nome = escolasPorId?.[c.schoolId]?.nome || c.school || 'Escola';
  return { chave, nome };
}

/**
 * @param {Array} fila   itens `{ child, hora, estado, status }` da viagem
 * @param {object} opcoes `{ direcao: 'ida'|'volta', escolasPorId }`
 * @returns {{ direcao, emCasa, naPerua, naEscola: Array<{chave,nome,criancas}>, entregues, fora }}
 *   `emCasa` só tem gente na ida; `entregues` só na volta.
 */
export function zonasDaRota(fila, { direcao = 'ida', escolasPorId = {} } = {}) {
  const ida = direcao !== 'volta';
  const emCasa = [];
  const naPerua = [];
  const entregues = [];
  const fora = [];
  const escolas = new Map();

  const naEscola = (item) => {
    const { chave, nome } = escolaDaCrianca(item.child, escolasPorId);
    if (!escolas.has(chave)) escolas.set(chave, { chave, nome, criancas: [] });
    escolas.get(chave).criancas.push(item);
  };

  for (const item of Array.isArray(fila) ? fila : []) {
    if (!item?.child) continue;
    // `estado` ausente é o dia normal (a fila antiga não o trazia).
    if (item.estado && item.estado !== 'normal') {
      fora.push(item);
      continue;
    }
    const s = item.status || 'home';
    if (s === 'onboard') naPerua.push(item);
    else if (ida) {
      if (s === 'home') emCasa.push(item);
      else naEscola(item); // atSchool (e um 'delivered' fora de hora: já passou da perua)
    } else if (s === 'delivered') entregues.push(item);
    else naEscola(item); // atSchool, ou 'home' sem a ida marcada (ver acima)
  }

  emCasa.sort(porHora);
  naPerua.sort(porHora);
  entregues.sort(porHora);
  fora.sort(porHora);
  const grupos = [...escolas.values()];
  grupos.forEach((g) => g.criancas.sort(porHora));
  grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { direcao: ida ? 'ida' : 'volta', emCasa, naPerua, naEscola: grupos, entregues, fora };
}

/** Quantas crianças estão na escola, somando os prédios. */
export function quantosNaEscola(zonas) {
  return (zonas?.naEscola || []).reduce((n, g) => n + g.criancas.length, 0);
}

/** O rótulo do lugar de uma criança, para a ficha rápida. */
export function rotuloDoLugar(status, direcao = 'ida') {
  if (status === 'onboard') return 'Na perua';
  if (status === 'atSchool') return 'Na escola';
  if (status === 'delivered') return 'Entregue em casa';
  return direcao === 'volta' ? 'Na escola' : 'Em casa';
}

/**
 * A VIAGEM ESTÁ "AO VIVO" PARA A AUXILIAR? Ela não lê `liveLocation` (a
 * posição da perua é do tio), então a tela dela decide pela turma e pelo
 * relógio:
 *   - alguém "Na perua" hoje (`rotaDaPeruaRodando`, passado em `rodando`), ou
 *   - a viagem do momento começa em até 30 minutos, ou ainda não passou 90
 *     minutos da última porta.
 * A segunda metade existe porque o PRIMEIRO "Entrou na perua" do dia é
 * justamente o que tira a perua de "ninguém na perua": sem ela, o cartão da
 * vez só apareceria depois do toque que ele existe para facilitar.
 *
 * `inicio` e `fim` em minutos do dia, como `blocosDaDirecao` devolve.
 */
export const ANTES_DA_VIAGEM_MIN = 30;
export const DEPOIS_DA_VIAGEM_MIN = 90;

export function viagemAoVivo(bloco, agoraMin, rodando = false) {
  if (rodando) return true;
  if (!bloco || !Number.isFinite(agoraMin)) return false;
  return agoraMin >= bloco.inicio - ANTES_DA_VIAGEM_MIN && agoraMin <= bloco.fim + DEPOIS_DA_VIAGEM_MIN;
}

/**
 * O texto do botão da vez da auxiliar, em português de gente (o do tio é o
 * "EMBARQUEI" da rota), pelo passo que ela vai dar.
 */
export function rotuloDaVez(proximo) {
  if (proximo === 'onboard') return 'Entrou na perua';
  if (proximo === 'atSchool') return 'Entregue na escola';
  if (proximo === 'delivered') return 'Entregue em casa';
  return null;
}
