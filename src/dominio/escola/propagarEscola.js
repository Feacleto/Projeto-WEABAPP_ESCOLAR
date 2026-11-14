/**
 * CORRIGIR O ENDEREÇO DA ESCOLA CHEGA ÀS CRIANÇAS — a régua pura
 * (RC2, 14/11/2026 — docs/analise/13a, linha "k").
 *
 * ── O BURACO
 * A escola é uma entidade (`schools`), mas a criança guarda uma CÓPIA dela: o
 * nome (`school`), o endereço (`schoolAddress`) e o ponto (`schoolLat` /
 * `schoolLng`) — de propósito, para que apagar a escola por engano não apague
 * o endereço de entrega de ninguém no meio da rota. O preço da cópia é este:
 * corrigir o endereço na tela de Escolas mexia só em `schools`, e quem lê a
 * cópia continuava no endereço velho —
 *   - o aviso de "chegou na escola" (`OperacaoDaRota`, `schoolLat`),
 *   - o mapa da família (`PaiMap`, `schoolLat`),
 *   - o contrato (`contractService`, `schoolAddress`) e a ficha da criança.
 * Só o TELEFONE da escola propagava (`definirTelefoneDaEscola`).
 *
 * ── O QUE ESTE ARQUIVO DECIDE
 * 1. Quais CAMPOS da criança são a cópia (`CAMPOS_DA_COPIA`) — e só eles.
 * 2. Quais CRIANÇAS entram: as ativas que apontam para a escola (`schoolId`) e
 *    cuja cópia está diferente do que a escola diz agora.
 * 3. Como dividir a escrita em lotes de 15.
 *
 * ⚠️ O PONTO ANDA JUNTO COM O ENDEREÇO, NUNCA SOZINHO. `camposDaCopia` devolve
 * `null` quando falta o ponto: gravar o endereço novo com a coordenada velha
 * faria a tela afirmar "a escola é aqui" sobre um alfinete em outro lugar — o
 * mesmo modo de falhar do "Local confirmado" sobre a rua errada. E gravar
 * `null` por cima de um ponto válido tiraria a escola do mapa da família. Sem
 * ponto novo, a criança fica como estava, e quem chama diz isso à pessoa.
 *
 * ⚠️ CRIANÇA PASSADA A OUTRO TIO NÃO ENTRA (`transferidaPara`): as rules a
 * congelam para o motorista de antes, e UMA delas no lote derrubaria o lote
 * inteiro (a escrita em lote é atômica).
 *
 * Não importa Firebase nem React (decisão 17): é o que o deixa testável no
 * Node (`npm run testar:propagar-escola`).
 */

/**
 * Os campos da criança que são a cópia do ENDEREÇO da escola. O nome
 * (`school`) e o telefone (`schoolPhone`) são outras cópias, com outros
 * caminhos — o telefone tem o seu (`definirTelefoneDaEscola`).
 */
export const CAMPOS_DA_COPIA = ['schoolAddress', 'schoolLat', 'schoolLng'];

/**
 * Quantas crianças por lote de escrita. É o mesmo 15 de toda escrita em lote do
 * projeto (`advanceMany`, aviso de escola): cada update de `children` passa
 * pelas rules, e o teto é de acessos por requisição, não de 500 operações.
 */
export const TAMANHO_DO_LOTE = 15;

const ehNumero = (v) => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));

/** Texto de endereço reduzido ao que ele diz: sem acento, caixa, pontuação e espaço sobrando. */
export function chaveDoEndereco(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Dois pontos são o mesmo lugar? ~1 m de tolerância (5 casas decimais). */
export function mesmoPonto(a, b) {
  const [la, lna, lb, lnb] = [a?.lat, a?.lng, b?.lat, b?.lng];
  const temA = ehNumero(la) && ehNumero(lna);
  const temB = ehNumero(lb) && ehNumero(lnb);
  if (!temA || !temB) return !temA && !temB;
  return Math.abs(Number(la) - Number(lb)) < 1e-5 && Math.abs(Number(lna) - Number(lnb)) < 1e-5;
}

/**
 * Os campos da criança que recebem a cópia nova, ou `null` se a escola não tem
 * endereço E ponto (ver o aviso do topo). Coordenada sempre número.
 */
export function camposDaCopia(escola) {
  const endereco = String(escola?.endereco || '').trim();
  if (!endereco) return null;
  if (!(ehNumero(escola?.lat) && ehNumero(escola?.lng))) return null;
  return { schoolAddress: endereco, schoolLat: Number(escola.lat), schoolLng: Number(escola.lng) };
}

/** A criança é desta escola e ainda opera com este motorista? */
function daEscola(c, escolaId) {
  if (!c || !escolaId || c.schoolId !== escolaId) return false;
  if (c.active === false) return false;
  if ('transferidaPara' in c && c.transferidaPara) return false;
  return true;
}

/**
 * As crianças que a pergunta alcança: da escola e com a cópia diferente do que
 * ela diz agora. Quem já está igual não conta — "isto muda o ponto de N
 * crianças" precisa ser o número de quem muda.
 *
 * Sem ponto novo (a escola foi salva sem coordenada), vale só o texto: o ponto
 * é resolvido na hora de aplicar.
 *
 * ⚠️ A COMPARAÇÃO É COM O QUE A ESCOLA DIZ AGORA, e não com "o endereço mudou
 * nesta edição": uma correção feita ANTES de existir esta pergunta deixou a
 * cópia para trás, e a próxima vez que a escola for salva é a chance de
 * acertá-la.
 *
 * @param {Array<object>} criancas  as crianças do motorista
 * @param {string} escolaId
 * @param {{endereco?:string, lat?:number|null, lng?:number|null}} escola  como a escola ficou
 */
export function criancasQueMudam(criancas, escolaId, escola) {
  const temPonto = ehNumero(escola?.lat) && ehNumero(escola?.lng);
  const textoNovo = chaveDoEndereco(escola?.endereco);
  return (Array.isArray(criancas) ? criancas : []).filter((c) => {
    if (!daEscola(c, escolaId)) return false;
    if (chaveDoEndereco(c.schoolAddress) !== textoNovo) return true;
    if (!temPonto) return false;
    return !mesmoPonto({ lat: c.schoolLat, lng: c.schoolLng }, escola);
  });
}

/** Divide em lotes de `tamanho` (padrão 15), sem perder nem repetir ninguém. */
export function lotesDe(lista, tamanho = TAMANHO_DO_LOTE) {
  const itens = Array.isArray(lista) ? lista : [];
  const n = Math.max(1, Math.floor(tamanho) || TAMANHO_DO_LOTE);
  const lotes = [];
  for (let i = 0; i < itens.length; i += n) lotes.push(itens.slice(i, i + n));
  return lotes;
}

/** O primeiro nome — é como ele chama a criança no portão. */
export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}
