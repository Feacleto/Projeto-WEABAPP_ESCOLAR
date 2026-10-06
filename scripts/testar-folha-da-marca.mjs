/**
 * A FOLHA DA MARCA (05/10/2026, protótipo "Abrir o logo do tio", versão A +
 * dados do B, aprovado pelo dono).
 *
 *   node scripts/testar-folha-da-marca.mjs   (ou: npm run testar:folha-da-marca)
 *
 * Régua pura (src/marca/folhaDaMarca.js) e leitura de arquivo para o que não
 * roda sem navegador: o logo só vira botão para o tio e a auxiliar (a família
 * não tem folha); a tela cheia é o selo, sem botão e sem dado da turma; a
 * auxiliar não vê o cartão nem o "trocar logo", e nada do tio além da marca
 * (nível, plano, assinatura, nota, selo pago, dinheiro); e nenhum R$.
 */
import { readFileSync } from 'node:fs';
import {
  DICA_DA_METADE,
  DICA_DA_CHEIA,
  FAIXA_DO_SELO,
  CONHECA,
  linkDoCartaoDoTio,
  iniciaisDaMarca,
  subtituloDoTio,
  subtituloDaAuxiliar,
  inicioDoVinculo,
  acoesDaFolha,
  mostraTrabalhandoPara,
  mensagemDoCartao,
  aoSoltarAAlca,
  rotuloDaPerua,
} from '../src/marca/folhaDaMarca.js';
import { mensagemDoCartaoDoTio, fraseDoCartaoDoTio, botaoDoCartaoDoTio, MENSAGEM_DE_QUEM_VIU_O_CARTAO } from '../src/marca/mensagensDoLink.js';
import { podeDizer } from '../src/marca/promessas.js';

let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  const igual = JSON.stringify(esperado) === JSON.stringify(obtido);
  if (igual) { ok++; console.log(`  ok  ${nome}`); }
  else { bad++; falhas.push(nome); console.log(`  FALHOU ${nome}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`); }
}
const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const semComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
/** O corpo de uma função de um arquivo, até a próxima declaração de topo. */
function corpo(fonte, nome) {
  const i = fonte.search(new RegExp(`(?:export default )?function ${nome}\\(`));
  if (i < 0) return '';
  const resto = fonte.slice(i + 10);
  const fim = resto.search(/\n(?:export default )?function |\nconst [A-Z]/);
  return fonte.slice(i, fim < 0 ? undefined : i + 10 + fim);
}

console.log('\n1. a régua');
checar('iniciais como no protótipo (o Tio fica)', 'TN', iniciaisDaMarca('Tio Nino'));
checar('iniciais de empresa', 'VZ', iniciaisDaMarca('Van do Zé'));
checar('sem marca, sem iniciais', '', iniciaisDaMarca(''));
checar('subtítulo com bairro e cidade', 'Transporte escolar · Socorro, São Paulo', subtituloDoTio({ regiao: 'Socorro', city: 'São Paulo' }));
checar('sem bairro, só a cidade', 'Transporte escolar · Campinas', subtituloDoTio({ city: 'Campinas' }));
checar('sem cidade, nenhuma vírgula pendurada', 'Transporte escolar', subtituloDoTio({ regiao: 'Centro' }));
const AGORA = new Date(2026, 9, 5, 9);
checar('a auxiliar: "desde {mês}" em minúsculo', 'Você trabalha nesta perua desde março',
  subtituloDaAuxiliar({ periodos: [{ de: new Date(2026, 2, 10).getTime(), ate: null }] }, AGORA));
checar('de outro ano, o ano entra', 'Você trabalha nesta perua desde novembro de 2025',
  subtituloDaAuxiliar({ periodos: [{ de: new Date(2025, 10, 3).getTime(), ate: null }] }, AGORA));
checar('quem saiu e voltou conta da VOLTA (o período aberto)', new Date(2026, 7, 1).getTime(),
  inicioDoVinculo({ aceitoEm: new Date(2025, 0, 1).getTime(), periodos: [{ de: new Date(2025, 0, 1).getTime(), ate: new Date(2025, 5, 1).getTime() }, { de: new Date(2026, 7, 1).getTime(), ate: null }] }));
checar('sem períodos, vale o aceitoEm (Timestamp)', 'Você trabalha nesta perua desde julho',
  subtituloDaAuxiliar({ aceitoEm: { toMillis: () => new Date(2026, 6, 2).getTime() } }, AGORA));
checar('sem data nenhuma, sem "desde"', 'Você trabalha nesta perua', subtituloDaAuxiliar({}, AGORA));

const doTio = acoesDaFolha('tio');
const daAux = acoesDaFolha('auxiliar', { marca: 'Tio Nino' });
checar('as três ações do tio, na ordem do protótipo',
  ['Mandar meu cartão a uma família', 'Ver como as famílias me veem', 'Trocar logo ou cor'], doTio.map((a) => a.rotulo));
