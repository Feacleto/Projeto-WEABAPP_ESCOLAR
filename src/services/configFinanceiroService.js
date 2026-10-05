import { Timestamp, doc, getDoc, increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TIPOS_DE_COMBUSTIVEL, nomeDoPosto, postoComPreco } from '../dominio/cobranca/combustivel.js';
import { vagasParaGravar, vagasValidas } from '../dominio/identidade/vagasDaPerua.js';

/**
 * O QUE O FINANCEIRO SABE DO MOTORISTA, FORA DO DOCUMENTO QUE AS FAMÍLIAS LEEM
 * (03/10/2026).
 *
 * `configFinanceiro/{uid}` — só o próprio motorista lê. Mora fora de `users`
 * porque as famílias leem `users` inteiro (precisam da chave PIX), e regra
 * não esconde campo.
 *
 *   temSenha     bool — gravado SÓ pelo servidor, ao criar a senha
 *   usoDaPerua   'so_rota' | 'tambem_fora' | ausente (ainda não perguntado)
 *   kmDasRotas   número que só sobe — km somados no celular dele durante as
 *                rotas. É um contador, como o hodômetro: o km entre dois
 *                abastecimentos é a diferença entre as duas leituras dele.
 *
 * "SUA PERUA" (03/10/2026) — abastecer, reserva e "preciso aumentar":
 *   combustivelDaPerua  chave de TIPOS_DE_COMBUSTIVEL — o que a perua bebe
 *   postos       lista (≤ 20) de { nome, preco, tipo, vistoEm } — o ÚLTIMO
 *                preço que ele viu em cada posto. É a memória dele, não uma
 *                pesquisa de preços: nunca há posto "recomendado".
 *   planoDaTroca { valorHoje, anos, valorFinal, criadoEm } — quanto separar
 *                por mês para trocar a perua.
 *   guardado     { troca?: { valor, em }, manutencao?: { valor, em } } — o que
 *                ELE ANOTOU que tem guardado. ⚠️ O app NÃO guarda dinheiro:
 *                é uma anotação, e o vocabulário é "anotou", "guardado",
 *                "atualizar" — nunca saldo, depósito ou saque.
 *
 * A PERUA EM VAGAS (05/10/2026):
 *   vagasDaPerua inteiro de 1 a 60 — quantas crianças cabem na perua, dito
 *                por ele no primeiro acesso. Nunca trava cadastro: é o desenho
 *                da perua no Início, nos planos e na turma
 *                (`dominio/identidade/vagasDaPerua.js`).
 *
 * A validação de cada chave mora aqui (mensagem em português) E na rule de
 * `configFinanceiro`, que é lista de PERMITIDOS — chave nova sem entrada lá é
 * `permission-denied`.
 *
 * ⚠️ O km é somado no aparelho e só o TOTAL é gravado. Nenhuma coordenada sai
 * daqui — o trajeto do motorista não é guardado em lugar nenhum.
 */

export const USO_DA_PERUA = {
  SO_ROTA: 'so_rota',
  TAMBEM_FORA: 'tambem_fora',
};

/** Escuta a configuração. Sem documento, entrega `{}`. */
export function watchConfigFinanceiro(uid, onUpdate) {
  if (!uid) {
    onUpdate({});
    return () => {};
  }
  return onSnapshot(
    doc(db, 'configFinanceiro', uid),
    (snap) => onUpdate(snap.exists() ? snap.data() : {}),
    (err) => {
      console.error('[configFinanceiro]', err);
      onUpdate({});
    }
  );
}

/** A resposta à pergunta "a perua roda só nas rotas?". */
export function definirUsoDaPerua(uid, uso) {
  if (!Object.values(USO_DA_PERUA).includes(uso)) {
    throw new Error('Uso da perua desconhecido.');
  }
  return setDoc(doc(db, 'configFinanceiro', uid), { usoDaPerua: uso }, { merge: true });
}

/** Soma os km de uma rota ao contador. Só valores positivos. */
export function somarKmDasRotas(uid, km) {
  const valor = Math.round(Number(km) * 10) / 10;
  if (!uid || !Number.isFinite(valor) || valor <= 0) return Promise.resolve();
  return setDoc(doc(db, 'configFinanceiro', uid), { kmDasRotas: increment(valor) }, { merge: true });
}

const CHAVES_DE_COMBUSTIVEL = TIPOS_DE_COMBUSTIVEL.map((t) => t.chave);

/** Que combustível a perua usa — o padrão do "Abastecer". */
export function definirCombustivelDaPerua(uid, chave) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  if (!CHAVES_DE_COMBUSTIVEL.includes(chave)) {
    throw new Error('Tipo de combustível desconhecido.');
  }
  return setDoc(doc(db, 'configFinanceiro', uid), { combustivelDaPerua: chave }, { merge: true });
}

