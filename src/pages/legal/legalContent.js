import {
  DEV_CIDADE_UF,
  DEV_CNPJ,
  DEV_COMARCA,
  DEV_ENDERECO,
  DEV_NAME,
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
 * ⚠️ AINDA FALTA O ENDEREÇO COMPLETO em `COMPANY_INFO.enderecoCompleto` — o
 * único campo destes documentos que ninguém pode preencher por inferência.
 * Ver o aviso lá.
 */
export const LEGAL_VERSION = '1.1';
export const LEGAL_DATE = '9 de setembro de 2026';

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
 * ⚠️ FALTA O NÚMERO E O CEP, e só isso. Logradouro, cidade e UF vêm de
 * `config/developer.js`, alimentado pelo rodapé "Onde estamos" da landing —
 * mesma informação, mesmo domínio, mesmo público. Número e CEP não existem no
 * repositório: complete `DEV_LOGRADOURO` lá e estes documentos mudam junto.
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
  razaoSocial: DEV_NAME,
  cnpj: DEV_CNPJ,
  cidade: DEV_CIDADE_UF,
  endereco: DEV_ENDERECO,
  email: 'contato@alobuzinou.com',
  dpoEmail: 'contato@alobuzinou.com',
};

/** Como o controlador se identifica por extenso, num documento legal. */
export const CONTROLADOR_POR_EXTENSO =
  `${COMPANY_INFO.razaoSocial} ("${COMPANY_INFO.name}"), ` +
  `CNPJ ${COMPANY_INFO.cnpj}, com sede em ${COMPANY_INFO.endereco}`;

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
      'O Aplicativo é uma ferramenta digital destinada à gestão e ao acompanhamento de transporte escolar privado, oferecida em duas modalidades de uso:',
      '(a) Motorista (Tio): cadastro de crianças, gerenciamento de rotas, controle financeiro e comunicação com responsáveis;',
      '(b) Responsável (Pai/Mãe): acompanhamento em tempo real do trajeto da criança, status do transporte e gerenciamento de pagamentos.',
    ],
  },
  {
    id: 'cadastro',
    title: '3. Cadastro e Conta',
    paragraphs: [
      'Para usar o Aplicativo é necessário criar uma conta com email válido e senha pessoal. Você é responsável por manter a confidencialidade das suas credenciais.',
      'Você deve fornecer informações verdadeiras, atuais e completas. O fornecimento de dados falsos pode resultar em suspensão ou exclusão da conta.',
      'O cadastro do responsável depende de um código de convite gerado pelo motorista após o cadastro da criança.',
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
      'O Aplicativo é uma ferramenta de apoio operacional; não substitui sua responsabilidade legal sobre o transporte e a segurança das crianças.',
      `${COMPANY_INFO.name} não é responsável por incidentes durante o transporte, atrasos, mudanças de rota, problemas mecânicos ou questões trabalhistas/contratuais entre motorista e responsáveis.`,
    ],
  },
  {
    id: 'responsabilidades-responsavel',
    title: '6. Responsabilidades do Responsável',
    paragraphs: [
      'Você declara ter autoridade legal sobre a criança cadastrada (poder familiar, guarda ou tutela) e autorizar expressamente o tratamento dos dados pessoais dela conforme nossa Política de Privacidade.',
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
    ],
  },
  {
    id: 'localizacao',
    title: '8. Geolocalização',
    paragraphs: [
      'O Aplicativo coleta a localização em tempo real do veículo do motorista (somente quando ele inicia uma rota) e o exibe aos responsáveis das crianças associadas.',
      'A coleta ocorre exclusivamente quando o motorista ativa o tracking — não há monitoramento em segundo plano nem fora dos horários de rota.',
      'O endereço residencial cadastrado pelo motorista é usado para roteamento e exibição no mapa do responsável correspondente.',
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
      `Você pode encerrar sua conta a qualquer momento solicitando exclusão pelo email ${COMPANY_INFO.email}. O exercício desse direito está descrito na Política de Privacidade.`,
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
      `Para assuntos relacionados a privacidade e proteção de dados, fale com nosso Encarregado (DPO): ${COMPANY_INFO.dpoEmail}.`,
    ],
  },
];

