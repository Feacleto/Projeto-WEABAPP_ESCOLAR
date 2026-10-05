import {
  collection,
  getAggregateFromServer,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  sum,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { notasPorMotorista, resumirCarteira } from '../dominio/associacao/carteira.js';
import { contarPorCanal } from '../dominio/identidade/origem.js';
import { linhasDosAssinantes, retratoDaBase } from '../dominio/associacao/retratoDaBase.js';
import { criarCacheComValidade } from '../compartilhado/cacheComValidade.js';
import { addMonths } from '../compartilhado/formatters.js';
import { parceirosDoDono } from './userService';

/**
 * Métricas da plataforma pro painel do super-admin.
 *
 * POR QUE AGREGAÇÃO NO SERVIDOR
 * `getCountFromServer` e `getAggregateFromServer` contam e somam SEM baixar
 * os documentos: custo de leitura irrisório e nenhum dado de criança
 * trafegando pra montar um número. Quando a base crescer, a conta continua
 * sendo uma chamada — baixar `payments` inteiro pra somar no cliente é o
 * tipo de coisa que funciona com 18 crianças e derruba a tela com 1.800.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 * Não inventa receita. A receita própria sai de `faturasParceiro` QUITADA —
 * taxa de associação que o motorista já pagou —, no mesmo critério do GMV,
 * que soma `payments` com status `paid`. Os dois números medem dinheiro que
 * entrou, e não dinheiro combinado; misturar os critérios faria uma linha
 * parecer maior que a outra por razão de contabilidade, não de negócio.
 *
 * Fatura ABERTA vem separada (`receitaEmAberto`) e nunca somada na primeira.
 * Ela é a distância entre faturar e receber — o número que diz se a cobrança
 * está funcionando —, e embutir na receita seria antecipar caixa que não
 * caiu. É a mesma linha que separa `claimed` de `paid` do lado do pai.
 *
 * GMV continua sendo outra coisa: o dinheiro que passou entre pai e motorista,
 * que a plataforma não toca. Confundir os dois é o erro clássico de valuation
 * de marketplace.
 *
 * SEGURANÇA
 * As leituras de `users`, `children`, `payments` e `waitlistDrivers` já são
 * permitidas pelas rules a quem tem role `admin`. `faturasParceiro` NÃO é:
 * ela pede `isOwner()`, e um motorista que chegasse aqui teria a agregação
 * negada — `somaCampo` engole e devolve `null`, então ele veria "—" em vez
 * de erro. Nenhuma porta se abre por causa disso; o módulo continua só
 * organizando o que o chamador já podia ler.
 *
 * O gate de super-admin na tela é de PRODUTO (esconder o negócio de quem não
 * é dono), não de segurança. Segurança de verdade exige custom claim + rules
 * dedicadas: está no brief de arquitetura.
 */

/**
 * Soma um campo numérico da coleção NO SERVIDOR — e, se não der, diz que não
 * sabe.
 *
 * ⚠️ O PLANO B QUE MORAVA AQUI SAIU EM 03/10/2026. Quando a agregação falhava
 * (índice faltando, emulador antigo, rede), ele lia os documentos da MESMA
 * consulta e somava no navegador. Em `payments where status == 'paid'` isso é
 * baixar todo pagamento já quitado da plataforma — 36 mil por ano no tamanho
 * que o plano mira — para mostrar UM número, e justamente no dia em que algo
 * já estava errado.
 *
 * Agora a falha devolve `null`, e a tela escreve "—": onde o número não existe,
 * a tela não inventa (nem zero, que pareceria medição).
 */
async function somaCampo(q, campo) {
  try {
    const snap = await getAggregateFromServer(q, { total: sum(campo) });
    return Number(snap.data().total || 0);
  } catch (err) {
    console.error(`[admin] a soma de ${campo} não veio do servidor:`, err);
    return null;
  }
}

async function conta(q) {
  try {
    return (await getCountFromServer(q)).data().count || 0;
  } catch {
    return 0;
  }
}


/** YYYY-MM do mês corrente, no mesmo formato do campo `month` de payments. */
export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Visão geral da plataforma.
 *
 * ── ELA MEDIA O FUNIL ANTIGO ATÉ 06/09/2026
 * Tamanho da base e dinheiro que passou pelo app. Nenhum dos dois diz como o
 * negócio vai: GMV é o dinheiro da família para o motorista, e a plataforma
 * não está no caminho dele. Continua aqui porque é o tamanho da operação que o
 * produto sustenta — mas não é receita, e o painel não deixa confundir.
 *
 * O que entrou junto é a CARTEIRA: em que degrau cada associado está e quanto
 * entra por mês. Ver `dominio/associacao/carteira.js`, que faz a conta e é
 * testado sem Firebase.
 *
 * ⚠️ A CONTAGEM DA FILA SAIU, E ELA ESTAVA QUEBRANDO ESTA TELA INTEIRA.
 * `conta(query(collection(db, 'waitlistDrivers')))` continuou aqui depois de a
 * coleção sair das rules na fase 2 — a consulta passou a ser negada, o
 * `Promise.all` rejeitava, e a Visão geral caía no estado de erro. Um número
 * que ninguém mais olhava derrubando três que todo mundo olha.
 *
 * ── UMA LEITURA DOS PARCEIROS, NÃO CINCO CONTAGENS
 * A carteira precisa dos documentos (faixa, descontos, início do teste), não
 * de contagens. Como são um por associado — dezenas, não milhares —, ler a
 * lista uma vez sai mais barato que as contagens que ela substitui.
 */
export async function getPlatformOverview() {
  const users = collection(db, 'users');
  const children = collection(db, 'children');
  const payments = collection(db, 'payments');
  const faturas = collection(db, 'faturasParceiro');

  const [
    usuarios,
    parceiros,
    responsaveis,
    criancas,
    gmvTotal,
    gmvMes,
    receitaPropria,
    receitaEmAberto,
  ] = await Promise.all([
    conta(query(users)),
    // OS DOCUMENTOS, não a contagem: a carteira precisa da faixa e dos
    // descontos de cada um. O dono, que tem papel próprio (`role: 'owner'`),
    // não entra nesta lista nem precisa ser descontado.
    //
    // A MESMA LEITURA da carteira e da aba Mês (`parceirosDoDono`, com cache):
    // eram três consultas iguais na abertura do painel.
    parceirosDoDono(),
    conta(query(users, where('role', '==', 'parent'))),
    conta(query(children, where('active', '==', true))),
    somaCampo(query(payments, where('status', '==', 'paid')), 'amount'),
    somaCampo(
      query(
        payments,
        where('status', '==', 'paid'),
        where('month', '==', mesAtual())
      ),
      'amount'
    ),
    // A TAXA DE ASSOCIAÇÃO QUE JÁ ENTROU — a receita de verdade da plataforma.
    // `quitada` é o dono ter dado baixa depois do PIX cair; não há gateway
    // que confirme por conta própria.
    somaCampo(query(faturas, where('status', '==', 'quitada')), 'total'),
    // Faturada e não recebida. Fica SEPARADA — ver o cabeçalho.
    somaCampo(query(faturas, where('status', '==', 'aberta')), 'total'),
  ]);

  const carteira = resumirCarteira({
    parceiros,
    agora: new Date(),
    mes: mesAtual(),
  });

  return {
    usuarios,
    motoristas: parceiros.length,
    responsaveis,
    criancas,
    carteira,
    gmvTotal,
    gmvMes,
    // Mensalidade média por criança ativa no mês — a base de qualquer conta
    // de take rate futura.
    // `null` quando o GMV do mês não veio: média de um número desconhecido
    // também é desconhecida.
    ticketMedio: gmvMes === null ? null : criancas > 0 ? gmvMes / criancas : 0,
    receitaPropria,
    receitaEmAberto,
    // DE ONDE VÊM OS ASSOCIADOS — e não custa leitura nova: `parceiros` já
    // são os documentos inteiros, baixados acima para a carteira. A conta é
    // pura, em `dominio/identidade/origem.js`.
    //
    // ⚠️ `null` com base vazia, de propósito: onde o número não existe a tela
    // diz "—", nunca zero. Dez canais zerados parecem medição e não são.
    origens: contarPorCanal(parceiros),
  };
}

/**
 * O RETRATO DA BASE — o Hoje e o Financeiro com a cobrança desligada.
 *
 * TRÊS CONTAGENS NO SERVIDOR e a lista de motoristas que já está no cache
 * (`parceirosDoDono`). Nenhum documento de criança ou de pagamento vem para o
 * navegador: crianças com família é `count()` de `inviteStatus == 'used'` (o
 * link, o irmão e o pedido de acesso gravam o mesmo valor), e as baixas do mês
 * são a MESMA consulta do GMV do mês, contada em vez de somada.
 *
 * Contagem que falha vem `null`, não zero — a tela escreve "—". A conta mora
 * em `dominio/associacao/retratoDaBase.js` (`npm run testar:retrato`).
 */
async function contaOuNada(q) {
  try {
    return (await getCountFromServer(q)).data().count || 0;
  } catch (err) {
    console.error('[admin] contagem do retrato não veio:', err);
    return null;
  }
}

// Hoje e Financeiro leem o mesmo retrato, e as abas desmontam ao trocar: sem
// cache, cada toque na barra refaria as três contagens.
const cacheDoRetrato = criarCacheComValidade({ validadeMs: 90 * 1000 });

export function getRetratoDaBase({ forcar = false } = {}) {
  return cacheDoRetrato.obter(() => buscarRetrato({ forcar }), { forcar });
}

/**
 * QUEM ACEITOU A VERSÃO ATUAL DOS TERMOS — duas contagens, nenhuma lista.
 * `total` exclui o dono só por não filtrar por papel: a diferença de uma ou
 * duas contas não muda a leitura, e filtrar por três papéis custaria três
 * consultas. `null` quando a contagem não veio.
 */
export async function getAceitesDosTermos(versao) {
  const users = collection(db, 'users');
  const [total, naVersao] = await Promise.all([
    contaOuNada(query(users)),
    contaOuNada(query(users, where('termsVersion', '==', versao))),
  ]);
  return { total, naVersao };
}

/**
 * AS FOTOS DIÁRIAS DA BASE, para o gráfico de evolução do Hoje.
 *
 * Um documento por dia, gravado pela agendada `fotografarBase` às 23h50 de
 * Brasília (functions/lib/fotoDaBase.js); só números. O teto é de 120 dias —
 * as 16 semanas do gráfico com folga — e a ordem é pelo campo `dia`, índice
 * simples automático. Falha devolve lista vazia: o gráfico diz que ainda não
 * há fotos em vez de derrubar o Hoje.
 */
export const DIAS_DE_FOTO_NO_PAINEL = 120;

export async function getFotosDaBase() {
  try {
    const snap = await getDocs(
      query(collection(db, 'fotosDaBase'), orderBy('dia', 'desc'), limit(DIAS_DE_FOTO_NO_PAINEL))
    );
    return snap.docs.map((d) => d.data());
  } catch (err) {
    console.error('[admin] as fotos da base não vieram:', err);
    return [];
  }
}

async function buscarRetrato({ forcar }) {
  const children = collection(db, 'children');
  const [parceiros, criancasAtivas, criancasComFamilia, baixasNoMes] = await Promise.all([
    parceirosDoDono({ forcar }),
    contaOuNada(query(children, where('active', '==', true))),
    contaOuNada(
      query(children, where('active', '==', true), where('inviteStatus', '==', 'used'))
    ),
    contaOuNada(
      query(
        collection(db, 'payments'),
        where('status', '==', 'paid'),
        where('month', '==', mesAtual())
      )
    ),
  ]);

  const agora = new Date();
  const mes = mesAtual();
  return {
    retrato: retratoDaBase({
      parceiros,
      agora,
      mes,
      criancasAtivas,
      criancasComFamilia,
      baixasNoMes,
    }),
    assinantes: linhasDosAssinantes({ parceiros, agora, mes }),
  };
}

/**
 * ⚠️ AS ÚLTIMAS AVALIAÇÕES SÃO UMA LEITURA SÓ PARA O PAINEL (03/10/2026).
 *
 * A pesquisa (`getSurveyResults`) e a nota por motorista (`carregarConsole`)
 * liam, cada uma, as mesmas 500 avaliações mais recentes — duas consultas
 * iguais na abertura, e a segunda de novo a cada troca de aba. Agora pedem ao
 * mesmo cache, com a mesma validade da lista de motoristas.
 */
export const MAX_AVALIACOES = 500;
const VALIDADE_DAS_AVALIACOES = 90 * 1000;
const cacheDasAvaliacoes = criarCacheComValidade({ validadeMs: VALIDADE_DAS_AVALIACOES });

function avaliacoesRecentes({ forcar = false } = {}) {
  return cacheDasAvaliacoes.obter(
    () =>
      getDocs(
        query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(MAX_AVALIACOES))
      ).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    { forcar }
  );
}

