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
  // 03/10/2026 — os avisos que estavam faltando, os quatro FATO: a perua
  // chegando (antes só um toast com o app aberto), a buzina com o app
  // fechado, o embarque na escola e o acesso de 24h do segundo responsável.
  perua_chegando: ESPECIE.FATO,
  perua_chegou: ESPECIE.FATO,
  buzina: ESPECIE.FATO,
  child_onboard: ESPECIE.FATO,
  acesso_temporario: ESPECIE.FATO,
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
  indicacao_cadastrou: ESPECIE.FATO,
  // O vínculo automático de irmão e a recusa dele: o que ACONTECEU com o
  // filho dela (ou com o cadastro dele). Não se desliga.
  irmao_vinculado: ESPECIE.FATO,
  irmao_recusado: ESPECIE.FATO,
  // O pedido de acesso sem link e a resposta do motorista: fatos sobre o
  // vínculo com a criança. Não se desligam.
  pedido_de_acesso: ESPECIE.FATO,
  acesso_aprovado: ESPECIE.FATO,
  acesso_recusado: ESPECIE.FATO,
  // A família informou o número da casa que o motorista não sabia.
  numero_da_casa: ESPECIE.FATO,
  // Um investidor deixou o contato no site — só o dono recebe.
  lead_investidor: ESPECIE.FATO,
  // A auxiliar confirmou que recebeu o pagamento que o motorista anotou:
  // o recibo dos dois fechou. Fato sobre dinheiro dele, não se desliga.
  auxiliar_confirmou_pagamento: ESPECIE.FATO,
  // O link da substituta de um dia morreu (pelo tio ou pelo fim da rota):
  // fato sobre quem vê a turma dele hoje, não se desliga.
  acesso_substituta_encerrado: ESPECIE.FATO,
  // O tio escreveu (ou mudou) uma recomendação para a auxiliar: ela precisa
  // ler e decidir se aparece. Fato sobre o trabalho dela, não se desliga.
  recomendacao_recebida: ESPECIE.FATO,
  // A rede de parceiros (fase 1, 05/10/2026). O tio parceiro foi indicado a
  // uma família: é cliente que pode chamar, e isso não se desliga. O tio da
  // família pergunta se o filho pode aparecer na foto da turma: é ele
  // pedindo uma resposta dela, como um recado.
  parceiro_indicou_voce: ESPECIE.FATO,
  // Passar a família para outro tio (fase 2): cada passo é um fato sobre a
  // turma dele ou sobre o transporte do filho dela, e nenhum se desliga.
  transferencia_pedida: ESPECIE.FATO,
  transferencia_respondida: ESPECIE.FATO,
  transferencia_concluida: ESPECIE.FATO,
  transferencia_para_aceitar: ESPECIE.FATO,
  familia_pede_outro_tio: ESPECIE.FATO,
  pedido_sim_da_foto: ESPECIE.FATO,

  rota_atrasada: ESPECIE.ESTADO,
  comercial_retorno: ESPECIE.ESTADO,
  // ⚠️ O ENCERRAMENTO É `estado`, E ISSO NÃO É DETALHE DE CLASSIFICAÇÃO.
  //
  // A leitura fácil seria `prazo` — tem data chegando. Mas `prazo` é
  // DESLIGÁVEL, e desligar estes três significaria a associação terminando em
  // silêncio para quem só pediu menos ruído: a conta para numa manhã de terça,
  // com criança na porta. `estado` é "a conta dela mudando de estado", que é
  // exatamente o que está acontecendo.
  encerramento_30d: ESPECIE.ESTADO,
  encerramento_7d: ESPECIE.ESTADO,
  encerramento_fim: ESPECIE.ESTADO,
  // A plataforma suspendeu, reativou ou deu um aviso formal (painel do dono,
  // 05/10/2026). É a conta mudando de estado por decisão de alguém, com prazo
  // de resposta: desligar isto seria a pessoa não saber por que o app parou.
  conta_suspensa: ESPECIE.ESTADO,
  conta_reativada: ESPECIE.ESTADO,
  aviso_da_plataforma: ESPECIE.ESTADO,

  payment_due_5d: ESPECIE.PRAZO,
  payment_due_3d: ESPECIE.PRAZO,
  payment_due_0d: ESPECIE.PRAZO,
  payment_overdue_3d: ESPECIE.PRAZO,
  payment_overdue_7d: ESPECIE.PRAZO,
  fatura_vence: ESPECIE.PRAZO,
  alvara_vence: ESPECIE.PRAZO,

  convite_parado: ESPECIE.OFERTA,
  // ⚠️ OFERTA, e não `fato`. Ela é a melhor notícia que o app tem pra dar —
  // e é oferta do mesmo jeito: quem desligou oferta desligou esta também, e
  // classificá-la como fato para "garantir" a entrega seria usar a exceção
  // de chegada da criança para vender.
  oferta_primeira_rota: ESPECIE.OFERTA,
  comercial_teste_comecou: ESPECIE.OFERTA,
  comercial_degrau_vira: ESPECIE.OFERTA,
  comercial_indicacao: ESPECIE.OFERTA,
  // A foto da turma saiu: novidade, não urgência. Quem desligou "Novidades"
  // continua vendo a foto no Início, só o celular não toca.
  foto_da_turma: ESPECIE.OFERTA,
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
