/**
 * DO CAMPO PARA O PRÓXIMO (03/10/2026, pedido do dono).
 *
 * Cada campo tem um "Salvar" ao lado (e o Enter do teclado faz o mesmo): o
 * toque leva ao PRÓXIMO campo da tela, e no último aciona o avanço da tela.
 * Quem tem quarenta anos preenche um campo por vez e espera um sinal de que
 * aquele está pronto; sem isso, ficava procurando onde tocar depois de
 * digitar, com o teclado cobrindo metade da tela.
 *
 * O "avanço da tela" é, nesta ordem:
 *   1. o botão marcado com `data-avancar` (o "Avançar" de um passo a passo
 *      que não é <form>, como o cadastro da criança);
 *   2. o envio do <form> em volta do campo;
 *   3. nada disso: só fecha o teclado.
 *
 * Só DOM, sem React e sem regra: mora em `compartilhado/`.
 */

const CAMPOS =
  'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([disabled]):not([readonly]),' +
  'textarea:not([disabled]):not([readonly]),select:not([disabled])';

function visivel(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

export function avancarDoCampo(campo) {
  if (!campo || typeof document === 'undefined') return;
  const area = campo.closest('[data-formulario], form, [role="dialog"]') || document.body;
  const campos = Array.from(area.querySelectorAll(CAMPOS)).filter(visivel);
  const proximo = campos[campos.indexOf(campo) + 1];
  if (proximo) {
    proximo.focus();
    proximo.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    return;
  }
  const botao =
    area.querySelector('[data-avancar]:not([disabled])') ||
    document.querySelector('[data-avancar]:not([disabled])');
  if (botao) {
    campo.blur();
    botao.click();
    return;
  }
  const form = campo.form || campo.closest('form');
  if (form?.requestSubmit) {
    form.requestSubmit();
    return;
  }
  campo.blur();
}
