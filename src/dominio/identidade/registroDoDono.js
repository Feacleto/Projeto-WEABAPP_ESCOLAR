/**
 * O REGISTRO DE AÇÕES DO DONO — espelho de `functions/lib/reguaDoRegistro.js`
 * (05/10/2026, painel do dono, lote 2).
 *
 * A folha "Suspender" do painel mostra as mesmas listas, o mesmo texto padrão
 * e a mesma validação que a callable `suspenderConta` aplica — senão a tela
 * deixaria mandar o que o servidor recusa, ou recusaria o que ele aceita.
 * O cabeçalho completo (por que existe, o direito do titular de pedir a linha
 * dele, por que o prazo não vai para `users`) está no arquivo do servidor.
 *
 * Duplicar régua só com teste que compara os dois caso a caso:
 * `npm run testar:registro`. Puro: sem Firebase, sem React.
 */

const ACAO = {
  SUSPENDER: 'suspender',
  REATIVAR: 'reativar',
  AVISO: 'aviso',
  RESPOSTA: 'resposta_registrada',
};

/** As ações que a callable aceita. A resposta registrada entra depois. */
const ACOES_DO_PAINEL = [ACAO.SUSPENDER, ACAO.REATIVAR, ACAO.AVISO];

/**
 * Motivos para suspender ou avisar — LISTA FECHADA (parecer da sessão
 * jurídica, 05/10/2026). `atraso` é a cláusula 5 do contrato e só existe com a
 * cobrança da plataforma ligada.
 */
const MOTIVOS_DE_BLOQUEIO = [
  { id: 'fraude', rotulo: 'Fraude' },
  { id: 'documento_falso', rotulo: 'Identidade ou documento falso' },
  { id: 'dados_de_terceiros', rotulo: 'Acesso a dados de outra turma' },
  { id: 'ameaca', rotulo: 'Ameaça ou assédio' },
  { id: 'uso_ilegal', rotulo: 'Uso ilegal' },
  { id: 'risco_crianca', rotulo: 'Risco à criança' },
  { id: 'ordem_autoridade', rotulo: 'Ordem de autoridade' },
  { id: 'atraso', rotulo: 'Atraso no pagamento', soComCobranca: true },
];

/**
 * Motivos para suspender ou avisar uma FAMÍLIA — lista fechada (decisão do
 * dono, 05/10/2026). Sem atraso, sem mensalidade, de propósito.
 */
const MOTIVOS_DA_FAMILIA = [
  { id: 'ameaca_ofensa', rotulo: 'Ameaça ou ofensa ao tio ou à auxiliar' },
  { id: 'fraude_comprovante', rotulo: 'Fraude: comprovante falso repetido' },
  { id: 'conta_de_outra_pessoa', rotulo: 'Conta usada por outra pessoa' },
  { id: 'ordem_autoridade', rotulo: 'Ordem de autoridade (guarda, medida protetiva)' },
  { id: 'conteudo_ofensivo', rotulo: 'Conteúdo ofensivo em recado ou comentário' },
];

const PAPEL = { MOTORISTA: 'motorista', FAMILIA: 'familia' };

/** O papel do alvo pelo `role` do documento. Outro papel não é alvo. */
function papelDoAlvo(role) {
  if (role === 'admin') return PAPEL.MOTORISTA;
  if (role === 'parent') return PAPEL.FAMILIA;
  return null;
}

const MOTIVOS_DE_REATIVAR = [
  { id: 'resposta_aceita', rotulo: 'A resposta foi aceita' },
  { id: 'prazo_cumprido', rotulo: 'O prazo da suspensão acabou' },
  { id: 'regularizou', rotulo: 'Regularizou' },
  { id: 'engano', rotulo: 'Foi engano' },
];

const GRAU = { AVISO: 'aviso', SUSPENSAO: 'suspensao', ENCERRAMENTO: 'encerramento' };

const DIAS_PARA_RESPONDER = 10;
const DIAS_MAXIMOS_DE_SUSPENSAO = 365;
const LIMITE_DA_MENSAGEM = 1000;
const LIMITE_DA_EVIDENCIA = 500;
const FUSO = 'America/Sao_Paulo';
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * A CLÁUSULA QUE PERMITE SUSPENDER (05/10/2026): a 11b dos Termos de Uso,
 * escrita pela revisão jurídica ("Suspensão e bloqueio"). Era um marcador até
 * a seção existir, e a régua recusava mandar com ele dentro.
 */
