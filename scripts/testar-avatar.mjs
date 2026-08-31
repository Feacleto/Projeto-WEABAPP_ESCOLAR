/**
 * Os avatares carregam? — Node puro, como o resto de scripts/.
 * Rodar: npm run testar:avatar   (precisa de rede; fora da bateria padrão)
 *
 * POR QUE ESTE TESTE EXISTE
 * O `avatarUrl.js` monta URL com nome de cabelo escrito à mão, e a API do
 * DiceBear não perdoa: nome fora do catálogo NÃO degrada pra um avatar feio,
 * devolve **HTTP 400** e a imagem não carrega. O rosto some, e some só na
 * tela de quem tem aquele gênero — o motorista vê o app funcionando e o
 * responsável vê um buraco.
 *
 * Isso já aconteceu de verdade: os nomes foram escritos de memória (`v8` usava
 * `longHairBob`, a `v9` encurtou pra `bob`) e a lista inteira quebrou. Lint,
 * build e os testes puros passavam limpos, porque o erro só existe do outro
 * lado da rede.
 *
 * POR QUE ELE NÃO ENTRA NO `npm run testar`
 * Depende de rede e de um serviço de terceiro. Bateria que falha porque o wifi
 * caiu ensina a ignorar bateria. Fica junto de `testar:regras` e
 * `testar:storage`, que também pedem coisa de fora — e vale rodar sempre que
 * alguém mexer no estilo ou nas listas de cabelo.
 */
import {
  childAvatarUrl,
  adultAvatarUrl,
  adminAvatarUrl,
} from '../src/marca/avatarUrl.js';

let ok = 0;
let falhou = 0;

async function carrega(nome, url) {
  let estado;
  try {
    const r = await fetch(url);
    const corpo = r.ok ? await r.text() : '';
    estado = r.ok && corpo.trimStart().startsWith('<svg') ? null : `HTTP ${r.status}`;
  } catch (e) {
    estado = e.message;
  }
  estado ? falhou++ : ok++;
  console.log(
    `  ${estado ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m'} ${nome}` +
      (estado ? `\n      ${estado}\n      ${url}` : ''),
  );
}

console.log('\n\x1b[1mAVATARES — as URLs que o app realmente monta\x1b[0m');

console.log('\n\x1b[1m1. Os três papéis, com gênero informado\x1b[0m');
// É aqui que a lista de cabelo entra na URL. Um nome errado derruba TODOS os
// avatares daquele gênero de uma vez, e nenhum do outro.
await carrega('criança menina', childAvatarUrl({ id: 'c1', gender: 'female' }));
await carrega('criança menino', childAvatarUrl({ id: 'c2', gender: 'male' }));
await carrega('responsável mulher', adultAvatarUrl({ seed: 'u1', gender: 'female' }));
await carrega('responsável homem', adultAvatarUrl({ seed: 'u2', gender: 'male' }));
await carrega('motorista mulher', adminAvatarUrl({ seed: 'd1', gender: 'female' }));
await carrega('motorista homem', adminAvatarUrl({ seed: 'd2', gender: 'male' }));

console.log('\n\x1b[1m2. Sem gênero — toda conta criada antes do campo existir\x1b[0m');
// Nenhum `hair` vai na URL; o estilo sorteia entre os 45. Se este caso
// quebrar, quebrou o estilo, não a lista.
await carrega('criança sem gênero', childAvatarUrl({ id: 'c3' }));
await carrega('responsável sem gênero', adultAvatarUrl({ seed: 'u3' }));
await carrega('motorista sem gênero', adminAvatarUrl({ seed: 'd3' }));

console.log('\n\x1b[1m3. Os campos vazios, que a tela produz mais do que parece\x1b[0m');
// Criança recém-criada antes de o id existir, responsável sem nome no perfil.
await carrega('criança sem id', childAvatarUrl({}));
await carrega('responsável sem seed nem nome', adultAvatarUrl({}));

console.log('\n\x1b[1m4. O contrário: nome inventado TEM que falhar\x1b[0m');
// Se este passar, a API deixou de validar e o teste inteiro perdeu o sentido —
// nome errado voltaria a passar despercebido até alguém abrir a tela.
const inventado = childAvatarUrl({ id: 'x', gender: 'female' }).replace(
  /hair=[^&]*/,
  'hair=longHairBob',
);
const r = await fetch(inventado);
if (r.status === 400) {
  ok++;
  console.log('  \x1b[32m✓\x1b[0m `longHairBob` (o nome da v8) é recusado com 400');
} else {
  falhou++;
  console.log(
    `  \x1b[31m✗\x1b[0m a API aceitou um cabelo inexistente (HTTP ${r.status}) —` +
      ' este teste deixou de proteger o que veio proteger',
  );
}

console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${falhou} falharam\x1b[0m`);
process.exit(falhou ? 1 : 0);
