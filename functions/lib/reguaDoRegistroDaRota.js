/**
 * O REGISTRO DA ROTA — "O que a Cida marcou" (05/10/2026, decisão do dono).
 *
 * Com a auxiliar marcando no celular dela, o tio, parado no portão da
 * escola, quer ver O QUE ela marcou e QUANDO: "06:52 Ana entrou na perua".
 * O status da criança diz só onde ela está agora; a ordem dos toques some.
 *
 * ── O DOCUMENTO
 * `registroDaRota/{motoristaUid}_{AAAA-MM-DD}` (dia de Brasília, o mesmo da
 * marcação) = `{ motoristaUid, dateKey, eventos: [evento] }`. UM documento
 * por tio por dia, e não um por criança, para o tio LER COM UMA ESCUTA SÓ
 * (um `get` pelo id do dia), em vez de uma por criança da turma.
 *
 * ── O EVENTO É UMA LISTA FECHADA
 * `em`, `auxiliarUid`, `auxiliarNome`, `passo`, `viagem`, `criancaNome`,
 * `escola` — e mais nada. PRIMEIRO nome da criança e da auxiliar: o registro
 * é lido por ela também (rules), e sobrenome, telefone e endereço não servem
 * para saber que a Ana entrou na perua. `testar:rota-ao-vivo` reprova campo
 * a mais.
 *
 * ⚠️ `em` é `Timestamp.now()`, não `serverTimestamp()`: o Firestore recusa
 * sentinela dentro de array. Quem escreve é só o servidor
 * (`marcarParadaPelaAuxiliar` e `marcarFaltaPelaAuxiliar`), com `arrayUnion`, na MESMA transação da
 * marcação — registro sem marcação, ou marcação sem registro, seriam o tio
 * lendo uma coisa e a família recebendo outra.
 *
 * ⚠️ DURA 7 DIAS (decisão do dono): `apagarViagensAntigas` apaga o resto. O
 * registro é para acompanhar a rota de hoje; "quem marcou o quê" de semanas
 * atrás vira vigilância do trabalho dela, não ferramenta da rota.
 *
 * Régua sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 */

const DIAS_DO_REGISTRO = 7;

/**
 * Os passos que viram evento. 'faltou' (05/10/2026, decisão do dono) é a
 * falta que ELA marcou antes do embarque (`marcarFaltaPelaAuxiliar`): não é
 * passo da viagem, e por isso a `viagem` dele é 'dia' — a falta vale para a
 * ida e a volta.
 */
const PASSOS = ['onboard', 'atSchool', 'delivered', 'faltou'];

/** Os campos do evento, na ordem. Campo novo precisa entrar AQUI, de propósito. */
const CAMPOS_DO_EVENTO = ['em', 'auxiliarUid', 'auxiliarNome', 'passo', 'viagem', 'criancaNome', 'escola'];

function idDoRegistro(motoristaUid, dateKey) {
  return `${motoristaUid}_${dateKey}`;
}

/** O primeiro nome, sem espaço sobrando, até 30 letras. */
function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0].slice(0, 30);
}

/**
 * Ida ou volta, pelo passo dado — o mesmo desenho de `passoValido`:
 *   ida   home → onboard → atSchool
 *   volta atSchool → onboard → delivered
 * e 'dia' para a falta, que só se marca antes de embarcar (home → faltou).
 * `null` quando o par não é um passo da auxiliar.
 */
function viagemDoPasso(anterior, proximo) {
  if (proximo === 'faltou') return anterior === 'home' || !anterior ? 'dia' : null;
  if (proximo === 'atSchool' && anterior === 'onboard') return 'ida';
  if (proximo === 'delivered' && anterior === 'onboard') return 'volta';
  if (proximo === 'onboard' && anterior === 'home') return 'ida';
  if (proximo === 'onboard' && anterior === 'atSchool') return 'volta';
  return null;
}

/**
 * O evento pronto para o `arrayUnion`. `null` se faltar o essencial — o
 * servidor então marca sem registrar, em vez de gravar evento torto.
 */
function eventoDoRegistro({ em, auxiliarUid, auxiliarNome, anterior, passo, criancaNome, escola }) {
  if (!em || !auxiliarUid || !PASSOS.includes(passo)) return null;
  const viagem = viagemDoPasso(anterior, passo);
  if (!viagem) return null;
  return {
    em,
    auxiliarUid: String(auxiliarUid),
    auxiliarNome: primeiroNome(auxiliarNome) || 'Auxiliar',
    passo,
    viagem,
    criancaNome: primeiroNome(criancaNome) || 'Criança',
    escola: String(escola || '').trim().slice(0, 80),
  };
}

/** O dia de corte ('AAAA-MM-DD'): registros com `dateKey` antes dele são apagados. */
function corteDoRegistro(agora = new Date()) {
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - DIAS_DO_REGISTRO);
  return limite.toISOString().slice(0, 10);
}

module.exports = {
  DIAS_DO_REGISTRO,
  CAMPOS_DO_EVENTO,
  idDoRegistro,
  primeiroNome,
  viagemDoPasso,
  eventoDoRegistro,
  corteDoRegistro,
};
