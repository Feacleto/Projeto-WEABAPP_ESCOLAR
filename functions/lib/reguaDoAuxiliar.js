/**
 * A AUXILIAR — régua PURA (05/10/2026, simulações "Conta da Auxiliar" e "Aba
 * Auxiliar do Motorista" aprovadas pelo dono).
 *
 * A auxiliar é o QUINTO papel do app (`role: 'auxiliar'`), sempre ligada a um
 * motorista — ou a dois, desde o vínculo por par. A conta dela nasce só pelo
 * convite de um deles — ninguém se cadastra
 * como auxiliar sozinho —, e ele a desativa quando quiser. Cada um tem a sua
 * conta: não existe "modo auxiliar" no celular do tio (decisão do dono).
 *
 * Régua sem `require`, como toda régua de `functions/lib/` (`testar:imports`).
 */

/** O link do convite vale 15 dias, como o convite da família. */
const VALIDADE_DO_CONVITE_DIAS = 15;
const VALIDADE_DO_CONVITE_MS = VALIDADE_DO_CONVITE_DIAS * 24 * 60 * 60 * 1000;

/** Até duas ao mesmo tempo: há perua com uma na ida e outra na volta. */
const MAX_AUXILIARES_ATIVAS = 2;

/** Sem 0/O nem 1/I: o código pode ser lido em voz alta. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_DO_CODIGO = 10;

/** `aleatorio` (0 ≤ x < 1) é injetado para o teste ser determinístico. */
function gerarCodigoDoConvite(aleatorio = Math.random) {
  let s = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) {
    s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length) % ALFABETO.length];
  }
  return s;
}

/** O código tem o formato certo? Só ele vira caminho de documento. */
function codigoValido(codigo) {
  return new RegExp(`^[${ALFABETO}]{${TAMANHO_DO_CODIGO}}$`).test(String(codigo || ''));
}

