import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { CLOUD_FUNCTIONS_ENABLED } from '../config/capabilities';

/**
 * O CUPOM DA INDICAÇÃO DO TIO — só a LEITURA, e ela nunca falha alto.
 *
 * Quem cria o código é o servidor (`meuCodigoDeIndicacao`, da sessão do
 * negócio): ele mora em `users.codigoDeIndicacao`, proibido ao cliente nas
 * rules, senão um tio copiaria o código de outro. Aqui só se pede.
 *
 * ⚠️ DEVOLVE `null` EM QUALQUER FALHA, de propósito. O cupom é uma linha a
 * mais na mensagem; sem ele, a indicação sai igual a antes. Função ainda não
 * publicada, sem internet ou sem Blaze não podem impedir o tio de indicar um
 * colega — e um erro na tela por causa de um enfeite ensinaria a não tocar
 * no botão.
 */
export async function meuCodigoDeIndicacao() {
  if (!CLOUD_FUNCTIONS_ENABLED) return null;
  try {
    const { data } = await httpsCallable(functions, 'meuCodigoDeIndicacao')({});
    const codigo = String(data?.codigo || '').trim();
    return codigo || null;
  } catch {
    return null;
  }
}
