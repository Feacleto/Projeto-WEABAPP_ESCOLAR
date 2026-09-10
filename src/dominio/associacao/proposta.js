/**
 * A PROPOSTA — a mensagem que o dono manda, escrita pelo degrau em que o
 * motorista está.
 *
 * ── POR QUE ISTO É REGRA E NÃO TEXTO NA TELA
 * São quatro mensagens diferentes, e escolher a errada é pior que não mandar:
 * oferecer desconto de conversão a quem nem cadastrou a turma ainda soa como
 * cobrança antes da entrega; mandar "precisa de ajuda pra começar?" a quem roda
 * há dois meses soa como quem não olhou nada antes de escrever.
 *
 * O degrau já é calculado em `carteira.js`. Aqui só entra o que dizer em cada
 * um — e os números dele dentro, porque mensagem genérica não move ninguém.
 *
 * ── ELA NÃO INVENTA PREÇO, E ISSO É O PONTO
 * Todo número que aparece no texto sai da régua: a faixa que o tamanho dele
 * pede, o preço de tabela, o desconto que ele JÁ tem. A proposta é um
 * lembrete, não uma negociação.
 *
 * Se um dia ela passar a oferecer um valor que não está na régua, o orçamento
 * voltou — com outro nome, e sem contrato que registre. A concessão existe e
 * tem caminho próprio: motivo, prazo e registro (ver
 * `dominio/associacao/concessao.js`).
 *
 * ── O TEXTO É EDITÁVEL ANTES DE SAIR
 * A tela abre o WhatsApp com isto preenchido e o dono lê antes de enviar.
 * Nada sai sem alguém ver — é o que separa "proposta" de "disparo".
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA além da régua de preço, e é o que o mantém
 * testável sem Firebase (`npm run testar:proposta`).
 */

import { PLANO, descontoDoFechamento, precoDaTabela } from './planos.js';
import { DIAS_DE_TRIAL, DIAS_POR_DEGRAU } from './trial.js';

/** Só o primeiro nome — a mensagem é de pessoa para pessoa. */
function primeiroNome(nome) {
  const n = String(nome || '').trim().split(/\s+/)[0];
  return n || 'tudo bem';
}

