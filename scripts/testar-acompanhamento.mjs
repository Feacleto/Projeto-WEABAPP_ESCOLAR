/**
 * O LINK DO DIA — o que ele mostra, e sobretudo o que ele NÃO mostra.
 *
 * POR QUE ESTE TESTE EXISTE
 * O link de acompanhamento é entregue a um TERCEIRO: a avó, a vizinha, o
 * motorista de aplicativo que vai buscar a criança hoje. Não há conta, não há
 * senha e não há rules no caminho — quem decide o que essa pessoa vê é uma
 * lista de campos dentro de `montarAcompanhamento`, e mais nada.
 *
 * O documento da criança carrega endereço, coordenada de casa, telefone dos
 * dois responsáveis, escola, mensalidade e o código do convite. Um `...child`
 * distraído ali entrega tudo isso a quem tem um link de WhatsApp. Por isso o
 * caso central deste arquivo não é "o payload tem os campos certos" — é
 * **nenhum valor sensível aparece no JSON, procurado um por um**. Essa é a
 * versão, para dados, do que `promessas.js` faz com palavras.
 *
 * COMO RODAR
 *   node scripts/testar-acompanhamento.mjs   (ou: npm run testar:acompanhamento)
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  chaveDoDia,
  horaLocal,
  acessoValido,
  estadoDoDia,
  montarAcompanhamento,
  CAMPOS_DO_PAYLOAD,
} = require('../functions/lib/reguaDoAcompanhamento.js');

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`  ok  ${nome}`);
    ok += 1;
  } else {
    console.log(` FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`);
    bad += 1;
    falhas.push(nome);
  }
}
const eq = (nome, esperado, obtido) =>
  checar(nome, esperado === obtido, `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);

function bloco(t) {
  console.log('');
  console.log(t);
}

// Uma criança REAL, com tudo o que o documento carrega de verdade.
const CRIANCA = {
  id: 'c1',
  name: 'João Pedro Almeida',
  address: 'Rua das Acácias, 412, apto 71',
  lat: -23.61234,
  lng: -46.71234,
  school: 'Colégio Santa Marta',
  schoolId: 'esc1',
  schoolLat: -23.6,
  schoolLng: -46.7,
  parentName: 'Carlos Almeida',
  parentPhone: '11987654321',
  parentEmail: 'carlos@exemplo.com',
  parent2Phone: '11912345678',
  monthlyFee: 480,
  dueDay: 10,
  inviteCode: 'TNAB23CD',
  parentUid: 'uid-do-pai',
  adminUid: 'uid-do-tio',
  horaPega: '06:30',
  horaEntrega: '12:35',
  saudeNotas: 'alérgica a amendoim',
};

const MOTORISTA = {
  name: 'Antonio Nino da Silva',
  marcaNome: 'Tio Nino',
  pixKey: '11999998888',
  email: 'nino@exemplo.com',
};

const RIDE = {
  marcos: { onboard: new Date('2026-09-10T10:12:00Z') },
  ordemVolta: 3,
  combinado: { ida: '06:30', volta: '12:35' },
};

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ O QUE NÃO PODE VAZAR — o caso que justifica o arquivo ═══');

const payload = montarAcompanhamento({ child: CRIANCA, ride: RIDE, motorista: MOTORISTA });
const texto = JSON.stringify(payload);

const PROIBIDOS = [
  ['endereço de casa', 'Acácias'],
  ['coordenada de casa (lat)', '-23.61234'],
  ['coordenada de casa (lng)', '-46.71234'],
  ['nome da escola', 'Santa Marta'],
  ['telefone do responsável', '11987654321'],
  ['telefone do 2º responsável', '11912345678'],
  ['e-mail do responsável', 'carlos@exemplo.com'],
  ['mensalidade', '480'],
  ['código do convite', 'TNAB23CD'],
  ['uid do pai', 'uid-do-pai'],
  ['uid do motorista', 'uid-do-tio'],
  ['chave PIX do motorista', '11999998888'],
  ['dado de saúde da criança', 'amendoim'],
  ['sobrenome da criança', 'Almeida'],
  ['nome civil do motorista', 'Antonio'],
];

PROIBIDOS.forEach(([nome, agulha]) => {
  checar(`não vaza ${nome}`, !texto.includes(agulha), `achei "${agulha}" em ${texto}`);
});

checar(
  'nenhum campo além da lista fechada',
  Object.keys(payload).every((k) => CAMPOS_DO_PAYLOAD.includes(k)),
  'sobrou: ' + Object.keys(payload).filter((k) => !CAMPOS_DO_PAYLOAD.includes(k)).join(', ')
);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ O QUE ELA PRECISA VER ═══');

eq('só o primeiro nome da criança', 'João', payload.crianca);
eq('a marca do motorista, não o nome civil', 'Tio Nino', payload.motorista);
eq('o estado sai dos marcos da viagem', 'na_perua', payload.estado);
eq('a posição na fila da volta', 3, payload.paradasNaVolta);
eq('a hora combinada da volta', '12:35', payload.combinado.volta);

checar('sem marca, cai no primeiro nome do motorista',
  montarAcompanhamento({ child: CRIANCA, ride: RIDE, motorista: { name: 'Antonio Nino' } })
    .motorista === 'Antonio');

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ O ESTADO VEM DA VIAGEM, NÃO DE `child.status` ═══');
/* `child.status` atravessa a meia-noite: entregue ontem continua `delivered`
   hoje de manhã. O doc de `rides/{dia}` já é do dia. */

