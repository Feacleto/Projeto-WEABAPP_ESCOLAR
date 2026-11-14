/**
 * O DIA FECHADO — quantas paradas de hoje foram marcadas (RC2, 14/11/2026 —
 * docs/analise/13b, item 14; decisão 31 do `decisoes.md`).
 *
 * ── O QUE É, E O QUE NÃO É
 * Uma linha calma no fim da última viagem: "Hoje: 14 de 14 paradas marcadas."
 * Conta TOQUES do motorista, não serviço: o "TODOS OS N" marca várias crianças
 * de uma vez, e uma criança pode ser marcada sem ter sido entregue de verdade.
 * Por isso o texto diz "marcadas" — e nunca "tudo certo", "sucesso" ou
 * "sem problemas" (`marca/diaFechado.js`, e o teste procura).
 *
 * ── DE ONDE SAI A CONTA (nada novo do banco)
 * Só do que a rota JÁ tem em memória: os blocos do dia (`diaCompleto`) e o
 * status de cada criança hoje. Nenhuma leitura de `rides`, nenhuma escrita —
 * é o que a decisão 31 permite sem tocar em prazo de retenção nem em dado novo.
 *
 * ── O QUE CONTA COMO PARADA
 * Uma criança numa viagem (a ida de Ana e a volta de Ana são duas paradas).
 * Entra no total só quem PRECISAVA da perua naquela viagem (`precisaDaPerua`):
 * quem faltou, ou foi levada ou buscada pelo pai, SAI do denominador — nenhuma
 * parada marcada faltando por um dia que não era dela.
 *
 * Marcada é o ÚLTIMO passo da viagem:
 *   ida   — entregue na escola (`atSchool`), ou já adiante (`delivered`);
 *   volta — entregue em casa (`delivered`).
 * ⚠️ `home` na volta NÃO conta, embora `getActionForStatus('home', 'dropoff')`
 * não ofereça ação nenhuma (a criança some da fila): "sem ação pendente" não é
 * "foi marcada". Contar assim inflaria o número exatamente no caso que ele
 * existe para mostrar — a parada que ficou sem registro.
 *
 * ── SÓ NO FIM DO DIA
 * O status de uma criança é UM campo que anda pelo dia inteiro: depois que a
 * volta começa, ela está `onboard` e a ida dela já não se lê dele. Por isso a
 * linha só aparece quando não há mais viagem pela frente — e o `resumoDoDia`
 * é conservador no meio do caminho (nunca conta a mais, às vezes conta a
 * menos), nunca o contrário.
 *
 * Não importa Firebase nem React (decisão 17): `statusDe` é parâmetro, porque
 * `statusNaDirecao` mora atrás do Firestore. `npm run testar:dia-fechado`.
 */
import { precisaDaPerua } from './horarios.js';

/**
 * Esta parada foi marcada até o fim?
 * @param {'ida'|'volta'} direcao
 * @param {string} status  home | onboard | atSchool | delivered
 */
export function paradaMarcada(direcao, status) {
  if (direcao === 'ida') return status === 'atSchool' || status === 'delivered';
  if (direcao === 'volta') return status === 'delivered';
  return false;
}

/**
 * Quantas paradas do dia foram marcadas, entre as que precisavam da perua.
 *
 * @param {Array<{direcao: 'ida'|'volta', paradas: Array<{child: object, estado: string}>}>} blocos
 *   o resultado de `diaCompleto`
 * @param {(child: object, direcao: 'pickup'|'dropoff') => string} statusDe
 *   o status da criança hoje nesta direção (`statusNaDirecao`, com a falta declarada)
 * @returns {{ marcadas: number, total: number }}
 */
export function resumoDoDia(blocos, statusDe) {
  let marcadas = 0;
  let total = 0;
  for (const b of Array.isArray(blocos) ? blocos : []) {
    const dir = b?.direcao === 'ida' ? 'pickup' : 'dropoff';
    for (const p of Array.isArray(b?.paradas) ? b.paradas : []) {
      if (!p?.child || !precisaDaPerua(p.estado)) continue;
      total += 1;
      if (paradaMarcada(b.direcao, statusDe(p.child, dir))) marcadas += 1;
    }
  }
  return { marcadas, total };
}
