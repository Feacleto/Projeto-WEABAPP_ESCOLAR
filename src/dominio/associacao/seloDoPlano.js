import { diasDeAtraso, assinaturaValida } from './contaAtiva.js';
import { estadoDoTrial } from './trial.js';
import { PLANO } from './planos.js';

/**
 * O CARTÃO "MEU PLANO" DA TELA TRANCADA DO FINANCEIRO (03/10/2026).
 *
 * A tela trancada mostra o nome do plano e UM selo — sem valor em reais. O
 * valor da fatura é dado financeiro e fica atrás da senha; saber se a conta
 * está em dia, não: é o que ele precisa ver antes de decidir abrir.
 *
 * Os selos saem de réguas que já existem:
 *   'Em dia'       tem plano e nenhuma fatura vencida (contaAtiva)
 *   'Atrasado'     tem plano e a fatura em aberto mais antiga já venceu
 *   'Em teste'     não tem plano e o teste não acabou (trial)
 *   'Teste acabou' não tem plano e o teste acabou — sem esta quarta frase o
 *                  cartão diria "Em teste" a quem já está bloqueado
 *
 * O tom é o PAPEL da cor, não a cor: quem desenha escolhe o token.
 */
export function seloDoPlano({
  plano = null,
  fatura = null,
  trialInicio = null,
  assinaturaAte = null,
  agora = new Date(),
} = {}) {
  if (plano === PLANO.MENSAL || plano === PLANO.ANUAL) {
    const nome = plano === PLANO.MENSAL ? 'Mensal' : 'Anual';
    const atraso = diasDeAtraso(fatura, agora);
    if (atraso !== null && atraso > 0) return { nome, selo: 'Atrasado', tom: 'perigo' };
    return { nome, selo: 'Em dia', tom: 'ok' };
  }
  const trial = estadoDoTrial({
    inicio: trialInicio,
    agora,
    temContrato: assinaturaValida(assinaturaAte, agora),
  });
  if (trial === 'expirado') {
    return { nome: 'Período de teste', selo: 'Teste acabou', tom: 'aviso' };
  }
  return { nome: 'Período de teste', selo: 'Em teste', tom: 'neutro' };
}
