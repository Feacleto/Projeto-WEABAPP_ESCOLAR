import {
  DEV_CIDADE_UF,
  DEV_CNPJ,
  DEV_COMARCA,
  DEV_ENDERECO,
  DEV_NAME,
  DEV_RAZAO_SOCIAL,
  DEV_TIPO_EMPRESA,
} from '../../config/developer.js';

/**
 * Conteúdo dos textos legais — fonte única.
 * Versão semântica: incrementar quando houver mudança material; obriga
 * o usuário a aceitar de novo (via TermsGate).
 *
 * ── 1.1 (09/09/2026): O CONTROLADOR PASSOU A SER IDENTIFICADO
 * A versão 1.0 dizia apenas "Alô Buzinou", sem razão social e sem CNPJ,
 * enquanto o contrato de associação era assinado por "Desenvolva Algo" e a
 * landing publicava o CNPJ. A mesma pessoa aceitava documentos que nomeavam
 * partes diferentes, e a cláusula de foro elegia "a sede do controlador" sem
 * dizer qual era.
 *
 * Mudou também: a seção 2b (com quem os dados são compartilhados) passou a
 * existir — Resend e Asaas recebem dado pessoal e não estavam declarados, e um
 * deles é internacional, com nome de criança no corpo do e-mail; e a seção 8
 * passou a descrever o que o código faz com o registro de mensalidades.
 *
 * ⚠️ SUBIR ESTA VERSÃO OBRIGA TODO MUNDO A ACEITAR DE NOVO. Feito agora, com
 * a base quase zero, custa uma conversa; com trinta associados custaria
 * trinta. É o argumento que `docs/pendencias.md` já registrava, e por isso o
 * momento é este.
 *
 * O endereço da sede está completo desde 05/10/2026 (número 61, em
 * `DEV_NUMERO`), e a parte passou a ser identificada pela razão social do MEI,
 * não pelo nome fantasia. Ver `COMPANY_INFO`.
 */
export const LEGAL_VERSION = '1.4';
export const LEGAL_DATE = '5 de outubro de 2026';

/*
 * ── 1.4 (04/10/2026, aprovado pelo dono): O POSTO DE COMBUSTÍVEL. A tela de
 * abastecer pergunta "Você está no posto agora?" e, com "Sim", lê a posição
 * UMA vez para anotar o endereço e o ponto do POSTO na lista de postos do
 * motorista (só ele lê) e reconhecer o posto da próxima vez. Era o primeiro
 * uso fora da rota, e a cláusula 8 dizia "nem fora da rota": promessa escrita
 * que o código passaria a quebrar. A cláusula, a base legal (5.c) e a
 * retenção dizem isso agora. ⚠️ O texto da saúde (1.3) continua sendo o
 * rascunho que espera a revisão jurídica.
 * Na mesma 1.4, ainda antes de publicar (aprovado pelo dono), a cláusula 8
 * passou a listar TODAS as leituras únicas fora da rota: a cidade do
 * primeiro acesso e o "Usar minha localização" do seletor de mapa já
 * existiam sem frase, e o "Estou na escola agora" é o da Carteira. Com um
 * uso só escrito, a frase "há um único uso" era falsa no dia em que nasceu.
 * E a FOTO DA TURMA (05/10/2026, aprovada pelo dono): a imagem da criança
 * só com o "Sim" do responsável (seção 4, base legal 5.g, retenção de 30
 * dias). Também antes de publicar a 1.4. E a NOTA DO TIO (etapa 2): só a
 * família avalia, e o tio vê só a média do semestre fechado (seção 6).
 *
 * E A REVISÃO JURÍDICA (05/10/2026), ainda antes de publicar a 1.4 — por isso
 * a versão não sobe: ninguém aceitou a 1.4 ainda (a última publicação, v1.2
 * do app, saiu com a 1.3). O que entrou:
 *   - O PAPEL DE CADA UM NA LGPD (Política, seção 2). Para os dados das
 *     famílias e crianças que o motorista cadastra e usa no negócio DELE, o
 *     motorista é o CONTROLADOR e a plataforma é OPERADORA (art. 5º VII e
 *     art. 39). A plataforma é controladora só dos fins dela (conta, login,
 *     cobrança da assinatura, segurança, comunidade, níveis, avaliações do
 *     app, métricas, comunicação). Dizer "o controlador de tudo somos nós"
 *     punha na plataforma uma decisão que é do motorista — quem ele
 *     transporta, quanto cobra, o que anota — e é o tipo de frase que se
 *     volta contra quem a escreveu.
 *   - A BASE LEGAL DA OPERAÇÃO DA CRIANÇA deixou de ser o "consentimento
 *     declarado pelo motorista": consentimento de terceiro declarado por
 *     outro terceiro não é consentimento. Agora é a execução do contrato de
 *     transporte de que o responsável é parte (art. 7º V) e o legítimo
 *     interesse (art. 7º IX), sempre no melhor interesse da criança (art. 14
 *     caput; Enunciado CD/ANPD nº 1/2023). Consentimento específico ficou SÓ
 *     para saúde (art. 11 I) e imagem na foto da turma.
 *   - A SEÇÃO 2b declara todos os serviços que recebem dado pessoal HOJE
 *     (conferidos no código): Nominatim, ViaCEP, MapTiler, DiceBear, Google
 *     Analytics (só com aceite), login com Google, WhatsApp. E a linha do
 *     Resend estava ERRADA: desde 03/10/2026 ele só manda o e-mail da fatura
 *     ao MOTORISTA (`functions/lib/emailDoAviso.js`), nada de família.
 *   - "Associação" virou ASSINATURA DO APLICATIVO, e o motorista, assinante.
 *   - Encarregado nomeado (art. 41 §1º), auxiliar do motorista, acesso de 24
 *     horas, entrada da família pelo link ou pelo pedido aprovado (o código
 *     saiu de toda tela em 02/10/2026), e o encerramento da assinatura pelo
 *     próprio app (existe desde 11/09/2026).
 *   - A parte passou a ser a razão social do MEI, com o nome fantasia ao lado.
 *
 * CONFERIDO CONTRA O CÓDIGO (05/10/2026, noite): a substituta de um dia (F3,
 * reguaDaSubstitutaDeUmDia.js) e a foto postada pela auxiliar (F1.5,
 * autoriaDaFoto em reguaDaComunidade.js) entraram, e as frases deixaram de
 * ser "em construção". O código mostrava mais que o texto dizia (o turno, a
 * falta do dia, a marca do tio; o link que morre com a conta trancada; o IP
 * de quem erra o link) e o texto subiu até ele. Só a COMUNIDADE segue marcada.
 *
 * E AINDA ANTES DE PUBLICAR (05/10/2026, à tarde), o que o código ganhou no
 * mesmo dia e a 1.4 precisa declarar. A versão NÃO sobe: a 1.4 nunca foi ao
 * ar (no ar está a 1.3) e ninguém a aceitou. Tudo isto vai para a revisão
 * do advogado junto com o resto da 1.4; nada é publicado antes. Cada frase
 * foi conferida no código que ela descreve:
 *   - A AUXILIAR POR PAR (`functions/lib/auxiliares.js`, `reguaDoAuxiliar.js`):
 *     até dois motoristas por auxiliar, o histórico de quem trabalhou com
 *     quem (nunca apagado: desativar fecha o período, recontratar abre outro)
 *     e a CÓPIA da turma com lista fechada de campos
 *     (`CAMPOS_DA_TURMA_DA_AUXILIAR`) — sem endereço, mensalidade, contrato,
 *     saúde, aniversário nem recado. Política 3(b), 4, 6(b), 8 e 9.
 *   - O RECIBO DO PAGAMENTO DELA (`pagamentosDaAuxiliar.js`): o motorista
 *     anota, ela confirma, a despesa nasce no caixa dele. Política 3(b), 6, 8.
 *   - A FALTA DELA E AS SUBSTITUTAS (`substitutasService.js`,
 *     `faltaDaAuxiliar.js`): dado de TERCEIRO que não usa o app, informado
 *     pelo motorista, que responde por poder cadastrá-lo (Termos 5).
 *     Base: legítimo interesse do motorista (5.k), com o dado mínimo que as
 *     rules permitem (nome e WhatsApp). Política 3(e), 6, 8 e 9.
 *   - A RECOMENDAÇÃO E A NOTA (`avaliacoesDaAuxiliar.js`). Base da
 *     recomendação: LEGÍTIMO INTERESSE (5.l), e não consentimento, porque o
 *     desenho é esse — o motorista escreve ANTES de ela dizer qualquer coisa
 *     (o texto nasce pendente), e o que ela controla é o que acontece depois:
 *     mostrar, não mostrar ou apagar, a qualquer momento. Isso é a oposição
 *     garantida do legítimo interesse (art. 18 §2º), não um consentimento
 *     prévio. Hoje ninguém além dos dois e da equipe lê, nem a aprovada; no
 *     dia em que outros motoristas lerem (etapa futura), a aprovação dela
 *     passa a ser a condição, e a base precisa ser revista nesse dia.
 *   - A PASSAGEM DA FAMÍLIA A OUTRO MOTORISTA (`reguaDaTransferencia.js`):
 *     comunicação de um controlador (o motorista que sai) a outro (o que
 *     entra), que só acontece com o "Aceito" da família — base: execução de
 *     contrato a pedido do titular (5.m). Antes do aceite o parceiro vê só o
 *     primeiro nome e a escola; isso, sim, é legítimo interesse, e está
 *     declarado. Termos 7b; Política 4, 6(f) e 8.
 *   - O AVISO AO PARCEIRO INDICADO (`avisarParceiroIndicado`): leva só a
 *     marca de quem indicou, nada da família. Política 6(d).
 * ⚠️ O texto da saúde (1.3) continua sendo o RASCUNHO que espera a revisão
 * jurídica (`docs/consentimento-saude.md`).
 */