/** R$ 149,00 — o mesmo formato que o app usa em todo lugar. */
function reais(v) {
  if (v === null || v === undefined) return null;
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

function plural(n, um, muitos) {
  return `${n} ${n === 1 ? um : muitos}`;
}

/**
 * A mensagem do momento dele.
 *
 * Devolve `{ assunto, texto }` — o assunto é o rótulo do botão na tela, o
 * texto é o que vai para o WhatsApp.
 *
 * `conta` é o resultado de `precoDoMes()` e pode vir `null` (ele ainda não tem
 * faixa). Nesse caso o texto usa a faixa que o TAMANHO dele pede, que é o que
 * ele quer saber antes de escolher.
 */
export function mensagemDeProposta({
  motorista,
  degrau,
  conta = null,
  diasRestantes = null,
} = {}) {
  const nome = primeiroNome(motorista?.name);
  const ativas = Math.max(0, Number(motorista?.criancasAtivas) || 0);
  // O PREÇO DE TABELA DELE, nos dois planos. Com preço linear não existe mais
  // "faixa sugerida" nem "acima da tabela": toda operação tem preço, de três a
  // trezentas crianças, e a proposta pode sempre dizer um número.
  const cheioMensal = precoDaTabela({ criancas: ativas, plano: PLANO.MENSAL });
  const cheioAnual = precoDaTabela({ criancas: ativas, plano: PLANO.ANUAL });
  // ⚠️ A PROPOSTA LÊ O DEGRAU E ESCREVE O NÚMERO DAQUELE DEGRAU.
  //
  // Ela nunca inventa preço, e aqui isso passou a valer para o DESCONTO
  // também: a escada de fechamento é 30/20/10 pelo mês da decisão, então uma
  // mensagem que diz sempre "30%" oferece, a quem está no terceiro mês, uma
  // condição que o servidor não vai gravar. O dono leria a mensagem, mandaria,
  // e o motorista veria outro número na fatura.
  //
  // O degrau sai de `diasRestantes`, que já chega aqui — este arquivo não tem
  // relógio, de propósito (`npm run testar:proposta` injeta o dia).
  const degrauDeFechamento =
    diasRestantes == null
      ? 1
      : diasRestantes > 0
        ? Math.min(
            DIAS_DE_TRIAL / DIAS_POR_DEGRAU,
            // O piso de zero é o mesmo de `degrauDaDecisao`, e pelo mesmo
            // motivo: relógio adiantado produz "mais de 90 dias restantes", e
            // `floor(-1 / 30) + 1` daria degrau ZERO — a proposta ofereceria 0%
            // a quem tem direito a 50%.
            Math.max(0, Math.floor((DIAS_DE_TRIAL - diasRestantes) / DIAS_POR_DEGRAU)) + 1
          )
        : null;
  const pctFechamento = Math.round(descontoDoFechamento(degrauDeFechamento) * 100);

  // ⚠️ "ACIMA DA TABELA" DEIXOU DE EXISTIR em 10/09/2026, e com ele some o
  // único caso em que a proposta ficava sem número. O preço é linear: a
  // operação de 60 crianças tem preço tanto quanto a de 6, e mandar uma
  // mensagem sem valor para o grande era mandá-lo perguntar.
  //
  // O que continua valendo é a regra: ela nunca INVENTA preço. Todo número
  // abaixo sai de `precoDaTabela` ou de `conta`, que é `precoDoMes`.
  const precoCheio = cheioMensal == null ? null : reais(cheioMensal);
  const precoAnual = cheioAnual == null ? null : reais(cheioAnual);
  const precoDele = conta && conta.liquido != null ? reais(conta.liquido) : null;

  if (degrau === 'nao_comecou') {
    // ATIVAÇÃO. Ele criou a conta e não rodou — o relógio do teste nem começou,
    // então falar de preço aqui é falar de uma coisa que ainda não existe para
    // ele. O que trava alguém nesse ponto é sempre o cadastro da turma.
    return {
      assunto: 'Ajudar a começar',
      texto:
        `Oi ${nome}! Vi que você criou sua conta no Alô Buzinou e ainda não ` +
        `começou a usar.\n\n` +
        `Precisa de ajuda pra cadastrar a turma? Depois que as crianças estão ` +
        `lá, é só iniciar a rota e as famílias já acompanham a perua pelo ` +
        `celular.\n\n` +
        `Seus 3 meses de teste só começam a contar na sua primeira rota — ` +
        `então não tem pressa nem relógio correndo.`,
    };
  }

  if (degrau === 'em_teste') {
    // CONVERSÃO. Aqui o preço é bem-vindo: ele está usando e o prazo aperta.
    const prazo =
      diasRestantes === null
        ? 'Seu teste está acabando'
        : `Seu teste termina em ${plural(diasRestantes, 'dia', 'dias')}`;

    // ⚠️ OS DOIS PLANOS VÃO NA MESMA MENSAGEM, e isso não é enfeite: se o dono
    // manda só o mensal, o motorista que quer economizar acha que o preço da
    // plataforma é o mais alto dos dois. A comparação é a oferta.
    //
    // ⚠️ "ACIMA DA TABELA" DEIXOU DE EXISTIR, e com ele o ramo em que a
    // proposta ficava sem número. Preço linear tem valor em qualquer tamanho, e
    // mandar uma mensagem sem valor para o maior associado era mandá-lo
    // perguntar.
    return {
      assunto: 'Propor contratação',
      texto:
        `Oi ${nome}! ${prazo}.

` +
        `Com ${plural(ativas, 'criança', 'crianças')}, sua associação fica em ` +
        `${precoCheio} por mês no plano mensal` +
        (precoDele && precoDele !== precoCheio ? ` (${precoDele} com os seus descontos)` : '') +
        `, ou ${precoAnual} por mês no anual, com compromisso de 12 meses.

` +
        `Quanto antes você contratar, menor fica a mensalidade — e o desconto ` +
        `não tem prazo para acabar. Contratando o mensal antes do fim do teste, ` +
        `você garante ${pctFechamento}%.

` +
        `É só abrir Planos no app.`,
    };
  }

  if (degrau === 'bloqueado') {
    // RESGATE. Ele perdeu o prazo da ESCADA — mas não perdeu tudo.
    //
    // ⚠️ ESTE COMENTÁRIO DIZIA "a antecipação já expirou", E ISSO MANDAVA O
    // DONO PELO CAMINHO ERRADO. A régua tem um degrau de RETORNO: quem volta
    // dentro de 30 dias depois do dia 90 leva 10%, e quem decide isso é
    // `functions/lib/contratacao.js` pelo relógio do servidor, sozinho —
    // automático, sem ninguém conceder nada.
    //
    // Quem lesse a versão anterior concluiria que o resgate exige exceção, e
    // abriria uma concessão (com motivo, prazo e registro) para dar um
    // desconto que a régua já dá.
    //
    // O texto continua NÃO prometendo número, e isso segue certo: se ele
    // voltar depois dos 30 dias, não há degrau nenhum, e prometer aqui para
    // não conceder depois é pior que não falar. O que o dono precisa saber é
    // que talvez não haja nada a conceder.
    return {
      assunto: 'Chamar de volta',
      texto:
        `Oi ${nome}! Sua conta no Alô Buzinou está pausada porque o período de ` +
        `teste terminou.\n\n` +
        `Nada foi perdido: suas ${plural(ativas, 'criança', 'crianças')}, os ` +
        `pagamentos e o histórico continuam lá, e voltam no instante em que ` +
        `você escolher um plano.\n\n` +
        `Quer que eu veja uma condição pra você voltar?`,
    };
  }

  // ATIVO — indicação. É o único momento em que pedir alguma coisa a ele não
  // soa como cobrança: ele está pagando, usando, e o pedido é um elogio.
  return {
    assunto: 'Pedir indicação',
    texto:
      `Oi ${nome}! Tudo certo com o Alô Buzinou por aí?\n\n` +
      `Se você conhece outro motorista escolar que se daria bem com o app, me ` +
      `passa o contato. Cada indicação que vira associado te dá desconto na ` +
      `sua própria mensalidade, todo mês, enquanto ele estiver ativo.`,
  };
}

/**
 * O link de WhatsApp com a mensagem pronta.
 *
 * O telefone vai só com dígitos e com o DDI do Brasil quando ele não veio —
 * o app guarda o telefone como a pessoa digitou, e `wa.me` sem DDI abre uma
 * conversa vazia sem dizer por quê.
 *
 * Devolve `null` sem telefone: quem chama esconde o botão em vez de oferecer
 * um link que não abre nada.
 */
export function linkDaProposta(telefone, texto) {
  const digitos = String(telefone || '').replace(/[^0-9]/g, '');
  if (digitos.length < 10) return null;
  const comDDI = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(texto)}`;
}
