/**
 * A CONCESSÃO — o dono abrindo mão de dinheiro para uma pessoa específica.
 *
 * ── ELA É A PORTA PELA QUAL O ORÇAMENTO PODE VOLTAR
 * O modelo negociado morreu em 06/09/2026: acabou o percentual caso a caso, o
 * piso, a carência e os seis eixos que um consultor cruzava por associado. O
 * preço passou a ser de tabela, e é isso que faz a operação caber numa pessoa.
 *
 * Só que retenção real precisa de exceção. Um associado bom, num mês ruim,
 * pede desconto — e "não" é a resposta que o faz cancelar. A exceção precisa
 * existir; o que não pode é virar a regra sem ninguém ter decidido isso.
 *
 * ── PRAZO E MOTIVO SÃO A TRANCA, E SÃO OBRIGATÓRIOS
 * Desconto sem data é PREÇO. Concessão sem motivo é um número que ninguém
 * consegue revisar seis meses depois — nem quem concedeu. As duas coisas juntas
 * são o que separa "abri uma exceção em agosto porque ele perdeu duas escolas"
 * de "esse associado paga menos, não me lembro por quê".
 *
 * ── UMA POR VEZ, E A NOVA SUBSTITUI A ANTERIOR
 * Duas concessões somando é exatamente como o preço desanda sem decisão: 30%
 * em março, mais 30% em agosto, e a ficha diz "30%" enquanto a fatura cobra
 * 40%. Conceder de novo é REVER a concessão, não empilhar outra.
 *
 * ── SE METADE DA CARTEIRA TIVER CONCESSÃO, A TABELA É QUE ESTÁ ERRADA
 * E é por isso que o painel conta quantas estão ativas em vez de diluí-las
 * numa média de receita. Uma exceção é retenção; trinta são um preço que
 * ninguém teve coragem de mudar na tabela.
 *
 * ── OS DOIS TIPOS CHEGAM A ZERO E CONTAM HISTÓRIAS DIFERENTES
 * Desconto com prazo produz uma fatura menor; isenção diz que aquele mês não
 * tem fatura. Já era assim entre `descontos` e `isencaoAte`, e a distinção vale
 * na hora de conferir o que foi concedido — R$ 0 cobrado e nada cobrado não
 * são a mesma linha num extrato.
 *
 * ESTE ARQUIVO NÃO IMPORTA FIREBASE NEM REACT (`npm run testar:concessao`).
 */

import {
  FUNDADOR,
  FUNDADORES_METADE,
  FUNDADORES_VITALICIO,
  ORIGEM,
} from './planos.js';

/** Os dois tipos, e eles não são intercambiáveis — ver o cabeçalho. */
export const TIPO = {
  DESCONTO: 'desconto',
  ISENCAO: 'isencao',
};

/** Um motivo curto demais não é motivo, é um caractere para passar da tela. */
export const MOTIVO_MINIMO = 10;

/** Prazo máximo de uma concessão, em meses. Acima disso é tabela nova. */
export const PRAZO_MAXIMO = 12;

/** E abaixo de 5% não é retenção, é ruído contábil. */
export const FRACAO_MINIMA = 0.05;

/**
 * O mês 'AAAA-MM' daqui a N meses, contando este como o primeiro.
 *
 * N=1 é só este mês. `setDate(1)` antes de andar porque `setMonth` estoura: 31
 * de março mais um mês vira 1º de maio, e o desconto ganharia um mês de graça.
 */
export function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.max(1, Number(meses) || 1) - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A concessão está bem formada? Devolve `{ ok, erro }`.
 *
 * ⚠️ ESTA FUNÇÃO É A TRANCA, e por isso ela mora aqui e não na tela: um
 * formulário valida o que o dedo digitou, e a próxima tela que gravar concessão
 * não passaria por ele. A regra é uma só, e é testada.
 */
export function validarConcessao({ tipo, fracao, meses, motivo } = {}) {
  if (tipo !== TIPO.DESCONTO && tipo !== TIPO.ISENCAO) {
    return { ok: false, erro: 'Escolha desconto ou meses sem fatura.' };
  }

  const m = String(motivo || '').trim();
  if (m.length < MOTIVO_MINIMO) {
    return {
      ok: false,
      erro: 'Escreva o motivo. Daqui a seis meses ninguém lembra por que abriu a exceção.',
    };
  }

  const n = Math.floor(Number(meses) || 0);
  if (n < 1) return { ok: false, erro: 'Concessão sem prazo vira preço. Diga por quantos meses.' };
  if (n > PRAZO_MAXIMO) {
    return {
      ok: false,
      erro: `Acima de ${PRAZO_MAXIMO} meses não é exceção, é tabela nova. Mude a faixa.`,
    };
  }

  if (tipo === TIPO.DESCONTO) {
    const f = Number(fracao) || 0;
    if (f < FRACAO_MINIMA) {
      return { ok: false, erro: `Menos de ${Math.round(FRACAO_MINIMA * 100)}% não segura ninguém.` };
    }
    // 100% de desconto é uma fatura de R$ 0, que conta história diferente de
    // "este mês não tem fatura". Quem quer zerar usa isenção, e o extrato fica
    // dizendo a verdade.
    if (f >= 1) {
      return { ok: false, erro: 'Para zerar, use meses sem fatura — não desconto de 100%.' };
    }
  }

  return { ok: true, erro: null };
}

