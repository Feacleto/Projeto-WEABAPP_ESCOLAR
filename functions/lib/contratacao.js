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
 * ── O DEGRAU DA ESCADA É DECIDIDO AQUI, E SÓ AQUI
 * Quem contrata no 1º mês do teste leva 50% pelos doze meses; no 2º, 30%; no
 * 3º, 15%. Quem decide EM QUE MÊS ele está é o servidor, olhando `trialInicio`
 * — um campo que o motorista grava uma vez e nunca mais (as rules garantem),
 * mas cuja LEITURA no cliente aconteceria no relógio do aparelho dele. Relógio
 * de cliente é a coisa mais fácil de mudar num telefone.
 *
 * ⚠️ ISSO PESA MAIS DO QUE PESAVA. A antecipação anterior era 50% em QUALQUER
 * dia dos 90: mentir no relógio só adiantava o inevitável. Com a escada, mentir
 * no relógio TROCA DE DEGRAU — é a diferença entre R$ 74,50 e R$ 126,65 por
 * doze meses. O incentivo para falsificar cresceu, e a defesa é a mesma: o
 * cliente não tem voto.
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

/**
 * A escada de fechamento, espelhada — SÓ OS DADOS, como a tabela de faixas.
 *
 * `npm run testar:gateway` compara esta cópia com `ESCADA_DE_FECHAMENTO` de
 * `src/dominio/associacao/planos.js` degrau por degrau. Divergir aqui é o
 * servidor gravando uma fração que a régua do app não reconhece — e a fatura
 * cobraria uma coisa enquanto o contrato assinado diria outra.
 */
const ESCADA = [
  { degrau: 1, fracao: 0.5 },
  { degrau: 2, fracao: 0.3 },
  { degrau: 3, fracao: 0.15 },
];

/** Quem deixou o teste vencer e volta em até 30 dias. */
const RETORNO = { fracao: 0.1, prazoDias: 30, degrau: 'retorno' };

/** Os descontos duram o contrato inteiro. */
const MESES_DE_CONTRATO = 12;

/** Cada degrau é um mês de teste: 90 dias divididos por 3. */
const DIAS_POR_DEGRAU = 30;

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

/**
 * 'AAAA-MM' do ULTIMO mes em que um desconto de N meses ainda vale.
 *
 * O DIA VAI PARA 1 ANTES DE SOMAR, e isso nao e detalhe: `setMonth` preserva
 * o dia, e 31 nao existe em todo mes. Contratar em 31/03 com `setMonth(+12)`
 * produzia 31/02/2027, que o JavaScript normaliza para 03/03 — um mes a mais
 * de desconto, de graca, para sempre.
 *
 * E o `- 1` faz o prazo ser INCLUSIVO do mes corrente: 12 meses a partir de
 * setembro terminam em agosto do ano seguinte, nao em setembro. Sem ele o
 * desconto durava 13 meses — meia mensalidade extra por associado, silenciosa,
 * crescendo com a base.
 *
 * HOUVE UMA SEGUNDA COPIA, em `premioDeConversao.js`, e ela ja fazia certo —
 * as duas divergiam em um mes inteiro. Esse arquivo foi apagado em 07/09/2026
 * junto com a roleta, e sobrou esta. `npm run testar:gateway` continua
 * guardando a armadilha do `setMonth`, que e do JavaScript e nao da copia.
 */
function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora);
  d.setDate(1);
  d.setMonth(d.getMonth() + meses - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ate quando a conta fica destravada por ter CONTRATADO.
 *
 * Fim do mes seguinte, meio-dia. E a mesma regra de `assinaturaAteDoMes`: quem
 * fecha um acordo hoje opera ate a primeira fatura vencer e ser paga.
 *
 * SEM ISTO, CONTRATAR NAO DESTRAVAVA NADA. `estadoDaConta` e `isAdmin()`
 * consultam `assinaturaAte`, e so a baixa de fatura escrevia esse campo — o
 * motorista assinava o contrato e voltava para a tela dizendo pra contratar.
 * Beco sem saida depois de a pessoa ter decidido pagar.
 *
 * Meio-dia, e nao meia-noite: o processo das functions roda em UTC, e a data
 * construida a 00:00 volta um dia quando lida no fuso de Brasilia.
 */
function cobertoAteOMesSeguinte(agora = new Date()) {
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth() + 2, 0, 12, 0, 0);
}

/**
 * O teste ainda está correndo?
 *
 * Quem nunca rodou uma rota não tem `trialInicio` — e conta como DENTRO do
 * teste, porque o relógio dele nem começou. Recusar o desconto a essa pessoa
 * puniria justamente quem decidiu antes de precisar.
 */
function dentroDoTrial(trialInicio, agora) {
  const inicio = paraData(trialInicio);
  if (!inicio) return true;
  const passados = Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA);
  return passados < DIAS_DE_TRIAL;
}