/**
 * Resultado da pesquisa de satisfação — o que o app faz com as avaliações
 * que NÃO vão pra home (as de responsável) e com as respostas de métrica.
 *
 * Lê até `max` feedbacks e agrega no cliente: são poucas centenas de
 * documentos pequenos, e agregar aqui evita criar índice pra cada corte que a
 * gente vai querer olhar.
 *
 * SÓ O DONO CONSEGUE. O comentário aqui dizia "o admin tem list liberado nas
 * rules" — e `admin`, neste projeto, é o MOTORISTA. A frase estava certa sobre
 * a rule e errada sobre quem: qualquer parceiro varria as avaliações de toda a
 * plataforma, com `uid` e papel de quem escreveu, incluindo as das famílias
 * dos concorrentes.
 *
 * O ramo `isAdmin()` do `allow list` de `feedbacks` saiu em 30/08/2026
 * (decisão 12). Esta função continua funcionando porque o único chamador dela
 * é o `AdminPanel`, e quem abre aquela tela é o dono — que passa por
 * `isOwner()`. Se um dia ela for chamada de uma tela de motorista, vai receber
 * `permission-denied`, e o certo é essa tela não existir.
 */
export async function getSurveyResults({ forcar = false } = {}) {
  const avaliacoes = await avaliacoesRecentes({ forcar });

  const base = {
    total: 0,
    // Os quatro papéis da avaliação rápida (dominio/suporte/avaliacaoRapida.js):
    // os dois sem conta chegam pelo link do acompanhamento.
    porPapel: {
      admin: { n: 0, soma: 0 },
      parent: { n: 0, soma: 0 },
      acompanhante: { n: 0, soma: 0 },
      segundo_responsavel: { n: 0, soma: 0 },
    },
    estrelas: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    usos: {},
    desejos: {},
    publicados: 0,
    comentarios: [],
  };

  for (const d of avaliacoes) {
    const nota = Number(d?.answers?.rating || 0);
    const papel = base.porPapel[d.role] ? d.role : 'parent';

    base.total += 1;
    if (nota >= 1 && nota <= 5) {
      base.estrelas[nota] += 1;
      base.porPapel[papel].n += 1;
      base.porPapel[papel].soma += nota;
    }
    for (const u of d?.answers?.uses || []) {
      base.usos[u] = (base.usos[u] || 0) + 1;
    }
    const w = d?.answers?.wish;
    if (w) base.desejos[w] = (base.desejos[w] || 0) + 1;
    // "Publicado" é AUTORIZADO e LIBERADO pelo dono: desde 03/10/2026 o
    // depoimento nasce escondido, e autorizado sozinho não aparece na home.
    if (d.allowTestimonial && d.hiddenByOwner === false) base.publicados += 1;

    const texto = (d.comment || '').trim();
    if (texto && base.comentarios.length < 40) {
      base.comentarios.push({
        id: d.id,
        texto,
        nota,
        papel,
        nome: (d.authorName || '').split(' ')[0] || null,
        publico: !!d.allowTestimonial,
        // Ausente conta como escondido: o documento antigo nasceu com
        // `false` explícito, e só o que a vitrine alcança está na home.
        naHome: !!d.allowTestimonial && d.hiddenByOwner === false,
        em: d.createdAt?.toDate?.() || null,
      });
    }
  }

  const media = (p) => (p.n > 0 ? p.soma / p.n : 0);
  const promotores = base.estrelas[4] + base.estrelas[5];
  const respondentes = Object.values(base.estrelas).reduce((a, b) => a + b, 0);

  return {
    ...base,
    mediaGeral: respondentes > 0
      ? (base.estrelas[1] +
          base.estrelas[2] * 2 +
          base.estrelas[3] * 3 +
          base.estrelas[4] * 4 +
          base.estrelas[5] * 5) /
        respondentes
      : 0,
    mediaMotorista: media(base.porPapel.admin),
    mediaResponsavel: media(base.porPapel.parent),
    // Quem acompanhou pelo link — acompanhante do dia e segundo responsável
    // juntos: os dois veem a mesma página.
    mediaPeloLink: media({
      n: base.porPapel.acompanhante.n + base.porPapel.segundo_responsavel.n,
      soma: base.porPapel.acompanhante.soma + base.porPapel.segundo_responsavel.soma,
    }),
    // % de quem deu 4 ou 5 — o proxy de recomendação mais honesto que dá
    // pra extrair de uma escala de estrelas (não é NPS, e não vamos chamar
    // de NPS: NPS tem outra pergunta e outra escala).
    satisfeitos: respondentes > 0 ? promotores / respondentes : 0,
    respondentes,
  };
}

