/**
 * Testes do endereço — Node puro, sem runner, como o resto de scripts/.
 * Rodar: node scripts/testar-endereco.mjs
 *
 * ── O QUE ESTE ARQUIVO GUARDA
 * O endereço da criança decide em que CALÇADA a perua para, e o modo de falhar
 * dele não é o app quebrar: é o app AFIRMAR. Endereço sem número devolve o meio
 * da rua, a tela escreve "Local confirmado!" e ninguém desconfia de um pino que
 * parece certo.
 *
 * As três funções aqui são puras de propósito — a consulta do geocodificador
 * chegou a morar no `locationService`, atrás de um `import` do Firestore, onde o
 * Node não a alcançava. É a mesma armadilha que deixou a máquina de estado da
 * criança anos sem teste.
 *
 * NÃO HÁ REDE AQUI. ViaCEP e Nominatim são serviços de terceiro; o que se testa
 * é o que o projeto controla — a máscara, o texto que a pessoa lê e a consulta
 * que sai. A chamada HTTP em si é do `locationService`.
 */
import { maskCep, unmaskCep, isValidCep } from '../src/compartilhado/masks.js';
import {
  montarEndereco,
  consultaDoEndereco,
} from '../src/compartilhado/formatters.js';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

console.log('\n\x1b[1m1. A máscara de CEP monta enquanto se digita\x1b[0m');
eq('vazio', maskCep(''), '');
eq('três dígitos', maskCep('013'), '013');
eq('cinco dígitos, ainda sem hífen', maskCep('01310'), '01310');
eq('o hífen entra no sexto', maskCep('013101'), '01310-1');
eq('completo', maskCep('01310100'), '01310-100');
eq('já mascarado não duplica o hífen', maskCep('01310-100'), '01310-100');
eq('pontuação colada de fora é limpa', maskCep('01.310-100'), '01310-100');
eq('letra no meio é ignorada', maskCep('01a310b100'), '01310-100');
eq('o nono dígito é cortado', maskCep('013101009'), '01310-100');

console.log('\n\x1b[1m2. O ZERO À ESQUERDA SOBREVIVE\x1b[0m');
// Metade de São Paulo e todo o Rio Grande do Sul têm CEP começando com zero.
// `Number('01310100')` é 1310100, e o ViaCEP responde 400 pra sete dígitos: o
// endereço "não existe" pra quem digitou um CEP perfeitamente válido. Por isso
// nada nesta cadeia converte pra número, e é isso que estes casos travam.
eq('a máscara preserva', maskCep('01310100'), '01310-100');
eq('o unmask preserva', unmaskCep('01310-100'), '01310100');
eq('unmask devolve string, não número', typeof unmaskCep('01310-100'), 'string');
eq('e o zero continua lá depois da volta', unmaskCep(maskCep('01310100')), '01310100');
eq('CEP gaúcho com dois zeros', unmaskCep(maskCep('00123456')), '00123456');

console.log('\n\x1b[1m3. Validade é sobre FORMATO, e só\x1b[0m');
eq('oito dígitos passa', isValidCep('01310100'), true);
eq('mascarado passa', isValidCep('01310-100'), true);
eq('sete dígitos não', isValidCep('0131010'), false);
eq('vazio não', isValidCep(''), false);
eq('nulo não', isValidCep(null), false);
eq('só a sequência de zeros não', isValidCep('00000-000'), false);
// A tabela de faixa de CEP por UF é tentadora e fica DESATUALIZADA em silêncio:
// os Correios reorganizam faixa, e aí ela recusa CEP novo e legítimo sem que o
// motorista tenha como saber que o errado é o app. Quem sabe se um CEP existe é
// o ViaCEP; aqui só mora o que é verdade sobre o formato, que não muda.
eq('faixa de outro estado NÃO é recusada aqui', isValidCep('99999-999'), true);

console.log('\n\x1b[1m4. O endereço que a PESSOA lê\x1b[0m');
const paulista = {
  logradouro: 'Avenida Paulista',
  numero: '1578',
  complemento: 'apto 42',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};
eq(
  'completo, no formato dos Correios',
  montarEndereco(paulista),
  'Avenida Paulista, 1578, apto 42 — Bela Vista, São Paulo/SP'
);
eq(
  'sem complemento',
  montarEndereco({ ...paulista, complemento: '' }),
  'Avenida Paulista, 1578 — Bela Vista, São Paulo/SP'
);
eq(
  'sem bairro',
  montarEndereco({ ...paulista, complemento: '', bairro: '' }),
  'Avenida Paulista, 1578 — São Paulo/SP'
);
eq(
  'sem número (o estado logo depois do CEP, antes de a pessoa digitar)',
  montarEndereco({ ...paulista, numero: '', complemento: '' }),
  'Avenida Paulista — Bela Vista, São Paulo/SP'
);
eq('espaço em volta é aparado', montarEndereco({
  logradouro: '  Rua das Trovas  ', numero: ' 10 ', localidade: 'São Paulo', uf: 'SP',
}), 'Rua das Trovas, 10 — São Paulo/SP');

