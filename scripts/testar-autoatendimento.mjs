/**
 * O AUTOATENDIMENTO — a fase da relação, as falas, as dúvidas e a história.
 *
 * POR QUE ESTE TESTE EXISTE
 * "Meus planos" é a tela em que o motorista decide sozinho. Três coisas não
 * podem acontecer nela: a fase errada (dizer "teste" a quem está com a rota
 * parada), um texto prometendo uma regra que o app ainda não cobra (o preço
 * novo está em decisão), e uma fala contando o teste ("mês 2 de 6"), que o
 * dono proibiu por deixar o motorista ansioso.
 *
 * COMO RODAR
 *   node scripts/testar-autoatendimento.mjs   (ou: npm run testar:autoatendimento)
 */
import { readFileSync } from 'node:fs';
import {
  FASE,
  DIAS_DA_RETA_FINAL,
  faseDoAutoatendimento,
  tomDaFala,
  EXPLICACOES,
  DUVIDAS,
  DUVIDAS_PRINCIPAIS,
  marcosDaHistoria,
  marcosPrincipais,
} from '../src/dominio/associacao/autoatendimento.js';
import { DIAS_DE_TRIAL } from '../src/dominio/associacao/trial.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  if (JSON.stringify(esperado) === JSON.stringify(obtido)) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome}\n      esperado: ${JSON.stringify(esperado)}\n      obtido:   ${JSON.stringify(obtido)}`);
  }
}

// ── a fase ──────────────────────────────────────────────────────────────────
const inicio = new Date('2026-10-14T12:00:00-03:00');
const dia = (n) => new Date(inicio.getTime() + n * 86400000);

checar('sem relógio: o teste ainda não começou', FASE.NAO_INICIADO, faseDoAutoatendimento({}));
checar('no começo do teste', FASE.TESTE, faseDoAutoatendimento({ trialInicio: inicio, agora: dia(5) }));
checar('na reta final', FASE.TESTE_FIM,
  faseDoAutoatendimento({ trialInicio: inicio, agora: dia(DIAS_DE_TRIAL - DIAS_DA_RETA_FINAL + 1) }));
checar('conta parada vence tudo', FASE.PAUSADA,
  faseDoAutoatendimento({ conta: { ativa: false }, jaContratou: true, atrasoDias: 15 }));
checar('fatura atrasada vem antes de "em dia"', FASE.ATRASO,
  faseDoAutoatendimento({ conta: { ativa: true }, jaContratou: true, atrasoDias: 3 }));
checar('cliente em dia', FASE.EM_DIA, faseDoAutoatendimento({ jaContratou: true }));
checar('renovação ausente é LIGADA: em dia', FASE.EM_DIA,
  faseDoAutoatendimento({ jaContratou: true, renovacaoAutomatica: undefined }));
checar('só o false explícito marca a saída', FASE.SAIDA,
  faseDoAutoatendimento({ jaContratou: true, renovacaoAutomatica: false }));
checar('vencendo hoje não é atraso', FASE.EM_DIA,
  faseDoAutoatendimento({ jaContratou: true, atrasoDias: 0 }));

checar('atraso é âmbar', 'aviso', tomDaFala(FASE.ATRASO));
checar('rota parada é cinza', 'parado', tomDaFala(FASE.PAUSADA));
checar('fim do teste NÃO é alerta', 'normal', tomDaFala(FASE.TESTE_FIM));

// ── os textos: curtos e verdadeiros hoje ────────────────────────────────────
for (const [chave, [titulo, linhas]] of Object.entries(EXPLICACOES)) {
  checar(`folha "${chave}" tem título`, true, titulo.length > 0);
  checar(`folha "${chave}" tem no máximo 2 linhas`, true, linhas.length <= 2);
  for (const l of linhas) checar(`folha "${chave}": frase curta (≤ 80)`, true, l.length <= 80);
}
checar('só a multa tem duas linhas', ['multa'],
  Object.entries(EXPLICACOES).filter(([, [, l]]) => l.length > 1).map(([k]) => k));
checar('três dúvidas principais', 3, DUVIDAS_PRINCIPAIS);

