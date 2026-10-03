/**
 * A TRANCA DO FINANCEIRO — quando o app volta a pedir a senha (03/10/2026).
 *
 * O motorista empresta o celular à auxiliar, ao filho, ao colega no portão. O
 * Financeiro (o caixa, as mensalidades, a fatura da plataforma) é a única
 * parte do app que ele não quer mostrando por cima do ombro. A senha de 4
 * números é a cortina; esta régua decide QUANDO a cortina desce de novo.
 *
 * ── AS DUAS REGRAS, e as duas são do dono
 *
 *   1. SAIR TRANCA. Sair das rotas protegidas (`/tio/finance…` e
 *      `/tio/taxa`) ou mandar o app para o segundo plano conta como sair.
 *      A preferência, gravada NO APARELHO, diz se tranca na hora ('sempre',
 *      o padrão) ou se quem volta dentro de 5 ou 30 minutos entra direto.
 *
 *   2. VOLTAR DENTRO DO FINANCEIRO VOLTA PARA A TELA PADRÃO. Quem tocou
 *      "Minha turma" na tela trancada, digitou a senha e caiu direto na
 *      turma viu UMA coisa — e o "voltar" dali leva de novo à tela trancada,
 *      não ao caixa aberto que ele nunca pediu para ver. Quem entrou pelo
 *      "Acessar dados financeiros" (o caixa) e foi a uma subtela volta ao
 *      caixa aberto: esse pediu o Financeiro inteiro.
 *
 * ── POR QUE O SEGUNDO PLANO TEM TOLERÂNCIA
 * Escolher uma foto da galeria, tirar foto de um comprovante ou abrir o
 * WhatsApp para cobrar também mandam a página para o segundo plano. Trancar
 * na volta de um passeio de 10 segundos desmontaria a tela por baixo do
 * seletor de foto — e a foto escolhida chegaria a um formulário que não
 * existe mais. `TOLERANCIA_DO_SEGUNDO_PLANO_MS` é o tempo de escolher uma
 * foto, não o de emprestar o celular.
 *
 * ── O ESTADO É DE MEMÓRIA, NUNCA PERSISTIDO
 * Recarregar o app tranca. Guardar "destravado" no aparelho faria o
 * Financeiro abrir sozinho para quem pega o celular e abre o navegador.
 *
 * Puro de propósito (sem React, sem navegador): o relógio e a rota entram por
 * parâmetro, e `npm run testar:tranca` mede cada transição.
 */

/** O caixa: a tela padrão do Financeiro e o destino de "Acessar dados financeiros". */
export const CAIXA = '/tio/finance';

/** A fatura da plataforma — protegida também, mas mora fora do layout do /tio. */
export const TAXA = '/tio/taxa';

/** A tela "Turma e contratos", destino do cartão "Minha turma". */
export const TURMA = '/tio/finance/turma';

/** As três escolhas de "Pedir a senha". */
export const PEDIR_SENHA = {
  SEMPRE: 'sempre',
  CINCO_MINUTOS: '5min',
  TRINTA_MINUTOS: '30min',
};

/** Os rótulos, na ordem em que aparecem nos ajustes. */
export const OPCOES_DE_PEDIR_SENHA = [
  { valor: PEDIR_SENHA.SEMPRE, rotulo: 'Sempre que sair do Financeiro' },
  { valor: PEDIR_SENHA.CINCO_MINUTOS, rotulo: 'Depois de 5 minutos fora' },
  { valor: PEDIR_SENHA.TRINTA_MINUTOS, rotulo: 'Depois de 30 minutos fora' },
];

const MINUTO = 60 * 1000;

const PRAZO_MS = {
  [PEDIR_SENHA.SEMPRE]: 0,
  [PEDIR_SENHA.CINCO_MINUTOS]: 5 * MINUTO,
  [PEDIR_SENHA.TRINTA_MINUTOS]: 30 * MINUTO,
};

/** Ver o cabeçalho: o tempo de escolher uma foto, não o de emprestar o celular. */
export const TOLERANCIA_DO_SEGUNDO_PLANO_MS = 30 * 1000;

