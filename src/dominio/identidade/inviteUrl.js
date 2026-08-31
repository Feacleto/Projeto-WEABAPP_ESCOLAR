/**
 * URL absoluta do convite. O responsável abre este link e a conta dele se
 * cria na hora — sem digitar o código num teclado de celular.
 *
 * Vive em utils (e não junto do componente de compartilhamento) porque é
 * usado tanto pra montar o link quanto pra montar a mensagem do WhatsApp.
 */
export function inviteUrl(code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/convite/${code}`;
}
