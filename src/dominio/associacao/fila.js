/**
 * A FILA DO DIA — o que precisa de você hoje, e nada além disso.
 *
 * ── ELA NÃO TEM CONTEÚDO PRÓPRIO, E É ISSO QUE ELA É
 * Tudo aqui já existe em outra tela: o degrau na carteira, o termômetro na
 * ficha, a espera na caixa de chamados, a fatura no fechamento. O que a fila
 * faz é APRESENTAR isso como trabalho em vez de relatório — e um relatório com
 * a mesma informação não produz uma ligação.
 *
 * ── SÓ ENTRA O QUE TEM AÇÃO POSSÍVEL HOJE
 * "3 associados sem indicar há 60 dias" é relatório: não há o que fazer com
 * essa linha nesta manhã. Fila que nunca esvazia deixa de ser lida, e uma vez
 * que o dono aprende a rolar por cima dela, ela não volta a ser lida no dia em
 * que tiver algo grave.
 *
 * Por isso o SUSPENSO fica de fora: quem suspendeu foi você. Não é pendência,
 * é decisão tomada.
 *
 * ── UMA LINHA POR MOTORISTA, A MAIS URGENTE
 * Um associado pode disparar quatro sinais ao mesmo tempo — parou de rodar, a
 * fatura venceu, encolheu e as famílias reclamam. Quatro linhas fariam o
 * contador dizer "7" quando o dia tem três conversas, e o número no topo é a
 * única coisa que alguém lê antes de decidir se abre a tela.
 *
 * A fila conta CONVERSAS. Os outros motivos estão na ficha, que a linha abre.
 *
 * A exceção é o chamado, que é uma linha por chamado: cada um é uma resposta
 * diferente, mesmo que sejam da mesma pessoa.
 *
 * ── O FECHAMENTO DO MÊS É UMA LINHA SÓ
 * Vinte faturas por fechar são um gesto na aba Mês, não vinte pendências. Uma
 * linha por fatura enterraria as conversas do dia debaixo de trabalho que se
 * resolve num clique.
 *
 * ── A COR NÃO É O ÚNICO SINAL, A ORDEM TAMBÉM É
 * Quem não enxerga a diferença entre âmbar e vermelho — e é gente demais para
 * ignorar — continua lendo a fila de cima para baixo e recebe a mesma
 * prioridade. Dentro do nível, quem espera há mais tempo vem primeiro, pelo
 * mesmo motivo da caixa de chamados.
 *
 * ── O NÍVEL VEM DO TERMÔMETRO, NÃO É REDECIDIDO AQUI
 * `risco.js` já classifica; repetir a régua aqui faria o mesmo motorista sair
 * vermelho numa tela e âmbar na outra, e quem visse as duas pararia de confiar
 * nas duas.
 *
 * ESTE ARQUIVO NÃO IMPORTA FIREBASE NEM REACT (`npm run testar:fila`). O
 * "agora" entra por parâmetro pelo mesmo motivo dos outros módulos de data.
 */

import { degrauDo } from './carteira.js';
import { estadoDaConta } from './contaAtiva.js';
import { pesoDoRisco, riscoDo } from './risco.js';
import { diasRestantes } from './trial.js';
import { aguardando, diasEsperando } from '../suporte/chamados.js';

/** Faltando isto ou menos para o teste acabar, vira conversa. */
export const TESTE_ACABANDO = 7;

/** E a partir daqui é a última chance antes de a conta bloquear. */
export const TESTE_NO_FIM = 2;

/** Cadastrou e não rodou: a partir daqui, a entrada dele falhou. */
export const DIAS_SEM_COMECAR = 3;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const PESO_NIVEL = { alto: 2, medio: 1, baixo: 0 };

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function diasEntre(de, ate) {
  const a = paraData(de);
  const b = paraData(ate);
  if (!a || !b) return null;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / MS_POR_DIA));
}

