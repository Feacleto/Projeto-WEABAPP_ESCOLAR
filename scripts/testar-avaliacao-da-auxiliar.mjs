/**
 * AS AVALIAÇÕES ENTRE O TIO E A AUXILIAR (05/10/2026) — a recomendação que o
 * tio escreve para ela e a nota que ela dá ao tio.
 *
 *   node scripts/testar-avaliacao-da-auxiliar.mjs
 *   (ou: npm run testar:avaliacao-da-auxiliar)
 *
 * Régua pura (pontos, filtro da frase, 30 dias, editar volta a pendente,
 * média só com 3 auxiliares diferentes) e leitura de arquivo para o que não
 * roda sem Firebase: o espelho das raízes de promessas.js, as callables
 * passando id por `idValido`, as rules das coleções novas com
 * `allow write: if false`, e nenhuma tela lendo a nota individual. Os casos
 * de regra de verdade (emulador) ficam para `testar:regras`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PROIBIDAS } from '../src/marca/promessas.js';
import * as App from '../src/dominio/identidade/avaliacaoDaAuxiliar.js';
import { ESPECIE_DO_AVISO } from '../src/dominio/identidade/avisos.js';
import { destinoDoAviso } from '../src/dominio/identidade/destinoDoAviso.js';

const require = createRequire(import.meta.url);
const A = require('../functions/lib/reguaDaAvaliacaoDaAuxiliar.js');
const R = require('../functions/lib/reguaDoAuxiliar.js');
const servidorAvisos = require('../functions/lib/avisos.js');
const servidorDestino = require('../functions/lib/destinoDoAviso.js');

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`); console.log(` FALHA ${nome}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const DIA = 24 * 60 * 60 * 1000;

console.log('\n1. os pontos fortes: de 1 a 3, da lista, sem repetir');
checar('a lista fechada do dono', ['Pontual', 'Cuidadosa com as crianças', 'Paciente', 'Organizada', 'Gentil com as famílias'],
  A.PONTOS_FORTES.map((p) => p.rotulo));
checar('vazio é recusado', false, A.validarPontos([]).ok);
checar('ausente é recusado', false, A.validarPontos(undefined).ok);
checar('quatro é recusado', false, A.validarPontos(['pontual', 'paciente', 'organizada', 'gentil']).ok);
checar('repetido é recusado', false, A.validarPontos(['pontual', 'pontual']).ok);
checar('fora da lista é recusado', false, A.validarPontos(['bonita']).ok);
checar('não-string é recusado', false, A.validarPontos([{ id: 'pontual' }]).ok);
checar('três da lista passam, na ordem da lista', { ok: true, pontos: ['pontual', 'paciente', 'gentil'] },
  A.validarPontos(['gentil', 'pontual', 'paciente']));
checar('o app e o servidor têm a mesma lista', JSON.stringify(A.PONTOS_FORTES), JSON.stringify(App.PONTOS_FORTES));
checar('os mesmos limites dos dois lados', [A.MAX_PONTOS, A.MAX_FRASE, A.MIN_DIAS_PARA_RECOMENDAR, A.MIN_AUXILIARES_PARA_MEDIA],
  [App.MAX_PONTOS, App.MAX_FRASE, App.MIN_DIAS_PARA_RECOMENDAR, App.MIN_AUXILIARES_PARA_MEDIA]);
checar('o 4º toque não marca e avisa', { pontos: ['pontual', 'paciente', 'gentil'], cheio: true },
  App.alternarPonto(['pontual', 'paciente', 'gentil'], 'organizada'));
checar('tocar de novo desmarca', { pontos: ['paciente'], cheio: false }, App.alternarPonto(['pontual', 'paciente'], 'pontual'));

console.log('\n2. a frase: filtrada no servidor');
const turma = A.palavrasDosNomes(['Lucas Andrade', 'Márcia Andrade', 'João Pedro', 'Ana Paula Souza'], 'Ana Lima');
const motivo = (f) => (A.problemaNaFrase(f, turma) || {}).motivo || null;
checar('frase vazia passa', null, motivo(''));
checar('sonda positiva: frase limpa passa', null, motivo('Chega sempre antes e trata todo mundo com carinho.'));
checar('80 letras passam', null, motivo('a'.repeat(80)));
checar('81 letras são recusadas', 'longa', motivo('a'.repeat(81)));
checar('telefone sem máscara', 'contato', motivo('liga 11987654321'));
checar('telefone com máscara', 'contato', motivo('liga (11) 98765-4321'));
checar('telefone com espaços', 'contato', motivo('fone 9 8765 4321'));
checar('fixo de 8 dígitos', 'contato', motivo('casa 3456-7890'));
checar('7 dígitos ainda não é telefone', null, motivo('trabalhou 1234567 dias'));
checar('CPF', 'contato', motivo('cpf 123.456.789-09'));
checar('CNPJ', 'contato', motivo('12.345.678/0001-90'));
checar('e-mail', 'contato', motivo('ana@gmail'));
checar('@ sozinho', 'contato', motivo('me acha no @analima'));
checar('link http', 'contato', motivo('veja http:x'));
checar('www', 'contato', motivo('www.ana'));
checar('.com', 'contato', motivo('anuncio.com'));
checar('.br', 'contato', motivo('site.br'));
for (const raiz of A.RAIZES_PROIBIDAS) {
  checar(`promessa: "${raiz}"`, 'promessa', motivo(`Ela é ${raiz}a demais`));
}
checar('promessa com acento e caixa', 'promessa', motivo('Muito CONFIÁVEL'));
checar('nome de criança', 'nome', motivo('Cuidou muito bem do Lucas'));
checar('nome de criança sem acento', 'nome', motivo('O Joao adorava ela'));
checar('nome de criança com acento a mais', 'nome', motivo('O Joãó adorava ela'));
checar('nome de responsável com acento', 'nome', motivo('A Márcia elogiou'));
checar('nome de responsável sem acento e em caixa alta', 'nome', motivo('A MARCIA elogiou'));
checar('sobrenome da família', 'nome', motivo('Os Andrade gostam'));
checar('o nome DELA não é recusado (uma mãe também é Ana)', null, motivo('A Ana é ótima'));
checar('palavra de 2 letras do nome não conta', null, motivo('Pontual de verdade'));
checar('a mensagem é genérica e não repete o nome', 'Tire o nome de criança ou família da frase.',
  A.problemaNaFrase('Cuidou do Lucas', turma).mensagem);
checar('a mensagem de contato diz o que tirar', 'Tire telefone, e-mail ou link da frase.',
  A.problemaNaFrase('liga 11987654321', turma).mensagem);

console.log('\n3. o espelho das raízes é o de promessas.js');
checar('a mesma lista, na mesma ordem', PROIBIDAS, A.RAIZES_PROIBIDAS);
// O espelho mudou de casa (05/10/2026): o filtro é comum à legenda da foto
// da comunidade, em reguaDoTextoLivre.js.
const textoDoEspelho = ler('functions/lib/reguaDoTextoLivre.js');
checar('o espelho diz de onde vem', true, textoDoEspelho.includes('src/marca/promessas.js'));
checar('o filtro comum não requer nada (testar:imports)', false, /require\(/.test(semComentarios(textoDoEspelho)));
const requiresDaRegua = semComentarios(ler('functions/lib/reguaDaAvaliacaoDaAuxiliar.js')).match(/require\([^)]*\)/g) || [];
checar('a régua da avaliação só requer o filtro comum', ["require('./reguaDoTextoLivre')"], requiresDaRegua);

console.log('\n4. os 30 dias de vínculo, pela SOMA dos períodos');
const agora = Date.UTC(2026, 9, 5, 12);
checar('29 dias não recomenda', false, A.podeRecomendar(R.diasDeVinculo([{ de: agora - 29 * DIA, ate: agora }], agora)));
checar('30 dias recomenda', true, A.podeRecomendar(R.diasDeVinculo([{ de: agora - 30 * DIA, ate: agora }], agora)));
checar('29 dias e 23 horas ainda não', false, A.podeRecomendar(R.diasDeVinculo([{ de: agora - 30 * DIA + 3600000, ate: agora }], agora)));
checar('período aberto conta até agora', true, A.podeRecomendar(R.diasDeVinculo([{ de: agora - 31 * DIA, ate: null }], agora)));
checar('dois períodos que somam 30', true, A.podeRecomendar(R.diasDeVinculo([
  { de: agora - 100 * DIA, ate: agora - 80 * DIA },
  { de: agora - 10 * DIA, ate: null },
], agora)));
checar('dois períodos que somam 29', false, A.podeRecomendar(R.diasDeVinculo([
  { de: agora - 100 * DIA, ate: agora - 80 * DIA },
  { de: agora - 9 * DIA, ate: null },
], agora)));
checar('o app usa a mesma régua', [false, true], [App.podeRecomendar(29), App.podeRecomendar(30)]);

console.log('\n5. editar volta para pendente');
const nova = A.documentoDaRecomendacao({ existente: null, motoristaUid: 't', auxiliarUid: 'a', assinatura: 'Tio Nino (João)', pontos: ['pontual'], frase: '  Ótima  ', agora: 'AGORA' });
checar('nasce pendente, sem aprovação, sem edição', ['pendente', null, null, 'AGORA', false], [nova.estado, nova.aprovadaEm, nova.editadaEm, nova.criadaEm, nova.removida]);
checar('a frase é aparada', 'Ótima', nova.frase);
const editada = A.documentoDaRecomendacao({ existente: { ...nova, estado: 'aprovada', aprovadaEm: 'ONTEM', criadaEm: 'ANTES' }, motoristaUid: 't', auxiliarUid: 'a', assinatura: 'Tio Nino (João)', pontos: ['paciente'], frase: '', agora: 'AGORA' });
checar('editar a aprovada volta a pendente e zera a aprovação', ['pendente', null, 'AGORA', 'ANTES'], [editada.estado, editada.aprovadaEm, editada.editadaEm, editada.criadaEm]);
checar('a resposta dela', ['aprovada', 'oculta', null], ['aprovar', 'ocultar', 'apagar'].map(A.estadoDaResposta));
checar('o id é o do par, o mesmo do vínculo', R.idDoVinculo('t', 'a'), A.idDaAvaliacao('t', 'a'));

console.log('\n6. a assinatura');
checar('marca e primeiro nome', 'Tio Nino (João)', A.assinaturaDoTio({ marcaNome: 'Tio Nino', name: 'João da Silva' }));
checar('o nome já está na marca: só a marca', 'Tio João', A.assinaturaDoTio({ marcaNome: 'Tio João', name: 'João da Silva' }));
checar('sem marca: o primeiro nome', 'João', A.assinaturaDoTio({ name: 'João da Silva' }));
checar('sem nada', 'Motorista', A.assinaturaDoTio({}));

console.log('\n7. a nota ao tio: só a média, e só com 3 auxiliares diferentes');
checar('estrelas de 1 a 5, inteiras', [false, true, true, false, false], [0, 1, 5, 6, 4.5].map(A.estrelasValidas));
checar('nenhuma', { respostas: 0, media: null }, A.resumoDasNotas([]));
checar('duas: sem média', { respostas: 2, media: null }, A.resumoDasNotas([{ auxiliarUid: 'a', estrelas: 5 }, { auxiliarUid: 'b', estrelas: 3 }]));
checar('três da MESMA auxiliar contam uma', { respostas: 1, media: null },
  A.resumoDasNotas([{ auxiliarUid: 'a', estrelas: 5 }, { auxiliarUid: 'a', estrelas: 4 }, { auxiliarUid: 'a', estrelas: 1 }]));
checar('três diferentes: média com uma casa', { respostas: 3, media: 4.3 },
  A.resumoDasNotas([{ auxiliarUid: 'a', estrelas: 5 }, { auxiliarUid: 'b', estrelas: 4 }, { auxiliarUid: 'c', estrelas: 4 }]));
checar('nota inválida não entra', { respostas: 2, media: null },
  A.resumoDasNotas([{ auxiliarUid: 'a', estrelas: 5 }, { auxiliarUid: 'b', estrelas: 4 }, { auxiliarUid: 'c', estrelas: 9 }]));
checar('a tela com média', 'Nota das suas auxiliares: 4,7', App.textoDaNota({ respostas: 3, media: 4.7 }));
checar('a tela sem média diz só quantas', '2 de 3 responderam — a média aparece com 3.', App.textoDaNota({ respostas: 2, media: null }));
checar('motivo do dono: de 5 a 200 letras', [false, true, true, false], ['abc', 'abuso', 'x'.repeat(200), 'x'.repeat(201)].map(A.motivoValido));

console.log('\n8. as callables');
const srv = ler('functions/lib/avaliacoesDaAuxiliar.js');
const indice = ler('functions/index.js');
for (const nome of ['recomendarAuxiliar', 'retirarRecomendacao', 'responderRecomendacao', 'removerRecomendacaoAbusiva', 'avaliarTio', 'minhaNotaDasAuxiliares', 'limparAvaliacoesDaContaApagada']) {
  checar(`${nome} é exportada`, true, indice.includes(`exports.${nome} = make`));
}
for (const v of ['auxiliarUid', 'motoristaUid', 'id']) {
  checar(`todo ${v} do cliente passa por idValido`, true, srv.includes(`idValido(${v})`));
}
checar('a prova dos 30 dias é o vínculo do par, lido no servidor', true,
  srv.includes('R.diasDeVinculo(v.periodos, Date.now())') && srv.includes('auxiliares/${R.idDoVinculo(motoristaUid, auxiliarUid)}'));
checar('o filtro da frase lê a turma DAQUELE tio', true, srv.includes("where('adminUid', '==', motoristaUid)"));
checar('remover exige o dono', true, srv.includes('exigirDono(db, request)'));
checar('a auxiliar responde e avalia como auxiliar', 2, (srv.match(/exigirAuxiliar\(db, request\)/g) || []).length);
checar('recomendar NÃO exige a conta operando (decisão escrita)', false, /exigirContaDoMotoristaOperando\(/.test(semComentarios(srv)));
checar('a recomendação avisa a auxiliar', true, srv.includes("type: 'recomendacao_recebida'"));

console.log('\n9. o aviso novo tem espécie e destino, dos dois lados');
checar('é fato no app e no servidor', ['fato', 'fato'], [ESPECIE_DO_AVISO.recomendacao_recebida, servidorAvisos.ESPECIE_DO_AVISO?.recomendacao_recebida ?? servidorAvisos.especieDoAviso?.('recomendacao_recebida')]);
checar('a auxiliar vai para o perfil dela', ['/aux/perfil', '/aux/perfil'],
  [destinoDoAviso({ type: 'recomendacao_recebida' }, 'auxiliar'), servidorDestino.destinoDoAviso({ type: 'recomendacao_recebida' }, 'auxiliar')]);
checar('aviso desconhecido da auxiliar cai no painel dela', '/aux', destinoDoAviso({ type: 'x' }, 'auxiliar'));

console.log('\n10. as rules das coleções novas');
const regras = ler('firestore.rules');
const blocoRec = regras.slice(regras.indexOf('match /recomendacoesDeAuxiliar/{id}'), regras.indexOf('match /notasDaAuxiliarAoTio/{id}'));
const blocoNota = regras.slice(regras.indexOf('match /notasDaAuxiliarAoTio/{id}'));
const blocoNotaSo = blocoNota.slice(0, blocoNota.indexOf('\n    }') + 6);
checar('recomendação: ninguém escreve pelo cliente', true, blocoRec.includes('allow write: if false;'));
checar('recomendação: só o autor e ela, e só sem a retirada do dono', true,
  blocoRec.includes('resource.data.removida == false')
  && blocoRec.includes('resource.data.motoristaUid == request.auth.uid')
  && blocoRec.includes('resource.data.auxiliarUid == request.auth.uid'));
checar('recomendação: o dono lê', true, blocoRec.includes('isOwner()'));
checar('recomendação: nenhuma leitura por outro motorista (isAdmin solto)', false, /isAdmin\(\)/.test(semComentarios(blocoRec)));
checar('nota: ninguém escreve pelo cliente', true, blocoNotaSo.includes('allow write: if false;'));
checar('nota: só o dono lê', true, /allow read: if isOwner\(\);/.test(blocoNotaSo));
const servico = ler('src/services/avaliacoesDaAuxiliarService.js');
checar('as consultas provam `removida == false` (regra não é filtro)', 1,
  (servico.match(/where\(campo, '==', uid\), where\('removida', '==', false\)/g) || []).length);

console.log('\n11. nenhuma tela lê a nota individual');
function varrer(dir, fora = []) {
  for (const nome of readdirSync(new URL(`../${dir}/`, import.meta.url))) {
    const rel = `${dir}/${nome}`;
    if (statSync(new URL(`../${rel}`, import.meta.url)).isDirectory()) varrer(rel, fora);
    else if (/\.(js|jsx)$/.test(nome)) fora.push(rel);
  }
  return fora;
}
checar('ninguém em src/ lê `notasDaAuxiliarAoTio`', [], varrer('src').filter((a) => semComentarios(ler(a)).includes('notasDaAuxiliarAoTio')));
const telasDoTio = [...varrer('src/pages/tio'), 'src/components/avaliacaoDaAuxiliar/NotaDasAuxiliares.jsx', 'src/components/avaliacaoDaAuxiliar/RecomendarAuxiliar.jsx'];
checar('nenhuma tela do tio chama `avaliarTio`', [], telasDoTio.filter((a) => /avaliarTio/.test(semComentarios(ler(a)))));
checar('a tela do tio usa só a média', true, ler('src/pages/tio/TioAuxiliar.jsx').includes('<NotaDasAuxiliares />'));
checar('a frase fixa da auxiliar', true, ler('src/components/avaliacaoDaAuxiliar/EstrelasParaOTio.jsx').includes('Só a equipe do Alô Buzinou vê a sua nota.'));
checar('o acesso encerrado oferece as estrelas', true, ler('src/pages/auxiliar/AuxHoje.jsx').includes('<EstrelasParaOTio'));
checar('o perfil tem as recomendações e as estrelas', true,
  ler('src/pages/auxiliar/AuxPerfil.jsx').includes('<RecomendacoesRecebidas />') && ler('src/pages/auxiliar/AuxPerfil.jsx').includes('<EstrelasParaOTio'));
const telas = ['src/components/avaliacaoDaAuxiliar/RecomendarAuxiliar.jsx', 'src/components/avaliacaoDaAuxiliar/RecomendacoesRecebidas.jsx', 'src/components/avaliacaoDaAuxiliar/NotaDasAuxiliares.jsx'];
const RANKING = /ranking|posi[cç][aã]o no|melhor auxiliar|recomenda[cç][oõ]es? recebidas?:|\.length\s*\}\s*recomenda/i;
checar('sem ranking nem contagem de recomendações', [], telas.filter((a) => RANKING.test(semComentarios(ler(a)))));
checar('sonda: o padrão de contagem acha quando existe', true, RANKING.test('<p>{lista.length} recomendações</p>'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