const CLAUSULA_DOS_TERMOS = 'cláusula 11b dos Termos de Uso';

const FORMATO_DO_ID = /^[A-Za-z0-9_-]{1,128}$/;
const FORMATO_DO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function diaDeBrasilia(agora) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

function somarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  return new Date(d.getTime() + n * DIA_MS).toISOString().slice(0, 10);
}

function dataPorExtenso(dia) {
  const [a, m, d] = String(dia).split('-');
  return `${d}/${m}/${a}`;
}

function rotuloDoMotivo(id) {
  const m = [...MOTIVOS_DE_BLOQUEIO, ...MOTIVOS_DA_FAMILIA, ...MOTIVOS_DE_REATIVAR].find((x) => x.id === id);
  return m ? m.rotulo : null;
}

/** Os motivos que a folha oferece agora. */
function motivosPara(acao, { cobrancaLigada = false, papel = PAPEL.MOTORISTA } = {}) {
  if (acao === ACAO.REATIVAR) return MOTIVOS_DE_REATIVAR;
  if (papel === PAPEL.FAMILIA) return MOTIVOS_DA_FAMILIA;
  return MOTIVOS_DE_BLOQUEIO.filter((m) => !m.soComCobranca || cobrancaLigada);
}

/**
 * Valida o pedido do painel. Devolve `{ ok: true, pedido }` com os campos
 * normalizados, ou `{ ok: false, erro }` com uma frase para a tela.
 *
 * `alvo` é o documento `users` do alvo (`role`), `donoUid` quem chamou.
 */
function validarPedido(dados, { agora = new Date(), cobrancaLigada = false, alvo = null, donoUid = null } = {}) {
  const d = dados || {};
  const acao = d.acao;
  if (!ACOES_DO_PAINEL.includes(acao)) return { ok: false, erro: 'Ação desconhecida.' };

  if (typeof d.alvoUid !== 'string' || !FORMATO_DO_ID.test(d.alvoUid)) {
    return { ok: false, erro: 'Conta inválida.' };
  }
  if (donoUid && d.alvoUid === donoUid) return { ok: false, erro: 'Você não pode fazer isto com a sua própria conta.' };
  const papel = d.alvoPapel === PAPEL.FAMILIA ? PAPEL.FAMILIA : PAPEL.MOTORISTA;
  if (alvo) {
    if (alvo.role === 'owner') return { ok: false, erro: 'Um dono não suspende outro dono pelo painel.' };
    const doAlvo = papelDoAlvo(alvo.role);
    if (!doAlvo) return { ok: false, erro: 'Só conta de motorista ou de família.' };
    if (doAlvo !== papel) return { ok: false, erro: 'Esta conta não é do papel escolhido.' };
  }

  // ⚠️ COM A COBRANÇA DESLIGADA NÃO EXISTE ATRASO com a plataforma
  // (cláusula 5): a frase diz isso, em vez do genérico "escolha da lista".
  if (d.motivo === 'atraso' && acao !== ACAO.REATIVAR && papel === PAPEL.MOTORISTA && !cobrancaLigada) {
    return { ok: false, erro: 'Com a cobrança desligada, não existe atraso.' };
  }
  const motivos = motivosPara(acao, { cobrancaLigada, papel });
  if (!motivos.some((m) => m.id === d.motivo)) return { ok: false, erro: 'Escolha um motivo da lista.' };

  const hoje = diaDeBrasilia(agora);
  let grau = null;
  let ate = null;
  if (acao === ACAO.AVISO) grau = GRAU.AVISO;
  if (acao === ACAO.SUSPENDER) {
    grau = d.grau === GRAU.ENCERRAMENTO ? GRAU.ENCERRAMENTO : d.grau === GRAU.SUSPENSAO ? GRAU.SUSPENSAO : null;
    if (!grau) return { ok: false, erro: 'Escolha entre suspender até uma data ou encerrar.' };
    if (grau === GRAU.SUSPENSAO && d.ate != null && d.ate !== '') {
      if (typeof d.ate !== 'string' || !FORMATO_DO_DIA.test(d.ate)) return { ok: false, erro: 'Data inválida.' };
      if (d.ate <= hoje) return { ok: false, erro: 'A data precisa ser depois de hoje.' };
      if (d.ate > somarDias(hoje, DIAS_MAXIMOS_DE_SUSPENSAO)) {
        return { ok: false, erro: `A suspensão vai até ${DIAS_MAXIMOS_DE_SUSPENSAO} dias.` };
      }
      ate = d.ate;
    }
  }

  const mensagem = typeof d.mensagem === 'string' ? d.mensagem.trim() : '';
  if (acao !== ACAO.REATIVAR && !mensagem) return { ok: false, erro: 'Escreva a mensagem para a pessoa.' };
  if (mensagem.length > LIMITE_DA_MENSAGEM) return { ok: false, erro: `A mensagem vai até ${LIMITE_DA_MENSAGEM} letras.` };

  const evidencia = typeof d.evidencia === 'string' ? d.evidencia.trim() : '';
  if (evidencia.length > LIMITE_DA_EVIDENCIA) return { ok: false, erro: `A evidência vai até ${LIMITE_DA_EVIDENCIA} letras.` };

  return {
    ok: true,
    pedido: {
      acao,
      alvoUid: d.alvoUid,
      alvoPapel: papel,
      motivo: d.motivo,
      grau,
      ate,
      urgente: acao === ACAO.SUSPENDER && d.urgente === true,
      mensagem,
      evidencia: evidencia || null,
      respostaAte: acao === ACAO.REATIVAR ? null : somarDias(hoje, DIAS_PARA_RESPONDER),
    },
  };
}