eq('sem marco nenhum, esperando', 'esperando', estadoDoDia({}));
eq('embarcou', 'na_perua', estadoDoDia({ marcos: { onboard: 1 } }));
eq('chegou na escola', 'na_escola', estadoDoDia({ marcos: { onboard: 1, atSchool: 2 } }));
eq('entregue', 'entregue', estadoDoDia({ marcos: { onboard: 1, atSchool: 2, delivered: 3 } }));
eq('ride ausente não explode', 'esperando', estadoDoDia(null));
checar(
  'um `status: delivered` de ontem no doc da criança não contamina',
  montarAcompanhamento({ child: { ...CRIANCA, status: 'delivered' }, ride: {} }).estado === 'esperando'
);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ A VALIDADE — e a revogação que não precisa de código ═══');

const HOJE = new Date('2026-09-10T15:00:00Z');
const chaveHoje = chaveDoDia(HOJE);
const acesso = { dateKey: chaveHoje, childId: 'c1' };
const indicacao = { childId: 'c1' };

checar('vale hoje, com a indicação de pé',
  acessoValido({ acesso, altPickup: indicacao, agora: HOJE }).ok);

eq('link de ontem vence', 'vencido',
  acessoValido({ acesso: { dateKey: '2026-09-09', childId: 'c1' }, altPickup: indicacao, agora: HOJE }).motivo);

eq('o pai tirou a pessoa: o link morre junto', 'revogado',
  acessoValido({ acesso, altPickup: null, agora: HOJE }).motivo);

eq('a indicação passou a ser de outra criança', 'trocado',
  acessoValido({ acesso, altPickup: { childId: 'c2' }, agora: HOJE }).motivo);

eq('token inexistente', 'inexistente',
  acessoValido({ acesso: null, altPickup: indicacao, agora: HOJE }).motivo);

checar('chamada sem argumento nenhum não explode',
  acessoValido().ok === false);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ O FUSO — as functions rodam em UTC e a família não ═══');

checar(
  '22h de Brasília ainda é o MESMO dia (o UTC já virou)',
  chaveDoDia(new Date('2026-09-10T01:30:00Z')) === '2026-09-09',
  'veio ' + chaveDoDia(new Date('2026-09-10T01:30:00Z'))
);
/* Sem isso o link da tarde morreria três horas antes da meia-noite —
   justamente quando a mãe ainda espera a criança voltar. */

eq('a hora do marco sai no relógio de São Paulo', '07:12',
  horaLocal(new Date('2026-09-10T10:12:00Z')));

eq('Timestamp do Firestore (toDate) também', '07:12',
  horaLocal({ toDate: () => new Date('2026-09-10T10:12:00Z') }));

eq('Timestamp cru (seconds) também', '07:12',
  horaLocal({ seconds: Math.floor(new Date('2026-09-10T10:12:00Z').getTime() / 1000) }));

eq('marco ausente vira null, nunca hora falsa', null, horaLocal(null));
eq('lixo vira null', null, horaLocal('nem data'));

// ══════════════════════════════════════════════════════════════════════════
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
if (bad) {
  console.log('');
  falhas.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log('════════════════════════════════════════════════════════════════');
process.exit(bad ? 1 : 0);
