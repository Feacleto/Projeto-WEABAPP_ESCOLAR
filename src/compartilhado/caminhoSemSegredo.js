/**
 * O ENDEREÇO QUE PODE SAIR DO APARELHO — sem o segredo que algumas rotas
 * carregam dentro dele (03/10/2026).
 *
 * ── POR QUE ISTO EXISTE
 * O Google Analytics grava a URL de cada tela (`page_location`). Três rotas
 * deste app têm a CHAVE na própria URL:
 *
 *   /convite/TNAB23CD        o código que cria a conta da família
 *   /acompanhar/AAAA…SEGREDO o link de quem busca a criança hoje
 *   /substituta/s_…SEGREDO   o link de um dia da substituta da auxiliar
 *   /auth-action?oobCode=…   o link de redefinir a senha
 *
 * Com o padrão do SDK, cada um desses ia parar num relatório de terceiro,
 * legível por quem tem acesso ao painel do Analytics — e o segredo do
 * acompanhamento abre o dia de uma criança. O registro de tela passou a ser
 * MANUAL (`send_page_view: false`) e o endereço passa por aqui antes.
 *
 * ── AS TRÊS REGRAS
 * 1. Query e âncora SEMPRE saem — é onde mora o `oobCode`, e nenhuma tela
 *    precisa delas para ser contada.
 * 2. As rotas com segredo viram o MOLDE (`/convite/:codigo`).
 * 3. Qualquer trecho com cara de identificador (o id do Firestore de uma
 *    criança, em `/tio/children/:id`) vira `:id`. Não é segredo, mas é uma
 *    pessoa — e a pergunta que o relatório responde é "que tela", nunca
 *    "de quem".
 *
 * Puro, sem React e sem Firebase: `npm run testar:busca` o mede.
 */

/** Rotas cujo trecho seguinte é um segredo. */
const COM_SEGREDO = {
  convite: ':codigo',
  acompanhar: ':token',
  substituta: ':token',
};

// Id do Firestore tem 20 caracteres; o segredo do acompanhamento é maior; o
// código do convite tem 8. Um trecho de 16+ com dígito no meio não é nome
// de tela em lugar nenhum deste app.
const PARECE_ID = /^(?=.*\d)[A-Za-z0-9_.-]{16,}$/;

export function caminhoSemSegredo(entrada) {
  let caminho = String(entrada || '/');
  // Aceita a URL inteira também: só o caminho interessa.
  const m = caminho.match(/^[a-z]+:\/\/[^/]*(\/.*)?$/i);
  if (m) caminho = m[1] || '/';
  caminho = caminho.split(/[?#]/)[0] || '/';
  if (!caminho.startsWith('/')) caminho = `/${caminho}`;

  const partes = caminho.split('/');
  for (let i = 1; i < partes.length; i += 1) {
    const anterior = partes[i - 1];
    if (COM_SEGREDO[anterior] && partes[i]) {
      partes[i] = COM_SEGREDO[anterior];
    } else if (PARECE_ID.test(partes[i])) {
      partes[i] = ':id';
    }
  }
  return partes.join('/') || '/';
}
