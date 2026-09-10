/**
 * O COLEGA SE CADASTROU — e quem indicou fica sabendo no mesmo dia.
 *
 * ── ⚠️ O BURACO QUE ISTO FECHA
 * `ESTADO.CADASTRADO` existia no domínio desde 06/09/2026: tinha frase pronta
 * em `situacaoDaIndicacao` (*"se cadastrou — vale quando pagar o primeiro
 * mês"*), era contado em `resumoDoIndicador` e renderizado na tela do
 * motorista **e** na do dono. **E nenhum caminho do projeto o gravava.**
 *
 * A indicação ia de `pendente` direto a `ativa`, na baixa da primeira fatura
 * do indicado. Isso é certo para o DINHEIRO — `escolherParaAtivar` casa pelo
 * telefone a partir de `pendente`, então ninguém perdia desconto. O buraco
 * era de FEEDBACK, e ele durava o teste inteiro do indicado mais um mês:
 *
 *   dia 5    ele indica
 *   dia 12   o colega se cadastra          ← a tela dele continua dizendo
 *   dia 30   o colega contrata               "ainda não se cadastrou"
 *   dia 125  o colega paga a 1ª fatura      ← só aqui alguma coisa muda
 *
 * Quatro meses vendo "pendente" depois de o colega já ter entrado. **É ali
 * que ele para de acreditar** — e a queixa que nasce daí, *"indiquei e não
 * recebi"*, é a mesma que a coleção `indicacoes` inteira existe para evitar.
 *
 * ── POR QUE UM GATILHO, E NÃO UMA CHAMADA DO CADASTRO
 * `inscreverAssociado` roda no CLIENTE. Para casar ali, o motorista recém
 * criado precisaria consultar `indicacoes` por `chave` — e uma consulta por
 * telefone **não é escopada por dono**: abrir esse `list` entregaria a
 * qualquer motorista os telefones que a base inteira indicou. É a mesma razão
 * pela qual o casamento do dinheiro acontece do lado do dono, na baixa.
 *
 * O gatilho resolve sem abrir nada: roda com Admin SDK quando o documento
 * nasce, não depende de o cliente lembrar de chamar, e **não pode ser
 * forjado** — ninguém dispara `onDocumentCreated` de fora.
 *
 * ── ⚠️ ELE NÃO ATIVA NADA, E ISSO É A CARÊNCIA
 * `cadastrado` não vale desconto. O desconto continua entrando só quando o
 * indicado PAGA — sem isso, cinco cadastros de teste dariam desconto real
 * sobre receita que nunca entrou. Este arquivo move o estado e conta a
 * novidade; quem move o dinheiro é `casarIndicacao.js`, na baixa da fatura.
 *
 * ── E O AVISO É `fato`, NÃO `oferta`
 * É uma coisa que aconteceu com uma indicação DELE, não a plataforma pedindo
 * algo. Por isso ele não pode ser desligado nas preferências — e por isso o
 * tipo está classificado como `fato` em `avisos.js`.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const {
  ESTADO,
  chaveDoTelefone,
  // ⚠️ A ESCOLHA É RÉGUA E MORA NO MÓDULO PURO. Ela nasceu aqui dentro e
  // `testar:imports` derrubou a bateria: este arquivo requer o SDK, e o
  // teste de indicação não pode alcançá-lo num checkout limpo.
  escolherParaCadastrar,
} = require('./indicacao');

const REGION = 'southamerica-east1';

function makeCasarNoCadastro(db) {
  return onDocumentCreated(
    {
      document: 'users/{uid}',
      region: REGION,
      maxInstances: LIMITES.GATILHO,
    },
    async (event) => {
      const novo = event.data && event.data.data();
      if (!novo) return;

      // Só motorista é indicado. A responsável entra por convite de criança,
      // e o telefone dela não tem nada a ver com a rede de indicação.
      if (novo.role !== 'admin') return;

      const chave = chaveDoTelefone(novo.phone);
      if (!chave) return;

      const indicadoUid = event.params.uid;

      try {
        // ⚠️ LÊ A COLEÇÃO INTEIRA, e é deliberado: uma consulta `where('chave',
        // '==', …)` seria mais barata e exigiria um índice, e o volume aqui é
        // de indicações da base toda — dezenas, não milhares. Quando passar
        // disso, o índice entra; hoje ele seria complexidade sem ganho.
        const snap = await db.collection('indicacoes').get();
        const indicacoes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const escolhida = escolherParaCadastrar(indicacoes, { indicadoUid, chave });
        if (!escolhida) return;

        // Os dois writes no MESMO lote: o estado da indicação e o aviso ao
        // indicador. Separados, existiria a indicação marcada que ninguém
        // soube — que é o silêncio que este arquivo veio acabar.
        const lote = db.batch();
        lote.update(db.doc(`indicacoes/${escolhida.id}`), {
          estado: ESTADO.CADASTRADO,
          indicadoUid,
          cadastradoEm: FieldValue.serverTimestamp(),
        });

        const nome = String(escolhida.nome || '').trim().split(/\s+/)[0];
        lote.set(db.collection('notifications').doc(), {
          userId: escolhida.indicadorUid,
          type: 'indicacao_cadastrou',
          // O título diz o que aconteceu; o corpo diz o que FALTA. "Cadastrou"
          // sozinho parece que já deu certo, e o desconto não veio — é aí que
          // nasce a reclamação.
          title: nome ? `${nome} criou a conta` : 'Sua indicação criou a conta',
          body: 'O desconto entra quando ele pagar a primeira mensalidade.',
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        await lote.commit();
        logger.info('[indicacao] cadastrada', {
          indicacao: escolhida.id,
          indicador: escolhida.indicadorUid,
          indicado: indicadoUid,
        });
      } catch (err) {
        // ⚠️ ENGOLE, E É DECIDIDO. Isto roda no gatilho de criação do
        // documento do motorista — o gesto mais crítico do produto, o único
        // que já deixou alguém preso numa sessão sem conta. O feedback de uma
        // indicação de terceiro não pode fazer barulho nesse caminho.
        //
        // E não se perde nada: `escolherParaAtivar` casa a partir de
        // `pendente` na baixa da fatura, então o DINHEIRO continua chegando
        // mesmo que este gatilho nunca tenha rodado.
        logger.warn('[indicacao] não deu pra casar no cadastro', {
          uid: indicadoUid,
          motivo: err && err.message,
        });
      }
    }
  );
}

module.exports = { makeCasarNoCadastro };