/** O texto que a folha já traz escrito, para o dono editar. */
function mensagemPadrao({ acao, grau = null, ate = null, agora = new Date(), papel = PAPEL.MOTORISTA } = {}) {
  const prazo = dataPorExtenso(somarDias(diaDeBrasilia(agora), DIAS_PARA_RESPONDER));
  if (acao === ACAO.REATIVAR) return 'Sua conta foi reativada. Tudo volta a funcionar como antes.';
  if (acao === ACAO.AVISO) {
    return `Recebemos uma situação na sua conta que vai contra a ${CLAUSULA_DOS_TERMOS}. Por enquanto é só um aviso: nada foi travado. Se quiser explicar, responda até ${prazo} por contato@alobuzinou.com.`;
  }
  const quanto =
    grau === GRAU.ENCERRAMENTO
      ? 'Sua conta foi encerrada'
      : ate
        ? `Sua conta foi suspensa até ${dataPorExtenso(ate)}`
        : 'Sua conta foi suspensa';
  if (papel === PAPEL.FAMILIA) {
    return `${quanto}, com base na ${CLAUSULA_DOS_TERMOS}. O transporte do seu filho continua: combine com o motorista por telefone o que for preciso. Você pode responder até ${prazo} por contato@alobuzinou.com, e uma pessoa vai ler.`;
  }
  return `${quanto}, com base na ${CLAUSULA_DOS_TERMOS}. As famílias continuam vendo os próprios dados. Você pode responder até ${prazo} por contato@alobuzinou.com, e uma pessoa vai ler.`;
}

/** O que muda em `users` do alvo. `null` no aviso: nada é travado. */
function efeitoNaConta(pedido) {
  if (!pedido) return null;
  // A FAMÍLIA tem `bloqueio` (grau e prazo, SEM motivo), e não `suspenso`, que
  // é a tranca do motorista nas rules (`isAdmin()`).
  if (pedido.alvoPapel === PAPEL.FAMILIA) {
    if (pedido.acao === ACAO.SUSPENDER) return { bloqueio: { grau: pedido.grau, ate: pedido.ate } };
    if (pedido.acao === ACAO.REATIVAR) return { bloqueio: null };
    return null;
  }
  if (pedido.acao === ACAO.SUSPENDER) return { suspenso: true };
  if (pedido.acao === ACAO.REATIVAR) return { suspenso: false };
  return null;
}

/**
 * O aviso ao alvo: leva a MENSAGEM e o prazo de resposta, NUNCA o motivo da
 * lista nem a evidência. Espécie 'estado', não desligável.
 */
function avisoAoAlvo(pedido) {
  if (!pedido) return null;
  const tipo =
    pedido.acao === ACAO.SUSPENDER
      ? 'conta_suspensa'
      : pedido.acao === ACAO.REATIVAR
        ? 'conta_reativada'
        : 'aviso_da_plataforma';
  const titulo =
    pedido.acao === ACAO.SUSPENDER
      ? pedido.grau === GRAU.ENCERRAMENTO
        ? 'Sua conta foi encerrada'
        : 'Sua conta foi suspensa'
      : pedido.acao === ACAO.REATIVAR
        ? 'Sua conta foi reativada'
        : 'Um aviso da plataforma';
  return {
    type: tipo,
    title: titulo,
    body: pedido.mensagem || mensagemPadrao({ acao: pedido.acao }),
    respostaAte: pedido.respostaAte,
  };
}

