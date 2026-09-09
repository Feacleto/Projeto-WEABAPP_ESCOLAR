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
 * ⚠️ A RÉGUA SAIU DESTE ARQUIVO, E O MOTIVO É O CI.
 *
 * A tabela de faixas, a escada, o degrau de retorno e as contas de data agora
 * moram em `./reguaDoServidor.js`, que **não faz `require` nenhum**. O
 * cabeçalho de lá conta a história inteira; em resumo: a primeira linha DESTE
 * arquivo é `require('firebase-functions/v2/https')`, e `firebase-functions`
 * só existe em `functions/node_modules` — que o CI não instala. Enquanto
 * `scripts/testar-gateway.mjs` importava daqui, ele morria no CI e levava os
 * 11 scripts seguintes com ele, pelo `&&` da bateria.
 *
 * ⚠️ NÃO TRAGA A RÉGUA DE VOLTA. Se precisar de uma constante nova espelhada,
 * ela nasce em `reguaDoServidor.js` e este arquivo a consome — é o que mantém
 * a comparação com `src/dominio/associacao/planos.js` executável.
 * `scripts/testar-imports.mjs` falha se alguém desfizer isso.
 */
const {
  PLANOS,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  mesDaqui,
  cobertoAteOMesSeguinte,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
} = require('./reguaDoServidor');

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