export const PRIVACY_SECTIONS = [
  {
    id: 'introducao',
    title: '1. Introdução',
    paragraphs: [
      `Esta Política de Privacidade descreve como o ${COMPANY_INFO.name} ("nós", "Aplicativo") coleta, usa, compartilha e protege dados pessoais, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).`,
      `Ao usar o Aplicativo, você concorda com as práticas descritas aqui. Para fins desta Política, considere "Titular" qualquer pessoa cujos dados são tratados, incluindo motoristas, responsáveis e crianças cadastradas.`,
    ],
  },
  {
    id: 'controlador',
    title: '2. Controlador de Dados',
    paragraphs: [
      `O controlador dos dados pessoais tratados no Aplicativo é ${CONTROLADOR_POR_EXTENSO}.`,
      `Encarregado pelo Tratamento de Dados Pessoais (DPO): ${COMPANY_INFO.dpoEmail}.`,
    ],
  },
  {
    id: 'operadores',
    title: '2b. Com quem os dados são compartilhados',
    paragraphs: [
      // ⚠️ ESTA SEÇÃO FALTAVA, e a §6 listava só Firebase/Google.
      //
      // Dois operadores recebem dado pessoal e não estavam declarados — um
      // deles internacional, com NOME DE CRIANÇA no corpo do e-mail. LGPD
      // art. 9º II (informação sobre compartilhamento) e art. 33
      // (transferência internacional).
      'Google Firebase (Google LLC): hospedagem, autenticação, banco de dados, armazenamento de arquivos e notificações. Servidores no Brasil (São Paulo) para o banco de dados e as funções.',
      'Resend (Estados Unidos): envio dos e-mails transacionais de cobrança. Recebe o nome e o e-mail do responsável e o primeiro nome da criança, apenas para compor a mensagem.',
      'Asaas (Brasil): emissão das cobranças da taxa de associação devida pelo motorista à plataforma. Recebe nome, CPF/CNPJ, e-mail e telefone do MOTORISTA. Nenhum dado de responsável ou de criança é enviado ao Asaas — a mensalidade da família não passa pela plataforma.',
      'A transferência internacional para o Resend se apoia no art. 33, II da LGPD (cláusulas contratuais padrão do fornecedor) e se limita ao necessário para o envio do aviso de vencimento.',
      'Não vendemos, alugamos nem cedemos dados pessoais a terceiros para fins publicitários.',
    ],
  },
  {
    id: 'dados-coletados',
    title: '3. Dados Coletados',
    paragraphs: [
      'Coletamos os seguintes dados pessoais:',
      '(a) De motoristas: nome, email, telefone, senha (criptografada), chave PIX, dados de geolocalização durante rotas ativas;',
      '(b) De responsáveis: nome, email, telefone, senha (criptografada), informações sobre a relação com a criança;',
      '(c) De crianças (cadastradas pelo motorista com consentimento do responsável): nome, gênero, escola, endereço residencial, endereço da escola, observações relevantes ao transporte (alergias, instruções especiais), turnos de transporte, status de mensalidades;',
      '(d) Dados técnicos: endereço IP, identificadores de dispositivo, versão do navegador, registros de acesso (logs);',
      '(e) Dados de uso: interações com o Aplicativo (não usamos rastreadores de terceiros para fins de marketing).',
    ],
  },
  {
    id: 'menores',
    title: '4. Tratamento de Dados de Crianças',
    paragraphs: [
      'O tratamento de dados pessoais de crianças e adolescentes ocorre sempre no melhor interesse da criança, conforme o art. 14 da LGPD.',
      'Os dados são fornecidos exclusivamente pelo motorista, mediante consentimento expresso do responsável legal — manifestado durante o aceite destes termos no primeiro acesso.',
      'Não coletamos dados das crianças diretamente. Apenas pelo motorista para fins operacionais (transporte seguro).',
      'Não usamos os dados das crianças para perfilamento, marketing, publicidade ou compartilhamento com terceiros para fins comerciais.',
    ],
  },
  {
    id: 'finalidades',
    title: '5. Finalidades e Bases Legais',
    paragraphs: [
      'Os dados são tratados para as seguintes finalidades, sob as bases legais aplicáveis (art. 7º e 11 da LGPD):',
      '(a) Execução do contrato de prestação do serviço de transporte escolar — base: execução de contrato (art. 7º, V);',
      '(b) Cumprimento de obrigações legais e regulatórias — base: obrigação legal (art. 7º, II);',
      '(c) Geolocalização durante rotas — base: consentimento do titular (art. 7º, I);',
      '(d) Comunicação com responsáveis (notificações, status, alertas) — base: legítimo interesse (art. 7º, IX);',
      '(e) Tratamento de dados de crianças — base: melhor interesse da criança com consentimento dos responsáveis (art. 14).',
    ],
  },
  {
    id: 'compartilhamento',
    title: '6. Compartilhamento de Dados',
    paragraphs: [
      'Compartilhamos dados pessoais apenas com:',
      '(a) Responsáveis das crianças associadas — no escopo necessário para o serviço (status do transporte, localização da perua durante rota);',
      '(b) Operadores técnicos (Firebase/Google Cloud) — armazenamento e autenticação, como processadores de dados sob contrato;',
      '(c) Autoridades competentes — quando exigido por ordem judicial ou obrigação legal.',
      'Não vendemos, alugamos ou cedemos dados pessoais para terceiros com finalidade de marketing ou publicidade.',
    ],
  },
  {
    id: 'armazenamento',
    title: '7. Armazenamento e Segurança',
    paragraphs: [
      'Os dados são armazenados em servidores da Google Cloud Platform (Firebase), com criptografia em trânsito (HTTPS/TLS) e em repouso.',
      'Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda, alteração ou divulgação, conforme padrões da indústria.',
      'Apesar disso, nenhum sistema é 100% seguro. Em caso de incidente de segurança que afete dados pessoais, comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados conforme o art. 48 da LGPD.',
    ],
  },
  {
    id: 'retencao',
    title: '8. Período de Retenção',
    paragraphs: [
      'Mantemos os dados enquanto a conta estiver ativa e enquanto necessário para as finalidades descritas.',
      'Após encerramento da conta, dados financeiros podem ser retidos pelo prazo de 5 (cinco) anos para cumprimento de obrigações fiscais e contábeis (art. 16, II da LGPD). O registro de mensalidades é apagado automaticamente após esse prazo.',
      'Localização em tempo real é mantida apenas durante a rota ativa; ao encerrar, mantém-se apenas o último ponto registrado para fins de auditoria limitada.',
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
      `Para exercer esses direitos, envie email para ${COMPANY_INFO.dpoEmail} com seu nome completo, email da conta e descrição da solicitação. Responderemos em até 15 (quinze) dias.`,
    ],
  },
  {
    id: 'cookies',
    title: '10. Cookies e Tecnologias Similares',
    paragraphs: [
      'O Aplicativo usa cookies e armazenamento local (localStorage) para:',
      '(a) Cookies essenciais — necessários para autenticação e funcionamento básico (sessão, preferências de aceite). Não podem ser desativados;',
      '(b) Cookies analíticos — métricas anônimas de uso para melhorar o produto. Coletados apenas com seu consentimento.',
      'Você pode gerenciar suas preferências de cookies a qualquer momento pelo aviso exibido na primeira visita ou pelo seu navegador.',
    ],
  },
  {
    id: 'transferencia',
    title: '11. Transferência Internacional',
    paragraphs: [
      'Como nossos servidores (Google Firebase) podem estar localizados em data centers fora do Brasil, dados pessoais podem ser transferidos internacionalmente.',
      'Adotamos garantias contratuais com nossos processadores conforme art. 33 da LGPD, assegurando nível adequado de proteção.',
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
      `Encarregado pelo Tratamento (DPO): ${COMPANY_INFO.dpoEmail}.`,
      `Atendimento geral: ${COMPANY_INFO.email}.`,
      'Você também pode registrar reclamações junto à Autoridade Nacional de Proteção de Dados (ANPD): https://www.gov.br/anpd.',
    ],
  },
];