/*
 * ── 1.3 também declara o DITADO POR VOZ (04/10/2026) na seção 2b: o áudio
 * vai ao serviço de voz do aparelho (Google/Apple). Fora do campo de saúde.
 *
 * ── 1.3 (03/10/2026): A INFORMAÇÃO DE SAÚDE GANHOU BASE LEGAL PRÓPRIA
 * A 1.2 listava "alergias, instruções especiais" entre as observações que o
 * MOTORISTA cadastra, e dizia que o consentimento do responsável era
 * "manifestado durante o aceite destes termos no primeiro acesso". As duas
 * frases ficaram falsas: saúde agora só a RESPONSÁVEL escreve, na tela dela,
 * com uma caixa de consentimento separada (art. 11, I — consentimento
 * específico e destacado não pode vir embutido no aceite geral). Ver
 * `docs/consentimento-saude.md`.
 *
 * ⚠️ O TEXTO NOVO SAIU DO RASCUNHO DAQUELE DOCUMENTO, que pede revisão
 * jurídica antes de ir ao ar. Decisão do dono (03/10/2026): construir agora e
 * publicar só depois da revisão.
 */

/**
 * A MARCA E OS ENDEREÇOS DE VERDADE.
 *
 * Isto aqui era `Tio Nino Digital` e `@tionino.digital` — um nome que a
 * plataforma não usa mais e um domínio que não é nosso. Não é detalhe de
 * texto: é a identificação da parte num documento que a pessoa ACEITA, e o
 * canal por onde ela exerce direito de LGPD. Endereço que não existe é
 * pedido de titular que ninguém recebe.
 *
 * `dpoEmail` aponta pro mesmo endereço do contato de propósito: uma caixa que
 * é lida todo dia responde melhor que um `dpo@` que ninguém abriu ainda.
 * Quando existir caixa dedicada, é trocar esta linha — e só esta.
 *
 * ⚠️ E O DOMÍNIO É O `.com`, NÃO O `.com.br` — o que parece contraintuitivo,
 * porque a landing é o `.com.br`. O motivo é que este endereço tem que
 * RECEBER: ele é o canal do Encarregado (art. 41 da LGPD) e a Política promete
 * resposta em 15 dias por ele.
 *
 * Ele esteve em `contato@alobuzinou.com.br` por engano até 09/09/2026, e esse
 * domínio NÃO TEM REGISTRO MX — nenhum servidor de e-mail. Toda mensagem de
 * titular enviada para lá voltava com erro de entrega, em silêncio, e o
 * documento continuava prometendo. O `.com` tem caixa na Hostinger (MX +
 * SPF), que é a única razão da escolha.
 *
 * A regra que fica: antes de publicar um endereço em documento legal,
 * confira o MX do domínio. Canal que não recebe é pior que canal ausente,
 * porque a pessoa tem o print do documento.
 */
/**
 * QUEM RESPONDE PELOS DADOS — e por que faltava.
 *
 * ⚠️ ESTE OBJETO TINHA SÓ NOME E E-MAIL, e a mesma pessoa aceitava dois
 * documentos que nomeavam PARTES DIFERENTES:
 *
 *   - Termos e Política diziam "Alô Buzinou", sem razão social e sem CNPJ;
 *   - o contrato de associação era assinado por "Desenvolva Algo", com CNPJ e
 *     um Gmail (`src/config/developer.js`);
 *   - a landing publicava "Alô Buzinou · CNPJ 65.000.217/0001-47".
 *
 * A LGPD (art. 9º I) e o CDC (art. 33) exigem identificação clara do
 * controlador, e a cláusula de foro dos Termos elege "a comarca da sede do
 * controlador" — inexequível quando o documento não diz qual é.
 *
 * `razaoSocial` e `cnpj` NÃO foram inventados aqui: os dois já estavam no
 * repositório, nos dois lugares acima, e concordam entre si. O que faltava era
 * o documento legal dizer o mesmo.
 *
 * O ENDEREÇO ESTÁ COMPLETO desde 05/10/2026: logradouro, número (61), bairro,
 * cidade, UF e CEP vêm de `config/developer.js` (`DEV_ENDERECO`).
 *
 * ⚠️ E A PARTE É A PESSOA, NÃO O NOME FANTASIA (05/10/2026, dado do dono). A
 * empresa é um MEI: a razão social é o nome do titular, FELIPE ANDERSON
 * ANACLETO DA SILVA, e "Desenvolva Algo" é só o nome fantasia. Até aqui os
 * documentos chamavam "Desenvolva Algo" de razão social — um nome que não
 * identifica ninguém numa consulta ao CNPJ.
 */
export const COMPANY_INFO = {
  // O nome pelo qual o produto é conhecido — o que aparece no corpo do texto.
  name: 'Alô Buzinou',
  // ⚠️ A PESSOA JURÍDICA VEM DE `config/developer.js`, E NÃO É COPIADA AQUI.
  //
  // A primeira versão deste objeto repetiu razão social, CNPJ e cidade à mão —
  // e a cidade saiu ERRADA: foi inferida do rodapé da landing, que traz
  // "São Paulo/SP" como ESTADO. A sede é em Socorro. A cláusula de foro
  // passou a eleger a comarca da capital, que não é a competente.
  //
  // Copiar identidade legal em dois arquivos é como as três versões deste
  // produto passaram a existir (Termos dizendo uma coisa, contrato outra,
  // landing uma terceira). `developer.js` já dizia, no próprio cabeçalho, o
  // que fazer: "um lugar pra mudar, todas as telas mudam".
  razaoSocial: DEV_RAZAO_SOCIAL,
  tipoEmpresa: DEV_TIPO_EMPRESA,
  nomeFantasia: DEV_NAME,
  cnpj: DEV_CNPJ,
  cidade: DEV_CIDADE_UF,
  endereco: DEV_ENDERECO,
  email: 'contato@alobuzinou.com',
  dpoEmail: 'contato@alobuzinou.com',
  // ⚠️ O ENCARREGADO PRECISA DE NOME (LGPD art. 41 §1º: identidade e contato
  // divulgados publicamente). A dispensa para agente de pequeno porte (Res.
  // CD/ANPD nº 2/2022) NÃO vale aqui: ela exclui quem faz tratamento de ALTO
  // RISCO, e este app trata dado de criança, localização e saúde — o caso
  // mais provável de ser classificado assim. Por isso o campo existe e é
  // impresso nos documentos.
  //
  // Enquanto não houver outra pessoa designada, o encarregado é o próprio
  // TITULAR do MEI (a razão social de um MEI é o nome dele). Quando o dono
  // designar alguém, é trocar esta linha — e só esta.
  encarregadoNome: DEV_RAZAO_SOCIAL,
};

/** Como a plataforma se identifica por extenso, num documento legal. */
export const CONTROLADOR_POR_EXTENSO =
  `${COMPANY_INFO.razaoSocial} (${COMPANY_INFO.tipoEmpresa}), ` +
  `nome fantasia ${COMPANY_INFO.nomeFantasia} ("${COMPANY_INFO.name}"), ` +
  `CNPJ ${COMPANY_INFO.cnpj}, com sede em ${COMPANY_INFO.endereco}`;

/** O encarregado, como os documentos o apresentam. */
const ENCARREGADO =
  `${COMPANY_INFO.encarregadoNome}, pelo e-mail ${COMPANY_INFO.dpoEmail}`;

