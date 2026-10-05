/**
 * R4 — A FAMÍLIA RESPONDE A FOTO DA TURMA E DÁ ESTRELAS AO TIO (F1.6).
 *
 * A Renata de `semear-familia-comunidade.mjs` abre o /pai. Mede, em ordem:
 *   1. no Início aparece "Pode aparecer em foto da turma?"; ela responde
 *      "Sim" e o banco grava `children/comSofia.fotoDaTurmaConsentida = true`;
 *   2. a pergunta some do Início;
 *   3. a avaliação ("Como está o transporte da Sofia?", 1 a 5 estrelas, com
 *      "Agora não") aparece; ela dá 4 e o banco grava
 *      `avaliacoesDoTio/{tio}_{mãe}_{AAAA-S}` com nota 4; a avaliação some;
 *   4. a foto da turma semeada aparece no Início e abre em tela cheia;
 *   5. na ficha da Sofia ela muda a foto para "Não" e de volta para "Sim", e
 *      a nota para 5 — o mesmo documento do semestre, lido no banco.
 *
 * As duas respostas são escrita DIRETA no Firestore pelo app
 * (`comunidadeService.js`: `responderFotoDaTurma` e `avaliarOTio`), quem
 * barra são as rules — a jornada NÃO depende do emulador de functions. A
 * foto, que no app nasce pela callable `publicarFotoDaTurma` + Storage, é
 * semeada pelo REST (ver a semente).
 *
 * Rodar: node testes-navegador/semear-familia-comunidade.mjs
 *        node testes-navegador/r4-foto-e-estrelas.mjs
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP, garantirSessao } from './lib.mjs';

const FS = 'http://127.0.0.1:8085/v1/projects/demo-alobuzinou/databases/(default)/documents';
const ADM = { Authorization: 'Bearer owner' };
const TIO = 'comTioZeca';
const CRIANCA = 'comSofia';
// Conta própria, com Chrome próprio: o "Agora não" fica no localStorage e
// não pode vazar de/para a Mariana da R1/R2.
const CONTA = { perfil: 'mae-comunidade', painel: '/pai', email: 'mae.comunidade@teste.local', senha: 'senha-de-teste-123' };
// O semestre da nota, em UTC — a conta de `semestreDe` (dominio/identidade/comunidade.js).
const agora = new Date();
const SEMESTRE = `${agora.getUTCFullYear()}-${agora.getUTCMonth() + 1 <= 6 ? 1 : 2}`;

const ler = async (caminho) => {
  const res = await fetch(`${FS}/${caminho}`, { headers: ADM });
  return res.ok ? (await res.json()).fields || {} : null;
};
const consentimento = async () => (await ler(`children/${CRIANCA}`))?.fotoDaTurmaConsentida?.booleanValue;

const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'R4-foto-e-estrelas', perfil: CONTA.perfil });
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.first().isVisible().catch(() => false);
const r = {};

/** O cartão da pergunta: o <div> pai do título (FotoDaTurmaDaFamilia.jsx). */
const cartaoDaFoto = (raiz) => raiz.getByText('Pode aparecer em foto da turma?', { exact: true }).first().locator('xpath=..');
const estrelas = (raiz) => raiz.getByRole('radiogroup', { name: 'Nota de 1 a 5 estrelas' }).first();

