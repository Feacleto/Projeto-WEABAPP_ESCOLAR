// Formatadores e constantes de exibição em formato brasileiro.

/**
 * Arredonda dinheiro pro centavo. Use no FIM de toda soma.
 *
 * Trinta mensalidades de R$ 287,50 somadas em `reduce` dão
 * 8624.999999999998. `formatCurrency` esconde (mostra R$ 8.625,00), então
 * ninguém vê — até o número entrar numa COMPARAÇÃO. E entra: `total === 0`
 * decide se uma fatura está quitada.
 *
 * O `taxaService` já fazia isso, com o motivo escrito, numa função privada
 * chamada `centavos`. O resto do app somava direto: o recebido do mês, a
 * dívida acumulada, o total de despesas por categoria, a receita da
 * plataforma no painel do dono.
 *
 * Arredondar UMA vez no fim, e não a cada parcela: arredondar no meio acumula
 * o erro em vez de eliminá-lo.
 */
export function emCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/**
 * O primeiro nome — a forma como o app chama as pessoas.
 *
 * Estava reinventado em 40 lugares, com dois problemas.
 *
 * O primeiro é visível: `.split(' ')[0]` sem fallback renderiza literalmente
 * `undefined` quando o nome falta — acontecia na lista de aniversariantes e
 * no toast do aviso da agenda.
 *
 * O segundo é de voz: os fallbacks divergiam entre 'Aluno', 'a criança',
 * 'seu filho', 'Criança', 'A criança', 'Você', 'Tio' e ''. Num app que
 * escolhe cada palavra com cuidado, a mesma ausência de nome aparecia de oito
 * jeitos. O fallback é parâmetro porque ele DEPENDE do lugar: numa lista de
 * crianças 'a criança' cabe, num cumprimento não.
 *
 * `split` por espaços com `trim()`, e não `split(' ')`: nome com espaço à esquerda
 * ou espaço duplo devolvia string vazia na versão ingênua.
 */
export function primeiroNome(nome, fallback = '') {
  const limpo = String(nome ?? '').trim();
  if (!limpo) return fallback;
  return limpo.split(/\s+/)[0] || fallback;
}

/**
 * Dinheiro na TELA. Vazio vira travessão.
 *
 * "—" diz "não há número aqui"; "R$ 0,00" diz "o número é zero". Num painel,
 * a diferença é entre um dado que não carregou e um mês sem receita.
 */