checar('as duas da auxiliar', ['Falar com o Tio Nino', 'Ver o PIX da perua'], daAux.map((a) => a.rotulo));
checar('UM botão cheio por folha, e é o primeiro', [[true, false, false], [true, false]], [doTio.map((a) => a.cheio), daAux.map((a) => a.cheio)]);
checar('"Falar com a Tia Rosa"', 'Falar com a Tia Rosa', acoesDaFolha('auxiliar', { marca: 'Tia Rosa' })[0].rotulo);
checar('a auxiliar não manda cartão nem troca logo', [], daAux.filter((a) => /cartão|Trocar logo/.test(a.rotulo)));
checar('"Trabalhando para" só com dois tios', [false, false, true],
  [mostraTrabalhandoPara([]), mostraTrabalhandoPara([{ motoristaUid: 'a' }]), mostraTrabalhandoPara([{ motoristaUid: 'a' }, { motoristaUid: 'b' }])]);

console.log('\n2. o cartão do tio é para CONHECER o tio (texto aprovado pelo dono)');
const link = linkDoCartaoDoTio('UID1');
checar('o link é a página /conheca/{uid}', `${CONHECA}/UID1`, link);
checar('e o endereço é o do app', 'https://alobuzinou.com/conheca/UID1', link);
checar('a mensagem é a de mensagemDoCartaoDoTio', mensagemDoCartaoDoTio({ marca: 'Tio Nino', url: link }), mensagemDoCartao({ marca: 'Tio Nino', uid: 'UID1' }));
checar('e ela diz isto', `Oi! Aqui é o Tio Nino, transporte escolar. Na minha perua os avisos para as famílias vão pelo app Alô Buzinou. Quer conversar sobre vaga? É só me responder aqui. ${link}`,
  mensagemDoCartao({ marca: 'Tio Nino', uid: 'UID1' }));
