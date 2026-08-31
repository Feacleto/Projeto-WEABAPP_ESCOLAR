/**
 * Testes da travessia — Node puro, sem runner, como o resto de scripts/.
 * Rodar: node scripts/testar-travessia.mjs
 *
 * O que está sendo protegido aqui é a REGRA DA FALA, não o desenho: nenhuma
 * frase da cortina pode citar nome, hora ou contagem, e toda frase tem que ser
 * verdadeira com rota rodando, rota parada, férias e domingo. É por isso que o
 * módulo não importa nada — dá pra conferir a fala sem subir o app.
 */
import {
  CENA_ABERTURA,
  CENA_ENTRADA,
  CENA_SAIDA,
  assinarTravessia,
  duracaoDaTravessia,
  falaDaTravessia,
  travessar,
} from '../src/marca/travessia.js';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

console.log('\n\x1b[1m1. Cada papel tem a sua sala\x1b[0m');
eq('motorista entra no transporte',
   falaDaTravessia(CENA_ENTRADA, 'admin').linha, 'Entrando no seu transporte.');
eq('responsável entra no acompanhamento',
   falaDaTravessia(CENA_ENTRADA, 'parent').linha, 'Entrando no acompanhamento.');
eq('dono entra na plataforma',
   falaDaTravessia(CENA_ENTRADA, 'owner').linha, 'Entrando na plataforma.');
eq('plaqueta do motorista',
   falaDaTravessia(CENA_ENTRADA, 'admin').plaqueta, 'Ambiente de trabalho');
eq('plaqueta da família',
   falaDaTravessia(CENA_SAIDA, 'parent').plaqueta, 'Ambiente da família');

console.log('\n\x1b[1m2. A saída fala de permanência, e só ela\x1b[0m');
eq('motorista sai e o transporte fica',
   falaDaTravessia(CENA_SAIDA, 'admin').linha, 'Seu transporte continua aqui.');
eq('responsável sai e o acompanhamento fica',
   falaDaTravessia(CENA_SAIDA, 'parent').linha, 'O acompanhamento continua aqui.');
// "continua aqui" é caro demais pra gastar na entrada: só faz efeito no
// momento em que a pessoa poderia achar que fechou e perdeu.
eq('nenhuma entrada diz "continua aqui"',
   [CENA_ENTRADA].flatMap((c) => ['admin', 'parent', 'owner']
     .map((r) => falaDaTravessia(c, r).linha)
     .filter((l) => l.includes('continua'))),
   []);

console.log('\n\x1b[1m3. Quem NÃO fala, e por quê\x1b[0m');
// O gesto do balão virando porta já diz tudo; palavra ali seria uma segunda
// coisa pra ler no pior momento.
eq('a abertura é muda (motorista)', falaDaTravessia(CENA_ABERTURA, 'admin'), null);
eq('a abertura é muda (responsável)', falaDaTravessia(CENA_ABERTURA, 'parent'), null);
// Quem espera aprovação não está entrando em ambiente de trabalho nenhum.
eq('aguardando não recebe fala', falaDaTravessia(CENA_ENTRADA, 'aguardando'), null);
eq('papel desconhecido não recebe fala', falaDaTravessia(CENA_ENTRADA, 'sei-la'), null);
eq('papel ausente não quebra', falaDaTravessia(CENA_ENTRADA, undefined), null);

console.log('\n\x1b[1m4. Nenhuma fala carrega dado, nome ou hora\x1b[0m');
const TODAS = [CENA_ABERTURA, CENA_ENTRADA, CENA_SAIDA]
  .flatMap((c) => ['admin', 'parent', 'owner', 'aguardando'].map((r) => falaDaTravessia(c, r)))
  .filter(Boolean)
  .flatMap((f) => [f.plaqueta, f.linha]);
eq('nenhum dígito em lugar nenhum', TODAS.filter((t) => /\d/.test(t)), []);
eq('nenhum cumprimento de turno',
   TODAS.filter((t) => /bom dia|boa tarde|boa noite|olá|ola\b/i.test(t)), []);
// "Preparando" e "pronto" prometem estado: um diz que falta coisa, o outro que
// terminou. As duas podem estar mentindo no instante em que aparecem.
eq('nenhuma promessa de estado',
   TODAS.filter((t) => /preparando|pronto|carregando|montado/i.test(t)), []);
eq('as falas existem mesmo', TODAS.length > 0, true);

console.log('\n\x1b[1m5. O disparo chega em quem esta ouvindo\x1b[0m');
// A cena NAO viaja mais pelo `state` da navegacao: ao zerar a sessao, o
// PrivateRoute devolve um <Navigate> que roda em efeito e podia chegar depois
// do nosso, levando o `state` junto. Era por isso que sair nao tinha teatro.
const recebidos = [];
const desligar = assinarTravessia((x) => recebidos.push(x));

travessar(CENA_SAIDA, 'admin');
eq('a cena chega no ouvinte', recebidos.length, 1);
eq('com cena e papel',
   { cena: recebidos[0].cena, role: recebidos[0].role },
   { cena: 'saida', role: 'admin' });

travessar(CENA_ENTRADA, 'parent');
eq('dois disparos, dois selos', recebidos[0].selo !== recebidos[1].selo, true);
travessar(CENA_SAIDA, 'admin');
eq('a MESMA cena duas vezes tambem troca de selo',
   recebidos[0].selo !== recebidos[2].selo, true);

// Estado adulterado ou chamada errada nao pode acender cena inventada.
eq('cena inventada nao dispara', travessar('explodir', 'admin'), null);
eq('e nem chega em ninguem', recebidos.length, 3);
eq('papel ausente vira null', travessar(CENA_ENTRADA).role, null);

desligar();
travessar(CENA_SAIDA, 'admin');
eq('depois de desligar, ninguem recebe', recebidos.length, 4);

console.log('\n\x1b[1m7. Movimento reduzido encurta, mas não corta seco\x1b[0m');
// Zerar devolveria o piscão que a cortina existe pra cobrir.
eq('reduzido ainda dura', duracaoDaTravessia(CENA_ENTRADA, true) > 0, true);
eq('reduzido é mais curto',
   duracaoDaTravessia(CENA_ENTRADA, true) < duracaoDaTravessia(CENA_ENTRADA, false), true);
// Existe teto porque a cortina é travessia, não abertura de filme: acima de
// dois segundos ela deixa de ser continuidade e vira espera.
eq('cortina normal cabe em 2 s', duracaoDaTravessia(CENA_ABERTURA, false) <= 2000, true);
eq('e a de entrar também', duracaoDaTravessia(CENA_ENTRADA, false) <= 2000, true);

console.log(`\n\x1b[1m${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} passaram, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
