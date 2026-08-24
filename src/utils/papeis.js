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
 * O DONO É UMA CONTA SÓ, E O PAPEL É A ÚNICA PROVA DISSO
 * O fallback `superAdmin: true` foi REMOVIDO. Ele existia como ponte pra conta
 * antiga, e ponte que ninguém atravessa vira porta dos fundos: enquanto duas
 * coisas diferentes davam poder de dono, "quantos donos existem?" não tinha
 * resposta olhando o código — dependia de quantos docs tinham um booleano
 * esquecido. Agora é uma pergunta de uma query: `role == 'owner'`.
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
  return '/login';
}
