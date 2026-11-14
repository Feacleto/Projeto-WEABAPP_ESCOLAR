/**
 * Testes da lista da turma no papel — Node puro, sem runner.
 * Rodar: node scripts/testar-lista-impressa.mjs
 *
 * Protege docs/analise/13a (linha "n") e a decisão 14: a folha leva só nome,
 * escola, hora e rua. Telefone, saúde, mensalidade, nota sobre família e foto
 * NUNCA entram — e a prova é com um documento de criança cheio de dado
 * sensível, não com uma lista de nomes de campo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMPOS_DA_LINHA,
  SEM_ESCOLA,
  SEM_DADO,
  ruaCurta,
  horaDePegar,
  linhasDaLista,
} from '../src/dominio/rota/listaImpressa.js';
import {
  AVISO_DO_PAPEL,
  todasAsAfirmacoes,
  mesDaFolha,
  subtituloDaFolha,
  tituloDoGrupo,
  BOTAO_IMPRIMIR,
} from '../src/marca/listaImpressa.js';
import { promessaProibida } from '../src/marca/promessas.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replaceAll('\r\n', '\n');
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  bateu ? ok++ : falhou++;
  console.log(`  ${bateu ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome}` +
    (bateu ? '' : `\n      esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`));
};

const crianca = (extra = {}) => ({
  id: 'c1', name: 'Ana', active: true, schoolId: 'e1', school: 'Escola Alvorada',
  horaPega: '06:20', address: 'Rua das Flores, 120, Apto 4 — Centro, São Paulo/SP', ...extra,
});
const escolas = [{ id: 'e1', nome: 'Escola Alvorada' }, { id: 'e2', nome: 'Colégio Horizonte' }];

console.log('\n\x1b[1m1. A rua, e só a rua\x1b[0m');
eq('formato dos Correios', ruaCurta('Rua das Flores, 120, Apto 4 — Centro, São Paulo/SP'), 'Rua das Flores');
eq('o traço separa a rua do bairro mesmo sem número', ruaCurta('Rua das Flores — Centro, São Paulo/SP'), 'Rua das Flores');
eq('formato do mapa (número na frente)', ruaCurta('120, Rua Augusta, Consolação, Região Imediata de São Paulo, 01305-000, Brasil'), 'Rua Augusta');
eq('texto livre com número colado', ruaCurta('Rua Augusta 100'), 'Rua Augusta');
eq('o número que É o nome da rua fica ("Rua 25")', ruaCurta('Rua 25, 300'), 'Rua 25');
eq('"Estrada 5" fica', ruaCurta('Estrada 5'), 'Estrada 5');
eq('rua com número no nome e número da casa', ruaCurta('Rua 15 de Novembro, 200'), 'Rua 15 de Novembro');
eq('só o número da casa: sem rua', ruaCurta('120'), '');
eq('s/n não é rua', ruaCurta('s/n, Avenida Brasil'), 'Avenida Brasil');
eq('vazio, nulo e espaços', [ruaCurta(''), ruaCurta(null), ruaCurta('   ')], ['', '', '']);
eq('nunca devolve o número da casa', /\b120\b/.test(ruaCurta(crianca().address)), false);
eq('nunca devolve bairro nem cidade', /Centro|São Paulo/.test(ruaCurta(crianca().address)), false);

console.log('\n\x1b[1m2. A hora é a combinada, nunca o chute\x1b[0m');
eq('hora gravada', horaDePegar({ horaPega: '6:20' }), '06:20');
eq('sem hora, vazio — mesmo com período (o app presumiria 06:30)', horaDePegar({ period: 'morning', pickupPeriod: 'morning' }), '');
eq('lixo vira vazio', horaDePegar({ horaPega: 'xx' }), '');
eq('na linha, sem hora vira traço', linhasDaLista([crianca({ horaPega: '' })], escolas).grupos[0].criancas[0].hora, SEM_DADO);

console.log('\n\x1b[1m3. Agrupar por escola, ordenar pela hora\x1b[0m');
{
  const turma = [
    crianca({ id: 'a', name: 'Pedro', horaPega: '06:40' }),
    crianca({ id: 'b', name: 'Ana', horaPega: '06:20' }),
    crianca({ id: 'c', name: 'Bia', schoolId: 'e2', school: 'Colégio Horizonte', horaPega: '06:00' }),
    crianca({ id: 'd', name: 'Lívia', horaPega: '' }),
    crianca({ id: 'e', name: 'Caio', schoolId: null, school: '' }),
  ];
  const { total, grupos } = linhasDaLista(turma, escolas);
  eq('total', total, 5);
  eq('grupos pela hora da primeira criança, "Sem escola" por último',
    grupos.map((g) => g.escola), ['Colégio Horizonte', 'Escola Alvorada', SEM_ESCOLA]);
  eq('dentro da escola: pela hora, sem hora no fim',
    grupos[1].criancas.map((c) => c.nome), ['Ana', 'Pedro', 'Lívia']);
  eq('ordena hora como hora, não como texto ("7:00" depois de "06:20", "13:00" depois de "07:00")',
    linhasDaLista([
      crianca({ id: 'x', name: 'X', horaPega: '13:00' }),
      crianca({ id: 'y', name: 'Y', horaPega: '7:00' }),
      crianca({ id: 'z', name: 'Z', horaPega: '06:20' }),
    ], escolas).grupos[0].criancas.map((c) => c.nome), ['Z', 'Y', 'X']);
  eq('mesma hora: por nome', linhasDaLista([
    crianca({ id: 'x', name: 'Davi' }), crianca({ id: 'y', name: 'Ana' }), crianca({ id: 'z', name: 'Caio' }),
  ], escolas).grupos[0].criancas.map((c) => c.nome), ['Ana', 'Caio', 'Davi']);
}
eq('só crianças ativas', linhasDaLista([crianca(), crianca({ id: 'z', active: false })], escolas).total, 1);
eq('o nome oficial da escola vem da escola, não da cópia velha na criança',
  linhasDaLista([crianca({ school: 'E.M. Alvorada (antigo)' })], escolas).grupos[0].escola, 'Escola Alvorada');
eq('escola ainda em texto solto: duas grafias viram um grupo',
  linhasDaLista([
    crianca({ id: 'a', schoolId: null, school: 'E.M. Rui Barbosa' }),
    crianca({ id: 'b', schoolId: null, school: 'EM Rui Barbosa' }),
  ], []).grupos.length, 1);
eq('lista vazia, nula ou com lixo', [linhasDaLista([]).total, linhasDaLista(null).total, linhasDaLista([null, 7]).total], [0, 0, 0]);
eq('criança sem nome não deixa buraco', linhasDaLista([crianca({ name: '' })], escolas).grupos[0].criancas[0].nome, SEM_DADO);
eq('criança sem endereço não deixa buraco', linhasDaLista([crianca({ address: '' })], escolas).grupos[0].criancas[0].rua, SEM_DADO);

console.log('\n\x1b[1m4. NADA PROIBIDO ENTRA (com um documento de criança cheio de dado sensível)\x1b[0m');
const SENSIVEL = {
  parentPhone: 'TEL-RESP-99911', parent2Phone: 'TEL-RESP2-99922', schoolPhone: 'TEL-ESCOLA-99933',
  parentPhoneChave: 'CHAVE-99944', parentEmail: 'EMAIL-resp@x.com', parentName: 'RESPONSAVEL-NOME-Maria',
  parent2Name: 'RESPONSAVEL2-NOME', saudeNotas: 'SAUDE-asma-grave', saudeConsentidaEm: 'SAUDE-DATA',
  notes: 'NOTA-sobre-a-mae-que-atrasa', monthlyFee: 987654, dueDay: 7, photoURL: 'https://FOTO-url.png',
  birthDate: '2015-04-03', cep: 'CEP-01310-100', lat: -23.51111, lng: -46.62222, schoolLat: -23.5333, schoolLng: -46.6444,
  schoolAddress: 'ENDERECO-DA-ESCOLA-Av-Longa-999', inviteCode: 'CODIGO-TNAB23CD', parentUid: 'UID-DO-PAI',
  altResponsibles: [{ name: 'AVULSO-NOME', phone: 'AVULSO-TEL-99955' }], turma: 'TURMA-5B', professora: 'PROFESSORA-Zeca',
  contractHash: 'HASH-contrato', adminUid: 'UID-DO-MOTORISTA', autorizacaoDeclaradaPor: 'UID-AUTOR', enderecoPartes: { logradouro: 'PARTES-rua' },
};
{
  const saida = linhasDaLista([crianca({ ...SENSIVEL })], escolas);
  const texto = JSON.stringify(saida);
  const vazou = Object.entries(SENSIVEL).flatMap(([campo, v]) =>
    [campo, ...(typeof v === 'object' ? JSON.stringify(v).match(/[A-Z]{3,}[A-Za-z0-9-]*/g) || [] : [String(v)])]
      .filter((m) => m.length > 2 && texto.includes(m) && m !== campo).map((m) => `${campo}: ${m}`));
  eq('nenhum valor sensível aparece no que a régua entrega', vazou, []);
  eq('nem o NOME de um campo sensível aparece como chave',
    Object.keys(SENSIVEL).filter((k) => new RegExp(`"${k}"`).test(texto)), []);
  eq('cada linha tem exatamente os campos da lista fechada',
    saida.grupos.flatMap((g) => g.criancas.map((c) => Object.keys(c).sort())),
    [[...CAMPOS_DA_LINHA].sort()]);
  eq('a lista fechada é id, nome, hora e rua', CAMPOS_DA_LINHA, ['id', 'nome', 'hora', 'rua']);
  eq('o grupo só tem chave, escola e crianças', Object.keys(saida.grupos[0]).sort(), ['chave', 'criancas', 'escola']);
  // Sonda positiva: o que PODE entrar entra, senão o teste acima não provaria nada.
  eq('sonda positiva: nome, hora e rua estão lá', [
    saida.grupos[0].criancas[0].nome, saida.grupos[0].criancas[0].hora, saida.grupos[0].criancas[0].rua,
  ], ['Ana', '06:20', 'Rua das Flores']);
  eq('sonda positiva: o procurador acharia um vazamento', JSON.stringify({ x: 'TEL-RESP-99911' }).includes('TEL-RESP-99911'), true);
}
eq('um campo novo no documento da criança não chega ao papel sozinho',
  Object.keys(linhasDaLista([crianca({ campoNovoDeAmanha: 'XYZ-NOVO' })], escolas).grupos[0].criancas[0]).includes('campoNovoDeAmanha'), false);