/**
 * A preferência lida do aparelho. Qualquer coisa desconhecida — inclusive
 * nada, ou um armazenamento que não pôde ser lido — é 'sempre': o erro barato
 * é pedir a senha uma vez a mais.
 */
export function preferenciaValida(valor) {
  return Object.values(PEDIR_SENHA).includes(valor) ? valor : PEDIR_SENHA.SEMPRE;
}

/** Quanto tempo fora ainda deixa entrar sem senha. */
export function prazoDaPreferencia(preferencia) {
  return PRAZO_MS[preferenciaValida(preferencia)];
}

/** Caminho sem barra no fim e sem query — `/tio/finance/` é `/tio/finance`. */
export function normalizarCaminho(caminho) {
  const s = String(caminho || '').split(/[?#]/)[0];
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
}

/**
 * A rota pede senha? `/tio/finance` e tudo abaixo, e `/tio/taxa` e tudo
 * abaixo. `/tio/financeiro` (que não existe) NÃO casa — o teste confere,
 * porque `startsWith` sozinho casaria.
 */
export function rotaProtegida(caminho) {
  return /^\/tio\/(finance|taxa)(\/|$)/.test(normalizarCaminho(caminho));
}

/** O estado inicial, e o de quem acabou de trancar. */
export function estadoTrancado() {
  return { destravado: false, entradaDireta: false, saiuEm: null };
}

/**
 * Senha ou digital conferidas, a caminho de `destino`. Entrar direto num
 * destino que não é o caixa marca `entradaDireta` — é ela que faz o "voltar"
 * para o caixa cair de novo na tela trancada (regra 2).
 */
export function destravar(destino) {
  return {
    destravado: true,
    entradaDireta: normalizarCaminho(destino) !== CAIXA,
    saiuEm: null,
  };
}

/**
 * A rota mudou de `de` para `para`. Devolve o estado novo.
 *
 *   protegida → fora       'sempre' tranca na hora; com prazo, anota a hora
 *   fora → protegida       passou do prazo, tranca; senão segue aberto
 *   protegida → protegida  entrada direta chegando ao caixa tranca (regra 2)
 */
export function aoMudarDeRota(estado, { de, para, agora, preferencia }) {
  if (!estado?.destravado) return estado || estadoTrancado();
  const origem = normalizarCaminho(de);
  const destino = normalizarCaminho(para);
  if (origem === destino) return estado;
  const estavaDentro = rotaProtegida(origem);
  const ficaDentro = rotaProtegida(destino);

  if (estavaDentro && !ficaDentro) {
    if (prazoDaPreferencia(preferencia) === 0) return estadoTrancado();
    return { ...estado, saiuEm: agora };
  }

  if (!estavaDentro && ficaDentro) {
    if (estado.saiuEm == null) return { ...estado };
    if (agora - estado.saiuEm > prazoDaPreferencia(preferencia)) return estadoTrancado();
    return { ...estado, saiuEm: null };
  }

  if (estavaDentro && ficaDentro) {
    if (estado.entradaDireta && destino === CAIXA) return estadoTrancado();
    return estado;
  }

  return estado;
}

/**
 * O app voltou do segundo plano depois de ficar escondido desde `escondeuEm`.
 * Só pesa para quem estava NUMA rota protegida — fora dela, o relógio de
 * `saiuEm` já está correndo e decide na volta à rota.
 *
 * O limite é o maior entre o prazo da preferência e a tolerância: com
 * 'sempre', escolher uma foto não tranca; com 30 minutos, vale os 30.
 */
export function aoVoltarDoSegundoPlano(estado, { escondeuEm, agora, preferencia, naRotaProtegida }) {
  if (!estado?.destravado || !naRotaProtegida || escondeuEm == null) return estado;
  const limite = Math.max(prazoDaPreferencia(preferencia), TOLERANCIA_DO_SEGUNDO_PLANO_MS);
  return agora - escondeuEm > limite ? estadoTrancado() : estado;
}
