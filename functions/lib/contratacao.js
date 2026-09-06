const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');

const REGION = 'southamerica-east1';

/**
 * O MOTORISTA CONTRATA SOZINHO — e o servidor é quem escreve a cláusula.
 *
 * ── POR QUE ISTO É CLOUD FUNCTION E NÃO UMA ESCRITA DO CLIENTE
 * A faixa contratada não é preferência de tela: é `users.planoId`, que a fatura
 * cobra, e `users.limiteCriancas`, que as rules cobram a cada criança
 * cadastrada. As duas estão na lista de campos que o cliente NUNCA escreve —
 * cláusula que o devedor edita não é cláusula.
 *
 * Sem esta função, autoatendimento significaria abrir essas rules, e aí o
 * motorista se poria na faixa de R$ 69 com teto de 40 pelo console do
 * navegador. É o mesmo raciocínio de `limiteCriancas` desde o começo, aplicado
 * ao caminho novo.
 *
 * ── OS DOIS CAMPOS VÃO NO MESMO BATCH
 * Um é o preço, o outro é o teto. Gravados separadamente existiria a janela em
 * que ele paga uma faixa e cadastra na outra — e cada campo estaria certo do
 * ponto de vista de quem o lê.
 *
 * ── O DESCONTO DE ANTECIPAÇÃO É DECIDIDO AQUI, E SÓ AQUI
 * Quem contrata ANTES de o teste acabar leva metade pelos doze meses. Quem
 * decide se ainda está dentro do teste é o servidor, olhando `trialInicio` —
 * um campo que o motorista grava uma vez e nunca mais (as rules garantem), mas
 * cuja LEITURA no cliente aconteceria no relógio do aparelho dele. Relógio de
 * cliente é a coisa mais fácil de mudar num telefone.
 *
 * ── O QUE ELE NÃO FAZ: EMITIR O DOCUMENTO
 * O contrato em `contratosAssociacao` é escrito pelo cliente logo depois, e as
 * rules exigem que a faixa dentro dele bata com a que ESTA função acabou de
 * gravar. A divisão é essa: o servidor é dono dos NÚMEROS, o cliente monta o
 * DOCUMENTO, e a regra amarra um no outro.
 *
 * A alternativa seria espelhar aqui a régua de preço e o montador de contrato
 * inteiros — duzentas linhas de `src/dominio/associacao/` que o deploy das
 * functions não alcança. Duas cópias de aritmética de dinheiro divergindo em
 * silêncio é exatamente o problema que este projeto já teve, e a cópia de
 * `assinaturaAteDoMes` (a única que existe) só se sustenta porque tem teste
 * provando a igualdade mês a mês. Duzentas linhas não se prova assim.
 */

/**
 * A régua, espelhada — SÓ OS DADOS, nenhuma aritmética.
 *
 * É a única coisa que precisa existir dos dois lados, e é uma tabela de três
 * linhas: id, teto, preço. `npm run testar:gateway` compara esta cópia com
 * `src/dominio/associacao/planos.js` faixa por faixa, então divergir é teste
 * vermelho e não descoberta numa fatura.
 */
const PLANOS = [
  { id: 'ate10', ate: 10, preco: 69 },
  { id: 'ate25', ate: 25, preco: 149 },
  { id: 'ate40', ate: 40, preco: 229 },
];

/** Contratou antes de o teste acabar: metade da conta pelos 12 meses. */
const ANTECIPACAO = { fracao: 0.5, meses: 12 };

/** Os mesmos 90 dias de `dominio/associacao/trial.js`. */
const DIAS_DE_TRIAL = 90;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'AAAA-MM' de N meses à frente — o fim da validade de um desconto. */
function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora);
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * O teste ainda está correndo?
 *
 * Quem nunca rodou uma rota não tem `trialInicio` — e conta como DENTRO do
 * teste, porque o relógio dele nem começou. Recusar a antecipação a essa
 * pessoa puniria justamente quem decidiu antes de precisar.
 */
function dentroDoTrial(trialInicio, agora) {
  const inicio = paraData(trialInicio);
  if (!inicio) return true;
  const passados = Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA);
  return passados < DIAS_DE_TRIAL;
}

function makeContratarPlano(db) {
  return onCall(
    { region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirMotorista(db, request);

      const planoId = String(request.data?.planoId || '').trim();
      const plano = PLANOS.find((p) => p.id === planoId);
      if (!plano) {
        throw new HttpsError('invalid-argument', 'Faixa desconhecida.');
      }

      const ref = db.doc(`users/${uid}`);
      const snap = await ref.get();
      const dados = snap.data() || {};
      const agora = new Date();

      // ── o desconto de antecipação ──────────────────────────────────────
      //
      // UMA VEZ SÓ. A lista de descontos é SUBSTITUÍDA, e quem já tem o de
      // antecipação mantém a data original: sem isso, trocar de faixa no
      // décimo mês renovaria o desconto por mais doze, e o desconto de
      // conversão viraria a tabela definitiva daquele associado.
      const anteriores = Array.isArray(dados.descontos) ? dados.descontos : [];
      const jaTinha = anteriores.find((d) => d?.origem === 'antecipacao');
      const ganhaAgora = !jaTinha && dentroDoTrial(dados.trialInicio, agora);

      const descontos = anteriores.filter((d) => d?.origem !== 'antecipacao');
      if (jaTinha) descontos.push(jaTinha);
      else if (ganhaAgora) {
        descontos.push({
          origem: 'antecipacao',
          fracao: ANTECIPACAO.fracao,
          ate: mesDaqui(ANTECIPACAO.meses, agora),
        });
      }

      await ref.set(
        {
          planoId: plano.id,
          // O TETO VEM DA FAIXA, no mesmo write. Ver o cabeçalho.
          limiteCriancas: plano.ate,
          descontos,
          contratadoEm: agora,
        },
        { merge: true }
      );

      logger.info('[contratacao] faixa contratada', {
        uid,
        planoId: plano.id,
        antecipacao: ganhaAgora,
      });

      return {
        planoId: plano.id,
        limiteCriancas: plano.ate,
        descontos,
        // A tela precisa saber se o desconto foi concedido AGORA para dizer
        // isso à pessoa. Descobrir depois, na primeira fatura, transforma um
        // presente em desconfiança.
        antecipacao: ganhaAgora,
      };
    }
  );
}

module.exports = { makeContratarPlano, PLANOS, ANTECIPACAO, dentroDoTrial, mesDaqui };
