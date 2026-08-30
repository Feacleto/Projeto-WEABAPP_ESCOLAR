/**
 * TETOS DE INSTÂNCIA — quanto esta plataforma aceita gastar sob abuso.
 *
 * POR QUE ISTO EXISTE
 * Firebase não cai sob carga: ele ESCALA, e depois cobra. Sem
 * `maxInstances`, o teto de uma function é o teto da conta — e o alerta de
 * orçamento avisa, não desliga. Um laço contra um endpoint público não
 * derruba o app; ele chega como fatura no fim do mês.
 *
 * O risco não é hipotético num BaaS: quatro callables aqui respondem SEM
 * autenticação, porque precisam mesmo (a vitrine da home e a prévia do
 * convite acontecem antes de existir conta). Elas são a superfície que
 * qualquer um alcança com um `curl` em laço.
 *
 * O CRITÉRIO DOS NÚMEROS
 * Não é capacidade de pico — é quanto de dano cabe numa madrugada. Hoje a
 * plataforma tem um associado e dezenas de famílias; os tetos abaixo cobrem
 * uma ordem de grandeza acima disso e ainda assim limitam o estrago.
 *
 * Lembre que instância ≠ requisição: em Functions v2 cada instância atende
 * várias chamadas ao mesmo tempo (concorrência padrão de 80 nas HTTP). Então
 * `PUBLICO: 3` não é "três pessoas por vez" — é da ordem de duzentas
 * simultâneas, e um teto de custo bem abaixo do que uma conta sem limite
 * aceitaria.
 *
 * QUANDO SUBIR
 * Quando a fila aparecer no log como `429` para gente de verdade. Subir por
 * precaução devolve exatamente o que estes números existem pra tirar.
 *
 * O QUE ISTO NÃO É
 * Não é App Check. O App Check é que responde "esta chamada veio do meu app?",
 * e é o próximo passo — mas ele exige registro no console do Firebase ANTES,
 * e `enforceAppCheck` ligado sem esse registro derruba o app inteiro. Estes
 * tetos limitam o dano de quem passa; o App Check é quem impede de passar.
 */

/**
 * Callable PÚBLICA — responde sem autenticação.
 *
 * O teto mais apertado, e a razão é `getInvitePreview`: ela lê a criança, os
 * pagamentos em aberto e conta os recados a CADA chamada. Um laço contra ela
 * não vaza nada (o retorno é curado), mas multiplica leitura de Firestore
 * indefinidamente — o custo é por leitura, e ninguém precisa de senha pra
 * disparar.
 */
const PUBLICO = 3;

/**
 * Callable que exige login.
 *
 * Mais folgada porque o atacante precisa primeiro de uma conta, e conta neste
 * app não se cria sozinha: responsável só nasce por `redeemInvite`, motorista
 * passa por aprovação. Isso não a torna segura — torna o abuso rastreável até
 * um uid, que é o que muda a resposta de "bloquear tudo" pra "bloquear ele".
 */
const AUTENTICADO = 5;

/**
 * Gatilho do Firestore.
 *
 * Mais alto que os outros de propósito: aqui a vazão não é escolha da
 * plataforma, é consequência do que os usuários escrevem. Segurar demais não
 * economiza — atrasa. E o que atrasa é `sendPushOnNotification`, ou seja, o
 * aviso de que a perua está chegando, que perde o sentido cinco minutos
 * depois.
 *
 * O disparo continua limitado pelo que as rules deixam escrever, então o teto
 * de abuso já está uma camada antes.
 */
const GATILHO = 10;

/**
 * Função agendada.
 *
 * UM, e o motivo não é custo — é correção. Estas rodam sozinhas e mexem em
 * dinheiro (gerar mensalidade, mandar cobrança) ou em estado de operação
 * (fechar rota esquecida). Duas execuções ao mesmo tempo, vindas de um retry
 * sobre um commit parcial, é exatamente o cenário de cobrança duplicada que o
 * id determinístico de `payments/{criança}_{mês}` foi criado pra impedir.
 *
 * Teto de 1 faz a segunda esperar em vez de correr junto. Cinto, além do
 * suspensório que já existe no id.
 */
const AGENDADO = 1;

module.exports = { PUBLICO, AUTENTICADO, GATILHO, AGENDADO };
