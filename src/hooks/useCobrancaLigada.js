import { useEffect, useState } from 'react';
import { watchPlatformConfig } from '../services/platformConfigService';
import { cobrancaLigada } from '../dominio/associacao/cobrancaLigada';
import { moduloAtivo } from '../dominio/associacao/modulosDeCobranca';

/**
 * A configuração da plataforma, reativa. `null` = ainda carregando.
 *
 * Cada tela assina o mesmo documento; o SDK do Firestore compartilha a escuta
 * de um mesmo doc, então várias assinaturas não viram várias leituras.
 */
export function useConfigDaPlataforma() {
  const [config, setConfig] = useState(null);
  useEffect(() => watchPlatformConfig(setConfig), []);
  return config;
}

/**
 * A chave mestra da cobrança. Ver `dominio/associacao/cobrancaLigada.js`.
 *
 * ⚠️ ENQUANTO CARREGA, RESPONDE `null`. Para quem só testa verdade
 * (`if (cobranca)`), é o mesmo que desligada — o erro barato é esconder um
 * aviso de cobrança por meio segundo; o caro é piscar "seu teste acabou" numa
 * fase em que nada é cobrado. Quem REDIRECIONA precisa esperar o `null`
 * passar. Falha de leitura fica desligada (o service devolve o padrão).
 */
export function useCobrancaLigada() {
  const config = useConfigDaPlataforma();
  return config === null ? null : cobrancaLigada(config);
}

/**
 * Um módulo de cobrança (ver `dominio/associacao/modulosDeCobranca.js`).
 * `null` enquanto carrega, como a chave mestra.
 */
export function useModuloDeCobranca(id) {
  const config = useConfigDaPlataforma();
  return config === null ? null : moduloAtivo(config, id);
}