/**
 * A pendência DESTE motorista, ou `null` se não há nenhuma.
 *
 * Devolve UMA, a mais urgente — ver o cabeçalho. A ordem de checagem abaixo é
 * a ordem de urgência, e a primeira que casar é a que sai.
 */
export function pendenciaDoMotorista({
  motorista,
  faturas = [],
  nota = null,
  agora = new Date(),
} = {}) {
  if (!motorista?.uid) return null;

  // ⚠️ SUSPENSO NÃO É PENDÊNCIA. Quem suspendeu foi o dono, e a conta está no
  // estado em que ele a pôs — pôr isso na fila é a tela cobrando dele uma
  // decisão que ele já tomou.
  if (motorista.suspenso === true) return null;

  const degrau = degrauDo(motorista, agora);
  const nome = String(motorista.name || '').trim().split(/\s+/)[0] || 'Motorista';
  const destino = { aba: 'motoristas', uid: motorista.uid };

  // 1. A CONTA BLOQUEOU. É o mais urgente porque ele está fora do app agora —
  // e, ao contrário de todo o resto, ele não consegue trabalhar enquanto isso.
  if (degrau === 'bloqueado') {
    const { motivo, dias } = estadoDaConta({
      suspenso: false,
      trialInicio: motorista.trialInicio || null,
      assinaturaAte: motorista.assinaturaAte || null,
      fatura: null,
      agora,
    });
    return {
      id: `motorista:${motorista.uid}`,
      nivel: 'alto',
      titulo:
        motivo === 'trial'
          ? `${nome} terminou o teste e não contratou`
          : `${nome} está bloqueado por atraso`,
      detalhe:
        motivo === 'trial'
          ? 'a conta bloqueou — ele não consegue rodar'
          : dias
            ? `${dias} dias sem pagar`
            : 'a conta bloqueou',
      destino,
      // Sem data de bloqueio no documento, a espera é o que se sabe: os dias
      // de atraso. Zero quando nem isso — nunca `null`, que quebraria a ordem.
      espera: dias || 0,
    };
  }

  // 2. O TESTE ESTÁ ACABANDO. Tem DATA, e é isso que a põe acima do risco: a
  // conversa do risco pode ser amanhã, esta não.
  const faltam =
    degrau === 'em_teste' && motorista.trialInicio
      ? diasRestantes(motorista.trialInicio, agora)
      : null;
  if (faltam !== null && faltam <= TESTE_ACABANDO) {
    return {
      id: `motorista:${motorista.uid}`,
      nivel: faltam <= TESTE_NO_FIM ? 'alto' : 'medio',
      titulo:
        faltam <= 0
          ? `${nome} está no último dia de teste`
          : `${nome}: o teste acaba em ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`,
      detalhe: 'ainda não escolheu faixa',
      destino,
      // Quem tem menos tempo primeiro — a espera aqui é ao contrário.
      espera: TESTE_ACABANDO - faltam,
    };
  }

  // 3. O TERMÔMETRO. O nível vem de lá pronto; o texto é o primeiro motivo,
  // que é o mais forte porque `risco.js` os monta em ordem de urgência.
  const risco = riscoDo({ motorista, faturas, nota, degrau, agora });
  if (risco.nivel !== 'nenhum' && risco.sinais.length) {
    const [primeiro] = risco.sinais;
    return {
      id: `motorista:${motorista.uid}`,
      nivel: risco.nivel === 'alto' ? 'alto' : 'medio',
      titulo: `${nome} ${primeiro.texto}`,
      // Os outros motivos NÃO viram linha, viram detalhe: a fila conta
      // conversas, e esta pessoa é uma.
      detalhe:
        risco.sinais.length > 1
          ? risco.sinais.slice(1).map((s) => s.texto).join(' · ')
          : null,
      destino,
      espera: pesoDoRisco(risco.nivel),
    };
  }

  // 4. CADASTROU E NÃO COMEÇOU. É o mais fraco e é o mais barato de resolver:
  // ele não está saindo, ele não conseguiu entrar. Uma ligação de dez minutos
  // no terceiro dia vale mais que a conversa de retenção três meses depois.
  if (degrau === 'nao_comecou') {
    const dias = diasEntre(motorista.createdAt, agora);
    if (dias !== null && dias >= DIAS_SEM_COMECAR) {
      return {
        id: `motorista:${motorista.uid}`,
        nivel: 'baixo',
        titulo: `${nome} se cadastrou há ${dias} dias e não rodou`,
        detalhe: 'o teste dele nem começou',
        destino,
        espera: dias,
      };
    }
  }

  return null;
}