const tudo = JSON.stringify({ EXPLICACOES, DUVIDAS });
for (const proibido of ['avulso', 'Avulso', 'por uso', 'R$ 0,20', 'R$ 5,60', 'R$ 5,30', 'R$ 4,90']) {
  checar(`nenhum texto promete o preço novo ("${proibido}")`, false, tudo.includes(proibido));
}
for (const nome of ['Via Van', 'Rotasegura', 'Van+', 'Tio da Van']) {
  checar(`nenhum texto cita "${nome}"`, false, tudo.includes(nome));
}

// ── nenhuma tela conta o teste ──────────────────────────────────────────────
const tela = readFileSync(new URL('../src/pages/tio/TioPlanos.jsx', import.meta.url), 'utf8');
checar('a tela não diz "mês N de N"', false, /m[eê]s\s*\{?[^}]*\}?\s*de\s*\{?\s*MESES/i.test(tela));
checar('a tela usa a fase do domínio', true, tela.includes('faseDoAutoatendimento'));
checar('o topo diz "Meus planos"', true, tela.includes('title="Meus planos"'));
checar('o botão "Minha história" leva à tela dela', true, tela.includes("'/tio/historia'"));
checar('o botão do time é o de vendas', true, tela.includes('salesWhatsAppLink'));

// ── a história ──────────────────────────────────────────────────────────────
const agora = Date.parse('2027-04-20T12:00:00-03:00');
const perfil = {
  createdAt: Date.parse('2026-10-05T10:00:00-03:00'),
  trialInicio: Date.parse('2026-10-14T10:00:00-03:00'),
  contratadoEm: Date.parse('2027-04-01T10:00:00-03:00'),
  indicacoesAtivas: 1,
};
const criancas = [
  { name: 'Bia Souza', createdAt: Date.parse('2026-10-07T10:00:00-03:00'), parentUid: 'p2', inviteUsedAt: Date.parse('2026-10-09T10:00:00-03:00') },
  { name: 'Ana Lima', createdAt: Date.parse('2026-10-06T10:00:00-03:00') },
];
const marcos = marcosDaHistoria({ perfil, criancas, nivel: 'prata', agora });
checar('os marcos vêm em ordem de data', true, marcos.every((m, i) => i === 0 || marcos[i - 1].ms <= m.ms));
checar('a primeira criança é a mais antiga, pelo primeiro nome', true,
  marcos.some((m) => m.texto === 'Cadastrou a primeira criança, Ana.'));
checar('a primeira família entra', true, marcos.some((m) => m.texto === 'A primeira família entrou no app.'));
checar('o nível entra', true, marcos.some((m) => m.texto === 'Você está no nível Prata.'));
checar('a indicação entra no singular', true,
  marcos.some((m) => m.texto === 'Um colega que você indicou é cliente.'));
checar('no máximo quatro principais', 4, marcosPrincipais(marcos).length);
checar('sem dado nenhum, nenhum marco', [], marcosDaHistoria({ agora }));
checar('nível sem rótulo não entra', false,
  marcosDaHistoria({ nivel: 'sem_nivel', agora }).some((m) => m.icone === 'nivel'));

// ── A FATURA DE R$ 0,00 (05/10/2026, decisão do dono) ──
{
  const { faturaGratisDoMes } = await import('../src/dominio/associacao/faturaGratis.js');
  const { precoDaTabela } = await import('../src/dominio/associacao/planos.js');
  const f = faturaGratisDoMes({ criancas: 15, agora: new Date(2026, 9, 5) });
  checar('o valor riscado é o da tabela de hoje', precoDaTabela({ criancas: 15 }), f.valorDeHoje);
  checar('ele paga zero', 0, f.vocePaga);
  checar('o mês pelo nome', 'outubro', f.mes);
  checar('sem criança, não há fatura para mostrar', null, faturaGratisDoMes({ criancas: 0 }));
  checar('o motivo diz grátis, nunca conta o teste', true, !/m[eê]s \d|de 6|até/i.test(f.motivo));
  const fonte = readFileSync(new URL('../src/dominio/associacao/faturaGratis.js', import.meta.url), 'utf8');
  checar('é demonstrativo: nada é gravado', false, /firebase|addDoc|setDoc|faturasParceiro\b.*=/.test(fonte.replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
