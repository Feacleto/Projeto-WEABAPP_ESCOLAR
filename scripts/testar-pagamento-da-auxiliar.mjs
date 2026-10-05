/**
 * O PAGAMENTO DA AUXILIAR (05/10/2026) — fase 4: o motorista anota que pagou,
 * vira despesa do mês dele, e ela confirma "Recebi" no app dela, atrás da
 * senha dela.
 *
 *   node scripts/testar-pagamento-da-auxiliar.mjs
 *   (ou: npm run testar:pagamento-da-auxiliar)
 *
 * Régua pura dos dois lados e leitura de arquivo para o que não roda sem
 * Firebase: as callables passam todo id por `idValido`, a régua não requer
 * nada, a escrita é só do servidor, a aba dela é protegida e nenhuma tela
 * dela fala do dinheiro do motorista.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  nomeDoMesDoPagamento,
  mesEAnoDoPagamento,
  diaCurto,
  idDoPagamentoDaAuxiliar,
  pagamentoDoMes,
  recibosEmOrdem,
  estadoDoRecibo,
  historicoDeAuxiliares,
} from '../src/dominio/identidade/auxiliar.js';
import { ESPECIE_DO_AVISO } from '../src/dominio/identidade/avisos.js';
import { destinoDoAviso } from '../src/dominio/identidade/destinoDoAviso.js';

const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDoPagamentoDaAuxiliar.js');
const { idValido } = require('../functions/lib/reguaDosIds.js');
const avisosDoServidor = require('../functions/lib/avisos.js');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(nome); console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// 05/10/2026, 12h em Brasília.
const AGORA = Date.UTC(2026, 9, 5, 15);

console.log('\n1. o valor');
checar('900 vale', 900, R.valorValido(900));
checar('texto com ponto vale', 900.5, R.valorValido('900.50'));
checar('arredonda ao centavo', 900.13, R.valorValido(900.129));
checar('zero não vale', null, R.valorValido(0));
checar('negativo não vale', null, R.valorValido(-10));
checar('NaN não vale', null, R.valorValido('abc'));
checar('o teto (20 mil) vale', 20000, R.valorValido(20000));
checar('acima do teto não vale', null, R.valorValido(20000.01));
checar('meio centavo arredonda a zero e não vale', null, R.valorValido(0.004));

console.log('\n2. o mês');
checar('o mês de hoje, em Brasília', '2026-10', R.chaveDoMes(AGORA));
checar('meia-noite UTC do dia 1 ainda é o mês anterior em Brasília', '2026-09', R.chaveDoMes(Date.UTC(2026, 9, 1, 1)));
checar('o mês corrente pode', true, R.mesPodeSerAnotado('2026-10', AGORA));
checar('o mês passado pode (o pagamento esquecido)', true, R.mesPodeSerAnotado('2026-09', AGORA));
checar('12 meses para trás pode', true, R.mesPodeSerAnotado('2025-10', AGORA));
checar('13 meses para trás não', false, R.mesPodeSerAnotado('2025-09', AGORA));
checar('o mês que vem não (adiantado é do mês em que aconteceu)', false, R.mesPodeSerAnotado('2026-11', AGORA));
checar('mês 13 não', false, R.mesPodeSerAnotado('2026-13', AGORA));
checar('mês com barra não', false, R.mesPodeSerAnotado('2026/10', AGORA));
checar('vazio não', false, R.mesPodeSerAnotado('', AGORA));
checar('nome do mês', 'outubro de 2026', R.nomeDoMes('2026-10'));

console.log('\n3. o id determinístico — um recibo por mês');
const id = R.idDoPagamento('tioUID123', 'auxUID456', '2026-10');
checar('o formato', 'tioUID123_auxUID456_2026-10', id);
checar('o id passa no idValido (vira caminho)', true, idValido(id));
checar('o mesmo mês dá o mesmo id (o toque duplo acha o primeiro)', id, R.idDoPagamento('tioUID123', 'auxUID456', '2026-10'));
checar('outro mês, outro id', false, id === R.idDoPagamento('tioUID123', 'auxUID456', '2026-09'));
checar('o cliente monta o mesmo id do servidor', id, idDoPagamentoDaAuxiliar('tioUID123', 'auxUID456', '2026-10'));
checar('um uid com barra não vira caminho', false, idValido(R.idDoPagamento('tio', 'aux/../x', '2026-10')));

console.log('\n4. a despesa que nasce junto');
checar('a descrição tem o nome e o mês', 'Pagamento de Cida Souza · outubro de 2026', R.descricaoDaDespesa('Cida Souza', '2026-10'));
checar('no mês corrente, a data é agora', AGORA, R.dataDaDespesa('2026-10', AGORA));
const setembro = R.dataDaDespesa('2026-09', AGORA);
checar('num mês passado, o último dia dele (para cair no extrato certo)', '2026-09', R.chaveDoMes(setembro));
checar('… e é o dia 30', 30, new Date(setembro).getUTCDate());

console.log('\n5. quem confirma');
const recibo = { motoristaUid: 'tio', auxiliarUid: 'aux', mes: '2026-10', valor: 900, recebidoEm: null };
checar('a própria auxiliar pode', { pode: true, jaConfirmado: false }, R.podeConfirmar(recibo, 'aux'));
checar('o motorista não confirma por ela', false, R.podeConfirmar(recibo, 'tio').pode);
checar('outra pessoa não', false, R.podeConfirmar(recibo, 'outra').pode);
checar('sem sessão não', false, R.podeConfirmar(recibo, null).pode);
checar('recibo inexistente não', false, R.podeConfirmar(null, 'aux').pode);
checar('a segunda confirmação é idempotente', { pode: true, jaConfirmado: true }, R.podeConfirmar({ ...recibo, recebidoEm: 1 }, 'aux'));
checar('o vínculo desativado NÃO impede (o pagamento é dela)', true, R.podeConfirmar({ ...recibo, ativa: false }, 'aux').pode);
const aviso = R.avisoDaConfirmacao({ nome: 'Cida Souza', mes: '2026-10' });
checar('o aviso ao motorista', ['auxiliar_confirmou_pagamento', 'Cida confirmou o pagamento'], [aviso.type, aviso.title]);

console.log('\n6. o aviso tem espécie e destino, nos dois lados');
checar('espécie no app', 'fato', ESPECIE_DO_AVISO.auxiliar_confirmou_pagamento);
checar('espécie no servidor', 'fato', avisosDoServidor.ESPECIE_DO_AVISO.auxiliar_confirmou_pagamento);
checar('leva o motorista à aba Auxiliar', '/tio/auxiliar', destinoDoAviso({ type: 'auxiliar_confirmou_pagamento' }, 'admin'));
checar('o servidor leva ao mesmo lugar', true, ler('functions/lib/destinoDoAviso.js').includes("auxiliar_confirmou_pagamento: '/tio/auxiliar'"));

console.log('\n7. a tela, do lado do app');
checar('nome do mês', 'outubro', nomeDoMesDoPagamento('2026-10'));
checar('mês e ano', 'outubro de 2026', mesEAnoDoPagamento('2026-10'));
checar('dia curto', '05/10', diaCurto(new Date(2026, 9, 5, 12)));
checar('dia curto de Timestamp', '05/10', diaCurto({ toMillis: () => new Date(2026, 9, 5, 12).getTime() }));
const lista = [
  { id: 'a', auxiliarUid: 'cida', mes: '2026-09', recebidoEm: 1 },
  { id: 'b', auxiliarUid: 'cida', mes: '2026-10', recebidoEm: null },
  { id: 'c', auxiliarUid: 'rose', mes: '2026-10', recebidoEm: null },
];
checar('o recibo do mês de UMA auxiliar', 'b', pagamentoDoMes(lista, 'cida', '2026-10')?.id);
checar('sem recibo no mês', null, pagamentoDoMes(lista, 'rose', '2026-09'));
checar('do mais novo para o mais velho', ['2026-10', '2026-10', '2026-09'], recibosEmOrdem(lista).map((p) => p.mes));
checar('os três estados', ['sem_anotacao', 'esperando', 'confirmado'],
  [estadoDoRecibo(null), estadoDoRecibo(lista[1]), estadoDoRecibo(lista[0])]);
checar('o histórico leva o valor do convite (o botão nasce com ele)', [900, null],
  historicoDeAuxiliares([{ uid: 'a', ativa: true, valorMensal: 900 }, { uid: 'b', ativa: true }]).map((h) => h.valorMensal));

console.log('\n8. as travas (servidor e rules)');
const regua = ler('functions/lib/reguaDoPagamentoDaAuxiliar.js');
checar('a régua não requer nada (testar:imports)', false, /require\(/.test(semComentarios(regua)));
const servidor = ler('functions/lib/pagamentosDaAuxiliar.js');
const anotar = servidor.slice(servidor.indexOf('function makeAnotarPagamentoDaAuxiliar'), servidor.indexOf('function makeConfirmarRecebimentoDaAuxiliar'));
const confirmar = servidor.slice(servidor.indexOf('function makeConfirmarRecebimentoDaAuxiliar'), servidor.indexOf('module.exports'));
checar('anotar é do motorista', true, anotar.includes('await exigirMotorista(db, request)'));
checar('o id da auxiliar passa no idValido ANTES de virar caminho', true,
  anotar.indexOf('idValido(auxiliarUid)') > -1 && anotar.indexOf('idValido(auxiliarUid)') < anotar.indexOf('auxiliares/${auxiliarUid}'));
checar('o mês e o valor passam pela régua', true, anotar.includes('R.mesPodeSerAnotado(mes') && anotar.includes('R.valorValido('));
checar('a conta dele precisa estar operando', true, anotar.includes('exigirContaDoMotoristaOperando(db, uid)'));
checar('o vínculo precisa ser DELE e ATIVO', true, anotar.includes('v.motoristaUid !== uid') && anotar.includes('v.ativa !== true'));
checar('recibo e despesa no MESMO lote, e o segundo toque é recusado', true,
  ['runTransaction', 'tx.get(reciboRef)', 'recibo.exists', 'tx.create(reciboRef', 'tx.set(despesaRef'].every((p) => anotar.includes(p)));
checar('a despesa é a categoria que o caixa chama de Auxiliar', true, anotar.includes("category: 'monitor'"));
checar('e guarda o id do recibo', true, anotar.includes('despesaId: despesaRef.id') && anotar.includes('pagamentoDaAuxiliar: id'));
checar('confirmar passa o id no idValido antes de virar caminho', true,
  confirmar.indexOf('idValido(id)') > -1 && confirmar.indexOf('idValido(id)') < confirmar.indexOf('${COLECAO}/${id}'));
checar('confirmar NÃO exige vínculo ativo', false, /auxiliares\//.test(confirmar));
checar('confirmar avisa o motorista na mesma transação', true,
  confirmar.includes('runTransaction') && confirmar.includes("collection('notifications')") && confirmar.includes('userId: pagamento.motoristaUid'));
const indice = ler('functions/index.js');
checar('as duas callables estão exportadas', true,
  ['anotarPagamentoDaAuxiliar', 'confirmarRecebimentoDaAuxiliar'].every((n) => indice.includes(`exports.${n} =`)));
const senha = ler('functions/lib/senhaDoFinanceiro.js');
checar('a senha aceita a auxiliar (mesmas callables, sem cópia)', 2, (senha.match(/await exigirMotoristaOuAuxiliar\(db, request\)/g) || []).length);
const papeis = ler('functions/lib/papeis.js');
checar('o guarda novo só abre motorista e auxiliar', true, papeis.includes("dados?.role !== 'auxiliar'") && papeis.includes('!ehMotorista(dados)'));

const regras = ler('firestore.rules');
const bloco = regras.slice(regras.indexOf('match /pagamentosDaAuxiliar/{id}'), regras.indexOf('match /configFinanceiro/{uid}'));
checar('a coleção tem regra', true, bloco.length > 0 && regras.includes('match /pagamentosDaAuxiliar/{id}'));
checar('ninguém escreve o recibo pelo cliente', true, /allow write: if false;/.test(bloco));
checar('lê só quem está no recibo', true,
  bloco.includes('resource.data.motoristaUid == request.auth.uid') && bloco.includes('resource.data.auxiliarUid == request.auth.uid'));
const blocoConfig = regras.slice(regras.indexOf('match /configFinanceiro/{uid}'), regras.indexOf('allow create', regras.indexOf('match /configFinanceiro/{uid}')));
checar('a auxiliar lê o PRÓPRIO configFinanceiro (o temSenha)', true,
  blocoConfig.includes("userDoc().get('role', '') == 'auxiliar'") && blocoConfig.includes('request.auth.uid == uid'));

console.log('\n9. a aba dela é protegida e não fala do dinheiro do motorista');
const aba = ler('src/pages/auxiliar/AuxPagamentos.jsx');
checar('a lista mora dentro do guarda da senha', true, /<GuardaDosPagamentos>\s*<ListaDePagamentos \/>\s*<\/GuardaDosPagamentos>/.test(aba));
const guarda = ler('src/components/auxiliar/GuardaDosPagamentos.jsx');
checar('o guarda usa o teclado de banco e confere no servidor', true,
  guarda.includes('<TecladoDeBanco') && guarda.includes('conferirNoServidor(pares'));
checar('o guarda só mostra o conteúdo destravado', true, guarda.includes('if (aberto) return children;'));
const telasDela = ['src/pages/auxiliar/AuxPagamentos.jsx', 'src/components/auxiliar/GuardaDosPagamentos.jsx'];
for (const t of telasDela) {
  const s = semComentarios(ler(t)).toLowerCase();
  checar(`${t.split('/').pop()} não fala de saldo nem do caixa dele`, false, /saldo|despesa|extrato|mensalidade|caixa|expenses/.test(s));
}
checar('a sonda acha "saldo" quando existe', true, /saldo/.test('<p>Saldo do mês</p>'.toLowerCase()));
checar('ela só lê pagamentosDaAuxiliar (nunca expenses)', false, /expenses/.test(ler('src/hooks/useAuxiliares.js')));
const layout = ler('src/pages/auxiliar/AuxLayout.jsx');
checar('a aba fica entre Hoje e Perfil', true,
  layout.indexOf("'/aux'") < layout.indexOf("'/aux/pagamentos'") && layout.indexOf("'/aux/pagamentos'") < layout.indexOf("'/aux/perfil'"));
checar('a rota existe', true, ler('src/App.jsx').includes('<Route path="pagamentos" element={<AuxPagamentos />} />'));
checar('o acesso encerrado tem o caminho dos pagamentos', true, ler('src/pages/auxiliar/AuxHoje.jsx').includes('Ver os meus pagamentos'));
checar('o perfil troca a senha', true, ler('src/pages/auxiliar/AuxPerfil.jsx').includes('Trocar a senha dos pagamentos'));

console.log('\n10. do lado do motorista');
const tio = ler('src/components/auxiliar/PagamentoDaAuxiliar.jsx');
checar('o cartão da auxiliar tem a seção', true, ler('src/pages/tio/TioAuxiliar.jsx').includes('<PagamentoDaAuxiliar auxiliar={a} />'));
checar('o botão é de contorno (o verde cheio da tela é o convite)', false, /bg-marca|bg-primary /.test(semComentarios(tio)));
checar('diz que vira despesa', true, tio.includes('Vira a despesa'));
checar('as duas etiquetas', true, tio.includes('Esperando a {primeiro} confirmar') && tio.includes('A {primeiro} confirmou'));
checar('a espera é âmbar com texto legível', true, tio.includes('text-warningText'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