/**
 * O QUE A ABA MOTORISTAS PRECISA — três listas, uma vez.
 *
 * Parceiros, responsáveis e avaliações. Os responsáveis entram porque
 * `feedbacks` NÃO guarda `adminUid`: quem sabe a que motorista uma família
 * pertence é o documento dela (`users.adminUid`), e a nota por motorista só
 * existe cruzando as duas listas. Ver `notasPorMotorista` em `carteira.js`.
 *
 * QUATRO CONSULTAS NA ABERTURA DA ABA, e não uma por ficha. Com dezenas de
 * associados, carregar tudo de uma vez e filtrar em memória é mais barato — e,
 * mais importante, deixa a lista responder ao toque sem esperar rede.
 *
 * ── AS FATURAS VÊM JUNTO PORQUE O TERMÔMETRO PRECISA DELAS
 * `risco.js` decide por quatro sinais, e dois moram em `faturasParceiro`: a
 * fatura vencida e a série de `criancasAtivas` que revela encolhimento. Sem a
 * lista inteira aqui, o termômetro da LISTA sairia mais fraco que o da FICHA —
 * e o mesmo motorista apareceria em dois níveis diferentes na mesma tela.
 *
 * ⚠️ ERA a coleção INTEIRA — uma fatura por associado por mês, para sempre.
 * Desde 03/10/2026 são os últimos 12 meses (`primeiroMesDaJanela`, abaixo). A
 * ficha continua assinando TODAS as faturas de um motorista só, que é a
 * leitura que cabe abrir uma por vez.
 *
 * ⚠️ Isto NÃO carrega crianças. O contador `users.criancasAtivas` já responde
 * o tamanho de cada operação, e foi por precisar da soma das mensalidades que
 * a versão antiga desta tela varria `children` inteira — trazendo endereço,
 * escola e telefone de família para o navegador do dono. Não repita.
 *
 * ── ⚠️ ELA É CACHEADA, E O CACHE NASCEU DE UM PROBLEMA REAL
 * QUATRO abas consomem esta função — Hoje, Motoristas, Selos e Indicações — e
 * elas DESMONTAM ao trocar de aba. Sem cache, cada toque na barra relia a base
 * de usuários inteira, 500 avaliações e toda a `faturasParceiro`: o painel
 * ficava mais lento quanto mais o dono trabalhasse nele, que é o oposto do que
 * uma ferramenta de mesa deve fazer.
 *
 * O cache é de 90 segundos e guarda a PROMESSA, não o resultado — duas abas
 * montando ao mesmo tempo compartilham a mesma ida ao banco em vez de fazerem
 * duas (`compartilhado/cacheComValidade.js`).
 *
 * ⚠️ QUEM ACABOU DE ESCREVER PASSA `forcar: true`. Ler cache depois de
 * suspender um parceiro ou conceder um desconto mostraria a tela contradizendo
 * a ação que a pessoa acabou de fazer — e ela repetiria a ação.
 */
