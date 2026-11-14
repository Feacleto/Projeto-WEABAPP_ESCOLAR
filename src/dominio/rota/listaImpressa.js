/**
 * A LISTA DA TURMA NO PAPEL — a régua pura (RC2, 14/11/2026 —
 * docs/analise/13a, linha "n"; decisões 8 e 14 de `13-lotes`).
 *
 * ── PARA QUE SERVE
 * O motorista quer uma folha na mão: no portão, com a substituta, com a
 * auxiliar. A tela já mostra tudo — o papel não precisa mostrar nada além do
 * que ajuda a rota.
 *
 * ── O QUE VAI PARA O PAPEL, E SÓ ISSO
 * Quatro campos por criança: o NOME, a ESCOLA (o título do grupo), a HORA de
 * pegar e a RUA. Papel fica esquecido no carro, cai do banco, vai para a
 * lixeira da escola: tudo o que sai do app e entra numa folha deixa de ter
 * regra de acesso.
 *
 * ⚠️ NUNCA ENTRA, E O TESTE PROCURA UM POR UM: telefone (do responsável, do
 * segundo responsável e da escola), e-mail, nome do responsável, mensalidade,
 * dado de saúde, nota sobre a família, foto, aniversário, CEP, coordenada,
 * código do convite. A decisão 14 proíbe nota sobre responsável em qualquer
 * superfície, e o dado de saúde da criança só a família escreve — nenhum dos
 * dois pode sair por aqui.
 *
 * ⚠️ O MECANISMO É UMA LISTA FECHADA, NÃO UM FILTRO. `linhasDaLista` monta cada
 * linha campo a campo; ela nunca copia o documento da criança e depois tira o
 * que não pode. Campo novo em `children` não chega ao papel sozinho — para
 * entrar, alguém precisa escrevê-lo aqui, e o teste reprova.
 *
 * ── A RUA É SÓ A RUA (sem o número da casa)
 * Decisão desta entrega: o papel diz "Rua das Flores", não "Rua das Flores,
 * 120". A rua orienta a ordem e a conversa ("a do final da Rua das Flores");
 * o número da porta é a localização exata de uma criança e fica no app, que
 * tem login. Se o dono quiser o número no papel, é uma linha em `ruaCurta`.
 *
 * ── A HORA É A COMBINADA, NUNCA A PRESUMIDA
 * O app tem um chute por período (`horariosCombinados`) que a tela do
 * responsável esconde de propósito. No papel o chute viraria "combinado": sem
 * hora gravada, a linha diz "—".
 *
 * Não importa Firebase nem React (decisão 17): é o que deixa isto testável no
 * Node (`npm run testar:lista-impressa`).
 */
import { normalizaHora, emMinutos } from './horarios.js';
import { chaveDoNome } from '../escola/nomeEscola.js';

/** O título do grupo das crianças sem escola. */
export const SEM_ESCOLA = 'Sem escola';

/** Os únicos campos de uma linha da lista. Qualquer outro é falha. */
export const CAMPOS_DA_LINHA = ['id', 'nome', 'hora', 'rua'];

/** O traço de "não tem" — a linha nunca fica com buraco. */
export const SEM_DADO = '—';

/**
 * Só a RUA de um endereço, sem número, complemento, bairro nem cidade. Aceita
 * os dois formatos que existem no banco:
 *   - o dos Correios (`montarEndereco`): "Rua X, 120, Apto 4 — Bairro, Cidade/UF";
 *   - o do mapa (`display_name`): "120, Rua X, Bairro, Região…, CEP, Brasil";
 *   - e o texto livre que ele digitou ("Rua Augusta 100").
 * Sem rua legível, devolve `''`.
 */
export function ruaCurta(endereco) {
  const antesDoTraco = String(endereco ?? '').split(' — ')[0];
  const partes = antesDoTraco.split(',').map((p) => p.trim()).filter(Boolean);
  // Número solto na frente (formato do mapa) ou "s/n" não é a rua.
  const soNumero = (p) => /^(\d+[a-zA-Z]?(\s*[-/]\s*\d+)?|s\/?n)$/i.test(p);
  const rua = partes.find((p) => !soNumero(p));
  if (!rua) return '';
  // "Rua Augusta 100": o número colado no fim sai. Só com três palavras ou
  // mais, para não comer "Rua 25" ou "Estrada 5", cujo número É o nome.
  const palavras = rua.split(/\s+/);
  if (palavras.length >= 3 && /^\d+[a-zA-Z]?$/.test(palavras[palavras.length - 1])) {
    return palavras.slice(0, -1).join(' ');
  }
  return rua;
}

/** A hora combinada de pegar ('06:20') ou `''`. Nunca o chute por período. */
export function horaDePegar(crianca) {
  return normalizaHora(crianca?.horaPega) || '';
}

/**
 * A LISTA, agrupada por escola e ordenada pela hora.
 *
 *   - Só entra criança ativa.
 *   - O grupo é a escola (`schoolId`, ou o nome quando a escola ainda é texto
 *     solto — duas grafias da mesma escola viram um grupo só); sem escola, o
 *     último grupo.
 *   - Dentro do grupo: pela hora (quem não tem hora, no fim), depois pelo nome.
 *   - Os grupos, pela hora da primeira criança de cada um.
 *
 * @param {Array<object>} criancas  as crianças do motorista (`children`)
 * @param {Array<object>} [escolas]  as escolas dele, para o nome oficial do grupo
 * @returns {{ total: number, grupos: Array<{ chave: string, escola: string,
 *   criancas: Array<{ id: string, nome: string, hora: string, rua: string }> }> }}
 */
export function linhasDaLista(criancas, escolas = []) {
  const escolaPorId = new Map((Array.isArray(escolas) ? escolas : []).map((e) => [e.id, e]));
  const grupos = new Map();

  for (const c of Array.isArray(criancas) ? criancas : []) {
    if (!c || typeof c !== 'object' || c.active === false) continue;
    const escola = escolaPorId.get(c.schoolId);
    const nomeDaEscola = String(escola?.nome || c.school || '').trim();
    const chave = c.schoolId ? `id:${c.schoolId}` : nomeDaEscola ? `nome:${chaveDoNome(nomeDaEscola)}` : 'sem';
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, escola: nomeDaEscola || SEM_ESCOLA, criancas: [] });
    }
    // A LINHA É MONTADA CAMPO A CAMPO — ver o aviso do topo.
    grupos.get(chave).criancas.push({
      id: String(c.id ?? ''),
      nome: String(c.name ?? '').trim() || SEM_DADO,
      hora: horaDePegar(c) || SEM_DADO,
      rua: ruaCurta(c.address) || SEM_DADO,
    });
  }

  const minutos = (l) => (l.hora === SEM_DADO ? Infinity : emMinutos(l.hora));
  const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.criancas.sort((a, b) => minutos(a) - minutos(b) || porNome(a, b));
  }
  lista.sort((a, b) => {
    // "Sem escola" é sempre o último.
    if ((a.chave === 'sem') !== (b.chave === 'sem')) return a.chave === 'sem' ? 1 : -1;
    return (
      minutos(a.criancas[0]) - minutos(b.criancas[0]) ||
      a.escola.localeCompare(b.escola, 'pt-BR')
    );
  });

  return { total: lista.reduce((n, g) => n + g.criancas.length, 0), grupos: lista };
}