console.log('\n\x1b[1m5. NENHUMA PONTUAÇÃO ÓRFÃ — o caso que derruba o template\x1b[0m');
// Interpolar as partes num template devolve `", 123 — , /SP"` sempre que uma
// delas falta, E ELAS FALTAM: cidade pequena costuma ter um CEP único pro
// município inteiro, e o ViaCEP responde com `logradouro` e `bairro` em branco.
// Empresa grande e agência dos Correios têm CEP próprio, com o mesmo efeito.
eq('CEP único de município: só cidade e UF', montarEndereco({
  logradouro: '', numero: '', complemento: '', bairro: '', localidade: 'Socorro', uf: 'SP',
}), 'Socorro/SP');
eq('nada preenchido devolve string vazia', montarEndereco({}), '');
eq('argumento ausente não quebra', montarEndereco(), '');
eq('só a UF', montarEndereco({ uf: 'SP' }), 'SP');
eq('só a cidade', montarEndereco({ localidade: 'Socorro' }), 'Socorro');
// Nenhuma saída pode começar ou terminar em pontuação solta, nem trazer o
// travessão sem os dois lados. Este é o caso que pega o template ingênuo antes
// de ele virar endereço gravado.
const amostras = [
  paulista,
  { ...paulista, numero: '', complemento: '' },
  { ...paulista, logradouro: '', numero: '', bairro: '' },
  { localidade: 'Socorro', uf: 'SP' },
  { logradouro: 'Rua A', localidade: 'Socorro' },
  {},
];
const orfa = amostras
  .map(montarEndereco)
  .filter((s) => /^[,—/\s]|[,—/]\s*$|—\s*$|^\s*—|,\s*,|\/\s*$/.test(s));
eq('nenhuma amostra sai com pontuação órfã', orfa, []);

console.log('\n\x1b[1m6. O NÚMERO SEM RUA FICA — apagar em silêncio é pior\x1b[0m');
// Sem logradouro, um número solto produz um texto estranho. A tentação é
// descartá-lo. Mas apagar sem avisar o que a pessoa acabou de digitar é a pior
// das duas falhas: ela vê o campo preenchido, salva, e o número não está no
// endereço. Estranho ela conserta; invisível, não.
eq('o número digitado aparece mesmo sem rua', montarEndereco({
  numero: '123', localidade: 'Socorro', uf: 'SP',
}), '123 — Socorro/SP');

console.log('\n\x1b[1m7. A consulta do geocodificador é OUTRA string\x1b[0m');
// O que a pessoa lê e o que o Nominatim lê são dois textos com dois leitores.
// Ele espera o número ANTES do nome da rua (`1600 Pennsylvania Ave`, da
// documentação dele); a pessoa espera o formato dos Correios. Forçar uma string
// só pioraria a de alguém.
eq(
  'número na frente do nome da rua',
  consultaDoEndereco(paulista),
  '1578 Avenida Paulista, Bela Vista, São Paulo, SP, Brasil'
);
eq('e ela DIFERE do texto da tela', consultaDoEndereco(paulista) === montarEndereco(paulista), false);
// "apto 42" e "fundos" não existem no mapa. Na consulta eles só dão ao parser
// texto que ele não sabe encaixar — e o encaixe errado custa a RUA.
eq('o complemento fica fora', /apto/.test(consultaDoEndereco(paulista)), false);
eq(
  'sem número, a rua vai sozinha',
  consultaDoEndereco({ ...paulista, numero: '' }),
  'Avenida Paulista, Bela Vista, São Paulo, SP, Brasil'
);
eq(
  'partes ausentes não deixam vírgula dupla',
  consultaDoEndereco({ logradouro: 'Rua A', localidade: 'Socorro' }),
  'Rua A, Socorro, Brasil'
);
eq('argumento ausente não quebra', consultaDoEndereco(), 'Brasil');

console.log('\n\x1b[1m8. "Brasil" VAI SEMPRE, e não por enfeite\x1b[0m');
// O `countrycodes=br` da requisição já restringe o país — e mesmo assim o nome
// entra na frase. Quem chama esta função pode não ser quem monta a URL, e uma
// consulta que só está correta por causa de um parâmetro em OUTRO arquivo é a
// garantia que se perde na primeira refatoração.
//
// O custo de ficar sem país está SONDADO, e não suposto: em 10/09/2026, "Rua
// Augusta, 100" e "Avenida da Liberdade, 100" voltaram as duas de LISBOA no
// Nominatim sem a restrição — e as duas são ruas brasileiras banais. A sonda
// também mostrou por que isso passa despercebido: "Rua das Flores, 100" vem do
// Brasil sozinha, então quem testa com um endereço qualquer não vê nada.
for (const p of amostras) {
  eq(`país presente em ${JSON.stringify(p).slice(0, 34)}…`,
     consultaDoEndereco(p).endsWith('Brasil'), true);
}

console.log('\n\x1b[1m9. O NÚMERO CHEGA NAS DUAS PONTAS\x1b[0m');
// A invariante que dá sentido à mudança inteira: quando a pessoa digita o
// número, ele tem que aparecer NO TEXTO que ela lê E NA CONSULTA que sai. Perder
// numa das duas é o bug original de volta — no primeiro caso ela salva um
// endereço sem número, no segundo o pino cai no meio da rua com o número certo
// escrito na tela.
for (const numero of ['1', '10', '1578', '1578-A', 's/n']) {
  const partes = { ...paulista, numero };
  eq(`"${numero}" está no texto da tela`, montarEndereco(partes).includes(numero), true);
  eq(`"${numero}" está na consulta`, consultaDoEndereco(partes).includes(numero), true);
}

console.log('\n' + '─'.repeat(66));
console.log(`\x1b[1m${ok} passaram, ${falhou} falharam\x1b[0m`);
process.exit(falhou ? 1 : 0);
