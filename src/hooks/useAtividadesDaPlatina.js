import { useEffect, useState } from 'react';
import { watchAtividadesDaPlatina } from '../services/nivelService';

/**
 * As atividades de Platina em vigor (docs/niveis.md, seção 5). Todo motorista
 * lê a mesma lista; quem diz se ELE fez cada uma é a régua
 * (`dominio/identidade/nivel.js`), no aparelho.
 *
 * Erro de leitura devolve lista vazia com `erro` preenchido: quem desenha a
 * tela decide se mostra algo — a lista vazia sozinha diria "nenhuma
 * atividade", que é outra coisa.
 */
export function useAtividadesDaPlatina() {
  const [estado, setEstado] = useState({ atividades: [], carregando: true, erro: null });

  useEffect(() => watchAtividadesDaPlatina(
    (atividades) => setEstado({ atividades, carregando: false, erro: null }),
    (erro) => setEstado({ atividades: [], carregando: false, erro })
  ), []);

  return estado;
}