export const TERMS_SECTIONS = [
  {
    id: 'aceite',
    title: '1. Aceite dos Termos',
    paragraphs: [
      `Ao criar uma conta no aplicativo ${COMPANY_INFO.name} ("Aplicativo"), operado por ${CONTROLADOR_POR_EXTENSO}, você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso e com a Política de Privacidade.`,
      'Se você não concorda com qualquer disposição, não utilize o Aplicativo.',
      'O uso continuado do Aplicativo após eventuais alterações implica aceite das novas versões. Notificaremos mudanças relevantes com pelo menos 15 (quinze) dias de antecedência.',
    ],
  },
  {
    id: 'objeto',
    title: '2. Objeto',
    paragraphs: [
      'O Aplicativo é uma ferramenta digital destinada à gestão e ao acompanhamento de transporte escolar privado, oferecida nas seguintes modalidades de uso:',
      '(a) Motorista (Tio), ASSINANTE do Aplicativo: cadastro de crianças, gerenciamento de rotas, controle financeiro e comunicação com responsáveis. O motorista paga a assinatura do aplicativo à plataforma, nas condições do contrato de assinatura que ele aceita no próprio Aplicativo;',
      '(b) Auxiliar do motorista: pessoa que trabalha com o motorista na rota. Ela tem conta própria, criada somente pelo convite enviado por ele, e pode trabalhar com até dois motoristas ao mesmo tempo, cada um pelo seu convite. Ela vê apenas o que é necessário para ajudar na rota do dia, sem endereço, valores de mensalidade, contrato ou informações de saúde. Cada motorista pode desativá-la a qualquer momento, só na perua dele, e responde pelo uso que ela faz do Aplicativo no trabalho com ele;',
      '(c) Responsável (Pai/Mãe): acompanhamento do trajeto da criança, status do transporte, contrato com o motorista e registro de pagamentos;',
      '(d) Acompanhamento por link, sem conta: o responsável pode enviar a quem vai buscar a criança um link que vale até a meia-noite daquele dia; e o responsável ou o motorista pode enviar ao segundo responsável um link que vale por 24 horas, com o qual ele também pode receber no celular os avisos da rota. Quem abre esses links vê apenas o dia da criança — as etapas do transporte —, nunca dinheiro, endereço ou contrato.',
    ],
  },
  {
    id: 'cadastro',
    title: '3. Cadastro e Conta',
    paragraphs: [
      'Para usar o Aplicativo é necessário criar uma conta com e-mail válido e senha pessoal, ou entrar com uma conta Google. Você é responsável por manter a confidencialidade das suas credenciais.',
      'Você deve fornecer informações verdadeiras, atuais e completas. O fornecimento de dados falsos pode resultar em suspensão ou exclusão da conta.',
      'O responsável entra no Aplicativo pelo LINK DE CONVITE que o motorista envia depois de cadastrar a criança, ou, sem o link, informando o número de WhatsApp: nesse caso, a conta só é ligada à criança depois que o motorista aprova o pedido no Aplicativo.',
      'A conta da auxiliar do motorista só é criada pelo convite enviado por ele.',
      'Menores de 18 anos não podem criar contas próprias. As contas de responsáveis são exclusivamente para pessoas maiores de idade que detêm guarda ou autoridade parental sobre as crianças cadastradas.',
    ],
  },
  {
    id: 'uso',
    title: '4. Uso Permitido',
    paragraphs: [
      'Você se compromete a usar o Aplicativo apenas para fins lícitos e em conformidade com estes Termos. É vedado:',
      '(a) usar o Aplicativo para fins ilegais, fraudulentos ou que violem direitos de terceiros;',
      '(b) tentar acessar contas, dados ou funcionalidades não autorizadas;',
      '(c) introduzir vírus, malware ou qualquer código malicioso;',
      '(d) realizar engenharia reversa, descompilação ou modificação não autorizada;',
      '(e) usar bots, scrapers ou meios automatizados para coletar dados;',
      '(f) compartilhar credenciais ou conteúdo restrito a outros responsáveis.',
    ],
  },
  {
    id: 'responsabilidades-motorista',
    title: '5. Responsabilidades do Motorista',
    paragraphs: [
      'Ao se cadastrar como motorista, você declara possuir todas as autorizações legais para exercer a atividade de transporte escolar (CNH, alvará municipal quando exigido, vistoria veicular, etc.).',
      'Você é responsável pelo conteúdo cadastrado, pela exatidão dos dados das crianças e pela comunicação com os responsáveis.',
      'Os dados das famílias e das crianças que você cadastra e usa no seu serviço de transporte são dados do SEU negócio: para eles, você é o controlador, nos termos da LGPD, e o Aplicativo trata esses dados por sua conta, como operador, conforme estes Termos e a Política de Privacidade. Cabe a você cadastrar só o necessário para o transporte e informar as famílias de que usa o Aplicativo.',
      'Se você convidar uma auxiliar, você responde pelo uso que ela faz do Aplicativo no trabalho com você, e deve desativá-la quando ela deixar de trabalhar com você. O que você anota sobre ela — o pagamento, as faltas e a recomendação — deve ser verdadeiro.',
      'Se você cadastrar substitutas (pessoas que cobriram a falta da auxiliar), você declara que elas sabem e concordam em ter o nome e o WhatsApp na sua lista, e deve tirá-las da lista quando elas pedirem. Elas não usam o Aplicativo e não são avisadas por ele.',
      'Se você pedir para passar uma família para outro motorista (cláusula 7b), você declara que conversou com a família antes e que o outro motorista tem condições de prestar o serviço.',
      'O Aplicativo é uma ferramenta de apoio operacional; não substitui sua responsabilidade legal sobre o transporte e a segurança das crianças.',
      `${COMPANY_INFO.name} não é responsável por incidentes durante o transporte, atrasos, mudanças de rota, problemas mecânicos ou questões trabalhistas/contratuais entre motorista e responsáveis.`,
    ],
  },
  {
    id: 'responsabilidades-responsavel',
    title: '6. Responsabilidades do Responsável',
    paragraphs: [
      'Você declara ter autoridade legal sobre a criança cadastrada (poder familiar, guarda ou tutela) e estar ciente do tratamento dos dados pessoais dela descrito na Política de Privacidade. As informações de saúde e a imagem da criança na foto da turma só são tratadas se você autorizar, em pergunta própria, no Aplicativo.',
      'Você é responsável por verificar previamente as informações sobre o motorista, sua habilitação e a regularidade do serviço contratado.',
      'A relação contratual sobre o serviço de transporte (mensalidades, horários, conduta) é exclusivamente entre você e o motorista.',
    ],
  },
  {
    id: 'pagamentos',
    title: '7. Pagamentos',
    paragraphs: [
      `O ${COMPANY_INFO.name} oferece registro e acompanhamento de mensalidades, mas não processa nem intermedeia transações financeiras.`,
      'Os pagamentos ocorrem diretamente entre o responsável e o motorista, fora do Aplicativo (PIX, dinheiro ou outros meios combinados entre as partes).',
      `O ${COMPANY_INFO.name} não tem responsabilidade por valores devidos, atrasos, estornos ou disputas financeiras entre as partes.`,
      'O mesmo vale para o pagamento da auxiliar: o motorista anota no Aplicativo o que pagou e ela confirma que recebeu. É um recibo dos dois, não um pagamento — o dinheiro não passa pelo Aplicativo.',
    ],
  },
  {
    // ⚠️ "7b" E NÃO "8": a Política cita a "cláusula 8 dos Termos" (a
    // geolocalização) em três lugares. Renumerar quebraria as três em
    // silêncio — o mesmo motivo da "2b" da Política.
    id: 'transferencia-familia',
    title: '7b. Passagem da família para outro motorista',
    paragraphs: [
      'O motorista pode pedir, na ficha da criança, para passar o transporte dela a um motorista PARCEIRO (alguém que ele indicou ao Aplicativo, ou que o indicou). Nunca a qualquer motorista: a lista é só a dos parceiros dele.',
      'São três passos, um de cada pessoa: (1) o motorista de agora pede; (2) o parceiro aceita ou recusa, vendo só o primeiro nome da criança e a escola; (3) a FAMÍLIA lê o que vai e o que fica, e decide. Nada muda antes do "Aceito" da família. O motorista de agora pode desistir até lá, e o pedido que não é concluído em 7 (sete) dias depois de feito vence sozinho: a criança continua com o motorista de agora.',
      'Com o aceite, a criança entra na turma do novo motorista com um cadastro novo e sai da turma do anterior. O novo motorista combina com a família o valor e os horários e envia um contrato novo, que a família assina no Aplicativo. As mensalidades em aberto continuam devidas ao motorista anterior, e o novo só cobra a partir do mês seguinte.',
      'A passagem está disponível só para motoristas com assinatura do aplicativo; quem vai receber a família e ainda não assina precisa assinar antes. Cada motorista pode pedir até 10 (dez) passagens por mês; acima disso, pelo suporte.',
      'O que vai para o novo motorista, e o que nunca vai, está na seção 4 da Política de Privacidade.',
    ],
  },
  {
    id: 'localizacao',
    title: '8. Geolocalização',
    paragraphs: [
      'O Aplicativo coleta a localização do veículo do motorista enquanto ele mantém uma rota iniciada. Não há coleta em segundo plano.',
      'Fora da rota, a localização é lida UMA vez, e só quando o motorista toca no botão que pede isso, em quatro momentos: (1) no primeiro acesso, para preencher o nome da cidade e do bairro dele; (2) no "Usar minha localização" do cadastro de uma criança ou de uma escola, para marcar aquele ponto no mapa; (3) no "Estou na escola agora", para marcar o ponto da escola; e (4) no "Sim, estou" da tela de abastecer, para anotar o endereço e o ponto do posto de combustível na lista de postos dele, que só ele vê, e reconhecer esse posto nos próximos abastecimentos. Em nenhum desses casos a posição do motorista é guardada: fica guardado apenas o nome da cidade e do bairro, ou o lugar da casa, da escola ou do posto.',
      'O COMPARTILHAMENTO COM AS FAMÍLIAS É UMA ESCOLHA DO MOTORISTA, revogável a qualquer momento e sem custo, por uma chave na própria tela de início de rota. Desligada, o veículo deixa de aparecer no mapa dos responsáveis; o aviso de aproximação continua, porque ele é calculado no aparelho do motorista e não envia a posição.',
      'A posição exibida aos responsáveis é APROXIMADA, por referência: ela é arredondada no aparelho do motorista antes de ser enviada, e não indica o ponto exato do veículo.',
      'Ao encerrar a rota, a última posição é APAGADA. O Aplicativo não mantém histórico de localização do motorista.',
      'O endereço residencial cadastrado pelo motorista é usado para roteamento e exibição no mapa do responsável correspondente.',
      'O Aplicativo não coleta a localização do dispositivo dos responsáveis em nenhuma hipótese.',
    ],
  },
  {
    id: 'propriedade-intelectual',
    title: '9. Propriedade Intelectual',
    paragraphs: [
      `Todo o conteúdo, marca, layout, código-fonte e funcionalidades do Aplicativo são de propriedade exclusiva do ${COMPANY_INFO.name} ou seus licenciadores, protegidos por leis de propriedade intelectual.`,
      'Você não adquire qualquer direito sobre esses elementos. É vedada a cópia, reprodução ou redistribuição sem autorização prévia por escrito.',
    ],
  },
  {
    id: 'limitacao',
    title: '10. Limitação de Responsabilidade',
    paragraphs: [
      `Na máxima extensão permitida pela lei, o ${COMPANY_INFO.name} não responde por danos indiretos, lucros cessantes ou perdas decorrentes de:`,
      '(a) indisponibilidade temporária do Aplicativo por manutenção, falha de terceiros (Firebase, provedor de internet) ou caso fortuito;',
      '(b) imprecisão ou atraso na geolocalização causada por sinal de GPS, conexão de rede ou hardware do dispositivo;',
      '(c) condutas dos demais usuários (motoristas, responsáveis);',
      '(d) eventos externos ao funcionamento técnico do Aplicativo.',
    ],
  },
  {
    id: 'rescisao',
    title: '11. Suspensão e Encerramento',
    paragraphs: [
      'O motorista pode encerrar a assinatura do aplicativo a qualquer momento, pelo próprio Aplicativo, nas condições do contrato de assinatura. Encerrar a assinatura não apaga a conta nem os dados.',
      `A exclusão da conta é feita a pedido, pelo e-mail ${COMPANY_INFO.email}. O exercício desse direito, e o que precisa ser guardado por obrigação legal, está descrito na Política de Privacidade.`,
      `O ${COMPANY_INFO.name} pode suspender ou encerrar contas em caso de violação destes Termos, fraude ou inatividade prolongada, mediante notificação prévia quando aplicável.`,
    ],
  },
  {
    id: 'lei-aplicavel',
    title: '12. Lei Aplicável e Foro',
    paragraphs: [
      'Estes Termos são regidos pelas leis da República Federativa do Brasil.',
      // ⚠️ A COMARCA É DECLARADA, NÃO DERIVADA DA SEDE.
      //
      // Foro de eleição é escolha das partes (CPC art. 63). A sede é em
      // Socorro e a comarca eleita é São Paulo — as duas são verdadeiras ao
      // mesmo tempo, e uma cláusula que diga "comarca X, sede do controlador"
      // fica falsa por dentro. Ver `DEV_COMARCA` em `config/developer.js`.
      //
      // A ressalva do consumidor vem no parágrafo seguinte, e não é cortesia:
      // sem ela a cláusula é abusiva (CDC art. 51, IV) e o juiz a afasta
      // inteira. Com ela, ela vale onde pode valer.
      `Fica eleito o foro da comarca de ${DEV_COMARCA} para dirimir quaisquer controvérsias decorrentes destes Termos.`,
      `Esta eleição não afasta o direito do consumidor de propor ação no foro de seu próprio domicílio, nos termos do art. 101, I do Código de Defesa do Consumidor.`,
    ],
  },
  {
    id: 'contato',
    title: '13. Contato',
    paragraphs: [
      `Dúvidas, sugestões ou reclamações sobre estes Termos: ${COMPANY_INFO.email}.`,
      `Para assuntos relacionados a privacidade e proteção de dados, fale com o Encarregado pelo Tratamento de Dados Pessoais: ${ENCARREGADO}.`,
    ],
  },
];

