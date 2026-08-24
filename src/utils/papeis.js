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
 * COMPATIBILIDADE
 * `superAdmin: true` continua sendo aceito como dono pra não quebrar conta
 * antiga, mas quem manda é o papel. Conta nova nasce com `role: 'owner'`.
 */

/** É o dono da plataforma? */
export function ehDono(profile) {
  if (!profile) return false;
  return profile.role === 'owner' || profile.superAdmin === true;
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
 * A ordem importa: o dono é checado ANTES do motorista, porque uma conta
 * antiga pode ter os dois (`role: 'admin'` + `superAdmin: true`) e o painel
 * dela é o da plataforma.
 *
 * Sem perfil devolve null — quem chama decide o que fazer, em vez de receber
 * um palpite. Mandar alguém pro /pai por engano é como se perde a pessoa numa
 * tela que não é dela.
 */
export function painelDe(profile) {
  if (!profile?.role && !profile?.superAdmin) return null;
  if (ehDono(profile)) return '/admin';
  if (ehMotorista(profile)) return '/tio';
  return '/pai';
}