/** Só dígitos, com DDD: 10 (fixo) ou 11 (celular). `null` se não for. */
function telefoneLimpo(bruto) {
  const d = String(bruto || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length === 10 || d.length === 11 ? d : null;
}

/**
 * O convite ainda vale? Devolve `{ vale, motivo }`. Os motivos não chegam à
 * tela: quem abre um link que não vale recebe UMA frase só, como no convite
 * da família — dizer "foi usado" ou "venceu" a um estranho com o link na mão
 * conta coisa demais.
 */
function conviteVale(convite, agoraMs) {
  if (!convite) return { vale: false, motivo: 'inexistente' };
  if (convite.canceladoEm) return { vale: false, motivo: 'cancelado' };
  if (convite.usadoPor) return { vale: false, motivo: 'usado' };
  const criado = Number(convite.criadoEmMs) || 0;
  if (!criado || agoraMs - criado > VALIDADE_DO_CONVITE_MS) return { vale: false, motivo: 'vencido' };
  return { vale: true, motivo: null };
}

/** Ele ainda pode chamar mais uma? Conta as ativas. */
function cabeMaisUma(ativas) {
  return Math.max(0, Number(ativas) || 0) < MAX_AUXILIARES_ATIVAS;
}

/**
 * ⚠️ O VÍNCULO É POR PAR (05/10/2026, decisão do dono com a QA):
 * `auxiliares/{motoristaUid}_{auxiliarUid}`. Era `auxiliares/{auxiliarUid}`,
 * um documento por AUXILIAR — e isso tinha dois defeitos que só aparecem com
 * o tempo:
 *   - o convite de um SEGUNDO tio sobrescrevia o vínculo do primeiro, e o
 *     "quem já trabalhou comigo" dele perdia a pessoa (o histórico é o que a
 *     recomendação, na próxima etapa, vai ler);
 *   - ela não podia trabalhar para dois tios, e há auxiliar que faz a ida
 *     com um e a volta com outro.
 * Por par, cada relação tem a sua história, e o mesmo tio recontratando a
 * mesma pessoa reabre o MESMO documento com um período novo.
 *
 * SEM MIGRAÇÃO: a conta da auxiliar ainda não foi ao ar (espera a revisão da
 * Política), então não há documento no formato antigo em produção.
 */
function idDoVinculo(motoristaUid, auxiliarUid) {
  return `${motoristaUid}_${auxiliarUid}`;
}

/** Até dois tios ativos por auxiliar — a ida com um, a volta com outro. */
const MAX_TIOS_ATIVOS = 2;

/** Ela ainda pode aceitar mais um tio? Conta os vínculos ATIVOS dela. */
function cabeMaisUmTio(ativosDaAuxiliar) {
  return Math.max(0, Number(ativosDaAuxiliar) || 0) < MAX_TIOS_ATIVOS;
}

/**
 * OS PERÍODOS DE TRABALHO. `periodos: [{ de, ate }]`, `ate: null` no aberto.
 * Desativar FECHA o período; recontratar ABRE um novo — nada é apagado.
 * As datas vão como instante pronto (não `serverTimestamp`): o Firestore
 * recusa sentinela dentro de array.
 */
function abrirPeriodo(periodos, agora) {
  const lista = Array.isArray(periodos) ? periodos.map((p) => ({ ...p })) : [];
  if (lista.some((p) => p && p.ate == null)) return lista; // já tem um aberto
  lista.push({ de: agora, ate: null });
  return lista;
}
function fecharPeriodo(periodos, agora) {
  return (Array.isArray(periodos) ? periodos : []).map((p) => (p && p.ate == null ? { ...p, ate: agora } : { ...p }));
}

/**
 * Quantos dias de vínculo, somando os períodos — o aberto conta até agora.
 * É a régua que a recomendação vai usar (30 dias de vínculo, pela SOMA: quem
 * trabalhou duas temporadas de 20 dias trabalhou 40). Dias INTEIROS, para
 * baixo: 29 dias e 23 horas ainda não são 30.
 */
function diasDeVinculo(periodos, agoraMs) {
  let total = 0;
  for (const p of Array.isArray(periodos) ? periodos : []) {
    const de = msDe(p?.de);
    if (de == null) continue;
    const ate = p.ate == null ? agoraMs : msDe(p.ate);
    if (ate == null || ate <= de) continue;
    total += ate - de;
  }
  return Math.floor(total / DIA_MS);
}

/**
 * ⚠️ A TURMA QUE A AUXILIAR VÊ É UMA LISTA FECHADA DE CAMPOS (fase 2,
 * 05/10/2026). Ela não pode ler `children` direto: ali moram a mensalidade, o
 * vencimento, o contrato e a saúde da criança, e regra de acesso não esconde
 * campo — quem lê o documento lê tudo. O servidor copia para ela SÓ o que está
 * aqui. Campo novo em `children` não entra sozinho: alguém precisa decidir
 * acrescentá-lo, e `testar:auxiliar` reprova mensalidade, contrato e saúde.
 */
const CAMPOS_DA_TURMA_DA_AUXILIAR = [
  'name', 'photoURL', 'gender',
  'school', 'schoolId', 'schoolPhone', 'turma', 'professora',
  'horaPega', 'horaEntrega', 'period', 'pickupPeriod', 'dropoffPeriod',
  'parentName', 'parentPhone',
  'status', 'statusUpdatedAt', 'active',
];

/** O recorte de uma criança para a auxiliar. `null` se ela não deve aparecer. */
function recorteParaAuxiliar(child) {
  if (!child || child.active !== true || !child.adminUid) return null;
  const r = {};
  for (const k of CAMPOS_DA_TURMA_DA_AUXILIAR) {
    if (child[k] !== undefined) r[k] = child[k];
  }
  return r;
}

/** A falta do dia, para ela: só data, criança e tipo — nunca o recado. */
function faltaParaAuxiliar(declaracao) {
  if (!declaracao || !declaracao.adminUid || !declaracao.childId || !declaracao.dateKey) return null;
  return { dateKey: declaracao.dateKey, childId: declaracao.childId, type: declaracao.type || null };
}

/**
 * A MARCAÇÃO DA AUXILIAR SÓ ANDA PARA A FRENTE (fase 3, 05/10/2026), pelos
 * mesmos passos do motorista (`acaoDaParada.js`):
 *   ida   home → onboard → atSchool
 *   volta atSchool → onboard → delivered
 * Corrigir um toque errado ("Desfazer") continua com o motorista: ela marca,
 * ele corrige — senão os dois desfazendo ao mesmo tempo apagariam um ao outro.
 */
const PASSOS_PERMITIDOS = {
  home: ['onboard'],
  onboard: ['atSchool', 'delivered'],
  atSchool: ['onboard'],
  delivered: [],
};
function passoValido(atual, proximo) {
  return (PASSOS_PERMITIDOS[atual || 'home'] || []).includes(proximo);
}

/** O status de hoje: o gravado ontem não vale hoje (`getEffectiveStatus`). */
function statusDeHoje(child, hojeChave, chaveDoDia) {
  const em = child?.statusUpdatedAt;
  const ms = em && typeof em.toMillis === 'function' ? em.toMillis() : null;
  if (ms == null) return child?.status || 'home';
  return chaveDoDia(ms) === hojeChave ? child.status || 'home' : 'home';
}

/**
 * O aviso à família pela marcação dela — o mesmo critério do motorista: o
 * embarque só avisa na saída da escola (de manhã quem põe na perua é a
 * própria família), e chegada na escola e em casa sempre avisam.
 */
function avisoDaMarcacao({ proximo, anterior, nome, hora }) {
  const n = String(nome || '').split(' ')[0] || 'A criança';
  if (proximo === 'onboard' && anterior === 'atSchool') {
    return { type: 'child_onboard', title: `${n} entrou na perua`, body: `Às ${hora}, na saída da escola. Marcado na perua.` };
  }
  if (proximo === 'atSchool') return { type: 'child_arrived_school', title: `${n} chegou na escola`, body: `Às ${hora}, marcado na perua.` };
  if (proximo === 'delivered') return { type: 'child_arrived_home', title: `${n} chegou em casa`, body: `Às ${hora}, marcado na perua.` };
  return null;
}

/**
 * ⚠️ A CONTA DO MOTORISTA ESTÁ OPERANDO? (achado da QA, 05/10/2026)
 *
 * A tranca do projeto mora no `isAdmin()` das rules: suspenso, ou teste
 * vencido sem assinatura com a cobrança ligada, não escreve nada. As
 * callables da auxiliar escrevem com o Admin SDK, por cima das rules — sem
 * esta conferência, a auxiliar viraria o jeito de operar uma conta trancada.
 * É o MESMO predicado do `isAdmin()` (firestore.rules), escrito aqui:
 *   não suspenso E (assinatura cobre hoje + 10 dias OU teste correndo — ou nem
 *   começado — OU cobrança desligada).
 */
const DIA_MS = 24 * 60 * 60 * 1000;
function msDe(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function contaDoMotoristaOpera(motorista, { cobrancaLigada = false, agoraMs = Date.now() } = {}) {
  if (!motorista || motorista.role !== 'admin') return false;
  if (motorista.suspenso === true) return false;
  if (!cobrancaLigada) return true;
  const assinatura = msDe(motorista.assinaturaAte);
  if (assinatura != null && assinatura + 10 * DIA_MS > agoraMs) return true;
  const teste = msDe(motorista.trialInicio);
  return teste == null || teste + 90 * DIA_MS > agoraMs;
}

module.exports = {
  contaDoMotoristaOpera,
  passoValido,
  statusDeHoje,
  avisoDaMarcacao,
  CAMPOS_DA_TURMA_DA_AUXILIAR,
  recorteParaAuxiliar,
  faltaParaAuxiliar,
  VALIDADE_DO_CONVITE_DIAS,
  VALIDADE_DO_CONVITE_MS,
  MAX_AUXILIARES_ATIVAS,
  TAMANHO_DO_CODIGO,
  gerarCodigoDoConvite,
  codigoValido,
  telefoneLimpo,
  conviteVale,
  cabeMaisUma,
  idDoVinculo,
  MAX_TIOS_ATIVOS,
  cabeMaisUmTio,
  abrirPeriodo,
  fecharPeriodo,
  diasDeVinculo,
};