checar('nunca "entrar" (a família só entra pelo convite de uma criança)', false, /entrar|entre\b|conta/i.test(mensagemDoCartao({ marca: 'Tio Nino', uid: 'UID1' })));
checar('nem /familia?tio= (o endereço antigo)', false, /familia\?tio=/.test(ler('src/marca/folhaDaMarca.js') + ler('src/components/marca/FolhaDaMarca.jsx')));
const fonteDaRegua = semComentarios(ler('src/marca/folhaDaMarca.js'));
checar('a régua não escreve frase própria para o cartão', true,
  /export function mensagemDoCartao\([^)]*\) \{\s*return mensagemDoCartaoDoTio\(/.test(fonteDaRegua));

console.log('\n2b. a página /conheca/:uid');
const pagina = semComentarios(ler('src/pages/Conheca.jsx'));
const appDaPagina = ler('src/App.jsx');
checar('rota pública e lazy', true,
  appDaPagina.includes("const Conheca = lazy(() => import('./pages/Conheca'));") && appDaPagina.includes('<Route path="/conheca/:uid" element={<Conheca />} />'));
checar('fora de toda PrivateRoute (fica ao lado do /acompanhar)', true,
  appDaPagina.indexOf('path="/conheca/:uid"') < appDaPagina.indexOf('path="/acompanhar/:token"') && appDaPagina.indexOf('path="/acompanhar/:token"') - appDaPagina.indexOf('path="/conheca/:uid"') < 200);
checar('lê pela callable pública (hook → service), sem Firestore', [true, false],
  [pagina.includes('useCartaoDoTio(uid)') && ler('src/services/cartaoDoTioService.js').includes("'verCartaoDoTio'"), /firebase\/|useAuth|collection\(/.test(pagina)]);
checar('a frase do app, o botão e a mensagem pronta',
  ['Na perua do Tio Nino, os avisos vão pelo app Alô Buzinou: quando a perua sai, quando está chegando e quando a criança chega.', 'Falar com o Tio Nino no WhatsApp', 'Oi! Vi o seu cartão e quero conversar sobre vaga na perua.'],
  [fraseDoCartaoDoTio('Tio Nino'), botaoDoCartaoDoTio('Tio Nino'), MENSAGEM_DE_QUEM_VIU_O_CARTAO]);
checar('a frase não promete o que o app não faz (promessas.js)', true, podeDizer(fraseDoCartaoDoTio('Tio Nino')) && podeDizer(MENSAGEM_DE_QUEM_VIU_O_CARTAO));
checar('cada promessa da frase existe no app (a saída, o chegando, a entrega)', true,
  ler('src/dominio/rota/focoDaViagem.js').includes('saidaDaViagem') && ler('functions/index.js').includes('avisarAproximacao') && /delivered/.test(ler('functions/lib/push.js') + ler('src/services/childrenService.js')));
checar('UM botão cheio, e é o do WhatsApp', 1, (pagina.match(/shadow-focus/g) || []).length);
checar('sem preço nem dado de criança', false, /R\$|formatCurrency|monthlyFee|valor|crian[çc]a\.|child|turma|escola/i.test(pagina.replace(/fraseDoCartaoDoTio/g, '')));
checar('sem link para outros tios nem lista (não existe busca de motorista)', false,
  /<Link|navigate\(|href=\{?['"`]\/|\.map\(|motoristas|outros tios/i.test(pagina));
checar('a meta noindex na página', true, pagina.includes("'noindex, nofollow'"));
checar('noindex no hosting também', true,
  /noindex/.test(JSON.parse(ler('firebase.json')).hosting.find((h) => h.target === 'app').headers.find((h) => h.source === '/conheca/**')?.headers?.[0]?.value || ''));
checar('a recusa é a frase do servidor (uma só)', true, pagina.includes('{cartao.frase}') && ler('src/services/cartaoDoTioService.js').includes("'Este cartão não vale mais.'"));
checar('nenhuma letra abaixo de 16px', false, /\btext-(?:sm|xs)\b/.test(pagina));

console.log('\n3. a alça');
checar('toque na metade: tela cheia', 'cheia', aoSoltarAAlca(2, false));
checar('toque na cheia: volta à metade', 'metade', aoSoltarAAlca(-3, true));
checar('puxar para cima: tela cheia', 'cheia', aoSoltarAAlca(120, false));
checar('puxar para baixo da cheia: metade', 'metade', aoSoltarAAlca(-120, true));
checar('puxar para baixo da metade: fecha', 'fechar', aoSoltarAAlca(-120, false));
checar('arrasto curto: fica onde estava', ['metade', 'cheia'], [aoSoltarAAlca(40, false), aoSoltarAAlca(-40, true)]);
checar('as dicas do protótipo', ['Puxe para cima para ver mais', 'Puxe para baixo para fechar'], [DICA_DA_METADE, DICA_DA_CHEIA]);

console.log('\n4. o cartão do dia da auxiliar diz de quem é a perua');
checar('ida', 'Perua do Tio Nino · ida sai 6h40', rotuloDaPerua({ marca: 'Tio Nino', genero: 'male', direcao: 'ida', hora: '6h40' }));
checar('volta, tia', 'Perua da Tia Rosa · volta sai 12h', rotuloDaPerua({ marca: 'Tia Rosa', genero: 'female', direcao: 'volta', hora: '12h' }));
checar('sem viagem, só a perua', 'Perua do Tio Nino', rotuloDaPerua({ marca: 'Tio Nino' }));

console.log('\n5. o Header: o logo só vira botão para o tio e a auxiliar');
const header = semComentarios(ler('src/components/layout/Header.jsx'));
checar('o papel fecha a porta (admin ou auxiliar)', true, header.includes("(role === 'admin' || role === 'auxiliar') ? contexto : null"));
checar('sonda: a família não está na lista', false, /role === 'parent'\) \? contexto/.test(header));
checar('o botão diz "Abrir a marca do …" e tem 48px', true,
  header.includes('aria-label={`Abrir a marca do ${nome') && /min-h-12 min-w-12/.test(corpo(header, 'LogoTocavel')));
checar('sem folha, o logo continua só um logo', true, corpo(header, 'LogoTocavel').includes('if (!folha) return children;'));
const app = ler('src/App.jsx');
checar('o tio tem a folha (em volta do TioLayout)', true, /<FolhaDaMarcaDoTio>\s*<TioLayout \/>\s*<\/FolhaDaMarcaDoTio>/.test(app));
checar('a auxiliar tem a folha (no AuxLayout)', true, ler('src/pages/auxiliar/AuxLayout.jsx').includes('<FolhaDaMarcaDaAuxiliar>'));
const rotaDoPai = app.slice(app.indexOf('path="/pai"'), app.indexOf('path="/pai"') + 2500);
checar('a família NÃO tem folha (nem na rota, nem no layout)', [false, false],
  [/FolhaDaMarca/.test(rotaDoPai), /FolhaDaMarca/.test(ler('src/pages/pai/PaiLayout.jsx'))]);

console.log('\n6. a folha');
const folha = semComentarios(ler('src/components/marca/FolhaDaMarca.jsx'));
checar('o voltar do celular e o Escape fecham', true, folha.includes('useVoltarFechaFolha(true, onFechar)') && folha.includes("e.key === 'Escape'"));
checar('tocar fora fecha', true, /onClick=\{onFechar\}/.test(folha));
checar('respeita prefers-reduced-motion', true, folha.includes('motion-reduce:animate-none') && folha.includes('motion-safe:transition-[height]'));
checar('é portal (a tela anima com transform)', true, folha.includes('createPortal('));
checar('nenhuma letra abaixo de 16px (sem text-sm nem text-xs)', false, /\btext-(?:sm|xs)\b/.test(folha));
checar('botões com 48px ou mais', true, /min-h-\[52px\]/.test(folha) && /min-h-12/.test(folha));
checar('UM cheio na metade do tio, UM na da auxiliar', [1, 1],
  [(corpo(folha, 'MetadeDoTio').match(/className=\{CHEIO\}/g) || []).length, (corpo(folha, 'MetadeDaAuxiliar').match(/className=\{CHEIO\}/g) || []).length]);
checar('o PIX da auxiliar é o MESMO PixDaPerua', true, corpo(folha, 'MetadeDaAuxiliar').includes('<PixDaPerua') && ler('src/components/route/PixDaPerua.jsx').includes('gatilho ? gatilho('));
checar('"Trocar logo ou cor" leva ao cartão "Sua marca" do Perfil', true,
  folha.includes("navigate('/tio/profile#sua-marca')") && ler('src/pages/Profile.jsx').includes('id="sua-marca"'));
checar('os textos da troca, do protótipo', true, folha.includes('Trabalhando para') && folha.includes('Com criança na perua, a troca fica travada.'));
checar('nenhum valor em R$ na folha nem na régua', false,
  /R\$|formatCurrency|monthlyFee|amount|valorMensal/.test(folha + fonteDaRegua));

console.log('\n7. a tela cheia é o SELO: sem botão e sem dado da turma');
const selo = corpo(folha, 'SeloDaMarca');
checar('o selo existe', true, selo.length > 0);
checar('sem botão nem link', false, /<button|<a\s|onClick/.test(selo));
checar('sem dado da turma (criança, telefone, PIX, região)', false, /crianca|child|phone|pix|regiao|city|subtitulo/i.test(selo));
checar('com a faixa do Alô Buzinou do adesivo', true,
  selo.includes('FAIXA_DO_SELO.marca') && selo.includes('FAIXA_DO_SELO.frase') && selo.includes('FAIXA_DO_SELO.site') && selo.includes('<LogoMark tone="onDark"'));
checar('os textos da faixa', ['Alô Buzinou', 'Eu uso o app Alô Buzinou', 'alobuzinou.com.br'], [FAIXA_DO_SELO.marca, FAIXA_DO_SELO.frase, FAIXA_DO_SELO.site]);
checar('a folha cheia pinta a cor da marca com a letra que lê nela (naMarca)', true,
  folha.includes('backgroundColor: cor.marca, color: cor.naMarca') && folha.includes("'bg-marca text-naMarca'"));

console.log('\n8. a auxiliar vê do tio SÓ a marca (QA, 05/10/2026)');
// O que entra na versão dela: a metade dela, o botão de cada tio, o provedor
// e o selo. A exceção NOMEADA é a faixa do selo ("Eu uso o app Alô
// Buzinou"), que é a mesma do adesivo: ela entra pelo `FAIXA_DO_SELO`, e o
// nome da função `SeloDaMarca` e a paleta da gráfica `CORES_DO_ADESIVO`
// (a cor da faixa) não são texto na tela.
const daAuxiliar = [
  corpo(folha, 'MetadeDaAuxiliar'),
  corpo(folha, 'BotaoDoTio'),
  semComentarios(ler('src/components/marca/FolhaDaMarcaDaAuxiliar.jsx')),
  selo.replace(/SeloDaMarca/g, '').replace(/FAIXA_DO_SELO\.\w+/g, '').replace(/CORES_DO_ADESIVO\.\w+/g, ''),
].join('\n');
const PROIBIDO = /n[íi]vel|plano|assinatura|\bnota|R\$|\bselo|adesivo/i;
checar('nenhuma palavra de nível, plano, assinatura, nota, R$, selo ou adesivo', null, (daAuxiliar.match(PROIBIDO) || [null])[0]);
checar('sonda: o padrão acha quando existe', [true, true, true], [PROIBIDO.test('nivelDoTio'), PROIBIDO.test('R$ 10'), PROIBIDO.test('o selo do tio')]);
checar('a faixa do selo é a exceção nomeada (e não traz nenhuma dessas)', null, (Object.values(FAIXA_DO_SELO).join(' ').match(PROIBIDO) || [null])[0]);
checar('a metade dela não tem o cartão nem o "trocar logo"', false,
  /acoesDaFolha\('tio'\)|Mandar meu cartão|Trocar logo|mensagemDoCartao|PreviaDaFamilia/.test(corpo(folha, 'MetadeDaAuxiliar')));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) falhas.forEach((f) => console.log('  ✗ ' + f));
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
