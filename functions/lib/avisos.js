/**
 * A ESPÉCIE DE CADA AVISO — espelho de `src/dominio/identidade/avisos.js`.
 *
 * ── POR QUE EXISTE UMA CÓPIA
 * Quem aplica o guarda é `push.js`, que roda no servidor: é o ÚNICO ponto por
 * onde todo aviso passa antes de chegar num aparelho. O deploy das functions
 * não alcança `src/`, então a duplicação é obrigatória — e o que a torna
 * segura é `npm run testar:preferencias`, que compara as duas tabela por
 * tabela, tipo por tipo.
 *
 * É o quarto espelho do projeto, depois da régua de preço, da escolha do
 * indicado e da reconciliação da indicação. O raciocínio inteiro (por que a
 * preferência é por espécie, por que fato e estado não se desligam, e por que
 * o documento continua sendo escrito) está no arquivo do cliente.
 *
 * ⚠️ SEM `require` DE SDK — é régua, e `npm run testar:imports` guarda isso.
 */

const ESPECIE = {
  FATO: 'fato',
  ESTADO: 'estado',
  PRAZO: 'prazo',
  OFERTA: 'oferta',
};

const DESLIGAVEIS = [ESPECIE.PRAZO, ESPECIE.OFERTA];

const ESPECIE_DO_AVISO = {
  rota_iniciada: ESPECIE.FATO,
  proxima_parada: ESPECIE.FATO,
  child_arrived_school: ESPECIE.FATO,
  child_arrived_home: ESPECIE.FATO,
  nao_embarcou: ESPECIE.FATO,
  agenda_entry: ESPECIE.FATO,
  agenda_broadcast: ESPECIE.FATO,
  agenda_school_entry: ESPECIE.FATO,
  school_no_class: ESPECIE.FATO,
  schedule_changed: ESPECIE.FATO,
  absence_confirm: ESPECIE.FATO,
  absence_declared: ESPECIE.FATO,
  alt_pickup: ESPECIE.FATO,

  payment_claimed: ESPECIE.FATO,
  payment_confirmed: ESPECIE.FATO,
  contrato_pronto: ESPECIE.FATO,
  contract_accepted: ESPECIE.FATO,
  chamado_respondido: ESPECIE.FATO,
  indicacao_ativou: ESPECIE.FATO,

  rota_atrasada: ESPECIE.ESTADO,
  comercial_retorno: ESPECIE.ESTADO,

  payment_due_5d: ESPECIE.PRAZO,
  payment_due_3d: ESPECIE.PRAZO,
  payment_due_0d: ESPECIE.PRAZO,
  payment_overdue_3d: ESPECIE.PRAZO,
  payment_overdue_7d: ESPECIE.PRAZO,
  fatura_vence: ESPECIE.PRAZO,
  alvara_vence: ESPECIE.PRAZO,

  convite_parado: ESPECIE.OFERTA,
  comercial_teste_comecou: ESPECIE.OFERTA,
  comercial_degrau_vira: ESPECIE.OFERTA,
  comercial_indicacao: ESPECIE.OFERTA,
};

/** Padrão `FATO` — o seguro, não o conveniente. Ver o cliente. */
function especieDoAviso(tipo) {
  return ESPECIE_DO_AVISO[String(tipo || '')] || ESPECIE.FATO;
}

function podeDesligar(especie) {
  return DESLIGAVEIS.indexOf(especie) !== -1;
}

function tocaNoAparelho(tipo, desligadas) {
  const especie = especieDoAviso(tipo);
  if (!podeDesligar(especie)) return true;

  const lista = Array.isArray(desligadas) ? desligadas : [];
  return lista.indexOf(especie) === -1;
}

module.exports = {
  ESPECIE,
  DESLIGAVEIS,
  ESPECIE_DO_AVISO,
  especieDoAviso,
  podeDesligar,
  tocaNoAparelho,
};
