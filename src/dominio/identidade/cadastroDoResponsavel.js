/**
 * O PRIMEIRO ACESSO DO RESPONSÁVEL — o que o card ainda precisa perguntar.
 *
 * Mesmo desenho do motorista (`cadastroDoMotorista.js`), pedido pelo dono em
 * 02/10/2026: o app abre por baixo e um card curto pergunta só o que falta,
 * em até quatro passos.
 *
 *   casa    o NÚMERO da casa, quando o motorista cadastrou pela rua com
 *           "não sei o número agora" (`numeroPendente`). Ela confirma a rua
 *           e digita o número — quem sabe é quem mora lá
 *   voce    nome e WhatsApp — quase sempre já vêm do cadastro que o
 *           motorista fez, e aí o passo nem aparece
 *   filho   o aniversário da criança (obrigatório), turma e sala
 *           (opcionais). O aniversário saiu do cadastro do motorista no
 *           mesmo dia: quem sabe a data é a família
 *   avisos  a permissão de notificação, para ela saber que a perua está
 *           chegando
 *
 * ── ⚠️ O PASSO DOS AVISOS NUNCA PRENDE
 * Ele só aparece enquanto o navegador ainda não perguntou (`default`) E ela
 * nunca passou por ele (`avisosPerguntadosEm`). Negado, sem suporte (o
 * Safari do iPhone fora da tela de início não tem notificação) ou já
 * respondido, ele some. Um navegador que não pergunta duas vezes não pode
 * virar uma tela que não sai.
 */

function vazio(v) {
  return !String(v || '').trim();
}

/**
 * Os passos que faltam, na ordem. Lista vazia para quem não é responsável
 * e enquanto perfil ou criança ainda carregam.
 *
 *   permissao — 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function passosDoResponsavel({ profile, child, permissao }) {
  if (!profile || profile.role !== 'parent') return [];
  const passos = [];
  if (vazio(profile.name) || vazio(profile.phone)) passos.push('voce');
  if (child && child.numeroPendente === true) passos.push('casa');
  if (child && vazio(child.birthDate)) passos.push('filho');
  if (permissao === 'default' && !profile.avisosPerguntadosEm) passos.push('avisos');
  return passos;
}

/** Os campos do passo `voce` que ainda estão vazios. */
export function camposDoResponsavelQueFaltam(profile) {
  return ['name', 'phone'].filter((c) => vazio(profile?.[c]));
}
