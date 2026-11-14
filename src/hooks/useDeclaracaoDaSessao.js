import { useState } from 'react';
import { useAuth } from './useAuth';
import {
  ERRO_DA_DECLARACAO,
  jaDeclarouNestaSessao,
  lembrarDaDeclaracao,
} from '../dominio/identidade/autorizacaoDeclarada.js';

/**
 * A declaração de autorização nos caminhos RÁPIDOS de cadastro de criança.
 *
 * Esses dois caminhos nasceram sem perguntar nada, e o registro por criança
 * (`autorizacaoDeclarada` + data + quem) pede que a pessoa tenha declarado de
 * verdade. A pergunta vem UMA vez por sessão (memória do módulo, por usuário —
 * nada em `localStorage`), e o registro é de cada criança.
 *
 * `confirmar()` diz se pode salvar: com a declaração já feita na sessão, sim;
 * com a caixa marcada, sim; senão ela devolve `false` e acende o erro. O
 * `lembrar()` só deve ser chamado DEPOIS que a criança foi salva — recusa do
 * banco não pode contar como declaração feita.
 */
export function useDeclaracaoDaSessao() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [marcada, setMarcada] = useState(false);
  const [erro, setErro] = useState('');
  // Lido a cada render: depois de salvar a primeira, a caixa some da folha.
  const jaDeclarou = jaDeclarouNestaSessao(uid);

  const confirmar = () => {
    if (jaDeclarou || marcada) {
      setErro('');
      return true;
    }
    setErro(ERRO_DA_DECLARACAO);
    return false;
  };

  const lembrar = () => lembrarDaDeclaracao(uid);

  return {
    jaDeclarou,
    marcada,
    erro,
    marcar: (v) => {
      setMarcada(v);
      if (v) setErro('');
    },
    confirmar,
    lembrar,
  };
}