/**
 * O registro da concessão, pronto para gravar.
 *
 * ⚠️ ELE É O REGISTRO, NÃO O EFEITO. Quem faz a fatura sair menor é a entrada
 * em `users.descontos` (desconto) ou `users.isencaoAte` (isenção) — e as duas
 * escritas vão no MESMO lote que esta. Separadas, existiria a concessão
 * registrada que nunca chegou na conta, ou o desconto na fatura que ninguém
 * consegue explicar. É a mesma amarra de `planoId` + `limiteCriancas`.
 */
export function montarConcessao({ tipo, fracao, meses, motivo, por, agora = new Date() } = {}) {
  const { ok, erro } = validarConcessao({ tipo, fracao, meses, motivo });
  if (!ok) throw new Error(erro);

  const n = Math.floor(Number(meses) || 0);
  return {
    tipo,
    fracao: tipo === TIPO.DESCONTO ? Number(fracao) : null,
    meses: n,
    ate: mesDaqui(n, agora),
    motivo: String(motivo).trim(),
    // QUEM CONCEDEU E QUANDO. Hoje o dono é um; a decisão 3 diz que pode ser
    // mais de um, e uma concessão sem autor é uma conversa que não acontece.
    por: por || null,
    em: agora,
  };
}

/** A entrada correspondente em `users.descontos` — o EFEITO, para o desconto. */
export function descontoDaConcessao(concessao) {
  if (!concessao || concessao.tipo !== TIPO.DESCONTO) return null;
  return {
    origem: ORIGEM.CONCESSAO,
    fracao: Number(concessao.fracao) || 0,
    ate: concessao.ate,
  };
}

/** Esta concessão ainda vale neste mês? Texto 'AAAA-MM' é ordenável. */
export function concessaoVigente(concessao, mes) {
  const m = String(mes || '');
  if (!m || !concessao?.ate) return false;
  return m <= String(concessao.ate);
}

/**
 * TUDO O QUE ESTE ASSOCIADO TEM DE CONDIÇÃO ESPECIAL, numa lista só.
 *
 * ⚠️ CADA LINHA DIZ SE É RÉGUA OU EXCEÇÃO, e essa coluna é o ponto da tabela.
 * Sem ela, "50%" de fundador e "50%" de concessão parecem a mesma coisa — e
 * são opostas: uma é política que vale para todo mundo que se qualificar, a
 * outra é dinheiro que o dono abriu mão para uma pessoa.
 *
 * `mes` é 'AAAA-MM' e decide o que ainda vale. Sem ele, nada com prazo entra —
 * ausência de referência é ausência de resposta, nunca "vale tudo". É a mesma
 * escolha de `descontosVigentes`.
 */
