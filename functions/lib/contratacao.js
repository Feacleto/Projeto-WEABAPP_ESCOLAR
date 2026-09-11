const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const LIMITES = require('./limites');
const { exigirMotorista } = require('./papeis');

const REGION = 'southamerica-east1';

/**
 * O MOTORISTA CONTRATA SOZINHO — e o servidor é quem escreve a cláusula.
 *
 * ── POR QUE ISTO É CLOUD FUNCTION E NÃO UMA ESCRITA DO CLIENTE
 * O plano contratado não é preferência de tela: é `users.plano`, que a fatura
 * cobra a cada mês
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
  planoValido,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  mesDaqui,
  cobertoAteOMesSeguinte,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
  limitarDiaVencimento,
} = require('./reguaDoServidor');

function makeContratarPlano(db) {
  return onCall(
    { region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirMotorista(db, request);

      const plano = String(request.data?.plano || '').trim();
      if (!planoValido(plano)) {
        throw new HttpsError('invalid-argument', 'Plano desconhecido — use mensal ou anual.');
      }

      const ref = db.doc(`users/${uid}`);
      const snap = await ref.get();
      const dados = snap.data() || {};
      const agora = new Date();

      // ── o desconto do degrau ───────────────────────────────────────────
      //
      // UMA VEZ SÓ. A lista de descontos é SUBSTITUÍDA, e quem já tem o de
      // fechamento mantém A FRAÇÃO original: sem isso, trocar de plano no
      // décimo mês daria a ele o degrau de hoje, e quem entrou no mês 3 podia
      // "melhorar" o próprio desconto trocando de plano ida e volta.
      //
      // ⚠️ ELE JÁ FOI DE PRAZO, E AGORA É VITALÍCIO. Até 09/09/2026 o objeto
      // levava `ate` doze meses à frente, e o risco era renovar esse prazo a
      // cada troca. Hoje o prazo não existe (`ate: null`) e o risco virou
      // outro: reescrever a FRAÇÃO. A guarda é a mesma, o motivo mudou.
      //
      // ⚠️ O LEGADO `antecipacao` CONTA COMO JÁ TENDO. É o mesmo instrumento
      // com o nome antigo, e tratá-lo como ausente daria um SEGUNDO desconto
      // de fechamento a quem já tem um — com data nova, doze meses à frente.
      /* A CONFIG DA CASA, LIDA UMA VEZ E USADA DUAS.
       *
       * ⚠️ ELA SUBIU PARA CÁ, e a ordem importa: a leitura ficava DEPOIS da
       * escrita dos descontos, e a janela precisa ser consultada ANTES de
       * decidir se concede. Lida no lugar antigo, ela chegaria tarde demais
       * para impedir a concessão que já tinha acontecido.
       *
       * ⚠️ ELE NÃO PODE LER ISTO DA TELA. `taxaConfig` é `read: isOwner()` —
       * a estrutura de preço da plataforma não vaza nem entre parceiros — e é
       * por isso que o fechamento COPIA a chave PIX para dentro da fatura.
       * Mesmo caminho aqui: quem tem Admin SDK lê e devolve só o que interessa.
       *
       * Falha na leitura cai no padrão em vez de derrubar a contratação, e o
       * padrão da janela é ABERTA: desligar o desconto precisa ser um ato de
       * alguém, nunca a consequência de um soluço de rede. */
      let diaVencimento = 10;
      try {
        const cfg = await db.doc('taxaConfig/app').get();
        diaVencimento = limitarDiaVencimento(cfg.data()?.diaVencimento ?? 10);
      } catch (err) {
        logger.error('[contratacao] taxaConfig não leu', { uid, err: String(err) });
      }

      /* ⚠️ A JANELA VEM DE `platformConfig`, NÃO DE `taxaConfig`, e a razão é
       * quem mais precisa lê-la: as telas do motorista. `taxaConfig` é
       * `read: isOwner()` — preço da casa não vaza nem entre parceiros —, mas
       * a folha da oferta e o `AvisoDoTrial` ANUNCIAM a porcentagem no
       * cliente. Se elas não souberem que a janela fechou, prometem um
       * desconto que este arquivo não vai gravar: o mesmo defeito que fez todo
       * contrato dizer "todo dia 10".
       *
       * Uma fonte, lida pelos dois lados. Falha na leitura mantém ABERTA:
       * desligar o desconto é um ato de alguém, nunca consequência de um
       * soluço de rede. */
      let janelaEscada = true;
      try {
        const pc = await db.doc('platformConfig/app').get();
        janelaEscada = pc.data()?.janelaEscada !== false;
      } catch (err) {
        logger.error('[contratacao] platformConfig não leu', { uid, err: String(err) });
      }

      const anteriores = Array.isArray(dados.descontos) ? dados.descontos : [];
      const eDeFechamento = (d) =>
        d?.origem === 'fechamento' || d?.origem === 'antecipacao';

      const jaTinha = anteriores.find(eDeFechamento);
      const degrau = jaTinha ? null : degrauDaDecisao(dados.trialInicio, agora);
      const fracao = degrau === null ? 0 : descontoDoDegrau(degrau);
      /* ⚠️ A JANELA SÓ TOCA EM QUEM GANHA AGORA — nunca em `jaTinha`.
       *
       * Essa linha é a janela inteira. Quem já tem o desconto é preservado
       * três linhas abaixo, num ramo que sequer consulta a régua: fechar a
       * janela não alcança ninguém para trás, nem por acidente. É a mesma
       * distinção que aposentou a condição de fundador — não conceder é
       * diferente de desfazer o que foi concedido —, e agora ela também está
       * escrita no contrato: "sem prazo enquanto este contrato estiver
       * vigente".
       *
       * Renovação e troca de plano passam por `jaTinha` e mantêm. */
      const ganhaAgora = !jaTinha && fracao > 0 && janelaEscada;

      const descontos = anteriores.filter((d) => !eDeFechamento(d));
      if (jaTinha) descontos.push(jaTinha);
      else if (ganhaAgora) {
        descontos.push({
          origem: 'fechamento',
          fracao,
          // ⚠️ `null` É O VITALÍCIO, E ELE PRECISA SER EXPLÍCITO.
          //
          // `descontosVigentes` trata `ate: null` como sem prazo e DESCARTA a
          // chave ausente — a distinção é estrita de propósito, porque as duas
          // falhas custam coisas diferentes: campo esquecido virando desconto
          // eterno vaza receita em silêncio; vitalício tratado como vencido
          // tira do motorista um desconto prometido. Escrever `null` é um ato
          // deliberado; esquecer a chave não é.
          ate: null,
          // O DEGRAU VAI GRAVADO junto da fração. A ficha do dono precisa
          // dizer QUAL degrau foi, e a fração sozinha não distingue 10% de
          // fechamento de 10% de concessão — que são espécies diferentes.
          degrau,
        });
      }

      // `assinaturaAte` VAI JUNTO, e e o campo que destrava a conta.
      //
      // Nunca REDUZ: quem ja esta coberto por um pagamento mais longo nao pode
      // perder cobertura por trocar de plano. `Math.max` de datas nao existe,
      // entao a comparacao e explicita.
      const jaCoberto = dados.assinaturaAte?.toDate?.() || null;
      const cobertura = cobertoAteOMesSeguinte(agora);

      await ref.set(
        {
          plano,
          // ⚠️ `limiteCriancas` NÃO É MAIS ESCRITO AQUI, e a ausência é a
          // mudança. Ele era gravado no MESMO write que a faixa, porque
          // separá-los abria a janela em que o motorista pagava uma faixa e
          // tinha o teto de outra. O teto saiu do modelo em 10/09/2026: nada
          // trava quando a operação cresce, e a fatura segue o número real de
          // crianças. Não há mais dois campos para manter coerentes.
          descontos,
          contratadoEm: agora,
          assinaturaAte:
            jaCoberto && jaCoberto > cobertura ? jaCoberto : cobertura,
        },
        { merge: true }
      );

      // ── O DIA DO VENCIMENTO, QUE O CONTRATO PRECISA DIZER ──────────────
      //
      // ⚠️ ELE VEM DAQUI PORQUE O MOTORISTA NÃO PODE LER `taxaConfig`.
      // A tela montava o contrato com `profile.diaVencimento` — um campo de
      // `users` que NINGUÉM NUNCA ESCREVEU. `limitarDiaVencimento(undefined)`
      // devolve o padrão, então **todo contrato assinado dizia "todo dia 10"**,
      // inclusive depois de o dono trocar o dia no painel: o documento
      // prometia uma data e a fatura vencia noutra.
      //
      // Não dá para a tela ler a config: `taxaConfig` é do DONO (a estrutura
      // de preço da plataforma não vaza nem entre parceiros), e é por isso que
      // o fechamento COPIA a chave PIX para dentro da fatura. Mesmo caminho
      // aqui — quem tem Admin SDK lê e devolve só o número.
      //
      // Falha na leitura cai no padrão em vez de derrubar a contratação: o
      // fechamento usa exatamente o mesmo `?? 10`, então o pior caso é o
      // contrato repetir o padrão, que é o comportamento de hoje.


      logger.info('[contratacao] plano contratado', {
        uid,
        plano,
        degrau,
        fracao,
      });

      return {
        plano,
        descontos,
        // A tela precisa saber se o desconto foi concedido AGORA, e QUAL foi,
        // para dizer isso à pessoa. Descobrir depois, na primeira fatura,
        // transforma um presente em desconfiança.
        // O DIA VEM DO SERVIDOR pelo mesmo motivo que a fração: o cliente
        // não alcança a fonte. Ver o bloco acima.
        diaVencimento,
        fechamento: ganhaAgora,
        degrau: ganhaAgora ? degrau : null,
        fracao: ganhaAgora ? fracao : 0,
      };
    }
  );
}

module.exports = {
  makeContratarPlano,
  ESCADA,
  RETORNO,
  MESES_DE_CONTRATO,
  dentroDoTrial,
  degrauDaDecisao,
  descontoDoDegrau,
  mesDaqui,
  cobertoAteOMesSeguinte,
};
