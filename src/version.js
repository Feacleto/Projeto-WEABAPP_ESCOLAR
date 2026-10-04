import { textoParaSuporte } from './compartilhado/versaoDoApp.js';

/**
 * Versão do app — mostrada no perfil, na tela de atualização e mandada no
 * chamado de suporte. O usuário lê o número quando reporta problema, e a
 * gente sabe qual build ele tem.
 *
 * ⚠️ ELA SAI DO BUILD, não da mão (04/10/2026): a marca de publicação do git
 * (`v1.12` → "1.12"), lida no `vite.config.js`. Build que não é publicação
 * diz "1.13-prévia". Era '1.0' fixo, "atualizar manualmente", e nunca foi
 * atualizado. Regras em `compartilhado/versaoDoApp.js`.
 * Fora do Vite (os testes em Node) não há build: 'dev'.
 */
const env = import.meta.env || {};

export const APP_VERSION = env.VITE_VERSAO_DO_APP || 'dev';

/** O número do commit publicado (a contagem do histórico) e o hash curto. */
export const COMMIT_DO_APP = env.VITE_COMMIT_DO_APP || null;
export const HASH_DO_APP = env.VITE_HASH_DO_APP || null;

/** Quando este build foi feito (ISO), ou null fora do Vite. */
export const DATA_DO_BUILD = env.VITE_DATA_DO_BUILD || null;

/** "1.12 · commit 391 (abc1234)" — o que o suporte precisa ler. */
export const VERSAO_PARA_SUPORTE = textoParaSuporte({
  versao: APP_VERSION,
  commit: COMMIT_DO_APP,
  hash: HASH_DO_APP,
});
