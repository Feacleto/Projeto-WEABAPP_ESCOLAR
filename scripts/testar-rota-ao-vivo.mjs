/**
 * A ROTA AO VIVO E A FICHA RÁPIDA (05/10/2026, decisão do dono).
 *
 *   node scripts/testar-rota-ao-vivo.mjs   (ou: npm run testar:rota-ao-vivo)
 *
 * 1. As zonas: quem está em casa / na perua / na escola / entregue, na ida e
 *    na volta, com quem falta fora de todas.
 * 2. O evento do registro ("O que a Cida marcou"): lista fechada, primeiro
 *    nome, nada de sobrenome, telefone ou endereço.
 * 3. O servidor grava o registro na MESMA transação da marcação.
 * 4. A ficha da auxiliar não lê recado, endereço nem saúde, e de quem busca
 *    só o NOME da cópia — nunca `altPickups` (leitura de arquivo, com sonda).
 * 5. A rule do registro: escrita fechada, `list` negado, `get` do tio e da
 *    auxiliar ATIVA do par.
 * 6. A retenção de 7 dias.
 * 7. O tio lê o registro com UMA escuta, e a ficha dele não abre escuta.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  zonasDaRota,
  quantosNaEscola,
  rotuloDoLugar,
  viagemAoVivo,
  rotuloDaVez,
} from '../src/dominio/rota/zonasDaRota.js';
import { fraseDoEvento, horaDoEvento, ultimosEventos, tituloDoRegistro } from '../src/dominio/rota/registroDaRota.js';
import { RECADO_MAXIMO, DIAS_DO_RECADO, idDoRecado, textoDoRecado, letrasQueSobram, recadoDoDiaParaMostrar } from '../src/dominio/rota/recadoDoDia.js';

const require = createRequire(import.meta.url);
const RR = require('../functions/lib/reguaDoRegistroDaRota.js');
const RD = require('../functions/lib/reguaDoRecadoDoDia.js');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (passou) ok++;
  else {
    bad++;
    falhas.push(`${nome}\n      esperado: ${JSON.stringify(esperado)}\n      obtido:   ${JSON.stringify(obtido)}`);
  }
  console.log(`  ${passou ? '✓' : '✗'} ${nome}`);
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
/** Tira comentários de bloco e de linha — o texto da decisão pode citar o proibido. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const crianca = (id, name, status, extra = {}) => ({
  child: { id, name, school: 'EMEF Sol', schoolId: 'sol', ...extra.child },
  hora: extra.hora || '06:40',
  estado: extra.estado || 'normal',
  status,
});
const nomes = (lista) => lista.map((q) => q.child.name);

console.log('\n1. as zonas da ida');
{
  const fila = [
    crianca('a', 'Ana Souza', 'home', { hora: '06:50' }),
    crianca('b', 'Bia', 'onboard', { hora: '06:40' }),
    crianca('c', 'Caio', 'atSchool'),
    crianca('d', 'Davi', 'atSchool', { child: { school: 'Colégio Lua', schoolId: 'lua' } }),
    crianca('e', 'Eva', 'home', { hora: '06:45', estado: 'falta' }),
    crianca('f', 'Fábio', 'home', { hora: '06:42' }),
  ];
  const z = zonasDaRota(fila, { direcao: 'ida', escolasPorId: { sol: { nome: 'EMEF Sol Nascente' } } });
  checar('em casa, na ordem da hora', ['Fábio', 'Ana Souza'], nomes(z.emCasa));
  checar('na perua', ['Bia'], nomes(z.naPerua));
  checar('na escola, por prédio, com o nome da escola (do cadastro de escolas)', [['Colégio Lua', ['Davi']], ['EMEF Sol Nascente', ['Caio']]],
    z.naEscola.map((g) => [g.nome, nomes(g.criancas)]));
  checar('quem falta fica fora de todas as zonas', ['Eva'], nomes(z.fora));
  checar('e não aparece "em casa"', false, z.emCasa.some((q) => q.child.id === 'e'));
  checar('na ida ninguém é "entregue em casa"', [], z.entregues);
  checar('quantos na escola soma os prédios', 2, quantosNaEscola(z));
  checar('status ausente vale "em casa"', ['X'], nomes(zonasDaRota([{ child: { id: 'x', name: 'X' }, hora: '07:00' }], { direcao: 'ida' }).emCasa));
}

console.log('\n2. as zonas da volta (o caminho inverso)');
{
  const fila = [
    crianca('a', 'Ana', 'atSchool', { hora: '12:30' }),
    crianca('b', 'Bia', 'onboard', { hora: '12:20' }),
    crianca('c', 'Caio', 'delivered', { hora: '12:10' }),
    crianca('d', 'Davi', 'home', { hora: '12:40' }),
    crianca('e', 'Eva', 'atSchool', { estado: 'pai-busca' }),
  ];
  const z = zonasDaRota(fila, { direcao: 'volta' });
  checar('na escola: quem espera a perua, e o "em casa" sem a ida marcada', ['Ana', 'Davi'], nomes(z.naEscola[0].criancas));
  checar('na perua', ['Bia'], nomes(z.naPerua));
  checar('entregues em casa', ['Caio'], nomes(z.entregues));
  checar('na volta ninguém está "ainda em casa"', [], z.emCasa);
  checar('o pai busca: fora', ['Eva'], nomes(z.fora));
  checar('direção', 'volta', z.direcao);
  checar('rótulo do lugar na ficha', ['Na perua', 'Na escola', 'Entregue em casa', 'Em casa', 'Na escola'],
    [rotuloDoLugar('onboard'), rotuloDoLugar('atSchool'), rotuloDoLugar('delivered'), rotuloDoLugar('home', 'ida'), rotuloDoLugar('home', 'volta')]);
  checar('fila vazia ou nula não quebra', [0, 0], [zonasDaRota(null).naPerua.length, zonasDaRota([]).emCasa.length]);
}

console.log('\n3. a viagem ao vivo da auxiliar e o botão da vez');
{
  const bloco = { inicio: 400, fim: 430 }; // 06:40 a 07:10
  checar('alguém na perua: ao vivo', true, viagemAoVivo(bloco, 100, true));
  checar('30 min antes da primeira porta: ao vivo (o primeiro "Entrou na perua")', true, viagemAoVivo(bloco, 370, false));
  checar('31 min antes: ainda não', false, viagemAoVivo(bloco, 369, false));
  checar('até 90 min depois da última porta', [true, false], [viagemAoVivo(bloco, 520, false), viagemAoVivo(bloco, 521, false)]);
  checar('sem viagem: não', false, viagemAoVivo(null, 400, false));
  checar('os botões da vez', ['Entrou na perua', 'Entregue na escola', 'Entregue em casa', null],
    [rotuloDaVez('onboard'), rotuloDaVez('atSchool'), rotuloDaVez('delivered'), rotuloDaVez('home')]);
}

console.log('\n4. o evento do registro é uma lista fechada');
{
  const em = { toMillis: () => Date.UTC(2026, 9, 5, 9, 52) }; // 06:52 em Brasília
  const e = RR.eventoDoRegistro({
    em,
    auxiliarUid: 'aux1',
    auxiliarNome: 'Cida Maria Santos',
    anterior: 'home',
    passo: 'onboard',
    criancaNome: 'Ana Beatriz Souza',
    escola: 'EMEF Sol',
    telefone: '11999998888',
    endereco: 'Rua das Trovas, 61',
  });
  checar('só os campos da lista, na ordem', RR.CAMPOS_DO_EVENTO, Object.keys(e));
  checar('a lista é a decidida', ['em', 'auxiliarUid', 'auxiliarNome', 'passo', 'viagem', 'criancaNome', 'escola'], RR.CAMPOS_DO_EVENTO);
  checar('primeiro nome da criança e da auxiliar', ['Ana', 'Cida'], [e.criancaNome, e.auxiliarNome]);
  const texto = JSON.stringify(e);
  checar('nada de sobrenome, telefone ou endereço', [false, false, false, false],
    [texto.includes('Souza'), texto.includes('Santos'), texto.includes('99999'), texto.includes('Trovas')]);
  checar('ida e volta pelo passo', ['ida', 'ida', 'volta', 'volta'],
    [RR.viagemDoPasso('home', 'onboard'), RR.viagemDoPasso('onboard', 'atSchool'), RR.viagemDoPasso('atSchool', 'onboard'), RR.viagemDoPasso('onboard', 'delivered')]);
  checar('passo que não é dela não vira evento', [null, null, null],
    [RR.eventoDoRegistro({ em, auxiliarUid: 'a', anterior: 'onboard', passo: 'home' }),
      RR.eventoDoRegistro({ em, auxiliarUid: 'a', anterior: 'delivered', passo: 'onboard' }),
      RR.eventoDoRegistro({ em: null, auxiliarUid: 'a', anterior: 'home', passo: 'onboard' })]);
  const falta = RR.eventoDoRegistro({ em, auxiliarUid: 'aux1', auxiliarNome: 'Cida', anterior: 'home', passo: 'faltou', criancaNome: 'Ana Souza', escola: 'EMEF Sol' });
  checar('"faltou" vira evento, com a mesma lista fechada', RR.CAMPOS_DO_EVENTO, Object.keys(falta || {}));
  checar('a falta vale para o dia', 'dia', falta?.viagem);
  checar('a frase da falta', 'Ana faltou', fraseDoEvento(falta));
  checar('falta depois de embarcar não vira evento', [null, null],
    [RR.eventoDoRegistro({ em, auxiliarUid: 'a', anterior: 'onboard', passo: 'faltou' }), RR.eventoDoRegistro({ em, auxiliarUid: 'a', anterior: 'atSchool', passo: 'faltou' })]);
  checar('o id é do tio e do dia', 'tio1_2026-10-05', RR.idDoRegistro('tio1', '2026-10-05'));
  checar('a régua do servidor não faz require', false, /require\(/.test(semComentarios(ler('functions/lib/reguaDoRegistroDaRota.js'))));

  checar('a frase do tio', ['Ana entrou na perua', 'Ana foi entregue na EMEF Sol', 'Ana entrou na perua na EMEF Sol', 'Ana foi entregue em casa'],
    [fraseDoEvento(e), fraseDoEvento({ ...e, passo: 'atSchool' }), fraseDoEvento({ ...e, viagem: 'volta' }), fraseDoEvento({ ...e, passo: 'delivered', viagem: 'volta' })]);
  checar('a hora é a de Brasília', '06:52', horaDoEvento(e));
  const muitos = Array.from({ length: 9 }, (_, i) => ({ ...e, criancaNome: `C${i}`, em: { toMillis: () => 1000 * i } }));
  checar('os 6 mais recentes, o mais novo em cima', ['C8', 'C7', 'C6', 'C5', 'C4', 'C3'], ultimosEventos(muitos).map((x) => x.criancaNome));
  checar('o título com uma auxiliar e com duas', ['O que a Cida marcou', 'O que as auxiliares marcaram'],
    [tituloDoRegistro(['Cida']).titulo, tituloDoRegistro(['Cida', 'Rosa']).titulo]);
}

console.log('\n5. o servidor grava o registro na MESMA transação da marcação');
{
  const servidor = ler('functions/lib/auxiliares.js');
  const marcar = servidor.slice(servidor.indexOf('function makeMarcarParadaPelaAuxiliar'), servidor.indexOf('function makeMarcarFaltaPelaAuxiliar'));
  const transacao = marcar.slice(marcar.indexOf('runTransaction'), marcar.indexOf('return { ok: true, avisou'));
  checar('o registro é escrito dentro da transação (tx.set)', true, transacao.includes('tx.set(db.doc(`registroDaRota/${idDoRegistro(motoristaUid, hoje)}`)'));
  checar('com arrayUnion do evento da régua', true, transacao.includes('eventos: FieldValue.arrayUnion(evento)') && transacao.includes('eventoDoRegistro('));
  checar('o instante é Timestamp.now() (array recusa serverTimestamp)', true, transacao.includes('em: Timestamp.now()'));
  checar('o dia é o mesmo da marcação', true, transacao.includes('dateKey: hoje'));
  checar('fora da transação, nenhuma escrita do registro', false, marcar.replace(transacao, '').includes('registroDaRota'));
  const falta = servidor.slice(servidor.indexOf('function makeMarcarFaltaPelaAuxiliar'), servidor.indexOf('module.exports'));
  const txFalta = falta.slice(falta.indexOf('runTransaction'), falta.indexOf('return { ok: true, avisou }'));
  checar('o Faltou dela grava o registro na transação dele, com passo "faltou"', true,
    txFalta.includes('tx.set(db.doc(`registroDaRota/${idDoRegistro(motoristaUid, hoje)}`)') && txFalta.includes("passo: 'faltou'"));
  checar('e fora da transação do Faltou, nenhuma escrita do registro', false, falta.replace(txFalta, '').includes('registroDaRota'));
}

console.log('\n6. a ficha da auxiliar não lê o que ela não vê');
{
  // `quemBusca`/`QuemBusca` continua proibido: é o objeto do TIO (nome,
  // telefone, parentesco). A auxiliar recebe `buscaHoje`, só o nome da cópia.
  const PROIBIDO = /\bnote\b|altPickup|quemBusca|QuemBusca|address|endereco|saude|Saude|declaracao|Recado|relationship|\.phone\b/;
  for (const arq of ['src/components/route/FichaRapidaDaAuxiliar.jsx', 'src/pages/auxiliar/AuxHoje.jsx']) {
    checar(`${arq.split('/').pop()} não cita recado, altPickups, telefone de quem busca, endereço nem saúde`, null,
      (semComentarios(ler(arq)).match(PROIBIDO) || [null])[0]);
  }
  const fichaAux = semComentarios(ler('src/components/route/FichaRapidaDaAuxiliar.jsx'));
  checar('a ficha dela diz "Hoje busca" com o nome que recebe', true, fichaAux.includes("titulo: 'Hoje busca', valor: buscaHoje"));
  const hojeAux = semComentarios(ler('src/pages/auxiliar/AuxHoje.jsx'));
  checar('e o cartão da ENTREGA também (só no passo de entregar em casa)', true,
    hojeAux.includes("item.action?.nextStatus === 'delivered' && buscaHoje") && hojeAux.includes('Hoje busca: {buscaHoje}'));
  checar('sonda: o padrão acha o campo quando existe', true, PROIBIDO.test('child.saudeNotas') && PROIBIDO.test('quemBusca.name'));
  const moldura = semComentarios(ler('src/components/route/FichaRapida.jsx'));
  checar('a moldura comum também não lê esses campos (só desenha o que recebe)', null, (moldura.match(PROIBIDO) || [null])[0]);
  const tio = semComentarios(ler('src/components/route/FichaRapidaDoTio.jsx'));
  checar('a do tio tem a ordem decidida: recado, busca, combinado, responsável, endereço, saúde', true,
    ['Recado de hoje', "'Busca hoje'", "'Combinado'", "'Responsável'", "'Endereço'", "'Saúde'", 'Ver ficha completa']
      .map((t) => tio.indexOf(t)).every((i, k, a) => i > -1 && (k === 0 || i > a[k - 1])));
  checar('a saúde vai com "Escrito pela família."', true, tio.includes('Escrito pela família.'));
  checar('o recado do dia vem de UMA fonte: recadosDoDia (nunca o note da falta, nunca o caderno)', [true, false, false],
    [tio.includes('recadoDoDiaParaMostrar(recado, getDateKey())'), tio.includes('.note'), /agenda/i.test(tio)]);
  checar('a ficha do tio não abre escuta (nada de hook de leitura)', false, /use[A-Z]\w*\(/.test(tio.replace('useNavigate(', '')));
}

console.log('\n7. o tio lê o registro com UMA escuta');
{
  const servico = semComentarios(ler('src/services/registroDaRotaService.js'));
  checar('uma escuta num documento pelo id (nunca consulta)', [true, false, false],
    [servico.includes("doc(db, 'registroDaRota', `${motoristaUid}_${dateKey}`)"), /query\(|where\(/.test(servico), /collection\(/.test(servico)]);
  const aoVivo = semComentarios(ler('src/components/route/RotaAoVivoDoTio.jsx'));
  checar('só com auxiliar ativa (sem auxiliar, nem escuta)', true, aoVivo.includes('nomes.length > 0') && aoVivo.includes("a.ativa === true"));
  checar('a rota passa os dados que já escuta, em vez de escutar de novo', [false, false, false],
    [/useChildren|useAbsences|useQuemBuscaHoje/.test(aoVivo), false, false]);
  const op = ler('src/components/route/OperacaoDaRota.jsx');
  checar('a operação entrega fila, declarações, quem busca e os recados ao "ao vivo"', true,
    /aoVivo\?\.\(\{[\s\S]*fila,[\s\S]*declaracoes,[\s\S]*quemBusca,[\s\S]*recados,/.test(op));
  checar('os recados do dia são UMA consulta da turma na operação', true, op.includes('useRecadosDoDiaDaTurma(user?.uid, dateKey)'));
  checar('e continua com o rodapé da parada e o desfazer', true, op.includes('function BarraDaParada') && op.includes('voltarPasso'));
}

console.log('\n8. a rule do registro');
{
  const regras = ler('firestore.rules');
  const ini = regras.indexOf('match /registroDaRota/');
  const bloco = ini > -1 ? regras.slice(ini, regras.indexOf('match /', ini + 10)) : '';
  checar('o bloco existe', true, ini > -1);
  checar('ninguém escreve pelo cliente', true, /allow write: if false;/.test(bloco));
  checar('list negado, separado do get', true, /allow list: if false;/.test(bloco) && /allow get:/.test(bloco));
  checar('nenhum "allow read" (que abriria o list junto)', false, /allow read/.test(bloco));
  checar('o tio lê o dele', true, bloco.includes('resource.data.motoristaUid == request.auth.uid'));
  checar('a auxiliar lê pelo par, com exists() antes do get()', true,
    bloco.includes("exists(/databases/$(database)/documents/auxiliares/$(resource.data.motoristaUid + '_' + request.auth.uid))")
    && bloco.indexOf('exists(') < bloco.indexOf('get(/databases'));
  checar('e só com o par ativo', true, bloco.includes('.data.ativa == true'));
}

console.log('\n9. a retenção de 7 dias');
{
  checar('7 dias', 7, RR.DIAS_DO_REGISTRO);
  checar('o corte', '2026-09-28', RR.corteDoRegistro(new Date(Date.UTC(2026, 9, 5, 12))));
  const ret = ler('functions/lib/retencaoDasViagens.js');
  checar('a agendada das viagens apaga o registro, por campo e em páginas', true,
    ret.includes('await apagarRegistrosAntigos(db)') && /collection\('registroDaRota'\)\s*\.where\('dateKey', '<', corte\)\s*\.limit\(/.test(ret));
}

console.log('\n10. o recado do dia da família (05/10/2026)');
{
  checar('140 letras', 140, RECADO_MAXIMO);
  checar('texto vazio não é recado', false, textoDoRecado('').ok);
  checar('só espaços não é recado', false, textoDoRecado('   \n  ').ok);
  checar('141 letras não cabem', false, textoDoRecado('a'.repeat(141)).ok);
  checar('140 cabem', true, textoDoRecado('a'.repeat(140)).ok);
  checar('1 cabe', { ok: true, texto: 'x' }, textoDoRecado('x'));
  checar('espaços repetidos viram um (a conta da tela é a da rule)', 'Sai às 11h hoje', textoDoRecado('  Sai   às 11h\n hoje ').texto);
  checar('a contagem do que sobra', 130, letrasQueSobram('  0123456789 '));
  checar('o id é o dia e a criança', '2026-10-05_c1', idDoRecado('2026-10-05', 'c1'));
  checar('o recado só aparece no dia dele', ['Sai às 11h', '', ''],
    [recadoDoDiaParaMostrar({ dateKey: '2026-10-05', texto: 'Sai às 11h' }, '2026-10-05'),
      recadoDoDiaParaMostrar({ dateKey: '2026-10-04', texto: 'Sai às 11h' }, '2026-10-05'),
      recadoDoDiaParaMostrar(null, '2026-10-05')]);
  checar('7 dias, nos dois lados', [7, 7], [DIAS_DO_RECADO, RD.DIAS_DO_RECADO]);
  checar('o corte do recado', '2026-09-28', RD.corteDoRecado(new Date(Date.UTC(2026, 9, 5, 12))));
  checar('a régua do servidor não faz require', false, /require\(/.test(semComentarios(ler('functions/lib/reguaDoRecadoDoDia.js'))));
  const ret = ler('functions/lib/retencaoDasViagens.js');
  checar('a agendada das viagens apaga os recados, por campo e em páginas', true,
    ret.includes('await apagarRecadosAntigos(db)') && /collection\('recadosDoDia'\)\s*\.where\('dateKey', '<', corte\)\s*\.limit\(/.test(ret));

  const servico = semComentarios(ler('src/services/recadosDoDiaService.js'));
  checar('o tio lê com UMA consulta: adminUid e dateKey', true,
    /where\('adminUid', '==', adminUid\),\s*where\('dateKey', '==', dateKey\)/.test(servico));
  checar('a edição muda só texto e atualizadoEm', true, servico.includes('updateDoc(ref, { texto: r.texto, atualizadoEm: serverTimestamp() })'));
  checar('a criação leva adminUid e parentUid da CRIANÇA', true,
    servico.includes('parentUid: child.parentUid || null') && servico.includes('adminUid: child.adminUid || null'));

  const campo = ler('src/components/absences/RecadoDoDia.jsx');
  const semC = semComentarios(campo);
  checar('o campo "Recado para o tio (hoje)" existe', true, semC.includes('label="Recado para o tio (hoje)"'));
  const iCampo = semC.indexOf('label="Recado para o tio (hoje)"');
  const iFrase = semC.indexOf('Para saúde, use a ficha da criança.');
  checar('a frase de saúde mora LOGO abaixo do campo, em 16px e muted', true,
    iFrase > iCampo && iFrase - iCampo < 400 && /<p className="text-base text-textMuted">Para saúde, use a ficha da criança\.<\/p>/.test(semC));
  checar('o campo tem o teto de 140', true, semC.includes('maxLength={RECADO_MAXIMO}'));
  checar('o botão do recado é de contorno (o cheio do Início é a barra)', false, /bg-primary\b|bg-marca\b/.test(semC));
  checar('o aviso rápido mostra o campo só com "Hoje"', true,
    ler('src/components/absences/AvisoRapido.jsx').includes("{dia === 'hoje' && hojeTemRota && <RecadoDoDia child={child} dateKey={hoje} />}"));

  // A AUXILIAR NÃO VÊ O RECADO: nenhuma tela, hook ou serviço dela o lê.
  const daAuxiliar = ['src/pages/auxiliar/AuxHoje.jsx', 'src/pages/auxiliar/AuxFoto.jsx', 'src/pages/auxiliar/AuxLayout.jsx',
    'src/pages/auxiliar/AuxPagamentos.jsx', 'src/pages/auxiliar/AuxPerfil.jsx', 'src/components/route/FichaRapidaDaAuxiliar.jsx',
    'src/services/auxiliarService.js', 'src/hooks/useAuxiliares.js'];
  checar('a auxiliar continua sem ler recadosDoDia', [],
    daAuxiliar.filter((a) => /recadosDoDia|RecadosDoDia|useRecadoDoDia|RecadoDoDia/.test(semComentarios(ler(a)))));
  checar('sonda: o padrão acha a leitura', true, /recadosDoDia|useRecadosDoDiaDaTurma/.test("collection(db, 'recadosDoDia')"));
  checar('o servidor não copia o recado para a turma da auxiliar', false, /recadosDoDia/.test(ler('functions/lib/turmaDaAuxiliar.js')));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
