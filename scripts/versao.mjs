/**
 * A VERSÃO DE PRODUÇÃO (04/10/2026, decisão do dono).
 *
 *   npm run versao:ver        mostra a versão no ar e qual seria a próxima
 *   npm run versao:publicar   marca o commit atual com a próxima versão
 *                             (v1.12) — o deploy.ps1 chama antes do build
 *   npm run versao:publicar -- --maior    vira o número da frente (v2.0),
 *                             só por decisão do dono, num marco do produto
 *   npm run versao:lista      reescreve docs/versoes.md a partir das marcas
 *
 * A REGRA: um número por PUBLICAÇÃO, de um em um, amarrado ao commit. A marca
 * do git (`v1.12`) é a fonte; docs/versoes.md é só a leitura dela para gente.
 *
 * ⚠️ SÓ MARCA COMMIT LIMPO. Com arquivo modificado e sem commit, o que seria
 * publicado não existe no histórico — a marca apontaria para outro código, e
 * o "1.12" do suporte deixaria de dizer o que a pessoa tem.
 * ⚠️ PUBLICAR DE NOVO O MESMO COMMIT NÃO CRIA VERSÃO NOVA: se o commit já tem
 * marca, ela é reaproveitada — o código não mudou, o número também não.
 * ⚠️ A marca nasce LOCAL; o deploy.ps1 a manda ao GitHub (`git push origin
 * v1.12`) só depois de o hosting subir — versão que não foi ao ar não pode
 * aparecer como publicada.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import {
  VERSAO_ANTES_DA_NUMERACAO,
  dataPorExtenso,
  nomeDaVersao,
  ordenarMarcas,
  proximaMarca,
} from '../src/compartilhado/versaoDoApp.js';

const args = process.argv.slice(2);
const acao = args[0] || 'ver';
const maior = args.includes('--maior');

function git(comando) {
  return execSync(`git ${comando}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}
const linhas = (texto) => texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const marcas = ordenarMarcas(linhas(git('tag --list "v*"')));
const ultima = marcas[0] || null;
const naHead = ordenarMarcas(linhas(git('tag --points-at HEAD')))[0] || null;
const commit = git('rev-list --count HEAD');
const hash = git('rev-parse --short HEAD');

function infoDaMarca(marca) {
  const data = git(`log -1 --format=%cI ${marca}`);
  return {
    marca,
    versao: nomeDaVersao(marca),
    commit: git(`rev-list --count ${marca}`),
    hash: git(`rev-parse --short ${marca}^{commit}`),
    data,
  };
}

/** Os assuntos dos commits que entraram nesta versão (desde a anterior). */
function mudancasEntre(anterior, marca) {
  if (!anterior) return null; // a primeira versão numerada leva tudo de antes
  const faixa = `${anterior}..${marca}`;
  return linhas(git(`log --no-merges --format=%s ${faixa}`));
}

function escreverLista() {
  const todas = ordenarMarcas(linhas(git('tag --list "v*"')));
  const blocos = todas.map((m, i) => {
    const info = infoDaMarca(m);
    const quando = dataPorExtenso(info.data) || '';
    const ano = info.data ? info.data.slice(0, 4) : '';
    const mudancas = mudancasEntre(todas[i + 1] || null, m);
    const corpo = mudancas
      ? mudancas.length
        ? mudancas.map((t) => `- ${t}`).join('\n')
        : '- (nenhum commit novo — publicação repetida)'
      : '- Primeira versão marcada: tudo o que veio antes dela.';
    return `## ${info.versao} · ${quando} de ${ano}\n\ncommit ${info.commit} (\`${info.hash}\`)\n\n${corpo}\n`;
  });
  const texto = `# Versões publicadas

Gerado por \`npm run versao:lista\` a partir das marcas \`v*\` do git — não
edite à mão. Cada versão é UMA publicação em produção; o número depois do
ponto sobe de um em um, e o da frente só muda por decisão do dono. A regra
mora em \`src/compartilhado/versaoDoApp.js\` e em \`scripts/versao.mjs\`.

${blocos.join('\n')}
## ${VERSAO_ANTES_DA_NUMERACAO} · até 4 de outubro de 2026

- O número fixo que o app mostrava antes da numeração. Não corresponde a um
  commit exato: houve publicação feita com arquivo sem commit.
`;
  writeFileSync('docs/versoes.md', texto);
  console.log(`docs/versoes.md reescrito (${todas.length} versões).`);
}

if (acao === 'ver') {
  console.log(`No ar (última marca): ${ultima ? nomeDaVersao(ultima) : `${VERSAO_ANTES_DA_NUMERACAO} (antes da numeração)`}`);
  console.log(`Este commit: ${commit} (${hash})${naHead ? ` — já é a ${nomeDaVersao(naHead)}` : ''}`);
  console.log(`Próxima publicação seria: ${naHead ? nomeDaVersao(naHead) : nomeDaVersao(proximaMarca(ultima, { maior }))}`);
} else if (acao === 'publicar') {
  if (naHead) {
    console.log(`Este commit já é a versão ${nomeDaVersao(naHead)} — publicação repetida, número mantido.`);
    process.exit(0);
  }
  const sujo = linhas(git('status --porcelain --untracked-files=no'));
  if (sujo.length) {
    console.error('PAROU: há arquivo modificado sem commit. A versão só marca commit limpo —');
    console.error('senão o número apontaria para um código que não foi o publicado.');
    process.exit(1);
  }
  const nova = proximaMarca(ultima, { maior });
  const mudancas = ultima ? linhas(git(`log --no-merges --format=%s ${ultima}..HEAD`)) : [];
  const mensagem = [
    `Versão ${nomeDaVersao(nova)} · commit ${commit} (${hash})`,
    '',
    ...mudancas.map((t) => `- ${t}`),
  ].join('\n');
  execSync(`git tag -a ${nova} -F -`, { input: mensagem });
  console.log(`Marcado: ${nova} = commit ${commit} (${hash}), ${mudancas.length} commit(s) novos.`);
  console.log(`Depois do deploy subir: git push origin ${nova}`);
} else if (acao === 'lista') {
  escreverLista();
} else {
  console.error(`Ação desconhecida: ${acao} (use ver, publicar ou lista).`);
  process.exit(1);
}