console.log('\n\x1b[1m5. O texto, com origem\x1b[0m');
const FUNCIONALIDADES = {
  'lista-so-com-quatro-campos': [['src/dominio/rota/listaImpressa.js', /CAMPOS_DA_LINHA = \['id', 'nome', 'hora', 'rua'\]/]],
  'window-print': [['src/pages/tio/TioListaImpressa.jsx', /window\.print\(\)/]],
};
const afirmacoes = todasAsAfirmacoes();
for (const a of afirmacoes) {
  eq(`"${a.id}" tem chave da lista fechada`, Object.hasOwn(FUNCIONALIDADES, a.sustenta), true);
}
for (const [chave, provas] of Object.entries(FUNCIONALIDADES)) {
  for (const [arquivo, padrao] of provas) eq(`"${chave}" existe: ${arquivo}`, padrao.test(ler(arquivo)), true);
}
const semAcento = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
for (const a of afirmacoes) {
  eq(`"${a.id}" não usa raiz proibida nem exclamação`, [promessaProibida(a.texto), /!/.test(a.texto)], [null, false]);
  eq(`"${a.id}" não promete nada que o app não cumpre`, /segur|gratis|automatic|em breve|apagad|criptograf/.test(semAcento(a.texto)), false);
}
eq('o aviso diz o que fica de fora', AVISO_DO_PAPEL.texto, 'Não vão para o papel: telefone, WhatsApp e saúde.');
eq('o botão', BOTAO_IMPRIMIR, 'Imprimir ou salvar em PDF');
eq('o mês da folha', mesDaFolha(new Date(2026, 10, 14)), 'novembro de 2026');
eq('o subtítulo, no plural e no singular', [subtituloDaFolha(14, new Date(2026, 10, 14)), subtituloDaFolha(1, new Date(2026, 10, 14))],
  ['novembro de 2026 · 14 crianças', 'novembro de 2026 · 1 criança']);
