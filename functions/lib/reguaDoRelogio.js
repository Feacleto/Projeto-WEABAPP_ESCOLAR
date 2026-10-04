/**
 * O RELÓGIO DO TESTE, A PARTE QUE DECIDE — régua pura, sem `require`.
 *
 * Quem lê e grava é `relogioDoTeste.js` (requer o SDK). Esta metade é a que
 * `npm run testar:trial` alcança num checkout limpo.
 *
 * ── A CÓPIA EM `taxaParceiros/{uid}.trialInicio` (03/10/2026)
 * O motorista pode apagar o próprio documento em `users` (sem crianças ativas)
 * e criá-lo de novo com a mesma sessão. Sem uma cópia fora do alcance dele, o
 * documento novo nasceria sem `trialInicio` e o teste de 90 dias recomeçaria
 * do zero — quantas vezes ele quisesse. `taxaParceiros` só o dono lê e escreve
 * pelas rules, e o servidor escreve com Admin SDK: é onde a data fica a salvo.
 *
 * ⚠️ A DATA MAIS ANTIGA VENCE, sempre. As duas cópias deveriam ser iguais;
 * quando não são, é porque uma delas nasceu numa janela de corrida (o
 * documento recriado e um gesto ligando o relógio antes de a restauração
 * chegar). Ficar com a mais nova seria dar ao motorista o prazo que a
 * corrida inventou.
 */

/** Milissegundos de um Timestamp do Firestore, Date, número ou `{seconds}`. */
function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.toDate === 'function') return valor.toDate().getTime();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  if (typeof valor._seconds === 'number') return valor._seconds * 1000;
  return null;
}

/**
 * A rota COMEÇOU nesta escrita de `liveLocation/{uid}`?
 *
 * Só a borda de subida conta: o celular regrava a posição a cada 30 s e o
 * pulso a cada minuto, e cada uma dessas escritas tem `routeActive: true`.
 * Tratar todas como "começou" leria três documentos a cada meio minuto por
 * motorista rodando.
 */
function rotaComecou(antes, depois) {
  return Boolean(depois) && depois.routeActive === true && !(antes && antes.routeActive === true);
}

/**
 * O que gravar, dado o que existe em `users` e na cópia.
 *
 * Devolve `{ usuario, copia }`, cada um:
 *   'agora'    — ligar o relógio neste instante (serverTimestamp)
 *   'copia'    — `users` recebe o valor da cópia (restauração)
 *   'usuario'  — a cópia recebe o valor de `users` (motorista anterior à cópia)
 *   null       — não mexer
 *
 * `podeComecar` é a chave da cobrança: sem ela o relógio não LIGA, mas uma
 * data que já existe continua sendo preservada — restaurar não é começar.
 */
function decidirRelogio({ noUsuario = null, naCopia = null, podeComecar = false } = {}) {
  const u = emMs(noUsuario);
  const c = emMs(naCopia);

  if (u === null && c === null) {
    return podeComecar ? { usuario: 'agora', copia: 'agora' } : { usuario: null, copia: null };
  }
  if (u === null) return { usuario: 'copia', copia: null };
  if (c === null) return { usuario: null, copia: 'usuario' };
  if (u > c) return { usuario: 'copia', copia: null };
  if (c > u) return { usuario: null, copia: 'usuario' };
  return { usuario: null, copia: null };
}

/**
 * O motorista registrou uma rota nesta escrita de `users/{uid}`? É o sinal que
 * liga o relógio desde 03/10/2026 (ver `relogioNaRota.js`): `ultimaRota` só é
 * gravada no início de uma rota, e mudar nela é a rota começando. Qualquer
 * outra escrita em `users` (preferência, contador do servidor) sai aqui.
 */
function rotaRegistrada(antes, depois) {
  if (!depois || depois.role !== 'admin' || !depois.ultimaRota) return false;
  const a = emMs(antes && antes.ultimaRota);
  const d = emMs(depois.ultimaRota);
  return d != null && d !== a;
}

/**
 * O TESTE COMEÇA NO 3º DIA DE ROTA, E SÓ NELE (04/10/2026, decisão do dono).
 *
 * Era a PRIMEIRA rota, ou a primeira família entrando, ou a primeira
 * mensalidade — o que viesse antes. Só que o motorista costuma iniciar uma rota
 * só para ver como funciona, e o convite da primeira família sai na primeira
 * semana: o teste começava antes de ele sentir o app. Agora ele tem dois dias
 * de rota "de graça" antes de o relógio andar.
 *
 * ⚠️ DIAS DIFERENTES, contados no FUSO DE BRASÍLIA e pelo relógio do SERVIDOR.
 * Testar três vezes na mesma manhã conta como um dia. A data sai de quando o
 * servidor viu a rota, nunca de `ultimaRota` (que o cliente grava): com a data
 * do cliente, bastaria gravar sempre o mesmo dia para o teste nunca começar.
 *
 * ⚠️ O BURACO QUE ISTO REABRE, escrito para não ser esquecido: os outros dois
 * gatilhos (família e mensalidade) existiam para quem pulasse `registrarRota`
 * pelo devtools. Sem eles, quem fizer isso não entra no relógio. A saída, se
 * virar caso real, é contar os dias pelas viagens (`rides`), que o servidor vê.
 */
const DIAS_DE_ROTA_PARA_O_TESTE = 3;

/** 'AAAA-MM-DD' do instante em Brasília — o dia da rota, não o do servidor em UTC. */
function diaEmBrasilia(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/**
 * Soma o dia de hoje à lista de dias com rota. Devolve a lista nova, se ela
 * mudou (para não regravar o mesmo dia) e se o relógio deve ligar.
 * A lista guarda no máximo `DIAS_DE_ROTA_PARA_O_TESTE` dias: depois disso o
 * relógio já ligou e ela não serve para mais nada.
 */
function contarDiaDeRota(dias, dia) {
  const lista = Array.isArray(dias) ? dias.filter((d) => typeof d === 'string') : [];
  if (!dia || lista.includes(dia)) {
    return { dias: lista, mudou: false, ligar: lista.length >= DIAS_DE_ROTA_PARA_O_TESTE };
  }
  const nova = [...lista, dia].slice(-DIAS_DE_ROTA_PARA_O_TESTE);
  return { dias: nova, mudou: true, ligar: nova.length >= DIAS_DE_ROTA_PARA_O_TESTE };
}

module.exports = {
  emMs,
  rotaComecou,
  rotaRegistrada,
  decidirRelogio,
  DIAS_DE_ROTA_PARA_O_TESTE,
  diaEmBrasilia,
  contarDiaDeRota,
};
