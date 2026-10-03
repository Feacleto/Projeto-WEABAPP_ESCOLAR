/**
 * OS MÓDULOS DE COBRANÇA — o registro único (02/10/2026).
 *
 * A cobrança da plataforma é feita de MÓDULOS que o dono liga e desliga no
 * painel admin, todos embaixo de uma chave mestra:
 *
 *   platformConfig/app.cobrancaLigada   a chave mestra = o módulo BASE (o
 *                                       Plano padrão). AUSENTE = DESLIGADA.
 *   platformConfig/app.modulos.{id}     cada módulo de desconto/cobrança.
 *                                       AUSENTE = DESLIGADO.
 *
 * ⚠️ CADA MÓDULO LIGA SOZINHO (decisão do dono, 02/10/2026). "Habilitar a
 * cobrança" liga SÓ o Plano padrão; escada, indicação e qualquer módulo novo
 * precisam ser ligados um a um. Ligar a mestra nunca acorda desconto nenhum.
 *
 * ⚠️ MAS OS DESCONTOS DEPENDEM DA BASE: eles descontam a FATURA do plano, e
 * sem plano não há fatura. Ligado no painel com a base desligada, o módulo
 * fica gravado como ligado e só passa a valer quando a base ligar.
 *
 * Tudo o que fala de cobrança no app — tela, aviso, texto de tutorial,
 * notificação antiga no sino — pergunta `moduloAtivo(config, id)` ao módulo
 * DONO dele. Desligou, some; ligou, volta. Nada é apagado.
 *
 * ── COMO CRIAR UM MÓDULO NOVO (ex.: um desconto sazonal de férias)
 * 1. Acrescente um item em `MODULOS_DE_COBRANCA`, com `id`, `nome`,
 *    `descricao` e os `tiposDeAviso` que ele dispara (para o sino esconder os
 *    antigos quando ele for desligado).
 * 2. Nas telas, leia `useModuloDeCobranca(id)`; nas functions,
 *    `moduloAtivo(db, id)` de `functions/lib/cobrancaLigada.js` (a mesma regra,
 *    espelhada — o Node das functions não importa este arquivo).
 * 3. O painel admin desenha o interruptor sozinho, a partir desta lista.
 *
 * ── PERÍODO (o caso sazonal)
 * O valor de um módulo pode ser só `true`/`false`, ou um objeto
 * `{ ativo, de, ate }` com datas 'AAAA-MM-DD'. Com período, ele só vale dentro
 * dele — "desconto de volta às aulas de 15/01 a 15/02" sem ninguém precisar
 * lembrar de desligar.
 *
 * Mora no domínio (puro, sem Firebase) para a bateria alcançar.
 * Ver docs/estrutura-de-cobranca.md.
 */
import { cobrancaLigada } from './cobrancaLigada.js';

export const MODULO = {
  /** A base: teste de 90 dias, plano por criança, fatura, bloqueio. */
  PLANO: 'plano',
  /** A escada de desconto do teste (30/20/10%). */
  ESCADA: 'escada',
  /** O desconto por motorista indicado que paga. */
  INDICACAO: 'indicacao',
};

export const MODULOS_DE_COBRANCA = [
  {
    id: MODULO.PLANO,
    nome: 'Plano padrão',
    descricao:
      'Teste de 90 dias, plano mensal ou anual por criança, fatura todo dia 1º e bloqueio de quem não paga.',
    // A base não tem interruptor próprio: ela É a chave mestra. Sem plano não
    // há o que descontar, então desligar a base é desligar a cobrança.
    base: true,
    tiposDeAviso: [
      'comercial_teste_comecou',
      'comercial_retorno',
      'fatura_vence',
      'encerramento_30d',
      'encerramento_7d',
      'encerramento_fim',
    ],
  },
  {
    id: MODULO.ESCADA,
    nome: 'Escada de desconto',
    descricao:
      '30% no 1º mês de teste, 20% no 2º, 10% no 3º, para quem contrata durante o teste. Desligar não tira o desconto de quem já ganhou: ele é vitalício e está no contrato.',
    // ⚠️ ESTE MÓDULO JÁ FOI O CAMPO `janelaEscada` (ausente = aberta). Desde
    // 02/10/2026 ele mora em `modulos.escada` (ausente = desligado), como os
    // outros. `escadaAberta()` continua existindo para o teste da régua, mas
    // nenhuma decisão de tela ou de servidor lê mais o campo antigo.
    tiposDeAviso: ['comercial_degrau_vira', 'oferta_primeira_rota'],
  },
  {
    id: MODULO.INDICACAO,
    nome: 'Desconto por indicação',
    descricao:
      'Cada motorista indicado que paga dá desconto na conta de quem indicou. Desligar esconde o programa; o desconto já conquistado continua na fatura.',
    tiposDeAviso: ['comercial_indicacao', 'indicacao_ativou', 'indicacao_cadastrou'],
  },
];

const POR_ID = Object.fromEntries(MODULOS_DE_COBRANCA.map((m) => [m.id, m]));

/** 'AAAA-MM-DD' do dia, no fuso do aparelho. */
function hojeISO(agora) {
  const d = agora instanceof Date ? agora : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** O valor gravado de um módulo, com o período resolvido. */
function valorDoModulo(config, modulo, agora) {
  const bruto = config?.modulos?.[modulo.id];

  if (bruto === undefined || bruto === null) return false; // ausente = desligado
  if (typeof bruto === 'boolean') return bruto;
  if (typeof bruto === 'object') {
    if (bruto.ativo === false) return false;
    const hoje = hojeISO(agora);
    if (bruto.de && hoje < bruto.de) return false;
    if (bruto.ate && hoje > bruto.ate) return false;
    return true;
  }
  return true;
}

/**
 * O que o PAINEL mostra no interruptor: o que o dono gravou, sem olhar a base.
 * (O que VALE é `moduloAtivo`, que exige a base.) A base responde a mestra.
 */
export function moduloLigadoNoPainel(config, id, agora = new Date()) {
  const modulo = POR_ID[id];
  if (!modulo) return false;
  if (modulo.base) return cobrancaLigada(config);
  return valorDoModulo(config, modulo, agora);
}

/**
 * O módulo vale AGORA? Exige a chave mestra (a base) ligada. Módulo desconhecido
 * responde `false`: perguntar por um id que não existe é um erro de quem
 * escreveu a tela, e cobrar por engano é o erro caro.
 */
export function moduloAtivo(config, id, agora = new Date()) {
  if (!cobrancaLigada(config)) return false;
  const modulo = POR_ID[id];
  if (!modulo) return false;
  if (modulo.base) return true;
  return valorDoModulo(config, modulo, agora);
}

/** O módulo dono de um tipo de notificação, ou `null` se não é de cobrança. */
export function moduloDoAviso(tipo) {
  return MODULOS_DE_COBRANCA.find((m) => m.tiposDeAviso?.includes(tipo)) || null;
}

/**
 * A notificação aparece no sino? As que não são de cobrança, sempre. As de
 * cobrança, só com o módulo delas ligado — quem recebeu "seu teste começou"
 * antes da pausa não continua lendo isso durante ela.
 */
export function avisoVisivel(config, tipo, agora = new Date()) {
  const modulo = moduloDoAviso(tipo);
  if (!modulo) return true;
  return moduloAtivo(config, modulo.id, agora);
}
