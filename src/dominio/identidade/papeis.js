/**
 * Os três papéis do app, e pra onde cada um vai.
 *
 * O NOME `admin` NÃO QUER DIZER DONO
 * Ele é histórico e confunde: no código inteiro `role: 'admin'` significa
 * MOTORISTA — quem opera uma perua. É esse papel que libera criança,
 * pagamento, rota e agenda.
 *
 * Quem administra a PLATAFORMA é outro: aprova motorista, abre e fecha
 * depoimento, olha os números do negócio. Esse é `role: 'owner'`.
 *
 * POR QUE ISTO VIROU PAPEL, E NÃO CONTINUOU UMA FLAG
 * Antes o dono era um motorista com `superAdmin: true` por cima, porque as
 * leituras do painel exigiam papel de motorista. O efeito era que ele entrava
 * no /tio e mexia na operação de um parceiro — abria rota, editava criança,
 * dava baixa em pagamento. Nada disso é dele. E ainda entrava na contagem de
 * parceiros da própria plataforma.
 *
 * Agora a separação é de papel, e vale nos dois lados: as rules têm
 * `isOwner()` e a interface tem isto.
 *
 * O DONO É UMA CONTA SÓ — E O FALLBACK `superAdmin` AINDA ESTÁ AQUI
 *
 * Este parágrafo dizia que o fallback "foi REMOVIDO". Não foi: ele está na
 * última linha de `ehDono()`, e o comentário lá dentro sempre explicou por
 * quê. O cabeçalho descrevia o destino como se fosse o presente, e as duas
 * coisas conviveram no mesmo arquivo, uma contradizendo a outra.
 *
 * O que continua verdadeiro é o ARGUMENTO: ponte que ninguém atravessa vira
 * porta dos fundos. Enquanto duas coisas diferentes derem poder de dono,
 * "quantos donos existem?" não tem resposta olhando o código — depende de
 * quantos docs têm um booleano esquecido. Quando a conta do dono for migrada
 * para `role: 'owner'` pelo console, o fallback sai de `ehDono()` e de
 * `functions/lib/papeis.js`, e aí a pergunta vira uma query só.
 *
 * Até lá, o número de donos se confere assim, e está escrito porque não é
 * óbvio:
 *   users where role == 'owner'  +  users where superAdmin == true
 *
 * A MIGRAÇÃO É MANUAL, E TEM QUE VIR ANTES
 * O cliente não escreve `role` (foi assim que a auto-promoção foi fechada),
 * então a conta do dono passa a `role: 'owner'` pelo console. Publicar esta
 * versão ANTES da migração tranca o dono fora do próprio painel — a conta
 * antiga (`role: 'admin'` + `superAdmin`) cai como motorista.
 */

/** É o dono da plataforma? */
export function ehDono(profile) {
  // `superAdmin` continua valendo, e o motivo é o dono não ter outra prova.
  //
  // O papel `owner` é o destino, e conta nova nasce com ele. Mas a conta do
  // dono hoje é `role: 'admin'` + `superAdmin: true`, e migrar exige console
  // — a regra proíbe escrever `role` pelo cliente, que foi como a
  // auto-promoção do motorista se fechou. Exigir só `owner` trancaria ele
  // fora do próprio painel, e o conserto não existiria dentro do app.
  //
  // Aceitar não afrouxa nada: `superAdmin` está entre as chaves que nenhum
  // cliente escreve, e a sondagem confirma isso contra produção (HTTP 403).
  // Documento que tem esse campo recebeu do console ou do Admin SDK.
  return profile?.role === 'owner' || profile?.superAdmin === true;
}

/** É motorista (opera uma perua)? */
export function ehMotorista(profile) {
  return profile?.role === 'admin';
}

/** É responsável? */
export function ehResponsavel(profile) {
  return profile?.role === 'parent';
}

/**
 * Motorista que se inscreveu e ainda não foi aprovado.
 *
 * A INSCRIÇÃO É O CADASTRO. Não existe "entrar na lista" e depois "criar
 * conta": quem preenche a lista de associados sai dali com conta criada, entra
 * no app e vê a própria posição na fila. O que falta é a aprovação do dono,
 * que é negociada fora do sistema.
 *
 * POR QUE ISTO É PAPEL, E NÃO `role: 'admin'` + `ativo: false`
 * Esta é a decisão que decide se o desenho falha pro lado seguro.
 *
 * Com flag, ele JÁ É motorista pra toda regra do Firestore, e cada uma
 * precisaria lembrar de checar `ativo`. Uma que esquecesse — uma só, hoje ou
 * daqui a seis meses — e um inscrito não aprovado alcançaria criança,
 * pagamento e rota de quem já está dentro.
 *
 * Com papel próprio, `isAdmin()` é falso e ele não alcança nada. Esquecer uma
 * checagem faz ele ver MENOS, não mais. É a diferença entre uma garantia que
 * depende de vigilância e uma que depende da forma.
 *
 * ATENÇÃO: `isAppUser()` nas rules significa "tem documento em users" — e o
 * aguardando tem. Ele foi ajustado pra EXCLUIR este papel, senão a fila de
 * espera viraria porta pros recados de escola e pra agenda do parceiro atual.
 */
export function ehAguardando(profile) {
  return profile?.role === 'aguardando';
}

/**
 * O painel DESTE usuário — a resposta para "pra onde eu mando essa pessoa".
 *
 * Os três papéis são exclusivos, então a ordem aqui é só legibilidade — mas
 * ela segue a do produto: plataforma, operação, família.
 *
 * SEM PAPEL, A RESPOSTA É `/login` — E ANTES ERA `null`, QUE VIROU BUG
 * O docstring anterior dizia que devolver `null` era de propósito, pra "quem
 * chama decide o que fazer". Só que nenhum dos dois chamadores decidia nada:
 * `App.jsx` jogava o retorno direto em `<Navigate to={...}>`, nas duas rotas
 * protegidas. E `<Navigate to={null}>` não estoura — ele não navega e não
 * renderiza, ou seja, TELA BRANCA CALADA, sem nada no console (conferido em
 * teste com react-router 7.18.2 pela sessão do ErrorBoundary; nem o boundary
 * pega, porque nada é jogado).
 *
 * Doc de usuário sem `role` é raro e é defeito de dado — mas a resposta certa
 * pra ele não é sumir com a tela: é mandar pro login, que é a única página que
 * funciona sem papel nenhum. `/login` não devolve a pessoa pra cá em ciclo:
 * ele só redireciona quem tem `profile?.role` — como todos os outros
 * chamadores desta função, que já filtram por isso antes de navegar.
 */
export function painelDe(profile) {
  if (ehDono(profile)) return '/admin';
  if (ehMotorista(profile)) return '/tio';
  if (ehResponsavel(profile)) return '/pai';
  // Inscrito e ainda não aprovado tem uma tela só: a da fila. Ela vem ANTES
  // do fallback de propósito — sem isto ele cairia no /login, entraria de
  // novo, e voltaria pro /login num laço que parece o app estar quebrado.
  if (ehAguardando(profile)) return '/aguardando';
  return '/login';
}
