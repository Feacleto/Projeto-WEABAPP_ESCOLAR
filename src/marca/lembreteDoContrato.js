/**
 * "LEMBRAR A FAMÍLIA NO WHATSAPP" — o lembrete do contrato que espera a
 * assinatura dela (04/10/2026, item 18 da revisão do Financeiro).
 *
 * Na tela "Turma e contratos" o selo dizia "Aguardando a família" e a única
 * ação da linha era "Mudar" — ou seja, o que estava parado era a família, e o
 * botão oferecido mexia no combinado. O que ele precisa ali é cutucar a mãe.
 *
 * ⚠️ PARA A FAMÍLIA NÃO EXISTE "MUDANÇA" (decisão do dono, 03/10/2026): seja o
 * primeiro contrato ou um aditivo, ela recebe um contrato e assina. Por isso
 * a frase é uma só, e nunca diz "aditivo", "versão" ou "o que muda".
 *
 * Quem ainda não entrou no app não tem onde assinar: aí a mensagem leva o
 * LINK DO CONVITE, que é a única porta da família (o código saiu de toda tela
 * em 02/10/2026). Sem link e sem conta, não há o que lembrar — devolve null e
 * a tela não oferece o botão.
 *
 * Puro de propósito: `npm run testar:turma` mede a frase e o link.
 */

/** O primeiro nome, para a mensagem não soar como cobrança de cartório. */
function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

/**
 * A frase. `linkDoConvite` só vem quando a família ainda não entrou no app.
 */
export function mensagemDoLembreteDoContrato({
  responsavel = '',
  crianca = '',
  assinatura = '',
  linkDoConvite = null,
} = {}) {
  const oi = primeiroNome(responsavel) ? `Oi, ${primeiroNome(responsavel)}!` : 'Oi!';
  const deQuem = primeiroNome(crianca) ? ` de ${primeiroNome(crianca)}` : '';
  const corpo = linkDoConvite
    ? `O contrato do transporte${deQuem} está esperando a sua assinatura. É só entrar no app por este link e assinar: ${linkDoConvite}`
    : `O contrato do transporte${deQuem} está esperando a sua assinatura no app Alô Buzinou. É só abrir o app e assinar.`;
  const fim = String(assinatura || '').trim() ? `Obrigado! ${String(assinatura).trim()}` : 'Obrigado!';
  return `${oi} ${corpo} ${fim}`;
}

/**
 * O link do WhatsApp com a frase pronta, ou null quando não há para quem
 * mandar (telefone sem DDD + número) ou o que lembrar (nem conta nem convite).
 */
export function linkDoLembreteDoContrato({
  telefone,
  responsavel,
  crianca,
  assinatura,
  linkDoConvite = null,
  familiaEntrou = false,
} = {}) {
  let digitos = String(telefone || '').replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  if (!familiaEntrou && !linkDoConvite) return null;
  const texto = mensagemDoLembreteDoContrato({
    responsavel,
    crianca,
    assinatura,
    linkDoConvite: familiaEntrou ? null : linkDoConvite,
  });
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`;
}