/**
 * EM QUE DEGRAU DA ESCADA ELE ESTÁ — 1, 2, 3, 'retorno' ou null.
 *
 * `null` é "nenhum desconto", e é o caso de quem deixou os 90 dias e mais 30
 * passarem. Não existe quarto degrau: escada que premia quem esperou é
 * exatamente a lição que ela existe para não ensinar.
 *
 * ⚠️ SEM `trialInicio` O DEGRAU É 1, e não zero. Quem nunca rodou uma rota
 * ainda não gastou um dia do teste; ele é o mais antecipado de todos, e
 * cobrar-lhe o preço cheio puniria quem decidiu antes de precisar.
 *
 * ⚠️ O PISO DO DIA ZERO É EXPLÍCITO. Relógio de servidor atrasado em relação ao
 * do aparelho que gravou `trialInicio` produz dias NEGATIVOS, e
 * `floor(-1 / 30) + 1` daria degrau ZERO — nenhum desconto para quem acabou de
 * começar, que é o oposto do desenho.
 */
function degrauDaDecisao(trialInicio, agora = new Date()) {
  const inicio = paraData(trialInicio);
  if (!inicio) return 1;

  const passados = Math.max(
    0,
    Math.floor((agora.getTime() - inicio.getTime()) / MS_POR_DIA)
  );
  if (passados < DIAS_DE_TRIAL) {
    return Math.floor(passados / DIAS_POR_DEGRAU) + 1;
  }
  if (passados < DIAS_DE_TRIAL + RETORNO.prazoDias) return RETORNO.degrau;
  return null;
}

/** A fração daquele degrau. Espelha `descontoDoFechamento` do app. */
function descontoDoDegrau(degrau) {
  if (degrau === RETORNO.degrau) return RETORNO.fracao;
  const passo = ESCADA.find((e) => e.degrau === degrau);
  return passo ? passo.fracao : 0;
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

      // ── o desconto do degrau ───────────────────────────────────────────
      //
      // UMA VEZ SÓ. A lista de descontos é SUBSTITUÍDA, e quem já tem o de
      // fechamento mantém a data E A FRAÇÃO originais: sem isso, trocar de
      // faixa no décimo mês renovaria o desconto por mais doze, e o desconto
      // de conversão viraria a tabela definitiva daquele associado.
      //
      // ⚠️ O LEGADO `antecipacao` CONTA COMO JÁ TENDO. É o mesmo instrumento
      // com o nome antigo, e tratá-lo como ausente daria um SEGUNDO desconto
      // de fechamento a quem já tem um — com data nova, doze meses à frente.
      const anteriores = Array.isArray(dados.descontos) ? dados.descontos : [];
      const eDeFechamento = (d) =>
        d?.origem === 'fechamento' || d?.origem === 'antecipacao';

      const jaTinha = anteriores.find(eDeFechamento);
      const degrau = jaTinha ? null : degrauDaDecisao(dados.trialInicio, agora);
      const fracao = degrau === null ? 0 : descontoDoDegrau(degrau);
      const ganhaAgora = !jaTinha && fracao > 0;

      const descontos = anteriores.filter((d) => !eDeFechamento(d));
      if (jaTinha) descontos.push(jaTinha);
      else if (ganhaAgora) {
        descontos.push({
          origem: 'fechamento',
          fracao,
          ate: mesDaqui(MESES_DE_CONTRATO, agora),
          // O DEGRAU VAI GRAVADO junto da fração. A ficha do dono precisa
          // dizer QUAL degrau foi, e a fração sozinha não distingue 15% de
          // fechamento de 15% de concessão — que são espécies diferentes.
          degrau,
        });
      }

      // `assinaturaAte` VAI JUNTO, e e o campo que destrava a conta.
      //
      // Nunca REDUZ: quem ja esta coberto por um pagamento mais longo nao pode
      // perder cobertura por trocar de faixa. `Math.max` de datas nao existe,
      // entao a comparacao e explicita.
      const jaCoberto = dados.assinaturaAte?.toDate?.() || null;
      const cobertura = cobertoAteOMesSeguinte(agora);

      await ref.set(
        {
          planoId: plano.id,
          // O TETO VEM DA FAIXA, no mesmo write. Ver o cabeçalho.
          limiteCriancas: plano.ate,
          descontos,
          contratadoEm: agora,
          assinaturaAte:
            jaCoberto && jaCoberto > cobertura ? jaCoberto : cobertura,
        },
        { merge: true }
      );

      logger.info('[contratacao] faixa contratada', {
        uid,
        planoId: plano.id,
        degrau,
        fracao,
      });

      return {
        planoId: plano.id,
        limiteCriancas: plano.ate,
        descontos,
        // A tela precisa saber se o desconto foi concedido AGORA, e QUAL foi,
        // para dizer isso à pessoa. Descobrir depois, na primeira fatura,
        // transforma um presente em desconfiança.
        fechamento: ganhaAgora,
        degrau: ganhaAgora ? degrau : null,
        fracao: ganhaAgora ? fracao : 0,
      };
    }
  );
}

module.exports = {
  makeContratarPlano,
  PLANOS,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
  mesDaqui,
  cobertoAteOMesSeguinte,
};