//
// ── ⚠️ DESDE 03/10/2026 AS PEÇAS TÊM CACHE PRÓPRIO, E ESTE É SÓ A JUNÇÃO
// A lista de motoristas (`parceirosDoDono`) e as avaliações
// (`avaliacoesRecentes`) são as MESMAS que a visão geral e a pesquisa leem, e
// vivem num cache só. `forcar` atravessa até elas: quem acabou de escrever
// relê a lista de motoristas também, não só a junção. A validade subiu para
// 90 segundos junto com as peças — mais curta que elas, a junção seria
// remontada sobre as mesmas peças guardadas, sem ganho nenhum.
const VALIDADE_DO_CACHE = 90 * 1000;
const cacheDoConsole = criarCacheComValidade({ validadeMs: VALIDADE_DO_CACHE });

/**
 * ⚠️ A JANELA DAS FATURAS É DE 12 MESES (03/10/2026). Era a coleção inteira —
 * uma fatura por motorista por mês, para sempre. O termômetro olha a fatura
 * vencida e a série de `criancasAtivas`; um ano de série responde as duas
 * perguntas, e fatura vencida há mais de um ano já virou conta bloqueada,
 * que é outro sinal.
 *
 * `mes` é 'AAAA-MM' e se compara como texto. Filtro de faixa num campo só usa
 * o índice simples automático — nenhum índice composto.
 */