eq('o título do grupo', tituloDoGrupo('Escola Alvorada', 5), 'Escola Alvorada · 5 crianças');

console.log('\n\x1b[1m6. A tela\x1b[0m');
const tela = ler('src/pages/tio/TioListaImpressa.jsx');
const telaSem = semComentarios(tela);
eq('a tela desenha o que a régua entrega', /linhasDaLista\(children, escolas\)/.test(telaSem), true);
eq('a tela NÃO lê nenhum campo sensível do documento da criança',
  /parentPhone|parent2|schoolPhone|parentEmail|parentName|saude|notes|monthlyFee|photoURL|birthDate|altResponsibles|inviteCode|\.lat\b|\.lng\b|\.cep\b/.test(telaSem), false);
eq('a tela não lê campo nenhum da criança: só passa a lista à régua', /\bc\.(name|address|horaPega|school)\b/.test(telaSem), false);
eq('não importa Firestore', /firebase\//.test(telaSem), false);
eq('o botão de imprimir não sai no papel', /className="space-y-2 print:hidden"/.test(tela), true);
eq('window.print só em um lugar (o botão)', (telaSem.match(/window\.print\(\)/g) || []).length, 1);
eq('a linha do papel é a linhaImpressa (o border comum some numa jato de pouca tinta)',
  (tela.match(/print:border-linhaImpressa/g) || []).length >= 2, true);
eq('no papel o fundo sai', /print:bg-transparent/.test(tela), true);
eq('a linha não se parte entre duas folhas', /break-inside-avoid/.test(tela), true);
eq('o título do grupo não fica sozinho no fim da folha', /break-after-avoid/.test(tela), true);
eq('no papel não depende de cor: nenhuma cor semântica de texto na folha',
  /text-(primary|warning|danger|accent|info|escola|perua|ouro)/.test(telaSem), false);
eq('nenhuma cor crua do Tailwind', /(text|bg|border)-(red|green|blue|amber|gray|slate|black|white)\b/.test(telaSem), false);
eq('não usa fixed nem sticky (uma ação, no alto)', /\bfixed\b|\bsticky\b/.test(telaSem), false);
eq('letra de 12 px ou menos não existe', /text-xs|text-\[(9|10|11|12|13)px\]/.test(telaSem), false);
eq('a tela usa o catálogo, sem escrever o aviso à mão', /Não vão para o papel|Imprimir ou salvar/.test(telaSem), false);

console.log('\n\x1b[1m7. Rota e entrada\x1b[0m');
const app = ler('src/App.jsx');
eq('a rota existe dentro do painel do motorista (/tio, com layout, senha e guarda)',
  /<Route path="children\/imprimir" element=\{<TioListaImpressa \/>\} \/>/.test(app), true);
const iRota = app.indexOf('path="children/imprimir"');
const iTio = app.indexOf('path="/tio"');
eq('depois do início do bloco /tio', iTio > 0 && iRota > iTio, true);
eq('antes de "children/:id" (nenhuma criança chamada "imprimir")', iRota < app.indexOf('path="children/:id"'), true);
eq('a tela é carregada sob demanda', /const TioListaImpressa = lazy\(/.test(app), true);
const meu = ler('src/components/tio/MeuTransporteSheet.jsx');
eq('a entrada fica no "Mais" do Meu transporte, só com turma',
  /criancas > 0 && \(\s*<Linha\s+icon=\{Printer\}\s+titulo="Imprimir a lista da turma"\s+onClick=\{\(\) => ir\('\/tio\/children\/imprimir'\)\}/.test(meu), true);

console.log(`\n${falhou ? '\x1b[31m' : '\x1b[32m'}${ok} ok, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
