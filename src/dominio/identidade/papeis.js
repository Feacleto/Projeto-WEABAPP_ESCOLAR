/**
 * Os papéis do app — três nomeados, mais a AUSÊNCIA de papel, que é estado de produto e tem tela própria (`/comecar`), e pra onde cada um vai.
 *
 * O NOME `admin` NÃO QUER DIZER DONO
 * Ele é histórico e confunde: no código inteiro `role: 'admin'` significa
 * MOTORISTA — quem opera uma perua. É esse papel que libera criança,
 * pagamento, rota e agenda.
 *
 * Quem administra a PLATAFORMA é outro: acompanha a base, abre e fecha
 * depoimento, olha os números do negócio. Esse é `role: 'owner'`.
 *
 * Ele NÃO aprova mais motorista — a entrada virou autoatendimento em
 * 06/09/2026. Ver o bloco do papel `aguardando`, mais abaixo, que ficou como
 * registro do que existia e por quê.
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
 * O DONO PODE SER MAIS DE UMA CONTA, E O LEGADO `superAdmin` SAIU (06/09/2026)
 *
 * As duas coisas andaram juntas. `isOwner()` nas rules e `ehDono()` aqui
 * sempre checaram o PAPEL, nunca a identidade — então duas contas com
 * `role: 'owner'` sempre foram duas donas. O que dizia o contrário era um
 * comentário, e comentário não é regra.
 *
 * O fallback `superAdmin: true` existia porque a conta do dono do projeto
 * ANTIGO nasceu como motorista com a flag por cima, e migrar exigia console.
 * Esse projeto foi excluído. A base atual é zero e a conta de dono ainda vai
 * ser criada — então esta é a única janela em que o fallback pode sair sem
 * trancar ninguém, e ponte que ninguém atravessa vira porta dos fundos.
 *
 * ⚠️ CONSEQUÊNCIA DIRETA: a conta de dono precisa nascer com
 * `role: 'owner'`. `superAdmin: true` não abre mais nada — nem aqui, nem em
 * `functions/lib/papeis.js`, nem nas rules. Está escrito no `deploy.md`.
 *
 * E agora "quantos donos existem?" é uma query só:
 *   users where role == 'owner'
 */

/** É o dono da plataforma? Pode haver mais de um. */
export function ehDono(profile) {
  return profile?.role === 'owner';
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
 * O PAPEL `aguardando` DEIXOU DE EXISTIR EM 06/09/2026, junto com a
 * aprovação. A conta do motorista passou a nascer operando: ele preenche o
 * cadastro, entra e roda: quem controla o acesso agora é o TESTE DE TRÊS
 * MESES, não uma fila.
 *
 * Ficou registrado aqui porque o argumento que criou esse papel continua
 * valendo para o próximo estado que alguém for inventar: ele era PAPEL e não
 * `role: admin` + `ativo: false`, porque com flag cada regra do Firestore
 * precisaria lembrar de checar — e uma que esquecesse abriria criança,
 * pagamento e rota de quem já estava dentro. Com papel próprio, esquecer uma
 * checagem fazia ele ver MENOS, não mais.
 *
 * Se um dia voltar a existir "conta que existe mas não opera", que volte
 * assim: pela forma, não por um booleano.
 */


/**
 * O painel DESTE usuário — a resposta para "pra onde eu mando essa pessoa".
 *
 * Os três papéis são exclusivos, então a ordem aqui é só legibilidade — mas
 * ela segue a do produto: plataforma, operação, família.
 *
 * SEM PAPEL, A RESPOSTA É `/comecar` — E JÁ FOI `null`, QUE VIROU BUG
 *
 * ⚠️ ESTE TÍTULO DIZIA `/login`, E O CORPO ABAIXO EXPLICA `/comecar`.
 * Título é a linha que se lê com pressa, e este afirmava o comportamento de
 * duas versões atrás — numa função que decide para onde vai TODO MUNDO que
 * acaba de entrar. `/login` devolveria a pessoa para a tela de onde ela
 * acabou de vir.
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
  // SEM PAPEL NÃO É ERRO — É O ESTADO NORMAL DE QUEM ACABOU DE ENTRAR.
  //
  // A conta do Firebase nasce antes de qualquer escolha: quem toca em
  // "Entrar com Google" tem sessão válida e nenhum documento em `users`.
  // Isso deixou de ser lixo a ser apagado e virou um estado do produto — a
  // sala de espera com duas saídas da decisão 5.
  //
  // Antes daqui saía '/login', e com a conta órfã sendo apagada isso nunca
  // acontecia. Sem a limpeza, '/login' viraria laço: entra, não tem papel,
  // volta pro login, entra de novo.
  //
  // Uma sessão sem documento de usuário NÃO ALCANÇA NADA: toda leitura do
  // app passa por `isAppUser()` nas rules, que exige o documento. A conta
  // pendurada é inerte, não é porta aberta.
  return '/comecar';
}