export const MESES_DE_FATURA_NO_CONSOLE = 12;

export function primeiroMesDaJanela(mes, meses = MESES_DE_FATURA_NO_CONSOLE) {
  return addMonths(mes, -(meses - 1));
}

export function carregarConsole({ forcar = false } = {}) {
  return cacheDoConsole.obter(() => buscarConsole({ forcar }), { forcar });
}

async function buscarConsole({ forcar }) {
  const users = collection(db, 'users');

  const [parceiros, responsaveis, avaliacoes, faturas, condicoes] = await Promise.all([
    parceirosDoDono({ forcar }),
    getDocs(query(users, where('role', '==', 'parent'))).then((s) =>
      s.docs.map((d) => ({ uid: d.id, ...d.data() }))
    ),
    avaliacoesRecentes({ forcar })
      // A vitrine degrada calada e esta também: sem avaliação, a ficha mostra
      // "sem avaliações" em vez de a aba inteira cair.
      .catch(() => []),
    getDocs(
      query(
        collection(db, 'faturasParceiro'),
        where('mes', '>=', primeiroMesDaJanela(mesAtual()))
      )
    )
      .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
      // Mesma degradação: sem fatura o termômetro perde dois sinais e mantém
      // os outros dois, em vez de a aba não abrir.
      .catch(() => []),
    // ⚠️ AS CONCESSÕES VÊM DE `taxaParceiros`, E NÃO DE `users`.
    //
    // Elas moravam no doc do motorista, que as FAMÍLIAS dele leem — e o
    // `motivo` é texto livre que o dono escreve sobre ele. Regra do Firestore
    // não esconde campo, então o registro inteiro ia junto com a chave PIX.
    // Saíram em 11/09/2026 para a coleção que já era só do dono.
    //
    // Uma consulta a mais para o DONO, na abertura da aba. Nenhuma para as
    // outras duas pontas.
    getDocs(collection(db, 'taxaParceiros'))
      .then((s) => s.docs.map((d) => ({ uid: d.id, ...d.data() })))
      .catch(() => []),
  ]);

  // Agrupadas por parceiro aqui, e não na tela: quem consome é o termômetro,
  // que recebe a lista de UM motorista por vez.
  const faturasPorParceiro = {};
  faturas.forEach((f) => {
    if (!f?.tioUid) return;
    (faturasPorParceiro[f.tioUid] ||= []).push(f);
  });

  // A concessão volta para o objeto do parceiro, que é como o painel inteiro
  // já a consome (`resumirConcessoes`, `condicoesVigentes`). A junção acontece
  // aqui, uma vez, e não em cada tela.
  //
  // `?? p.concessoes` é a ponte para o que foi concedido ANTES da mudança —
  // some sozinho quando aquela concessão for revista.
  const registroPorParceiro = {};
  condicoes.forEach((c) => {
    if (c?.uid) registroPorParceiro[c.uid] = c;
  });

  return {
    parceiros: parceiros.map((p) => ({
      ...p,
      concessoes: registroPorParceiro[p.uid]?.concessoes ?? p.concessoes,
    })),
    notas: notasPorMotorista(avaliacoes, responsaveis),
    // A fila do dia transforma nota baixa de motorista em conversa.
    avaliacoes,
    faturas: faturasPorParceiro,
  };
}

/**
 * O GMV de UM parceiro — o tamanho da operação dele, em dinheiro.
 *
 * Não é receita da plataforma: é o que passou entre as famílias dele e ele. Na
 * ficha ele diz uma coisa útil que nenhum outro número diz — se a operação é
 * grande ou pequena em reais, e não só em crianças.
 *
 * Sob demanda, ao abrir a ficha. Carregar isso para todo mundo na abertura da
 * aba seria somar a base inteira de pagamentos para mostrar um número por vez.
 */
export async function gmvDoParceiro(uid) {
  if (!uid) return null;
  try {
    return await somaCampo(
      query(
        collection(db, 'payments'),
        where('adminUid', '==', uid),
        where('status', '==', 'paid')
      ),
      'amount'
    );
  } catch (err) {
    // Índice faltando ou consulta negada: a ficha mostra "—" em vez de sumir.
    console.error('[admin] GMV do parceiro não carregou:', err);
    return null;
  }
}
