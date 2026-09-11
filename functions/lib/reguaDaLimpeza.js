/**
 * O QUE FAZER COM UMA COORDENADA QUE FICOU GRAVADA — a régua, e só ela.
 *
 * ── O QUE ESTÁ SENDO LIMPO
 * `checkpointFrom` (no cliente) gravava `lat` e `lng` do VEÍCULO do motorista
 * em dois lugares, um registro por criança por dia:
 *
 *   children/{id}.lastStatusCheckpoint      { lat, lng, at, distanceKm? }
 *   children/{id}/rides/{dia}.checkpoints   { delivered: {...}, atSchool: {...} }
 *
 * Nenhuma tela lia esses campos. Saíram em duas etapas: a coordenada em
 * 10/09/2026 (a distância ainda servia de conferência), e a distância em
 * 11/09/2026, por decisão do dono — **o app registra que entregou e a que
 * horas, e nada sobre onde**. O código parou de escrever; o que já foi
 * gravado é o que estas funções decidem, e hoje a resposta é sempre a mesma:
 * apaga.
 *
 * ── POR QUE ISTO É ARQUIVO SEPARADO, E SEM `require` NENHUM
 * Duas peças precisam da mesma decisão: a callable do dono
 * (`limpezaDoCheckpoint.js`) e o script de manutenção
 * (`scripts/limpar-coordenada-do-checkpoint.cjs`). Copiar a regra nos dois
 * seria o quarto espelho do projeto, e por um motivo pobre — aqui não há
 * fronteira de deploy nenhuma entre os dois, é a mesma máquina lendo o mesmo
 * disco. Então não há espelho: há um arquivo, e dois consumidores.
 *
 * Ele segue a regra da pasta: **módulo de `functions/lib/` que é RÉGUA não
 * requer `firebase-admin` nem `firebase-functions`** — quem toca no banco é
 * quem consome.
 */

/** O que fazer com UM checkpoint. */
const NADA = 'nada';
const TIRAR_COORDENADA = 'tirar-coordenada';
const APAGAR_INTEIRO = 'apagar-inteiro';

/**
 * @returns 'nada' | 'apagar-inteiro'
 *
 * ⚠️ A REGRA ENCOLHEU, E ISSO É A DECISÃO DE 11/09/2026. Ela tinha dois
 * caminhos: checkpoint COM distância perdia só a coordenada, porque a
 * distância era a conferência. O dono decidiu que **o app registra que
 * entregou e a que horas, e nada sobre onde** — então a distância saiu junto,
 * e sobrou um caminho só: **existe checkpoint, ele vai embora**.
 *
 * `TIRAR_COORDENADA` continua exportado e nunca mais é devolvido. Está no
 * teste, e é de propósito: se alguém reintroduzir a marcação, o valor já tem
 * nome e o caso que o proíbe já existe.
 */
function decidir(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return NADA;
  // Qualquer campo aqui é registro de onde ele estava: coordenada, distância
  // ou a hora órfã que sobra sem elas. Documento vazio (`{}`) não é registro
  // de nada e não vira escrita.
  return Object.keys(checkpoint).length > 0 ? APAGAR_INTEIRO : NADA;
}

/**
 * O plano para o mapa `checkpoints` de UMA viagem — um checkpoint por status.
 *
 * Devolve os CAMINHOS a apagar (`checkpoints.delivered.lat`), não valores: é
 * o consumidor que troca cada caminho pelo `FieldValue.delete()` dele. Assim
 * esta régua continua sem conhecer o SDK.
 *
 * ⚠️ `apagarMapa` existe porque mapa que fica VAZIO é o mesmo enigma do
 * `{ at }` solto, um nível acima — some inteiro em vez de virar `{}`.
 *
 * @returns { mexeu, apagarMapa, caminhos: string[], tiradas, inteiros }
 */
function planoDaViagem(mapa) {
  const vazio = { mexeu: false, apagarMapa: false, caminhos: [], tiradas: 0, inteiros: 0 };
  if (!mapa || typeof mapa !== 'object') return vazio;

  const caminhos = [];
  let tiradas = 0;
  let inteiros = 0;
  let sobrevive = 0;

  for (const status of Object.keys(mapa)) {
    const decisao = decidir(mapa[status]);
    if (decisao === NADA) {
      sobrevive += 1;
    } else if (decisao === APAGAR_INTEIRO) {
      inteiros += 1;
      caminhos.push(`checkpoints.${status}`);
    } else {
      // ⚠️ INALCANÇÁVEL DESDE 11/09/2026, e mantido de propósito: se alguém
      // devolver `TIRAR_COORDENADA` de `decidir`, o comportamento parcial
      // ainda funciona em vez de virar um `else` esquecido que apaga tudo.
      tiradas += 1;
      sobrevive += 1;
      caminhos.push(`checkpoints.${status}.lat`);
      caminhos.push(`checkpoints.${status}.lng`);
    }
  }

  if (!caminhos.length) return vazio;
  return {
    mexeu: true,
    apagarMapa: sobrevive === 0,
    caminhos,
    tiradas,
    inteiros,
  };
}

module.exports = {
  NADA,
  TIRAR_COORDENADA,
  APAGAR_INTEIRO,
  decidir,
  planoDaViagem,
};
