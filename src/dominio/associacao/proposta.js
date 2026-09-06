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
 * tem caminho próprio: motivo, prazo e registro (ver a Fase 12 do
 * `plano-console.md`).
 *
 * ── O TEXTO É EDITÁVEL ANTES DE SAIR
 * A tela abre o WhatsApp com isto preenchido e o dono lê antes de enviar.
 * Nada sai sem alguém ver — é o que separa "proposta" de "disparo".
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA além da régua de preço, e é o que o mantém
 * testável sem Firebase (`npm run testar:proposta`).
 */

import { ACIMA_DA_TABELA, ANTECIPACAO, planoPara } from './planos.js';

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
  const sugerido = planoPara(ativas);
  const pctAntecipacao = Math.round(ANTECIPACAO.fracao * 100);

  // ACIMA DA TABELA NÃO RECEBE PREÇO NENHUM na mensagem. Escrever um número
  // ali seria cobrar menos do que a conversa produziria — e `precoDoMes` já
  // devolve `motivo: 'conversa'` justamente para isso.
  const acimaDaTabela = ativas > 0 && !sugerido;
  const precoCheio = sugerido ? reais(sugerido.preco) : null;
  const precoDele = conta && conta.motivo !== ACIMA_DA_TABELA ? reais(conta.liquido) : null;

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

    if (acimaDaTabela) {
      return {
        assunto: 'Falar sobre o plano',
        texto:
          `Oi ${nome}! ${prazo}.\n\n` +
          `Com ${plural(ativas, 'criança', 'crianças')}, sua operação passou da ` +
          `tabela — nesse tamanho o valor a gente conversa. Me chama que eu te ` +
          `passo os números.`,
      };
    }

    return {
      assunto: 'Propor contratação',
      texto:
        `Oi ${nome}! ${prazo}.\n\n` +
        `Com ${plural(ativas, 'criança', 'crianças')} você fica na faixa de ` +
        `${precoCheio} por mês` +
        (precoDele && precoDele !== precoCheio ? ` — ${precoDele} com os seus descontos` : '') +
        `.\n\n` +
        `Contratando ANTES do fim do teste, você fica com ${pctAntecipacao}% de ` +
        `desconto pelos ${ANTECIPACAO.meses} meses de contrato. É só abrir ` +
        `Planos no app.`,
    };
  }

  if (degrau === 'bloqueado') {
    // RESGATE. Ele perdeu o prazo — a antecipação já expirou. O texto NÃO
    // promete o desconto: quem concede é o dono, com motivo e prazo, na folha
    // de concessão. Prometer aqui e não conceder depois é pior que não falar.
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