export const PRIVACY_SECTIONS = [
  {
    id: 'introducao',
    title: '1. Introdução',
    paragraphs: [
      `Esta Política de Privacidade descreve como o ${COMPANY_INFO.name} ("nós", "Aplicativo") coleta, usa, compartilha e protege dados pessoais, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).`,
      'Para fins desta Política, considere "Titular" qualquer pessoa cujos dados são tratados, incluindo motoristas, auxiliares, responsáveis, crianças cadastradas e as pessoas indicadas por eles (como o segundo responsável, quem busca a criança e as substitutas que o motorista anota quando a auxiliar falta).',
    ],
  },
  {
    id: 'controlador',
    title: '2. Quem decide sobre os dados',
    paragraphs: [
      // ⚠️ DOIS PAPÉIS, E A FRASE ANTIGA PUNHA OS DOIS NA PLATAFORMA (05/10/2026).
      //
      // "O controlador dos dados tratados no Aplicativo é a plataforma" dizia
      // que é ela quem decide sobre a turma do motorista — quem ele
      // transporta, quanto cobra, o que anota. Quem decide é ele: o app é a
      // ferramenta do negócio dele (LGPD art. 5º VI e VII, art. 39). A
      // plataforma é controladora só do que ela mesma decide fazer.
      'Na LGPD, CONTROLADOR é quem decide por que e como os dados são usados, e OPERADOR é quem trata os dados por conta do controlador, seguindo as instruções dele (art. 5º, VI e VII). No Aplicativo, os dois papéis existem, e dependem do dado:',
      '(a) OS DADOS DA TURMA DO MOTORISTA: os dados das famílias e das crianças que o motorista cadastra e usa no serviço de transporte dele (nome, endereço, escola, horários, etapas do transporte, mensalidades, contrato, faltas e recados), e o que ele anota sobre a equipe dele (o vínculo com a auxiliar, o pagamento dela, as faltas dela e as substitutas), são do negócio do motorista. Para esses dados, o MOTORISTA é o controlador, e o Aplicativo é o OPERADOR: guarda e trata esses dados por conta dele, conforme as instruções dele e os Termos de Uso (art. 39).',
      `(b) OS DADOS DO PRÓPRIO APLICATIVO: para as finalidades da plataforma, o controlador é ${CONTROLADOR_POR_EXTENSO}. São elas: as contas e o login; a cobrança da assinatura do aplicativo paga pelo motorista; a segurança, os registros de acesso e o limite de tentativas; a comunidade (foto da turma, motoristas parceiros, a nota que as famílias dão ao motorista, a recomendação que o motorista escreve para a auxiliar e a nota que a auxiliar dá ao motorista); os níveis do motorista; as avaliações do Aplicativo; as métricas de uso; e a comunicação da plataforma com os usuários.`,
      'Pedidos de titular — saber quais dados existem, corrigir, apagar, entre outros (seção 9) — podem ser feitos sempre pelo canal do Aplicativo, abaixo, sobre qualquer um desses dados. Quando o pedido for sobre dados da turma de um motorista, nós o atendemos junto com ele ou o encaminhamos a ele, e avisamos você do que foi feito.',
      `Encarregado pelo Tratamento de Dados Pessoais: ${ENCARREGADO}.`,
    ],
  },
  {
    id: 'operadores',
    title: '2b. Serviços de terceiros que recebem dados',
    paragraphs: [
      // ⚠️ ESTA LISTA É O QUE O CÓDIGO FAZ HOJE, conferida arquivo por arquivo
      // em 05/10/2026 — e não o que um dia foi contratado. Serviço novo que
      // receba dado pessoal entra aqui na mesma alteração (LGPD art. 9º, V, e
      // art. 33). A linha do Resend dizia que ele recebia nome do responsável
      // e da criança: era verdade até 03/10/2026, quando o e-mail ficou só
      // para a fatura do motorista (`functions/lib/emailDoAviso.js`).
      'Para funcionar, o Aplicativo usa os serviços abaixo. Cada um recebe só o necessário para a sua tarefa:',
      'Google Firebase e Google Cloud (Google LLC): hospedagem, login, banco de dados, armazenamento de arquivos, funções do servidor e notificações no celular. O banco de dados e as funções ficam em servidores em São Paulo.',
      'Login com Google (Google LLC): quando você escolhe "Começar com Google", o Google confirma quem você é e nos envia o seu nome, e-mail e foto da conta Google.',
      'Google Analytics (Google LLC): métricas de uso das telas, SOMENTE se você aceitar os cookies analíticos. O endereço das telas é enviado sem o código do convite e sem o link de acompanhamento. Recebe dados técnicos do aparelho, como o endereço IP.',
      'Asaas (Brasil): emissão das cobranças da assinatura do aplicativo devida pelo motorista à plataforma. Recebe nome, CPF/CNPJ, e-mail e telefone do MOTORISTA. Nenhum dado de responsável ou de criança é enviado ao Asaas — a mensalidade da família não passa pela plataforma.',
      'Resend (Estados Unidos): envio do e-mail que avisa o MOTORISTA do vencimento da fatura da assinatura. Recebe o e-mail e o primeiro nome do motorista e o texto do aviso. Nenhum e-mail é enviado a responsáveis, e nenhum dado de criança vai ao Resend.',
      'Nominatim, da OpenStreetMap Foundation (Reino Unido): encontra no mapa o ponto de um endereço. Recebe o endereço digitado (rua, número, bairro, cidade, CEP) da casa da criança, da escola ou do posto. Também recebe a posição do aparelho do motorista nas leituras únicas descritas na cláusula 8 dos Termos — no primeiro acesso, para devolver o nome da cidade e do bairro, e na tela de abastecer, para devolver o endereço do posto. Durante a rota, a posição NÃO é enviada a esse serviço.',
      'ViaCEP (Brasil): completa o endereço. Recebe o CEP digitado, ou a cidade e o pedaço do nome da rua que o motorista está procurando.',
      'MapTiler (Suíça): fornece as imagens do mapa. Como qualquer site que entrega imagens, recebe o endereço IP do aparelho e a região do mapa que está sendo vista.',
      // A SEMENTE DO AVATAR É UM IDENTIFICADOR, e vai na URL da imagem
      // (`src/marca/avatarUrl.js`): criança = prefixo de gênero + id do
      // cadastro; adulto = prefixo + uid (ou o nome, quando a tela não tem o
      // uid). Ele é tratado como dado pessoal por isso.
      'DiceBear (Alemanha): desenha o avatar de quem não tem foto. Para que o mesmo rosto apareça sempre, o endereço da imagem leva uma "semente": para a criança, o código interno do cadastro dela e, quando o gênero foi informado, uma letra que o indica; para o adulto, o código interno da conta e a mesma letra — ou, quando a tela não tem esse código, o nome da pessoa. O serviço também recebe o endereço IP do aparelho. Quem tem foto enviada não usa o DiceBear.',
      'WhatsApp (Meta): quando você toca num botão que abre o WhatsApp (mandar o convite, falar com o motorista, pedir acesso, falar com o suporte), o Aplicativo só prepara a mensagem: você vê o texto e decide enviar. O que é enviado passa a seguir as regras do WhatsApp.',
      // O DITADO POR VOZ (04/10/2026). O microfone dos campos usa o
      // reconhecimento de voz do NAVEGADOR do aparelho, que manda o áudio ao
      // serviço do fabricante. Não é operador contratado pela plataforma, mas
      // é dado pessoal (nome, endereço, telefone) saindo do aparelho por um
      // botão nosso — por isso está declarado. Entrou na 1.3, ainda não
      // publicada, para ninguém aceitar duas vezes.
      'Ditado por voz (opcional): ao tocar no microfone de um campo, o áudio é enviado ao serviço de reconhecimento de voz do próprio aparelho — Google, no Android; Apple, no iPhone — que devolve o texto escrito. O Alô Buzinou não grava nem guarda o áudio. O microfone não aparece no campo de informações de saúde da criança.',
      'Alguns desses serviços ficam fora do Brasil. Como isso é tratado está na seção 11.',
      'Não vendemos, alugamos nem cedemos dados pessoais a terceiros para fins publicitários.',
    ],
  },
  {
    id: 'dados-coletados',
    title: '3. Dados Coletados',
    paragraphs: [
      'Tratamos os seguintes dados pessoais:',
      '(a) Do motorista: nome, e-mail, telefone/WhatsApp, senha (guardada de forma cifrada pelo serviço de login), gênero (para o desenho do avatar), cidade e bairro, foto, nome e logotipo da marca dele, chave PIX, CPF ou CNPJ e endereço (para o contrato com as famílias e a cobrança da assinatura), alvará (somente quando ele o envia para receber o selo), despesas, quilômetros rodados nas rotas (só o total, sem trajeto) e a lista de postos de combustível dele, e a localização do veículo durante as rotas e nas leituras únicas descritas na cláusula 8 dos Termos;',
      '(b) Da auxiliar do motorista: nome, e-mail, telefone e as marcações que ela faz na rota; com cada motorista com quem trabalha (até dois ao mesmo tempo), o vínculo de trabalho: quando começou, quando terminou cada período (quem sai e volta tem mais de um) e o valor mensal que o motorista informou no convite, se informou; o recibo de cada pagamento (o mês, o valor que o motorista anotou ter pago, a data da anotação e a data em que ela confirmou o recebimento); as faltas dela que o motorista registra (o dia e quem a substituiu); a recomendação que um motorista escreve para ela; e a nota que ela dá ao motorista;',
      '(c) Do responsável: nome, e-mail, telefone/WhatsApp, senha (guardada de forma cifrada pelo serviço de login), gênero (para o desenho do avatar), foto (se ele enviar), o vínculo com a criança, o aceite do contrato com o motorista e os avisos de pagamento e comprovantes que ele envia;',
      '(d) Da criança (informados pelo motorista ou pelo responsável): nome, gênero, foto, data de aniversário, escola, turma e professora, endereço de embarque e da escola, horários, as etapas do transporte de cada dia, faltas avisadas, recados, observações do transporte (por exemplo, o portão de entrada), valor e situação das mensalidades e o contrato de transporte;',
      '(d.1) Informações de saúde da criança (opcional): quando o responsável opta por informá-las, com consentimento específico e destacado, guardamos o texto que ele escreveu e a data do consentimento. Essa informação é exibida apenas ao motorista responsável pelo transporte daquela criança, com a finalidade de permitir atendimento adequado em caso de emergência durante o trajeto. Ela pode ser apagada pelo responsável a qualquer momento, na ficha da criança, e é excluída junto com o cadastro da criança;',
      '(e) De terceiros, informados pela família ou pelo motorista: nome e telefone do segundo responsável e de quem vai buscar a criança, o telefone de um motorista colega que alguém indicou ao Aplicativo e, das SUBSTITUTAS que o motorista anota quando a auxiliar falta, só o nome e o WhatsApp, os dias em que cada uma cobriu a falta e o valor que o motorista anotou ter pago por dia. Nunca CPF, endereço ou foto da substituta;',
      '(e.1) Do link de um dia da substituta: quando o motorista manda a uma substituta o link que mostra a rota do dia, guardamos o nome dela, o dia, quando o link foi criado, quando e por que deixou de valer e um resumo cifrado do segredo do link — não o próprio link. Quem tenta abrir um link que não existe ou com o segredo errado tem o endereço IP contado no limite de tentativas, como no convite;',
      '(f) Avaliações: a nota e o comentário que o usuário dá ao Aplicativo; a nota que o responsável dá ao motorista; a recomendação que o motorista escreve para a auxiliar (até 3 pontos fortes de uma lista fixa e uma frase curta, assinada por ele); e a nota de 1 a 5 estrelas que a auxiliar dá ao motorista (seção 6);',
      '(g) Dados técnicos: identificadores do aparelho para as notificações, versão do navegador, registros de acesso (logs) e, no limite de tentativas contra abuso (por exemplo, na abertura de convites), um resumo cifrado do endereço IP — não o próprio número;',
      '(h) Dados de uso: interações com o Aplicativo e, somente com o seu aceite, as métricas do Google Analytics (seção 10).',
    ],
  },
  {
    id: 'menores',
    title: '4. Tratamento de Dados de Crianças',
    paragraphs: [
      'O tratamento de dados pessoais de crianças e adolescentes ocorre sempre no melhor interesse da criança, conforme o art. 14 da LGPD.',
      'Os dados da criança usados no transporte (nome, endereço de embarque, escola, horários, contato da família) são cadastrados pelo motorista para prestar o serviço contratado pela família, e servem para levar e trazer a criança com segurança e manter a família informada. A base legal está na seção 5.',
      'As informações de saúde, quando existirem, são escritas pelo próprio responsável, com consentimento específico e destacado, separado do aceite destes termos (art. 11, I, e art. 14, §1º). O motorista apenas as lê, e não pode escrevê-las. A auxiliar do motorista não as vê.',
      // ⚠️ A FOTO DA COMUNIDADE (05/10/2026, decisão do dono) está EM
      // CONSTRUÇÃO no prod. Conferir contra o código antes de ir ao
      // advogado. Se ela não entrar, este parágrafo volta ao texto do commit
      // a5a3b4e: "vista só pelas famílias daquele motorista, nunca por outros
      // motoristas (...) Foto publicada para outros motoristas parceiros não
      // pode conter criança."
      //
      // O "sim" é UM para os dois públicos, por escolha do dono. A lei aceita
      // um só consentimento se ele for ESPECÍFICO (art. 8º §4º, art. 14 §1º):
      // por isso a pergunta e este texto dizem os dois públicos com todas as
      // letras. O "sim" antigo, que só falava da turma, NÃO vale para a
      // comunidade: a família é perguntada de novo.
      'A FOTO DA TURMA E A COMUNIDADE: numa data especial, o motorista pode publicar uma foto da turma. Ela é vista pelas famílias atendidas por ele e, na comunidade, pelos motoristas parceiros dele (os que ele indicou ao Aplicativo e o que o indicou) e pelas famílias atendidas por esses parceiros, numa tela separada. A criança só aparece se o responsável dela tiver respondido "Sim" à pergunta sobre as fotos, que diz quem vê a foto. Quem respondeu "Sim" antes de a comunidade existir é perguntado de novo. A resposta pode ser mudada a qualquer momento na ficha da criança. Ninguém pode curtir nem comentar a foto no Aplicativo, e ela é apagada automaticamente em 30 (trinta) dias.',
      'A auxiliar também pode publicar a foto da turma, pelo celular dela e em nome do motorista, com as mesmas regras: só para as famílias daquele motorista e só com as crianças cuja família respondeu "Sim". As famílias veem apenas o primeiro nome de quem publicou; quem foi, pelo identificador, só o servidor do Aplicativo guarda, para saber o que ela pode apagar. A auxiliar pode apagar a foto que publicou a qualquer momento, mesmo depois de deixar de trabalhar com o motorista.',
      // A CÓPIA DA AUXILIAR É UMA LISTA FECHADA (`CAMPOS_DA_TURMA_DA_AUXILIAR`
      // em functions/lib/reguaDoAuxiliar.js): campo novo da criança não chega
      // a ela sem alguém decidir. Esta frase é aquela lista lida em voz alta.
      'O QUE A AUXILIAR VÊ DA CRIANÇA: o servidor mantém para ela uma cópia reduzida da turma de cada motorista com quem ela trabalha, com nome, foto, gênero, escola, turma, professora, telefone da escola, horários, as etapas do transporte e o nome e o telefone do responsável, e as faltas avisadas para o dia, sem o recado. Ela NUNCA vê o endereço, a data de aniversário, o segundo responsável, mensalidades, contrato, recados nem informações de saúde. A cópia deixa de ser lida por ela no instante em que o motorista a desativa, e é apagada quando o motorista não tem mais nenhuma auxiliar ativa.',
      'O QUE A SUBSTITUTA DE UM DIA VÊ: pelo link do dia, sem conta, só a rota daquele dia — o primeiro nome de cada criança, a escola, a hora de pegar e de entregar, o turno, a etapa do transporte (em casa, na perua, na escola, entregue) e se a criança faltou ou vai com a família naquele dia. Do motorista, só a marca e o logo. Ela nunca vê sobrenome, foto, telefone, endereço, mensalidade, contrato nem saúde, e não marca nada. O link para à meia-noite, quando a rota é encerrada, quando o motorista o encerra ou quando a conta do motorista deixa de operar, o que vier primeiro.',
      // A LISTA É `CAMPOS_QUE_VAO` / `CAMPOS_QUE_NUNCA_VAO` em
      // functions/lib/reguaDaTransferencia.js. ⚠️ A tela da família
      // (`O_QUE_VAI`) não cita o e-mail do responsável nem o telefone da
      // escola, que vão; aqui eles estão, para o documento não prometer menos
      // do que o código faz.
      'NA PASSAGEM PARA OUTRO MOTORISTA (cláusula 7b dos Termos): antes de a família aceitar, o motorista parceiro vê só o primeiro nome da criança e o nome da escola. Depois do "Aceito" da família, vão para o novo motorista o nome, o gênero, a data de aniversário, a turma e a professora da criança; o endereço de casa (com o ponto no mapa) e a escola (nome, endereço, telefone e ponto no mapa); e o nome, o e-mail e o WhatsApp do responsável, e o nome e o WhatsApp do segundo responsável. NUNCA vão: as informações de saúde e o consentimento delas, a foto, a resposta sobre a foto da turma, mensalidades e pagamentos, o contrato, os horários, as etapas e o histórico do transporte, quem busca a criança, as observações e recados. Essas autorizações e esses registros foram dados ao motorista anterior e ficam com ele; com o novo, a família combina e autoriza tudo de novo.',
      'Não coletamos dados diretamente das crianças: quem os informa é o motorista ou o responsável, para fins de operação do transporte.',
      'Não usamos os dados das crianças para perfilamento, marketing, publicidade ou compartilhamento com terceiros para fins comerciais.',
    ],
  },
  {
    id: 'finalidades',
    title: '5. Finalidades e Bases Legais',
    paragraphs: [
      // ⚠️ A BASE DA OPERAÇÃO DA CRIANÇA NÃO É CONSENTIMENTO (05/10/2026).
      //
      // A versão anterior dizia "melhor interesse com consentimento dos
      // responsáveis (art. 14)", e o consentimento era o que o MOTORISTA
      // declarava ter. Consentimento de um titular declarado por terceiro não
      // se prova, e consentimento é revogável: revogado, a criança deixaria de
      // poder ser transportada pelo app. O Enunciado CD/ANPD nº 1/2023 diz que
      // dado de criança pode usar as bases do art. 7º e 11, desde que no
      // melhor interesse dela. Consentimento ficou onde ele é a base certa:
      // saúde (art. 11, I) e imagem.
      'Os dados são tratados para as seguintes finalidades, sob as bases legais aplicáveis (art. 7º, 11 e 14 da LGPD):',
      '(a) Funcionamento do Aplicativo para cada usuário (conta, login, telas, notificações, assinatura do motorista) — base: execução do contrato que o usuário aceita ao aceitar estes Termos (art. 7º, V). O Alô Buzinou não é parte do contrato de transporte entre o motorista e a família;',
      '(b) Cumprimento de obrigações legais e regulatórias, como a guarda de registros de acesso e de dados fiscais — base: obrigação legal (art. 7º, II);',
      '(c) Geolocalização do veículo durante rotas — base: consentimento do titular (art. 7º, I), revogável a qualquer momento pela chave na tela de início de rota, sem custo e sem perda de nenhuma outra função do Aplicativo (art. 8º, §5º); e as leituras únicas fora da rota (cidade no primeiro acesso, ponto da casa, da escola e do posto de combustível) — base: consentimento do titular (art. 7º, I), dado a cada vez pelo toque no botão que pede a localização e dispensável, porque em todos os casos o endereço pode ser digitado, sem perda de nenhuma função;',
      '(d) Comunicação com responsáveis (notificações, status, alertas) — base: execução do contrato de transporte de que o responsável é parte (art. 7º, V) e legítimo interesse (art. 7º, IX);',
      '(e) Dados da criança usados no transporte (seção 4) — base: execução do contrato de transporte de que o responsável é parte (art. 7º, V) e legítimo interesse do motorista em organizar e prestar o serviço com segurança (art. 7º, IX), sempre no melhor interesse da criança (art. 14, caput; Enunciado CD/ANPD nº 1/2023);',
      '(f) Informações de saúde da criança — base: consentimento específico e destacado do responsável (art. 11, I, e art. 14, §1º), revogável a qualquer momento, sem custo, apagando a informação no Aplicativo (art. 8º, §5º);',
      // ⚠️ "e na comunidade" acompanha o parágrafo da §4 (em construção).
      '(g) Imagem da criança na foto da turma e na comunidade — base: consentimento específico do responsável (art. 14, §1º), dado pela resposta "Sim" no Aplicativo a uma pergunta que diz quem vê a foto, e revogável a qualquer momento, sem custo, na ficha da criança (art. 8º, §5º);',
      '(h) Segurança, prevenção de fraude e limite de tentativas, comunidade, níveis, avaliações do Aplicativo e comunicação da plataforma — base: legítimo interesse (art. 7º, IX), sem uso de dados de criança;',
      '(i) Métricas de uso pelo Google Analytics — base: consentimento (art. 7º, I), dado no aviso de cookies e revogável a qualquer momento.',
      // AS LETRAS NOVAS VÊM DEPOIS DA (i), em vez de renumerar: o comentário
      // de cada versão cita a letra (5.c, 5.g), e renumerar faria as citações
      // antigas apontarem para outra coisa.
      '(j) A conta da auxiliar, o vínculo dela com cada motorista, a cópia reduzida da turma que ela vê e o recibo do pagamento dela — base: execução do contrato que ela aceita ao aceitar estes Termos e do acerto de trabalho entre ela e o motorista, de que ela é parte (art. 7º, V); o histórico de quem trabalhou com quem, que continua depois de ela ser desativada, e o recibo, que serve de prova aos dois — base: legítimo interesse dos dois e exercício regular de direitos (art. 7º, VI e IX). Na cópia da turma, os dados da criança seguem a letra (e);',
      '(k) As faltas da auxiliar e a lista de substitutas que o motorista anota — base: legítimo interesse do motorista em organizar a equipe dele (art. 7º, IX), com o mínimo de dados: da substituta, só nome e WhatsApp;',
      // A RECOMENDAÇÃO É LEGÍTIMO INTERESSE, E NÃO CONSENTIMENTO, pelo
      // desenho: o motorista escreve antes de ela dizer qualquer coisa (o texto
      // nasce pendente), então não há consentimento PRÉVIO a declarar. O que
      // ela tem é a oposição a qualquer momento — mostrar, não mostrar,
      // apagar —, que é a garantia do legítimo interesse (art. 18, §2º). No
      // dia em que outros motoristas lerem a aprovada (etapa futura), rever.
      '(l) A recomendação que o motorista escreve para a auxiliar e a nota que ela dá a ele — base: legítimo interesse (art. 7º, IX) em registrar como foi trabalhar junto. A auxiliar decide se a recomendação aparece, e pode ocultá-la ou apagá-la a qualquer momento, sem dar motivo;',
      // A PASSAGEM DA FAMÍLIA é comunicação de dados de um controlador (o
      // motorista que sai) a outro (o que entra). Ela só acontece com o
      // "Aceito" da família, e a família aceita para continuar sendo
      // atendida: é procedimento de um contrato novo, a pedido dela (art. 7º,
      // V). A prévia ao parceiro (primeiro nome e escola) acontece ANTES do
      // aceite, e por isso tem base própria, declarada.
      '(m) A passagem da família para outro motorista — base: execução de contrato a pedido do titular (art. 7º, V): os dados só vão ao novo motorista quando a família toca em "Aceito", para que ele possa atendê-la e fazer o contrato novo com ela, sempre no melhor interesse da criança (art. 14). Antes do aceite, mostrar ao parceiro só o primeiro nome e a escola, para ele dizer se pode atender — base: legítimo interesse do motorista (art. 7º, IX), com o mínimo que permite essa resposta;',
      '(n) O link de um dia da substituta — base: legítimo interesse do motorista em fazer a rota acontecer no dia em que a auxiliar falta (art. 7º, IX), no melhor interesse da criança (art. 14), com o mínimo de dados descrito na seção 4.',
    ],
  },
  {
    id: 'compartilhamento',
    title: '6. Compartilhamento de Dados',
    paragraphs: [
      'Dentro do Aplicativo, cada pessoa vê só o que precisa:',
      '(a) Entre o motorista e as famílias atendidas por ele — no escopo necessário para o serviço (status do transporte, localização aproximada da perua durante a rota, contrato, mensalidades, recados). As famílias também veem o nome, a marca, o telefone, a chave PIX e os dados do motorista que constam no contrato;',
      // ⚠️ A FOTO DA COMUNIDADE, EM CONSTRUÇÃO (ver a seção 4).
      '(a.1) A foto da turma, só com as crianças cuja família respondeu "Sim", é vista também, numa tela separada, pelos motoristas parceiros daquele motorista e pelas famílias atendidas por esses parceiros, até ser apagada em 30 dias;',
      '(b) A auxiliar do motorista vê, de cada motorista com quem trabalha e só enquanto está ativa com ele, a cópia reduzida da turma descrita na seção 4 (sem endereço, mensalidades, contrato nem informações de saúde), a marca e a chave PIX do motorista. Do vínculo, os dois veem o mesmo: os períodos de trabalho e o valor informado no convite. O recibo do pagamento é visto só pelos dois, e ela continua vendo os recibos dela depois de desativada. As faltas dela e a lista de substitutas são vistas SÓ pelo motorista; a auxiliar não as vê. Quem já trabalhou com o motorista continua na lista "quem já trabalhou comigo" dele, com os períodos;',
      '(b.1) A substituta que recebe do motorista o link de um dia vê só a rota daquele dia, como descrito na seção 4, e só enquanto o link valer. O nome e o WhatsApp dela são vistos só pelo motorista que a cadastrou;',
      '(c) Quem recebe um link de acompanhamento (quem vai buscar a criança, ou o segundo responsável) vê só o dia da criança, enquanto o link valer — sem dinheiro, endereço ou contrato;',
      '(d) Em "Indicar para uma família", o motorista passa a uma família dele o nome e o WhatsApp de um motorista parceiro. São dados do próprio parceiro, que aceitou a parceria; a família decide se entra em contato. O parceiro recebe um aviso de que foi indicado, com o nome da marca de quem indicou e nada mais: nenhum dado da família é passado a ele. Entre parceiros, cada um vê também o nome das escolas atendidas pelo outro;',
      '(e) Na passagem da família para outro motorista (cláusula 7b dos Termos), o motorista de agora comunica ao novo motorista os dados da criança e do responsável listados na seção 4 — e só depois do "Aceito" da família. Antes disso, o parceiro vê só o primeiro nome da criança e a escola, e a família só vê o pedido depois que o parceiro aceita. Dali em diante, o novo motorista passa a ser o controlador desses dados para o serviço dele, e o anterior continua com os registros do período em que atendeu a família (mensalidades, contrato e histórico), que o novo nunca vê;',
      '(f) Serviços de terceiros, como operadores, na medida descrita na seção 2b;',
      '(g) Autoridades competentes — quando exigido por ordem judicial ou obrigação legal.',
      'A NOTA QUE O RESPONSÁVEL DÁ AO MOTORISTA (de 1 a 5 estrelas, uma por semestre) é guardada com o identificador de quem a deu, só para permitir que ele a mude dentro do semestre. O motorista nunca vê nota individual nem quem a deu: vê apenas a média de um semestre já encerrado, e só quando pelo menos cinco famílias responderam. O motorista não avalia as famílias.',
      'A RECOMENDAÇÃO QUE O MOTORISTA ESCREVE PARA A AUXILIAR só pode ser feita depois de 30 (trinta) dias de trabalho juntos, somando os períodos. Ela tem até 3 pontos fortes de uma lista fixa e uma frase curta, assinada por ele. A frase não aceita telefone, e-mail, link, nome de criança ou de família da turma dele, nem promessa de segurança. A auxiliar lê antes e escolhe mostrar, não mostrar ou apagar, e pode mudar de ideia a qualquer momento; se o motorista editar o texto, ela precisa aprovar de novo. Hoje a recomendação é vista só pelos dois e pela equipe do Alô Buzinou, que pode retirar uma recomendação abusiva e guarda o motivo.',
      'A NOTA QUE A AUXILIAR DÁ AO MOTORISTA (de 1 a 5 estrelas, uma por motorista com quem ela trabalhou, mudável) é vista, nota a nota, só pela equipe do Alô Buzinou. O motorista vê apenas a média, e só quando pelo menos 3 (três) auxiliares diferentes responderam — com menos, a média diria quem deu cada nota.',
      'Nenhuma dessas notas ou recomendações vira lista pública, ranking ou cadastro de pessoas a evitar, e nenhuma é mostrada às famílias.',
      'Quando a auxiliar publica a foto da turma em nome do motorista, as famílias daquele motorista veem a foto e apenas o primeiro nome de quem a publicou.',
      'Não vendemos, alugamos ou cedemos dados pessoais para terceiros com finalidade de marketing ou publicidade.',
    ],
  },
  {
    id: 'armazenamento',
    title: '7. Armazenamento e Segurança',
    paragraphs: [
      'Os dados são armazenados em servidores da Google Cloud Platform (Firebase), com criptografia em trânsito (HTTPS/TLS) e em repouso.',
      'Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda, alteração ou divulgação, conforme padrões da indústria.',
      'Apesar disso, nenhum sistema é 100% seguro. Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados conforme o art. 48 da LGPD e, quando forem dados da turma de um motorista, também o motorista.',
    ],
  },
  {
    id: 'retencao',
    title: '8. Período de Retenção',
    paragraphs: [
      'Mantemos os dados enquanto a conta estiver ativa e enquanto necessário para as finalidades descritas.',
      'Após encerramento da conta, dados financeiros podem ser retidos pelo prazo de 5 (cinco) anos para cumprimento de obrigações fiscais e contábeis (art. 16, II da LGPD). O registro de mensalidades é apagado automaticamente após esse prazo.',
      'Localização é mantida apenas durante a rota ativa. Ao encerrar, a última posição é apagada — não guardamos histórico de localização do motorista.',
      'A foto da turma é apagada automaticamente 30 (trinta) dias depois de publicada, ou antes, se o motorista a apagar.',
      'O endereço e o ponto dos postos de combustível anotados pelo motorista ficam na lista de postos dele (no máximo 20, saindo o visto há mais tempo) enquanto a conta existir.',
      'O registro diário de embarque e entrega (data e horário de cada etapa, sem qualquer dado de localização) é apagado automaticamente após 60 (sessenta) dias.',
      'Os avisos do Aplicativo (o sino) são apagados automaticamente após 90 (noventa) dias.',
      // ⚠️ SÓ O QUE O CÓDIGO FAZ (05/10/2026). Vínculo da auxiliar, recibos,
      // faltas, substitutas, a nota dela ao motorista e o registro da passagem
      // de família NÃO têm prazo nem varredura no código: "enquanto a conta
      // existir" é a frase verdadeira hoje, e o prazo é PENDÊNCIA do dono.
      // A cópia da turma e as recomendações têm regra no código, e ela está
      // escrita como é.
      'A cópia reduzida da turma que a auxiliar vê é apagada automaticamente quando o motorista deixa de ter auxiliar ativa; a criança que sai da turma sai da cópia na hora.',
      'O vínculo entre o motorista e a auxiliar (os períodos de trabalho) não é apagado quando ele a desativa: é o histórico de quem trabalhou com quem, e fica enquanto a conta existir. O mesmo vale para os recibos de pagamento dela, as faltas dela registradas pelo motorista, a lista de substitutas dele e a nota que a auxiliar dá ao motorista.',
      'A substituta tirada da lista pelo motorista deixa de aparecer nela, mas o nome e o WhatsApp dela continuam nas faltas que ela já cobriu, e o nome na despesa daquele dia no caixa do motorista, como controle do mês dele, enquanto a conta existir.',
      'A recomendação que o motorista escreveu para a auxiliar é apagada quando um dos dois a apaga ou quando a conta de qualquer um dos dois é excluída. A retirada pela equipe por abuso fica registrada, com o motivo, até a exclusão de uma dessas contas.',
      'Na passagem da família para outro motorista, o registro do pedido (quem pediu, para quem, o primeiro nome da criança, a escola e as datas de cada passo) fica enquanto as contas existirem. O cadastro anterior da criança continua com o motorista anterior, inativo, com os registros do período em que ele atendeu a família, e segue os prazos desta seção.',
      'O link de um dia da substituta para de funcionar à meia-noite daquele dia, quando a rota é encerrada, quando o motorista o encerra ou quando a conta dele deixa de operar. Do link, guardamos só o nome dela, o dia, quando ele deixou de valer e o resumo cifrado do segredo, enquanto a conta do motorista existir.',
      'Após esses prazos, os dados são apagados ou anonimizados.',
    ],
  },
  {
    id: 'direitos',
    title: '9. Direitos do Titular',
    paragraphs: [
      'Conforme o art. 18 da LGPD, você tem direito a:',
      '(a) confirmação da existência de tratamento;',
      '(b) acesso aos dados;',
      '(c) correção de dados incompletos, inexatos ou desatualizados;',
      '(d) anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;',
      '(e) portabilidade dos dados a outro fornecedor;',
      '(f) eliminação dos dados tratados com seu consentimento;',
      '(g) informação sobre entidades com as quais compartilhamos dados;',
      '(h) informação sobre a possibilidade de não fornecer consentimento e suas consequências;',
      '(i) revogação do consentimento;',
      '(j) oposição a tratamento que viole a LGPD.',
      `Para exercer esses direitos, envie e-mail para ${COMPANY_INFO.dpoEmail} com seu nome completo, e-mail da conta e descrição da solicitação. Responderemos em até 15 (quinze) dias. O responsável pode fazer o pedido também pelos dados da criança sob sua guarda.`,
      'Quando o pedido for sobre dados da turma de um motorista (seção 2, item a), ele é atendido junto com o motorista, que é o controlador desses dados, ou encaminhado a ele — e você é avisado do encaminhamento. Algumas informações você mesmo corrige ou apaga no Aplicativo, como as de saúde da criança e a resposta sobre a foto da turma.',
      `A AUXILIAR pode ocultar ou apagar a qualquer momento, no Aplicativo, a recomendação que recebeu. Para o resto — o vínculo, os recibos, as faltas registradas pelo motorista, a nota que ela deu ou a própria conta —, o pedido vai para ${COMPANY_INFO.dpoEmail}. Ao excluir a conta dela, as recomendações são apagadas automaticamente; os registros que são do negócio de cada motorista (vínculo, recibos e faltas) são tratados junto com ele, guardado o que a lei obriga.`,
      `A SUBSTITUTA, que não usa o Aplicativo, pode pedir ao motorista que a tire da lista dele — ele faz isso no próprio Aplicativo, em "Minhas substitutas" — ou pedir por ${COMPANY_INFO.dpoEmail}, informando o nome e o WhatsApp. Pelo e-mail, o pedido é atendido junto com o motorista, inclusive sobre o nome dela nas faltas que já cobriu.`,
    ],
  },
  {
    id: 'cookies',
    title: '10. Cookies e Tecnologias Similares',
    paragraphs: [
      'O Aplicativo usa cookies e armazenamento local (localStorage) para:',
      '(a) Cookies essenciais — necessários para autenticação e funcionamento básico (sessão, preferências de aceite). Não podem ser desativados;',
      '(b) Cookies analíticos — métricas de uso das telas, pelo Google Analytics, para melhorar o produto. Coletados apenas com seu consentimento.',
      'Você pode gerenciar suas preferências de cookies a qualquer momento pelo aviso exibido na primeira visita ou pelo seu navegador.',
    ],
  },
  {
    id: 'transferencia',
    title: '11. Transferência Internacional',
    paragraphs: [
      // ⚠️ ESTA SEÇÃO DIZIA "NOSSOS SERVIDORES PODEM ESTAR FORA", enquanto a 2b
      // dizia São Paulo — as duas eram meia verdade. O banco e as funções
      // ficam em São Paulo (`southamerica-east1`); o que sai do país são
      // serviços globais (login, notificações, métricas) e os terceiros
      // listados na 2b.
      'O banco de dados e as funções do servidor ficam em São Paulo, no Brasil. Alguns serviços, porém, podem processar dados fora do país: o login, as notificações no celular e as métricas do Google (que operam em servidores globais), o Resend (Estados Unidos), o Nominatim (Reino Unido), o MapTiler (Suíça) e o DiceBear (Alemanha), na medida descrita na seção 2b.',
      'Essas transferências se apoiam no art. 33 da LGPD: em cláusulas contratuais padrão, quando o fornecedor as oferece (inciso II), ou na necessidade de executar o serviço pedido pelo usuário (inciso IX, combinado com o art. 7º, V). Em todos os casos, só é enviado o necessário para a tarefa daquele serviço.',
    ],
  },
  {
    id: 'alteracoes',
    title: '12. Alterações desta Política',
    paragraphs: [
      'Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas com antecedência mínima de 15 (quinze) dias por email e por aviso no Aplicativo.',
      'O uso continuado após a vigência da nova versão implica aceite. Caso discorde, você pode encerrar sua conta antes da entrada em vigor.',
    ],
  },
  {
    id: 'contato-privacidade',
    title: '13. Contato',
    paragraphs: [
      `Encarregado pelo Tratamento de Dados Pessoais: ${ENCARREGADO}. Este é o canal único para qualquer assunto de privacidade e proteção de dados.`,
      `Atendimento geral: ${COMPANY_INFO.email}.`,
      'Você também pode registrar reclamações junto à Autoridade Nacional de Proteção de Dados (ANPD): https://www.gov.br/anpd.',
    ],
  },
];
