/**
 * O KANBAN DO DONO — a régua de temas e atividades.
 * COMO RODAR: node scripts/testar-kanban-do-dono.mjs
 */
import {
  ESTADO,
  LIMITES,
  acrescentarAtividade,
  agruparPorEstado,
  alternarAtividade,
  criarTema,
  frasesDoResumo,
  moverTema,
  removerAtividade,
  resumirKanban,
  temaValido,
} from '../src/dominio/associacao/kanbanDoDono.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

const H1 = '2026-10-05';
const H2 = '2026-10-07';
const novo = criarTema({ nome: '  Lançar   o plano  ', hoje: H1, uid: 'u1' });
checar('cria tema, limpa espaços', 'Lançar o plano', novo.tema.nome);
checar('nasce a fazer, aberto hoje, sem conclusão', [ESTADO.A_FAZER, H1, null, []], [
  novo.tema.estado, novo.tema.abertoEm, novo.tema.concluidoEm, novo.tema.atividades,
]);
checar('criadoPor é o uid', 'u1', novo.tema.criadoPor);
checar('o tema criado é válido', true, temaValido(novo.tema));
checar('nome vazio recusado', false, criarTema({ nome: '   ', hoje: H1, uid: 'u1' }).ok);
checar('nome de 121 letras recusado', false, criarTema({ nome: 'a'.repeat(121), hoje: H1, uid: 'u1' }).ok);
checar('nome de 120 letras aceito', true, criarTema({ nome: 'a'.repeat(120), hoje: H1, uid: 'u1' }).ok);
checar('data ruim recusada', false, criarTema({ nome: 'x', hoje: '5/10', uid: 'u1' }).ok);
checar('sem uid recusado', false, criarTema({ nome: 'x', hoje: H1, uid: '' }).ok);

const a = acrescentarAtividade(novo.tema, 'Escrever o texto', H1);
checar('acrescenta atividade', 1, a.tema.atividades.length);
checar('atividade nasce aberta hoje, sem conclusão', [H1, null], [a.tema.atividades[0].abertaEm, a.tema.atividades[0].concluidaEm]);
checar('texto vazio recusado', false, acrescentarAtividade(novo.tema, '  ', H1).ok);
checar('texto de 201 letras recusado', false, acrescentarAtividade(novo.tema, 'a'.repeat(201), H1).ok);
checar('texto de 200 letras aceito', true, acrescentarAtividade(novo.tema, 'a'.repeat(200), H1).ok);
checar('não muta o tema original', 0, novo.tema.atividades.length);

let cheio = novo.tema;
for (let i = 0; i < LIMITES.ATIVIDADES; i += 1) cheio = acrescentarAtividade(cheio, `t${i}`, H1).tema;
checar('50 atividades cabem', 50, cheio.atividades.length);
checar('a 51ª é recusada', false, acrescentarAtividade(cheio, 'mais uma', H1).ok);
checar('ids únicos', 50, new Set(cheio.atividades.map((x) => x.id)).size);
const semMeio = removerAtividade(cheio, 'a3');
const repostos = acrescentarAtividade(semMeio, 'n', H1).tema;
checar('id novo não colide depois de remover', 50, new Set(repostos.atividades.map((x) => x.id)).size);

const marcada = alternarAtividade(a.tema, 'a1', H2);
checar('marcar grava hoje', H2, marcada.atividades[0].concluidaEm);
checar('desmarcar zera', null, alternarAtividade(marcada, 'a1', H2).atividades[0].concluidaEm);
checar('id inexistente não muda nada', a.tema, alternarAtividade(a.tema, 'zzz', H2));

const fazendo = moverTema(a.tema, ESTADO.FAZENDO, H1);
checar('começar', [ESTADO.FAZENDO, null], [fazendo.estado, fazendo.concluidoEm]);
const pronto = moverTema(fazendo, ESTADO.CONCLUIDO, H2);
checar('concluir grava a data', [ESTADO.CONCLUIDO, H2], [pronto.estado, pronto.concluidoEm]);
checar('concluir de novo mantém a data', H2, moverTema(pronto, ESTADO.CONCLUIDO, '2026-10-09').concluidoEm);
checar('voltar zera a conclusão', null, moverTema(pronto, ESTADO.A_FAZER, H2).concluidoEm);
checar('estado inventado é ignorado', pronto, moverTema(pronto, 'xis', H2));

const reaberto = acrescentarAtividade(pronto, 'Faltou isto', '2026-10-08');
checar('atividade nova em tema concluído volta a Fazendo', [ESTADO.FAZENDO, null], [reaberto.tema.estado, reaberto.tema.concluidoEm]);
checar('atividade nova em tema a fazer não muda o estado', ESTADO.A_FAZER, acrescentarAtividade(novo.tema, 'x', H1).tema.estado);

checar('válido: tema com atividade', true, temaValido(marcada));
checar('inválido: estado fora da lista', false, temaValido({ ...marcada, estado: 'x' }));
checar('inválido: concluidoEm undefined', false, temaValido({ ...marcada, concluidoEm: undefined }));
checar('inválido: atividade sem data', false, temaValido({ ...marcada, atividades: [{ id: 'a', texto: 't', abertaEm: 'ontem', concluidaEm: null }] }));
checar('inválido: 51 atividades', false, temaValido({ ...cheio, atividades: [...cheio.atividades, { id: 'z', texto: 't', abertaEm: H1, concluidaEm: null }] }));

const g = agruparPorEstado([novo.tema, fazendo, pronto]);
checar('agrupa por estado', [1, 1, 1], [g.a_fazer.length, g.fazendo.length, g.concluido.length]);
checar('resumo', { abertos: 2, concluidos: 1 }, resumirKanban([novo.tema, fazendo, pronto]));
checar('frase do resumo', '2 temas abertos · 1 concluído', frasesDoResumo([novo.tema, fazendo, pronto]));
checar('frase singular', '1 tema aberto · 0 concluídos', frasesDoResumo([novo.tema]));
checar('resumo vazio', '0 temas abertos · 0 concluídos', frasesDoResumo([]));

console.log(`\n${ok} ok, ${bad} com falha`);
if (bad) {
  console.log(falhas.join('\n'));
  process.exit(1);
}
process.exit(0);
