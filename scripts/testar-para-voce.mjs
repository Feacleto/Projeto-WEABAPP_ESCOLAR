/**
 * "PARA VOCÊ" — a linha de relação no fim do Início do motorista.
 *
 * POR QUE ESTE TESTE EXISTE
 * O Início é onde o tio sente que está organizado, e essa sensação vem do
 * silêncio. Três coisas não podem acontecer: a linha aparecer com algo em
 * "Para resolver" ou com a rota rodando; dois avisos do mesmo prazo de teste
 * no mesmo dia (os 30 finais são do AvisoDoTrial); e uma frase de cobrança
 * ("falta", "pendente", exclamação).
 *
 * COMO RODAR
 *   node scripts/testar-para-voce.mjs   (ou: npm run testar:para-voce)
 */
import { readFileSync } from 'node:fs';
import { itemDoParaVoce, faseDeHoje, JANELA_DO_TESTE } from '../src/dominio/identidade/paraVoce.js';
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
const tipo = (x) => (x ? x.tipo : null);
const base = { foraDaRota: true, emDia: true };

// ── o silêncio ──────────────────────────────────────────────────────────────
checar('com a rota rodando, nada', null, itemDoParaVoce({ ...base, foraDaRota: false, boletimMes: '2026-09' }));
checar('com algo para resolver, nada', null, itemDoParaVoce({ ...base, emDia: false, boletimMes: '2026-09' }));
checar('sem nada a dizer, nada', null, itemDoParaVoce(base));

// ── a exceção: a Platina nos últimos 3 dias ─────────────────────────────────
const platina = (d) => ({ titulo: 'Foto em todas as crianças', diasRestantes: d });
checar('Platina a 2 dias fura o "para resolver"', 'platina',
  tipo(itemDoParaVoce({ ...base, emDia: false, nivel: 'platina', platina: platina(2) })));
checar('Platina a 5 dias não fura', null,
  tipo(itemDoParaVoce({ ...base, emDia: false, nivel: 'platina', platina: platina(5) })));
checar('Platina a 5 dias, em dia, aparece', 'platina',
  tipo(itemDoParaVoce({ ...base, nivel: 'platina', nivelVisto: 'platina', platina: platina(5) })));
checar('Platina de quem não chegou ao Ouro não conta', null,
  tipo(itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata', platina: platina(1) })));

// ── o fim do teste: só entre 60 e 31 dias ───────────────────────────────────
const inicio = new Date('2026-10-14T12:00:00-03:00');
const quandoFaltam = (d) => new Date(inicio.getTime() + (DIAS_DE_TRIAL - d) * 86400000);
const teste = { cobrancaLigada: true, jaContratou: false, trialInicio: inicio, criancas: 17, familias: 12 };
checar('a 45 dias do fim: o cartão do ambiente', 'teste',
  tipo(itemDoParaVoce({ ...base, teste, agora: quandoFaltam(45) })));
checar('a 20 dias do fim: NÃO (é do AvisoDoTrial)', null,
  tipo(itemDoParaVoce({ ...base, teste, agora: quandoFaltam(20) })));
checar(`a ${JANELA_DO_TESTE.ate} dias: ainda sim`, 'teste',
  tipo(itemDoParaVoce({ ...base, teste, agora: quandoFaltam(JANELA_DO_TESTE.ate) })));
checar('com a cobrança desligada: nada', null,
  tipo(itemDoParaVoce({ ...base, teste: { ...teste, cobrancaLigada: false }, agora: quandoFaltam(45) })));
checar('quem já assinou: nada', null,
  tipo(itemDoParaVoce({ ...base, teste: { ...teste, jaContratou: true }, agora: quandoFaltam(45) })));
checar('a frase traz os números logo depois', 'Seu ambiente digital de trabalho está pronto: 17 crianças, 12 famílias.',
  itemDoParaVoce({ ...base, teste, agora: quandoFaltam(45) }).frase);

// ── a ordem ─────────────────────────────────────────────────────────────────
checar('o teste vem antes do Boletim', 'teste',
  tipo(itemDoParaVoce({ ...base, teste, agora: quandoFaltam(45), boletimMes: '2026-09' })));
checar('o Boletim vem antes do nível', 'boletim',
  tipo(itemDoParaVoce({ ...base, boletimMes: '2026-09', nivel: 'prata', nivelVisto: 'bronze' })));
checar('o Boletim diz o mês', 'O boletim de setembro está pronto.',
  itemDoParaVoce({ ...base, boletimMes: '2026-09' }).frase);
checar('nível novo: "chegou à Prata"', 'Você chegou à Prata.',
  itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'bronze' }).frase);
checar('nível já visto não volta', null, tipo(itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata' })));
checar('a 1 passo: frase de perto, nunca "falta"', 'Você está a 1 passo do Ouro.',
  itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata', proximo: { nivel: 'ouro', faltam: [{}] } }).frase);
checar('a 4 passos: não aparece (seria lista de tarefas)', null,
  tipo(itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata', proximo: { nivel: 'ouro', faltam: [{}, {}, {}, {}] } })));
checar('sem senha: a proteção', 'senha', tipo(itemDoParaVoce({ ...base, senhaCriada: false })));
checar('trilha só depois do Ouro', null, tipo(itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata', faseDoNegocio: 'Organizado' })));
checar('trilha no Ouro', 'Seu negócio está na fase Organizado.',
  itemDoParaVoce({ ...base, nivel: 'ouro', nivelVisto: 'ouro', faseDoNegocio: 'Organizado' }).frase);

// ── as frases: curtas e sem cobrança ────────────────────────────────────────
const exemplos = [
  itemDoParaVoce({ ...base, teste, agora: quandoFaltam(45) }),
  itemDoParaVoce({ ...base, boletimMes: '2026-09' }),
  itemDoParaVoce({ ...base, nivel: 'platina', nivelVisto: 'ouro' }),
  itemDoParaVoce({ ...base, nivel: 'prata', nivelVisto: 'prata', proximo: { nivel: 'ouro', faltam: [{}, {}] } }),
  itemDoParaVoce({ ...base, senhaCriada: false }),
  itemDoParaVoce({ ...base, nivel: 'ouro', nivelVisto: 'ouro', faseDoNegocio: 'Planejado' }),
];
for (const e of exemplos) {
  const palavras = e.frase.split(/\s+/).length;
  checar(`"${e.frase}" é curta`, true, palavras <= (e.tipo === 'teste' ? 12 : 10));
  checar(`"${e.frase}" não cobra`, false, /\b(falta|faltam|pendente|complete|você precisa)\b|!/i.test(e.frase));
}

checar('a fase de hoje é a última completa em sequência', 'Planejado',
  faseDeHoje([
    { titulo: 'Organizado', contaParaDiamante: true, completa: true },
    { titulo: 'Planejado', contaParaDiamante: true, completa: true },
    { titulo: 'Formalizado', contaParaDiamante: true, completa: false },
  ]));
checar('sem fase completa, nenhuma', null, faseDeHoje([{ titulo: 'Organizado', contaParaDiamante: true, completa: false }]));

// ── o Início: os avisos de nível moram na linha, não no topo ────────────────
const inicioTela = readFileSync(new URL('../src/pages/tio/TioDashboard.jsx', import.meta.url), 'utf8');
checar('o aviso do Bronze saiu do topo', false, /<AvisoDoBronze/.test(inicioTela));
checar('o prazo da Platina saiu do topo', false, /<CartaoPrazoPlatina/.test(inicioTela));
checar('o Início monta a linha', true, /<ParaVoce\b/.test(inicioTela));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
