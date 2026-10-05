import { primeiroNome } from '../../compartilhado/formatters.js';
import { semHorarioCombinado } from '../rota/horarios.js';
import { conviteValidoAteMs } from './validadeDoConvite.js';

/**
 * O BUZI FALA DA TURMA (05/10/2026, Buzi Chat aprovado pelo dono).
 *
 * O assunto "Turma" do Buzi Chat: o que está parado do lado da família ou do
 * cadastro. As regras do Buzi valem aqui (`npm run testar:buzi`): um assunto
 * por pergunta, nada de comparar meses, nada de conversa de amigo.
 *
 * Nenhum valor de mensalidade aparece aqui: a turma é o cadastro, não o
 * dinheiro (o dinheiro tem o assunto Mensalidades).
 *
 * Puro: quem busca as crianças é a tela, e passa por parâmetro.
 */

export const TEMA_DA_TURMA = {
  CONVITE: 'convite',
  CONTRATO: 'contrato',
  SEM_HORARIO: 'semHorario',
};

export const PERGUNTA_DA_TURMA = {
  [TEMA_DA_TURMA.CONVITE]: 'Quem não entrou no app?',
  [TEMA_DA_TURMA.CONTRATO]: 'Quem falta assinar o contrato?',
  [TEMA_DA_TURMA.SEM_HORARIO]: 'Quem está sem horário?',
};

const DIA_MS = 24 * 60 * 60 * 1000;
const ativas = (children) => (children || []).filter((c) => c?.active !== false);
const nome = (c) => primeiroNome(c?.name, 'Criança');
const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

/** QUEM NÃO ENTROU NO APP — o convite que a família ainda não abriu. */
export function quemNaoEntrou(children = [], { agora = Date.now() } = {}) {
  const linhas = ativas(children)
    .filter((c) => c.inviteStatus === 'pending')
    .map((c) => {
      const ate = conviteValidoAteMs(c);
      let detalhe = 'o convite ainda não foi aberto';
      if (ate != null) {
        const faltam = Math.ceil((ate - agora) / DIA_MS);
        if (faltam <= 0) detalhe = 'o convite venceu: mande um link novo';
        else if (faltam === 1) detalhe = 'o convite vence amanhã';
        else if (faltam <= 3) detalhe = `o convite vence em ${faltam} dias`;
      }
      return { id: c.id, nome: nome(c), detalhe };
    })
    .sort(porNome);
  const n = linhas.length;
  const frases = n === 0
    ? ['Todas as famílias da turma já entraram no app.']
    : [`${n === 1 ? '1 família ainda não entrou' : `${n} famílias ainda não entraram`} no app.`];
  return { tema: TEMA_DA_TURMA.CONVITE, frases, linhas, quantas: n };
}

/** QUEM FALTA ASSINAR O CONTRATO — a versão emitida que a família não aceitou. */
export function quemFaltaAssinar(children = []) {
  const linhas = ativas(children)
    .filter((c) => c.contratoAguardando != null)
    .map((c) => ({
      id: c.id,
      nome: nome(c),
      detalhe: c.contratoVigente != null ? 'contrato novo esperando' : 'primeiro contrato esperando',
    }))
    .sort(porNome);
  const n = linhas.length;
  const frases = n === 0
    ? ['Nenhum contrato esperando a família assinar.']
    : [`${n === 1 ? '1 contrato espera' : `${n} contratos esperam`} a família assinar.`];
  return { tema: TEMA_DA_TURMA.CONTRATO, frases, linhas, quantas: n };
}

/** QUEM ESTÁ SEM HORÁRIO — a criança cuja hora de pegar ou entregar não foi definida. */
export function quemEstaSemHorario(children = []) {
  const linhas = semHorarioCombinado(children)
    .map((c) => ({ id: c.id, nome: nome(c), detalhe: c.school || 'sem escola na ficha' }))
    .sort(porNome);
  const n = linhas.length;
  const frases = n === 0
    ? ['Todas as crianças têm horário definido.']
    : [`${n === 1 ? '1 criança está' : `${n} crianças estão`} sem horário definido.`];
  return { tema: TEMA_DA_TURMA.SEM_HORARIO, frases, linhas, quantas: n };
}

/** A resposta de um tema da turma — o que a conversa chama a cada toque. */
export function responderDaTurma(tema, { children = [], agora = Date.now() } = {}) {
  if (tema === TEMA_DA_TURMA.CONVITE) return quemNaoEntrou(children, { agora });
  if (tema === TEMA_DA_TURMA.CONTRATO) return quemFaltaAssinar(children);
  if (tema === TEMA_DA_TURMA.SEM_HORARIO) return quemEstaSemHorario(children);
  return null;
}