try {
  const mae = (await ler(`children/${CRIANCA}`))?.parentUid?.stringValue;
  if (!mae) throw new Error('A Sofia não está no emulador: rode semear-familia-comunidade.mjs.');
  const NOTA = `avaliacoesDoTio/${TIO}_${mae}_${SEMESTRE}`;
  const nota = async () => {
    const f = await ler(NOTA);
    return f ? { nota: Number(f.nota?.integerValue ?? f.nota?.doubleValue), familia: f.familiaUid?.stringValue, semestre: f.semestre?.stringValue } : null;
  };
  r.antes = { consentimento: await consentimento(), nota: await nota() };

  await m('entra com a conta da Renata');
  await garantirSessao(pagina, estado, CONTA);
  await pagina.goto(APP + '/pai');
  await esperar(3500);
  await registrar(pagina, estado, 'inicio', { paginaInteira: true });

  // ── 1. A pergunta da foto no Início ────────────────────────────────────
  await m('1 · "Pode aparecer em foto da turma?" → Sim');
  const pergunta = cartaoDaFoto(pagina);
  r.perguntaNoInicio = await pergunta.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
  if (!r.perguntaNoInicio) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Início', oque: 'Sem resposta no banco, o Início não mostra "Pode aparecer em foto da turma?".' });
  } else {
    await registrar(pagina, estado, 'pergunta-da-foto');
    await tocar(pagina, pergunta.getByRole('button', { name: 'Sim', exact: true }), 'Sim');
    await esperar(2000);
    r.toastFoto = await visivel(pagina.getByText('Sofia pode aparecer na foto da turma.'));
    r.consentimentoDepoisDoSim = await consentimento();
    if (r.consentimentoDepoisDoSim !== true) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'Início', oque: `"Sim" gravou fotoDaTurmaConsentida = ${r.consentimentoDepoisDoSim}, e não true.` });
    }
    // ── 2. A pergunta some ───────────────────────────────────────────────
    await m('2 · a pergunta sai do Início');
    r.perguntaSumiu = !(await visivel(pagina.getByText('Pode aparecer em foto da turma?', { exact: true })));
    if (!r.perguntaSumiu) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Início', oque: 'Respondida, a pergunta da foto continua no Início.' });
  }

  // ── 3. As estrelas no Início ───────────────────────────────────────────
  await m('3 · "Como está o transporte da Sofia?" → 4 estrelas');
  const grupo = estrelas(pagina);
  r.avaliacaoNoInicio = await grupo.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
  if (!r.avaliacaoNoInicio) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Início', oque: 'Sem nota no semestre, o Início não mostra as estrelas do tio.' });
  } else {
    r.tituloDaAvaliacao = await visivel(pagina.getByText('Como está o transporte da Sofia?', { exact: true }));
    r.agoraNao = await visivel(pagina.getByRole('button', { name: 'Agora não', exact: true }));
    if (!r.agoraNao) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Início', oque: 'A avaliação do Início não tem "Agora não".' });
    await registrar(pagina, estado, 'estrelas-no-inicio');
    await tocar(pagina, grupo.getByRole('radio', { name: '4 estrelas' }), '4 estrelas');
    await esperar(2000);
    r.toastNota = await visivel(pagina.getByText('Obrigado. Sua nota foi registrada.'));
    r.notaDepoisDo4 = await nota();
    if (r.notaDepoisDo4?.nota !== 4 || r.notaDepoisDo4?.familia !== mae) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'Início', oque: `4 estrelas gravou ${JSON.stringify(r.notaDepoisDo4)} em ${NOTA}.` });
    }
    r.avaliacaoSumiu = !(await visivel(pagina.getByRole('radiogroup', { name: 'Nota de 1 a 5 estrelas' })));
    if (!r.avaliacaoSumiu) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'Início', oque: 'Depois da nota, as estrelas continuam no Início.' });
  }

  // ── 4. A foto da turma ─────────────────────────────────────────────────
  await m('4 · a foto da turma do Tio Zeca');
  const miniatura = pagina.getByRole('img', { name: 'Foto da turma: Dia das Crianças' });
  r.fotoNoInicio = await visivel(miniatura);
  if (!r.fotoNoInicio) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Início', oque: 'A foto "para as famílias" do tio, válida, não aparece em "Fotos da turma".' });
  } else {
    await registrar(pagina, estado, 'fotos-da-turma');
    await tocar(pagina, miniatura.first(), 'abrir a foto');
    const telaCheia = pagina.getByRole('dialog', { name: 'Foto da turma: Dia das Crianças' });
    r.fotoAbriu = await visivel(telaCheia);
    r.legenda = await visivel(telaCheia.getByText('Dia das Crianças · Festa na perua'));
    await registrar(pagina, estado, 'foto-aberta');
    await tocar(pagina, telaCheia.getByRole('button', { name: 'Fechar' }), 'Fechar');
    await esperar(800);
  }

  // ── 5. Mudar na ficha ──────────────────────────────────────────────────
  await m('5 · Ficha da Sofia: a foto e a nota se mudam aqui');
  await tocar(pagina, pagina.getByRole('button', { name: /^Ficha d[ao] Sofia/ }).first(), 'Ficha da Sofia');
  await esperar(2500);
  const ficha = pagina.getByRole('dialog').filter({ has: pagina.getByText('Pode aparecer em foto da turma?', { exact: true }) }).last();
  r.perguntaNaFicha = await ficha.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
  if (!r.perguntaNaFicha) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Ficha', oque: 'A ficha da Sofia não tem a pergunta da foto para mudar a resposta.' });
  } else {
    const cartao = cartaoDaFoto(ficha);
    const sim = cartao.getByRole('button', { name: 'Sim', exact: true });
    const nao = cartao.getByRole('button', { name: 'Não', exact: true });
    r.simMarcadoNaFicha = (await sim.getAttribute('aria-pressed').catch(() => null)) === 'true';
    await registrar(pagina, estado, 'ficha-foto-sim');
    await tocar(pagina, nao, 'Não');
    await esperar(2000);
    r.consentimentoDepoisDoNao = await consentimento();
    r.naoMarcado = (await nao.getAttribute('aria-pressed').catch(() => null)) === 'true';
    if (r.consentimentoDepoisDoNao !== false) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'Ficha', oque: `"Não" na ficha gravou ${r.consentimentoDepoisDoNao}, e não false.` });
    }
    await registrar(pagina, estado, 'ficha-foto-nao');
    await tocar(pagina, sim, 'Sim de novo');
    await esperar(2000);
    r.consentimentoNoFim = await consentimento();
    if (r.consentimentoNoFim !== true) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'Ficha', oque: `Voltar para "Sim" gravou ${r.consentimentoNoFim}, e não true.` });
    }
  }

  const grupoNaFicha = estrelas(pagina.getByRole('dialog').last());
  r.estrelasNaFicha = await grupoNaFicha.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
  if (!r.estrelasNaFicha) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'Ficha', oque: 'A ficha não mostra as estrelas para mudar a nota do semestre.' });
  } else {
    r.quatroMarcadoNaFicha = (await grupoNaFicha.getByRole('radio', { name: '4 estrelas' }).getAttribute('aria-checked').catch(() => null)) === 'true';
    r.frasePodeMudar = await visivel(pagina.getByText(/Você pode mudar a nota até o fim do semestre\./));
    await registrar(pagina, estado, 'ficha-estrelas-4');
    await tocar(pagina, grupoNaFicha.getByRole('radio', { name: '5 estrelas' }), '5 estrelas');
    await esperar(2000);
    r.notaNoFim = await nota();
    if (r.notaNoFim?.nota !== 5) {
      achado(estado, { gravidade: 'bloqueia', lente: 'dados', tela: 'Ficha', oque: `Mudar para 5 estrelas deixou ${JSON.stringify(r.notaNoFim)} em ${NOTA}.` });
    }
    await registrar(pagina, estado, 'ficha-estrelas-5');
  }
} catch (err) {
  console.error(err);
  achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '—', oque: `A jornada parou: ${err.message}` });
  await registrar(pagina, estado, '99-onde-parou').catch(() => {});
}
estado.resultado = r;
console.log(JSON.stringify(r, null, 2));
await encerrar(contexto, pagina, estado);