/**
 * Anota o preço que ele viu num posto. Lê a lista, aplica `postoComPreco` (o
 * mesmo nome substitui; acima de 20 sai o visto há mais tempo) e regrava a
 * lista INTEIRA — o merge do Firestore não mescla array, substitui.
 *
 * `vistoEm` é `Timestamp.now()` e não `serverTimestamp()`: o sentinela não
 * pode ir dentro de um array.
 *
 * Ler e regravar tem uma janela (dois aparelhos anotando no mesmo segundo,
 * um preço se perde). É o celular de UMA pessoa anotando à mão; uma
 * transação aqui seria custo sem caso real.
 *
 * `local` ({ endereco, lat, lng }) vem quando ele respondeu "estou no posto"
 * (04/10/2026): o posto passa a ser reconhecido pelo lugar. Só o ponto do
 * POSTO é guardado, nunca a posição dele fora do abastecimento.
 */
export async function guardarPrecoNoPosto(uid, { nome, preco, tipo, local = null }) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  const limpo = nomeDoPosto(String(nome || ''));
  if (!limpo) throw new Error('Diga o nome do posto.');
  const valor = Math.round(Number(String(preco).replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(valor) || valor < 3 || valor > 15) {
    throw new Error('O preço do litro precisa estar entre R$ 3 e R$ 15.');
  }
  if (!CHAVES_DE_COMBUSTIVEL.includes(tipo)) {
    throw new Error('Tipo de combustível desconhecido.');
  }
  const ref = doc(db, 'configFinanceiro', uid);
  const snap = await getDoc(ref);
  const atuais = snap.exists() && Array.isArray(snap.data().postos) ? snap.data().postos : [];
  const postos = postoComPreco(atuais, {
    nome: limpo,
    preco: valor,
    tipo,
    em: Timestamp.now(),
    endereco: local?.endereco,
    lat: local?.lat,
    lng: local?.lng,
  });
  return setDoc(ref, { postos }, { merge: true });
}

/**
 * O plano para trocar a perua. `criadoEm` é a hora do servidor: é dela que
 * sai "até janeiro de 2031", e o relógio do aparelho erraria a data.
 * Salvar de novo recomeça o plano a partir de hoje — é um plano novo.
 */
export function salvarPlanoDaTroca(uid, { valorHoje, anos, valorFinal }) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  const hoje = Number(valorHoje);
  const prazo = Number(anos);
  const final = Number(valorFinal);
  if (!Number.isFinite(hoje) || hoje <= 0) throw new Error('Quanto vale a perua hoje?');
  if (!Number.isInteger(prazo) || prazo < 1 || prazo > 20) {
    throw new Error('O prazo é de 1 a 20 anos.');
  }
  if (!Number.isFinite(final) || final < 0 || final >= hoje) {
    throw new Error('O valor no fim precisa ser menor que o de hoje.');
  }
  return setDoc(
    doc(db, 'configFinanceiro', uid),
    { planoDaTroca: { valorHoje: hoje, anos: prazo, valorFinal: final, criadoEm: serverTimestamp() } },
    { merge: true }
  );
}

export const CAIXAS_DO_GUARDADO = ['troca', 'manutencao'];

/**
 * Anota quanto ele TEM GUARDADO numa das duas caixas. Substitui o valor
 * anterior (é "atualizar", não somar): ele olha o extrato do banco e diz o
 * número. O merge mescla o mapa, então a outra caixa fica intacta.
 */
export function anotarGuardado(uid, caixa, valor) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  if (!CAIXAS_DO_GUARDADO.includes(caixa)) throw new Error('Caixa desconhecida.');
  const n = Math.round(Number(String(valor).replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) throw new Error('Diga um valor igual ou maior que zero.');
  return setDoc(
    doc(db, 'configFinanceiro', uid),
    { guardado: { [caixa]: { valor: n, em: serverTimestamp() } } },
    { merge: true }
  );
}

/**
 * Escuta SÓ as vagas da perua: `number` quando ele já disse, `null` quando
 * não disse, `undefined` quando não dá para saber.
 *
 * ⚠️ "NÃO DÁ PARA SABER" TEM DOIS CASOS, e nenhum deles é "não disse": o erro
 * de leitura, e o documento AUSENTE vindo do cache (sem sinal, o SDK pode
 * responder "não existe" antes de perguntar ao servidor). Tratar qualquer um
 * como `null` abriria o card do primeiro acesso para quem já respondeu.
 */
export function watchVagasDaPerua(uid, onUpdate) {
  if (!uid) {
    onUpdate(undefined);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'configFinanceiro', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(snap.metadata.fromCache ? undefined : null);
        return;
      }
      const v = snap.data().vagasDaPerua;
      onUpdate(vagasValidas(v) ? v : null);
    },
    (err) => {
      console.error('[vagasDaPerua]', err);
      onUpdate(undefined);
    }
  );
}

/**
 * Grava quantas vagas a perua tem. O número passa por `vagasParaGravar`, que
 * devolve SEMPRE um inteiro (a rule exige `is int`): texto de campo ou número
 * quebrado nunca chegam ao Firestore.
 */
export function definirVagasDaPerua(uid, valor) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  const vagasDaPerua = vagasParaGravar(valor);
  return setDoc(doc(db, 'configFinanceiro', uid), { vagasDaPerua }, { merge: true });
}