/** A linha do registro, sem os carimbos de hora (quem grava os põe). */
function linhaDoRegistro(pedido, { donoUid, donoNome = null, alvo = {} } = {}) {
  return {
    acao: pedido.acao,
    donoUid,
    donoNome: donoNome || null,
    alvoUid: pedido.alvoUid,
    alvoPapel: pedido.alvoPapel || PAPEL.MOTORISTA,
    alvoNome: alvo.marcaNome || alvo.name || null,
    motivo: pedido.motivo,
    motivoRotulo: rotuloDoMotivo(pedido.motivo),
    grau: pedido.grau,
    ate: pedido.ate,
    urgente: pedido.urgente,
    mensagem: pedido.mensagem || null,
    evidencia: pedido.evidencia,
    respostaAte: pedido.respostaAte,
  };
}

/**
 * O bloqueio da família está valendo? Encerramento vale sempre; suspensão vale
 * até o dia `ate` INCLUSIVE (sem `ate`, até alguém reativar).
 */
function bloqueioVigente(bloqueio, agora = new Date()) {
  if (!bloqueio || typeof bloqueio !== 'object') return false;
  if (bloqueio.grau === GRAU.ENCERRAMENTO) return true;
  if (bloqueio.grau !== GRAU.SUSPENSAO) return false;
  if (!bloqueio.ate) return true;
  return String(bloqueio.ate) >= diaDeBrasilia(agora);
}

/**
 * A suspensão já passou do prazo e a agendada deve reabrir a conta?
 * ⚠️ ENCERRAMENTO NUNCA SE REATIVA SOZINHO, nem suspensão sem data.
 */
function bloqueioVencido(bloqueio, agora = new Date()) {
  if (!bloqueio || bloqueio.grau !== GRAU.SUSPENSAO || !bloqueio.ate) return false;
  return String(bloqueio.ate) < diaDeBrasilia(agora);
}

/**
 * QUEM AVISAR: cada tio de cada criança ativa da família, UMA vez por tio,
 * com o primeiro nome das crianças dele (dois irmãos no mesmo tio = um aviso).
 */
function tiosParaAvisar(criancas = []) {
  const porTio = new Map();
  (Array.isArray(criancas) ? criancas : []).forEach((c) => {
    if (!c || c.active === false || !c.adminUid) return;
    const nome = String(c.name || '').trim().split(/\s+/)[0] || 'a criança';
    const lista = porTio.get(c.adminUid) || [];
    if (!lista.includes(nome)) lista.push(nome);
    porTio.set(c.adminUid, lista);
  });
  return [...porTio.entries()].map(([tioUid, nomes]) => ({ tioUid, nomes }));
}

function juntarNomes(nomes) {
  if (nomes.length <= 1) return nomes[0] || 'a criança';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/** O aviso ao tio quando a família fica sem os avisos, e quando volta. */
function avisoAoTio({ acao, nomes = [] } = {}) {
  const quem = juntarNomes(nomes);
  if (acao === ACAO.REATIVAR) {
    return {
      type: 'familia_com_avisos',
      title: `A família de ${quem} voltou a receber os avisos`,
      body: 'Os avisos do app voltaram a chegar no celular dela.',
    };
  }
  return {
    type: 'familia_sem_avisos',
    title: `A família de ${quem} está sem os avisos do app`,
    body: 'Combine por telefone o que for preciso.',
  };
}

export {
  ACAO,
  ACOES_DO_PAINEL,
  MOTIVOS_DE_BLOQUEIO,
  MOTIVOS_DE_REATIVAR,
  MOTIVOS_DA_FAMILIA,
  PAPEL,
  papelDoAlvo,
  bloqueioVigente,
  bloqueioVencido,
  tiosParaAvisar,
  avisoAoTio,
  GRAU,
  DIAS_PARA_RESPONDER,
  DIAS_MAXIMOS_DE_SUSPENSAO,
  LIMITE_DA_MENSAGEM,
  LIMITE_DA_EVIDENCIA,
  CLAUSULA_DOS_TERMOS,
  motivosPara,
  rotuloDoMotivo,
  validarPedido,
  mensagemPadrao,
  efeitoNaConta,
  avisoAoAlvo,
  linhaDoRegistro,
};