export function condicoesVigentes(motorista, mes) {
  const linhas = [];
  if (!motorista) return linhas;

  if (motorista.condicaoFundador === FUNDADOR.VITALICIO) {
    linhas.push({
      id: 'fundador',
      especie: 'regua',
      rotulo: 'Fundador vitalício',
      valor: '100%',
      ate: null, // ⚠️ NÃO EXPIRA. É o que torna o 14º irreversível.
      motivo: null,
    });
  } else if (motorista.condicaoFundador === FUNDADOR.METADE) {
    linhas.push({
      id: 'fundador',
      especie: 'regua',
      rotulo: 'Fundador',
      valor: '50%',
      ate: null,
      motivo: null,
    });
  }

  const indicacoes = Math.max(0, Math.floor(Number(motorista.indicacoesAtivas) || 0));
  if (indicacoes > 0) {
    linhas.push({
      id: 'indicacao',
      especie: 'regua',
      rotulo: `${indicacoes} ${indicacoes === 1 ? 'indicação' : 'indicações'}`,
      valor: `${Math.min(indicacoes * 10, 50)}%`,
      ate: null,
      motivo: null,
    });
  }

  const m = String(mes || '');
  const concessoes = (Array.isArray(motorista.concessoes) ? motorista.concessoes : []).filter(
    (c) => concessaoVigente(c, m)
  );

  (Array.isArray(motorista.descontos) ? motorista.descontos : []).forEach((d) => {
    if (!d?.ate || !m || m > String(d.ate)) return;

    if (d.origem === ORIGEM.CONCESSAO) {
      // Normalmente a linha completa vem de `concessoes`, logo abaixo, com
      // motivo e autor. Mas se o EFEITO existe e o REGISTRO não, o desconto
      // sumiria da tabela e continuaria saindo da fatura — um desconto
      // invisível, que é exatamente o que esta tabela existe para impedir.
      //
      // Então ele aparece, e aparece dizendo que está órfão: uma linha feia é
      // melhor que um desconto que ninguém vê.
      if (!concessoes.length) {
        linhas.push({
          id: 'concessao:orfa',
          especie: 'excecao',
          rotulo: 'Desconto concedido',
          valor: `${Math.round((Number(d.fracao) || 0) * 100)}%`,
          ate: d.ate,
          motivo: 'sem registro — conceda de novo para gravar o motivo',
        });
      }
      return;
    }

    linhas.push({
      id: d.origem,
      especie: 'regua',
      rotulo: 'Contratou dentro do teste',
      valor: `${Math.round((Number(d.fracao) || 0) * 100)}%`,
      ate: d.ate,
      motivo: null,
    });
  });

  concessoes.forEach((c, i) => {
    linhas.push({
      id: `concessao:${i}`,
      especie: 'excecao',
      rotulo: c.tipo === TIPO.ISENCAO ? 'Sem fatura (concedido)' : 'Desconto concedido',
      valor: c.tipo === TIPO.ISENCAO ? 'sem fatura' : `${Math.round((Number(c.fracao) || 0) * 100)}%`,
      ate: c.ate,
      motivo: c.motivo || null,
      por: c.por || null,
    });
  });

  return linhas;
}

/**
 * QUANTOS FUNDADORES JÁ FORAM CONCEDIDOS — o contador que não existia.
 *
 * São 13 condições e nada as somava: o campo era escrito por motorista, um de
 * cada vez, sem nenhuma tela dizendo quantos já saíram. Dava para conceder o
 * 14º sem perceber — e o vitalício NÃO EXPIRA, então o erro não se conserta no
 * mês seguinte, ele fica.
 *
 * `restam` pode ficar negativo de propósito. Zerar em zero esconderia
 * exatamente o caso que o contador existe para pegar.
 */
export function contarFundadores(parceiros = []) {
  const lista = Array.isArray(parceiros) ? parceiros : [];
  const vitalicio = lista.filter((p) => p?.condicaoFundador === FUNDADOR.VITALICIO).length;
  const metade = lista.filter((p) => p?.condicaoFundador === FUNDADOR.METADE).length;
  return {
    vitalicio,
    metade,
    total: vitalicio + metade,
    limite: FUNDADORES_VITALICIO + FUNDADORES_METADE,
    restamVitalicio: FUNDADORES_VITALICIO - vitalicio,
    restamMetade: FUNDADORES_METADE - metade,
    /**
     * ⚠️ ALGUÉM CONCEDEU ALÉM DO LIMITE? Não é o mesmo que `restam < 0`.
     *
     * `FUNDADORES_METADE` foi a ZERO em 07/09/2026, quando a condição virou
     * título em vez de preço. A partir daí, TODO fundador de metade histórico
     * deixa `restamMetade` negativo — e ele foi concedido corretamente, sob a
     * régua que valia. A tela que lia só o sinal passou a acusar o dono de ter
     * passado do combinado por causa de uma mudança de política.
     *
     * O estouro real é o do VITALÍCIO, que sempre foi um e nunca expira. Para a
     * metade, o que existe é histórico — contado, mostrado, e não acusado.
     */
    estourou: FUNDADORES_VITALICIO - vitalicio < 0,
    metadeHistorica: FUNDADORES_METADE === 0 && metade > 0,
  };
}

/**
 * O retrato das concessões da carteira — e a pergunta que ele responde não é
 * "quanto custou", é "a tabela ainda está certa?".
 *
 * ⚠️ SE METADE DA CARTEIRA TIVER CONCESSÃO ATIVA, A TABELA É QUE ESTÁ ERRADA.
 * Por isso a fração aparece inteira em vez de diluída numa média de receita:
 * uma média esconde a distribuição, que é justamente o dado.
 *
 * `fracao` vem `null` com carteira vazia — não zero. Zero por cento de
 * concessões e "não há ninguém" são coisas diferentes, e é a mesma escolha de
 * `resumirCarteira`.
 */
export function resumirConcessoes(parceiros = [], mes) {
  const lista = Array.isArray(parceiros) ? parceiros : [];
  const m = String(mes || '');
  const com = lista.filter((p) =>
    (Array.isArray(p?.concessoes) ? p.concessoes : []).some((c) => concessaoVigente(c, m))
  );
  return {
    comConcessao: com.length,
    total: lista.length,
    fracao: lista.length ? com.length / lista.length : null,
  };
}