export function formatCurrency(value) {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

/**
 * Dinheiro em DOCUMENTO. Vazio vira R$ 0,00.
 *
 * A diferença para `formatCurrency` é deliberada e as duas continuam
 * existindo: num contrato ou numa mensagem de cobrança, travessão não é
 * resposta — o documento precisa afirmar um valor, e "zero" é uma afirmação.
 *
 * ESTAVA ESCRITA EM QUATRO LUGARES: aqui não, mas em `contractService`,
 * `notificationsService` e `PixBlock`, mais uma variante curta. A cópia de
 * `notificationsService` vinha sob o comentário "evita dependência circular
 * com compartilhado/formatters" — e o ciclo NÃO EXISTIA: este arquivo não tem uma
 * única linha de `import`. Era uma justificativa falsa mantendo viva uma
 * divergência real, e cinco componentes importavam um service que fala com o
 * Firestore só para formatar moeda.
 */
export function formatBRL(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

// Aceita Date, timestamp do Firestore (com .toDate()), ou ISO string.
export function formatDate(input) {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(input) {
  const d = toDate(input);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatMonthLabel(monthKey) {
  // Recebe "YYYY-MM" e retorna "Abril/2026"
  if (!monthKey) return '—';
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatPhone(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/**
 * O E-MAIL PARA CONFERIR, NÃO PARA LER.
 *
 * Usado na tela de redefinir senha: ela precisa RECONHECER o endereço que
 * pediu o link ("é a minha conta mesmo?"), e reconhecer não exige ler o
 * endereço inteiro. A tela pode ser vista por cima do ombro numa fila de
 * escola, e o link chega por e-mail, que é o canal que já vaza.
 *
 * ⚠️ O NÚMERO DE PONTOS É FIXO, e isso é a parte que se erra por descuido.
 * Mascarar com um ponto por caractere escondido devolve o COMPRIMENTO do
 * endereço — que é informação de graça para quem estiver adivinhando. Quatro
 * pontos sempre, independente do tamanho.
 *
 * A régua: no máximo 4 caracteres visíveis, e nunca mais que a metade da
 * parte local. Endereço curto mostra menos, não proporcionalmente mais.
 *
 *   mascararEmail('maria.silva@gmail.com')  → 'mari••••@gmail.com'
 *   mascararEmail('ana@escola.com')         → 'a••••@escola.com'
 *
 * Devolve a entrada intacta quando não há o que mascarar (texto sem arroba,
 * ou arroba na primeira posição): inventar máscara para algo que não é
 * e-mail esconderia o defeito de quem passou o valor errado.
 */
export function mascararEmail(email) {
  const texto = String(email ?? '').trim();
  const arroba = texto.lastIndexOf('@');
  if (arroba < 1) return texto;

  const local = texto.slice(0, arroba);
  const metade = Math.floor(local.length / 2);
  const visiveis = Math.max(local.length >= 2 ? 1 : 0, Math.min(4, metade));
  return `${local.slice(0, visiveis)}••••${texto.slice(arroba)}`;
}

// "YYYY-MM" do mês corrente — usado como chave de payments
export function getCurrentMonthKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export const PERIOD_LABELS = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

function toDate(input) {
  if (!input) return null;
  if (input?.toDate) return input.toDate(); // Firestore Timestamp
  if (input instanceof Date) return input;
  const d = new Date(input);
  return isNaN(d) ? null : d;
}

/**
 * Distância no tempo em português coloquial, com "tom" pra colorir o pill.
 * Retorna { label, tone } onde tone é uma das categorias:
 *   - 'today'      → hoje (verde, destaque)
 *   - 'yesterday'  → ontem (amarelo)
 *   - 'recent'     → essa semana (azul claro)
 *   - 'older'      → mais antigo (cinza)
 *
 * Exemplos:
 *   agora           → { label: 'Hoje',         tone: 'today' }
 *   ontem           → { label: 'Ontem',        tone: 'yesterday' }
 *   2 dias atrás    → { label: 'Há 2 dias',    tone: 'recent' }
 *   8 dias atrás    → { label: 'Há 1 semana',  tone: 'older' }
 *   45 dias atrás   → { label: 'Há 1 mês',     tone: 'older' }
 */
/**
 * DIAS INTEIROS DE CALENDÁRIO entre dois instantes — não períodos de 24h.
 *
 * ── ⚠️ POR QUE ISTO PRECISOU VIRAR UMA FUNÇÃO
 * Quatro lugares faziam `Math.floor((Date.now() - d) / 86400000)` e chamavam
 * o resultado de "dias". Isso conta PERÍODOS DE 24 HORAS, e a diferença
 * aparece justamente nos rótulos que as pessoas leem:
 *
 *   a mãe declara a ausência ontem às 20h e abre a tela hoje às 8h — doze
 *   horas, zero períodos — e a tela diz **"hoje"**;
 *   o motorista abre a rota às 6h30 com uma ausência declarada ontem às 21h
 *   e o carimbo "ontem" **não aparece**, então ele lê a falta como recém
 *   declarada e não confere;
 *   a fatura vence dia 10 ao meio-dia, ele abre o app dia 13 às 9h — 2,875
 *   períodos — e o cartão diz **"venceu há 2 dias"**.
 *
 * A régua certa já existia neste arquivo, dentro de `formatRelativeTime`:
 * zerar a hora dos dois lados antes de subtrair. Ela estava presa lá dentro,
 * e por isso foi reescrita errada em quatro lugares.
 *
 * `Math.round` e não `floor` depois de zerar: o horário de verão não existe
 * mais no Brasil, mas um dia de 23 ou 25 horas em qualquer outro fuso daria
 * 0,958 dia, e `floor` transformaria ontem em hoje de novo.
 *
 * Positivo quando `ate` é depois de `de`.
 */
export function diasDeCalendario(de, ate = new Date()) {
  const a = toDate(de);
  const b = toDate(ate);
  if (!a || !b) return null;

  const inicio = new Date(a);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(b);
  fim.setHours(0, 0, 0, 0);
  return Math.round((fim - inicio) / 86400000);
}

export function formatRelativeTime(input, now = new Date()) {
  const d = toDate(input);
  if (!d) return { label: '—', tone: 'older' };

  // Zera horário pra comparar "dias inteiros" — evita "ontem de manhã virar hoje"
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffMs = today - start;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: 'Hoje', tone: 'today' };
  if (diffDays === 1) return { label: 'Ontem', tone: 'yesterday' };
  if (diffDays < 7) {
    return { label: `Há ${diffDays} dias`, tone: 'recent' };
  }
  if (diffDays < 14) return { label: 'Há 1 semana', tone: 'older' };
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return { label: `Há ${weeks} semanas`, tone: 'older' };
  }
  if (diffDays < 60) return { label: 'Há 1 mês', tone: 'older' };
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return { label: `Há ${months} meses`, tone: 'older' };
  }
  const years = Math.floor(diffDays / 365);
  return {
    label: years === 1 ? 'Há 1 ano' : `Há ${years} anos`,
    tone: 'older',
  };
}

/**
 * Idade em anos a partir de `birthDate` ('YYYY-MM-DD').
 *
 * Existe pra a lista de crianças poder dizer "Miguel, 7 anos" — a idade é o
 * que o tio usa pra distinguir dois irmãos e pra saber com quem está
 * falando na porta. Devolve null quando não há data, e o chamador
 * simplesmente omite.
 */
export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  // Ainda não fez aniversário este ano.
  const beforeBirthday =
    today.getMonth() < d.getMonth() ||
    (today.getMonth() === d.getMonth() && today.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;

  if (age < 0 || age > 30) return null; // data digitada errada
  return age;
}

/** "7 anos" / "1 ano" — ou null quando não há data. */
export function formatAge(birthDate) {
  const age = ageFromBirthDate(birthDate);
  if (age == null) return null;
  return age === 1 ? '1 ano' : `${age} anos`;
}

/**
 * Soma (ou subtrai) meses de uma chave 'YYYY-MM'.
 *
 * Estava definida dentro do TioFinance. Subiu pra cá quando o seletor de
 * mês passou a ser compartilhado com a tela de despesas — duas cópias da
 * mesma aritmética de data divergem na primeira correção.
 *
 * Usa `new Date(y, m - 1 + delta, 1)`, que já trata a virada de ano: mês
 * 13 vira janeiro do ano seguinte sem código extra.
 */
export function addMonths(monthKey, delta) {
  const [y, m] = String(monthKey).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monta o endereço de uma linha a partir das partes que o ViaCEP devolve,
 * mais o número e o complemento que a pessoa digita.
 *
 * Saída no formato dos Correios — `Logradouro, número, complemento — Bairro,
 * Cidade/UF`:
 *
 *   Avenida Paulista, 1578, apto 42 — Bela Vista, São Paulo/SP
 *
 * ── O CASO QUE DERRUBA A VERSÃO INGÊNUA: `logradouro` VAZIO
 * Interpolar as partes num template devolve `", 123 — , /SP"` sempre que uma
 * delas falta, e ELAS FALTAM. Cidade pequena costuma ter um CEP único para o
 * município inteiro, e aí o ViaCEP responde com `logradouro` e `bairro` em
 * branco — só `localidade` e `uf`. Empresa grande e prédio dos Correios têm
 * CEP próprio, com o mesmo efeito. Então cada junção é filtrada antes de
 * existir, e um endereço só com cidade sai `Socorro/SP`, limpo.
 *
 * ── E O NÚMERO SEM RUA FICA
 * Quando não há logradouro, um número solto produz `123 — Socorro/SP`, que é
 * estranho. A tentação é descartá-lo. Mas apagar em silêncio o que a pessoa
 * acabou de digitar é a pior das duas falhas: ela vê o campo preenchido, salva,
 * e o número não está no endereço. Estranho ela conserta; invisível, não.
 * A saída pra esse caso é o campo livre, que a opção do formulário mantém.
 */
/**
 * Monta a CONSULTA que vai pro geocodificador a partir das partes do endereço.
 *
 * ── ELA NÃO É O ENDEREÇO QUE APARECE NA TELA, E ISSO É DE PROPÓSITO
 * O que a pessoa lê é `montarEndereco`, logo abaixo, no formato dos Correios
 * (`Avenida Paulista, 1578 — Bela Vista, São Paulo/SP`). O que o Nominatim lê é
 * outra coisa: número ANTES do nome da rua, que é a forma que o parser dele
 * espera (`1600 Pennsylvania Ave` está na documentação). São duas strings com
 * dois leitores, e forçar uma só pioraria a de alguém.
 *
 * ── O COMPLEMENTO FICA DE FORA
 * "apto 42" e "fundos" não existem no mapa. Mandar isso na consulta só dá ao
 * parser texto que ele não sabe encaixar, e o encaixe errado custa a rua.
 *
 * ── POR QUE NÃO A BUSCA ESTRUTURADA DO NOMINATIM
 * Ele aceita `street`/`city`/`state`/`postalcode` em campos separados, e a
 * documentação promete mais precisão. O problema é que esses campos são
 * combinados com E: um campo que o OSM não tem para aquele endereço não baixa
 * a pontuação do resultado, ele ELIMINA o resultado. A cobertura de CEP e de
 * `state` no Brasil é irregular, então o modo "mais preciso" devolveria ZERO
 * justamente nas cidades onde o dado é mais pobre — e zero resultado é a tela
 * de "não achamos" para um endereço que existe.
 *
 * ── E "Brasil" VAI SEMPRE NO FIM
 * O `countrycodes=br` da requisição já restringe o país, e mesmo assim o nome
 * entra na frase: quem chama esta função pode não ser quem monta a URL, e uma
 * consulta que só está certa por causa de um parâmetro em outro arquivo é a
 * garantia que se perde na primeira refatoração.
 *
 * Que a falta do país custa caro está SONDADO, não suposto: em 10/09/2026,
 * "Rua Augusta, 100" e "Avenida da Liberdade, 100" voltaram as duas de LISBOA
 * no Nominatim sem a restrição de país — e as duas são ruas brasileiras banais.
 */
export function consultaDoEndereco({
  logradouro,
  numero,
  bairro,
  localidade,
  uf,
} = {}) {
  const limpo = (v) => String(v ?? '').trim();
  const rua = [limpo(numero), limpo(logradouro)].filter(Boolean).join(' ');
  return [rua, limpo(bairro), limpo(localidade), limpo(uf), 'Brasil']
    .filter(Boolean)
    .join(', ');
}

export function montarEndereco({
  logradouro,
  numero,
  complemento,
  bairro,
  localidade,
  uf,
} = {}) {
  const limpo = (v) => String(v ?? '').trim();

  const rua = [limpo(logradouro), limpo(numero), limpo(complemento)]
    .filter(Boolean)
    .join(', ');

  const cidadeUf = [limpo(localidade), limpo(uf)].filter(Boolean).join('/');
  const regiao = [limpo(bairro), cidadeUf].filter(Boolean).join(', ');

  return [rua, regiao].filter(Boolean).join(' — ');
}

/**
 * O RESUMO DE UM TEXTO LONGO PARA CABER NUM AVISO.
 *
 * ── POR QUE ISTO PRECISOU EXISTIR
 * Os três avisos de agenda mandavam, no corpo do push, o RÓTULO DO TIPO em vez
 * do recado: a mãe recebia *"Novo aviso sobre Lucas · Recado"* e tinha que
 * abrir o app para saber se importava. São os avisos mais frequentes do
 * produto — depois de três "Recado" ela para de abrir, e aí o quarto, que era
 * o importante, também não é lido.
 *
 * O corpo passa a carregar o conteúdo. Como o recado pode ter até 1500
 * caracteres e o push mostra umas duas linhas, ele precisa ser encurtado — e
 * encurtar bem é o trabalho desta função.
 *
 * ── CORTA NA PALAVRA, NUNCA NA LETRA
 * "vai atrasar 15 minu…" é pior que uma frase mais curta e inteira. O corte
 * volta até o último espaço, e só então acrescenta a reticência.
 *
 * ── E A FRASE INTEIRA VENCE O CORTE
 * Se o texto termina antes do limite, ele sai limpo, sem reticência. A maior
 * parte dos recados é curta — cortar o que já cabia seria inventar um problema.
 */
export function resumirParaAviso(texto, limite = 90) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= limite) return t;

  const cortado = t.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  // Texto sem espaço nenhum (um link colado, por exemplo) não tem onde
  // quebrar: corta na letra mesmo, que é melhor que devolver o texto inteiro.
  const base = ultimoEspaco > limite * 0.5 ? cortado.slice(0, ultimoEspaco) : cortado;
  return `${base.replace(/[.,;:!?\s]+$/, '')}…`;
}