/**
 * A fila inteira, na ordem em que se trabalha nela.
 *
 * `parceiros` são os documentos de `users` com papel de motorista, `faturas` é
 * o mapa `{ uid: [fatura] }` que `carregarConsole` já monta, `notas` o mapa de
 * avaliações por motorista, e `chamados` a coleção de suporte.
 */
export function montarFila({
  parceiros = [],
  faturas = {},
  notas = {},
  chamados = [],
  mes = null,
  agora = new Date(),
} = {}) {
  const itens = [];

  (Array.isArray(parceiros) ? parceiros : []).forEach((mot) => {
    const p = pendenciaDoMotorista({
      motorista: mot,
      faturas: faturas?.[mot.uid] || [],
      nota: notas?.[mot.uid] || null,
      agora,
    });
    if (p) itens.push(p);
  });

  (Array.isArray(chamados) ? chamados : []).forEach((c) => {
    if (!aguardando(c)) return;
    const dias = diasEsperando(c, agora) ?? 0;
    itens.push({
      id: `chamado:${c.id}`,
      // Um chamado de dois dias já é uma promessa quebrada; no mesmo dia,
      // ainda é trabalho normal.
      nivel: dias >= 2 ? 'alto' : 'medio',
      titulo:
        dias === 0
          ? 'Chamado novo, sem resposta'
          : `Chamado sem resposta há ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      detalhe: c?.role === 'admin' ? 'de um motorista' : 'de uma família',
      destino: { aba: 'chamados' },
      espera: dias,
    });
  });

  // O FECHAMENTO DO MÊS, EM UMA LINHA. Só conta quem tem faixa: sem `planoId`
  // não há o que faturar, e cobrar quem está em teste seria o erro que a linha
  // estaria justamente ajudando a cometer.
  if (mes) {
    const aFechar = (Array.isArray(parceiros) ? parceiros : []).filter(
      (m) =>
        m?.planoId &&
        m?.suspenso !== true &&
        !(faturas?.[m.uid] || []).some((f) => f?.mes === mes)
    ).length;
    if (aFechar > 0) {
      itens.push({
        id: `fechamento:${mes}`,
        nivel: 'baixo',
        titulo: `${aFechar} ${aFechar === 1 ? 'fatura' : 'faturas'} de ${mes} ainda por fechar`,
        detalhe: 'na aba Mês',
        destino: { aba: 'mes' },
        espera: 0,
      });
    }
  }

  itens.sort((a, b) => {
    const n = PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel];
    if (n !== 0) return n;
    const e = (b.espera || 0) - (a.espera || 0);
    if (e !== 0) return e;
    // Empate real: o título, que é estável. Sem isto a fila se reordena a cada
    // render, e uma linha muda de lugar debaixo do dedo de quem ia tocar nela.
    return String(a.titulo).localeCompare(String(b.titulo));
  });

  return itens;
}

/**
 * Quantas linhas de cada nível — o número do topo.
 *
 * `total` conta TUDO, inclusive o que é `baixo`: o contador diz o tamanho da
 * fila, não o tamanho do susto.
 */
export function resumirFila(itens = []) {
  const lista = Array.isArray(itens) ? itens : [];
  return {
    total: lista.length,
    alto: lista.filter((i) => i.nivel === 'alto').length,
    medio: lista.filter((i) => i.nivel === 'medio').length,
    baixo: lista.filter((i) => i.nivel === 'baixo').length,
  };
}
