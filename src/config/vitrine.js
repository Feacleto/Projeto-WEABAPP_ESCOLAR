/**
 * O PISO DOS CONTADORES DE VITRINE — o número que as duas portas nunca furam.
 *
 * A home do motorista mostra "N famílias atendidas"; a porta da família mostra
 * "N responsáveis usam". Os dois passam por aqui, e nenhum dos dois exibe
 * menos que `PISO_DA_VITRINE`.
 *
 * ISTO NÃO É O NÚMERO REAL, E QUEM MEXER AQUI PRECISA SABER DISSO
 * Enquanto a base for menor que o piso, a tela mostra o piso. Foi decisão de
 * produto, pedida explicitamente, e está escrita aqui por um motivo prático:
 * `src/config/rodada.js` documenta a regra OPOSTA — lá o contador de vagas é
 * real por exigência do CDC art. 37, e diz em letras que contador que não
 * corresponde ao real é propaganda enganosa. Sem este registro, quem ler
 * aquele arquivo depois vai tratar este piso como bug e "consertar". Não é
 * bug; é escolha, e ela é diferente da de lá.
 *
 * A diferença entre os dois casos, pra quem precisar decidir de novo: vaga é
 * PROMESSA (quem chega depois não entra), e promessa falsa é o que o CDC
 * alcança. Contador de uso é REPUTAÇÃO. Continua sendo afirmação sobre a
 * realidade, e o risco não é zero — mas ninguém toma decisão de compra
 * baseada em ser o 24º ou o 27º.
 *
 * COMO SAIR DO PISO
 * Baixar para 0 desliga: `comPiso` vira identidade e as duas telas passam a
 * mostrar só o real. É um número, num arquivo — igual ao de `rodada.js`, e
 * pelo mesmo motivo: constante que mora sozinha continua recebendo merge pra
 * sempre, lógica espalhada em duas páginas diverge na primeira mudança.
 */
/**
 * ⚠️ DESLIGADO EM 06/09/2026 — zero significa "sem piso", e a tela passa a
 * mostrar o número real.
 *
 * O argumento acima continua registrado porque foi uma decisão de produto
 * tomada com o ponto do CDC na mesa, e pode voltar à pauta. O que a desfez foi
 * outra coisa: um número inventado é um passivo em qualquer conversa em que
 * alguém possa abrir a página e perguntar de onde ele vem. Com base zero, o
 * piso mostraria 27 responsáveis que não existem.
 *
 * Voltar a ligar é trocar este número — e reler o arquivo inteiro antes.
 */
export const PISO_DA_VITRINE = 0;

/**
 * O número que vai pra tela.
 *
 * `null` entra e `null` sai — e essa é a parte que não pode se perder numa
 * refatoração. Sem resposta da vitrine (callable falhou, ou ainda está
 * carregando) NÃO existe contador: o piso vale sobre um número que chegou,
 * nunca sobre a ausência dele. Mostrar 27 com o backend fora do ar seria
 * exibir um número sem nenhum dado atrás — e aí não sobra nem a escolha de
 * produto, só o palpite.
 */
export function comPiso(valor) {
  if (valor === null || valor === undefined) return null;
  return Math.max(Number(valor) || 0, PISO_DA_VITRINE);
}

/**
 * O SITE INSTITUCIONAL — a porta pública, e ela mora FORA do app.
 *
 * Até 06/09/2026 a apresentação da plataforma era a rota `/` do próprio app
 * (`pages/Home.jsx`, 1090 linhas). Ela foi apagada: a landing estática em
 * `landing/` cobre tudo que ela fazia, e o `/` do app passou a ser o login.
 *
 * POR QUE ISTO É UMA CONSTANTE E NÃO UM `<Link to="/">`
 * O destino deixou de ser uma rota do react-router e virou OUTRO DOMÍNIO —
 * `alobuzinou.com` é o app e `alobuzinou.com.br` é a landing. `<Link>` monta
 * caminho relativo e mandaria a pessoa para `alobuzinou.com/`, que é o login
 * de novo. Quem sai daqui precisa de `<a href>`.
 *
 * Ver "Os domínios" em docs/deploy.md para por que são dois endereços, e o
 * que essa escolha custa.
 */
export const SITE_INSTITUCIONAL = 'https://alobuzinou.com.br';

/**
 * O ENDEREÇO QUE VAI NA MENSAGEM DE CONVITE — e por que ele NÃO é o
 * `SITE_INSTITUCIONAL`.
 *
 * As duas mensagens que a plataforma escreve para quem ainda não tem conta
 * mandavam a pessoa para a landing: o convite que o motorista manda ao colega
 * (`pages/tio/TioIndicar.jsx`) e o pedido que a responsável manda ao motorista
 * dela (`marca/pedidoAoMotorista.js`).
 *
 * ⚠️ ISSO PÕE UMA APRESENTAÇÃO NO CAMINHO DE QUEM JÁ FOI APRESENTADO. Quem
 * recebe essas mensagens acabou de ser convencido por alguém em quem confia —
 * e a landing responde "o que é isso?", que é a única pergunta que a mensagem
 * já tinha respondido. O pedido da responsável era o caso mais visível: ele
 * diz *"você cria a sua conta aqui"* e linkava para a página onde não se cria
 * conta nenhuma.
 *
 * ⚠️ E A LANDING PERDE A ORIGEM NO MEIO DO CAMINHO. `DriverSignup` lê `?o=` /
 * `?utm_source=` da PRÓPRIA URL (ver o comentário lá), então o canal só chega
 * ao painel do dono se o link apontar direto para o cadastro. Passando pela
 * landing, o cadastro que veio de uma indicação aparece como tráfego solto —
 * e a indicação é justamente o canal que o negócio aposta em medir.
 *
 * Por isso o destino é o cadastro do motorista, no domínio do APP, com o
 * `utm_source` que diz de onde veio. `conviteDeMotorista` existe para o canal ser
 * escolhido por quem escreve a mensagem: a lista fechada que traduz esse
 * texto num canal está em `dominio/identidade/origem.js`.
 */
export const CADASTRO_DE_MOTORISTA = 'https://alobuzinou.com/quero-fazer-parte';

/** O mesmo endereço, carimbado com o canal de onde a mensagem sai. */
export function conviteDeMotorista(utmSource) {
  return utmSource
    ? `${CADASTRO_DE_MOTORISTA}?utm_source=${encodeURIComponent(utmSource)}`
    : CADASTRO_DE_MOTORISTA;
}
