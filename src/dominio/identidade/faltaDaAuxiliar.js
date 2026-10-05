import { chaveDoTelefone, mesmaPessoa } from './indicacao.js';
import { formatBRL } from '../../compartilhado/formatters.js';

/**
 * A FALTA DA AUXILIAR E AS SUBSTITUTAS — régua pura (05/10/2026, fase 5,
 * desenho aprovado pelo dono).
 *
 * "O auxiliar cuida da rota, o tio também cuida caso a auxiliar falte, e ele
 * precisa registrar falta da auxiliar." E quem cobriu o dia entra numa lista
 * de substitutas, com quantas vezes veio e quanto ele pagou da última vez.
 *
 * Tudo aqui é do TIO e só dele: a auxiliar não vê falta nem substituta. Os
 * documentos moram em `faltasDaAuxiliar/{motorista}_{auxiliar}_{dia}` e
 * `substitutasDoTio/{id}`; a conta é feita aqui, sem Firebase, para o Node
 * dos testes alcançar.
 *
 * ⚠️ A FALTA NÃO DESCONTA NADA SOZINHA. O app anota a falta e quem cobriu;
 * se o dia sai do pagamento dela é conversa entre os dois, e nenhuma função
 * daqui calcula desconto — o teste procura.
 *
 * ⚠️ A SUBSTITUTA É TERCEIRO QUE NÃO USA O APP. Guarda-se o mínimo: nome,
 * WhatsApp e o que o próprio tio registrou. Nada de CPF, nada de endereço.
 */

/**
 * A categoria da despesa que o valor do dia vira em `expenses`: `monitor`,
 * a que o app já chama de "Auxiliar" no caixa — a MESMA do pagamento mensal
 * dela. Uma chave nova partiria o custo da auxiliar em dois em "Preciso
 * aumentar?" e no Buzi.
 */
export const CATEGORIA_DA_SUBSTITUTA = 'monitor';

/** Teto do valor de UM dia — o mesmo número das rules. */
export const VALOR_MAXIMO_DO_DIA = 5000;

/** Teto do nome — o mesmo das rules. */
export const NOME_MAXIMO = 60;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * O id da falta: uma por auxiliar por dia. Determinístico de propósito —
 * tocar duas vezes em "faltou hoje" (ou em dois aparelhos) cai no MESMO
 * documento, em vez de contar duas faltas num dia só.
 */
export function idDaFalta(motoristaUid, auxiliarUid, dateKey) {
  return `${motoristaUid}_${auxiliarUid}_${dateKey}`;
}

/** Nome limpo (1 a 60 letras) ou `null`. */
export function nomeDaSubstituta(nome) {
  const n = String(nome || '').replace(/\s+/g, ' ').trim();
  if (!n || n.length > NOME_MAXIMO) return null;
  return n;
}

/**
 * O WhatsApp em só dígitos, com DDD (10 ou 11), ou `null`. A normalização é
 * a da indicação (`chaveDoTelefone`): é ela que faz `(11) 8765-4321` e
 * `11 98765-4321` serem a mesma pessoa, e é isso que "já foi sua auxiliar"
 * precisa.
 */
export function telefoneDaSubstituta(telefone) {
  return chaveDoTelefone(telefone);
}

/** O valor do dia em reais (0 < v ≤ 5000, centavos), ou `null`. */
export function valorDoDia(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > VALOR_MAXIMO_DO_DIA) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Esta substituta pode ser gravada? `{ ok, erro, nome, telefone }` — o erro
 * em português, para a tela mostrar antes de a rule recusar.
 */
export function validarSubstituta({ nome, telefone } = {}) {
  const n = nomeDaSubstituta(nome);
  if (!n) return { ok: false, erro: 'Qual o nome dela?' };
  const t = telefoneDaSubstituta(telefone);
  if (!t) return { ok: false, erro: 'WhatsApp com DDD.' };
  return { ok: true, nome: n, telefone: t };
}

/** A falta desta auxiliar neste dia, ou `null`. */
export function faltaDoDia(faltas, auxiliarUid, dateKey) {
  return (Array.isArray(faltas) ? faltas : [])
    .find((f) => f.auxiliarUid === auxiliarUid && f.dateKey === dateKey) || null;
}

/**
 * Quantas vezes ela substituiu, quando foi a última e quanto ele pagou nela —
 * contado das FALTAS, não guardado à parte. É o que o service grava em
 * `substitutasDoTio` a cada registro e a cada "Desfazer": recontar em vez de
 * somar 1 é o que impede o contador de ficar errado para sempre quando uma
 * falta é desfeita.
 */
export function estatisticaDaSubstituta(faltas, substitutaId) {
  const delas = (Array.isArray(faltas) ? faltas : [])
    .filter((f) => f?.substituta?.id && f.substituta.id === substitutaId)
    .sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
  if (!delas.length) return { vezes: 0, ultimaEm: null, ultimoValor: null };
  return {
    vezes: delas.length,
    ultimaEm: delas[0].dateKey,
    ultimoValor: valorDoDia(delas[0].substituta.valor),
  };
}

/**
 * A lista de substitutas na ordem de chamar: quem mais veio primeiro, depois
 * a mais recente, depois o nome. A que mais veio é a que ele chama de novo.
 */
export function ordenarSubstitutas(lista) {
  return [...(Array.isArray(lista) ? lista : [])].sort((a, b) => {
    const v = (b.vezes || 0) - (a.vezes || 0);
    if (v) return v;
    const u = String(b.ultimaEm || '').localeCompare(String(a.ultimaEm || ''));
    if (u) return u;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

/**
 * Ela já foi auxiliar dele? O telefone bate com alguém do histórico
 * (`historicoDeAuxiliares`). Pelo TELEFONE, nunca pelo nome: duas Marias.
 */
export function jaFoiAuxiliar(telefone, historico) {
  return (Array.isArray(historico) ? historico : []).some((h) => mesmaPessoa(telefone, h.telefone));
}

/** Dinheiro curto: "R$ 80" quando é redondo, "R$ 80,50" quando não. */
export function reaisCurto(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return `R$ ${n.toLocaleString('pt-BR')}`;
  return formatBRL(n);
}

/** '2026-10-12' → '12/10'. */
export function diaCurto(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
  return m ? `${m[3]}/${m[2]}` : '';
}

/** '2026-10' → 'outubro'. */
export function nomeDoMesDaChave(monthKey) {
  const m = /^(\d{4})-(\d{2})/.exec(String(monthKey || ''));
  return m ? MESES[Number(m[2]) - 1] || '' : '';
}

/** A linha curta da escolha: "3 vezes · última R$ 80" ou "ainda não substituiu". */
export function linhaDaEscolha(s) {
  const vezes = s?.vezes || 0;
  if (!vezes) return 'ainda não substituiu';
  const valor = valorDoDia(s.ultimoValor);
  return `${vezes} ${vezes === 1 ? 'vez' : 'vezes'}${valor ? ` · última ${reaisCurto(valor)}` : ''}`;
}

/** A linha do cartão: "Substituiu 3 vezes · última em 12/10 · R$ 80". */
export function linhaDoCartao(s) {
  const vezes = s?.vezes || 0;
  if (!vezes) return 'Ainda não substituiu';
  const partes = [`Substituiu ${vezes} ${vezes === 1 ? 'vez' : 'vezes'}`];
  if (s.ultimaEm) partes.push(`última em ${diaCurto(s.ultimaEm)}`);
  const valor = valorDoDia(s.ultimoValor);
  if (valor) partes.push(reaisCurto(valor));
  return partes.join(' · ');
}

/** A descrição da despesa: "Substituta: Joana · 12/10". */
export function descricaoDaDespesa(nome, dateKey) {
  return `Substituta: ${nomeDaSubstituta(nome) || 'substituta'} · ${diaCurto(dateKey)}`;
}

/**
 * O CONTROLE DO MÊS: as faltas de cada auxiliar, cada substituição (dia, nome,
 * valor) e o total gasto com substitutas. Só soma o que foi REGISTRADO — falta
 * sem substituta não tem valor, e ninguém inventa um.
 */
export function resumoDoMes(faltas, monthKey) {
  const doMes = (Array.isArray(faltas) ? faltas : [])
    .filter((f) => String(f.dateKey || '').startsWith(`${monthKey}-`))
    .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
  const porUid = new Map();
  for (const f of doMes) {
    const atual = porUid.get(f.auxiliarUid) || { auxiliarUid: f.auxiliarUid, nome: f.nomeDaAuxiliar || 'Auxiliar', faltas: 0, dias: [] };
    atual.faltas += 1;
    atual.dias.push(f.dateKey);
    porUid.set(f.auxiliarUid, atual);
  }
  const substituicoes = doMes
    .filter((f) => f.substituta && valorDoDia(f.substituta.valor))
    .map((f) => ({
      dateKey: f.dateKey,
      auxiliarUid: f.auxiliarUid,
      nome: f.substituta.nome,
      valor: valorDoDia(f.substituta.valor),
    }));
  const total = Math.round(substituicoes.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  return {
    porAuxiliar: [...porUid.values()].sort((a, b) => b.faltas - a.faltas || a.nome.localeCompare(b.nome, 'pt-BR')),
    substituicoes,
    totalDeFaltas: doMes.length,
    total,
  };
}

/**
 * "A CIDA FALTOU HOJE", NO INÍCIO DO TIO (05/10/2026, decisão do dono).
 *
 * A falta é coisa da manhã, e a Central (onde ela é registrada) pede a senha.
 * Então o "Para resolver" do Início ganha uma linha por auxiliar que faltou
 * HOJE: "A Cida faltou hoje" com "Substituta: Joana" ou "Sem substituta
 * registrada". Tocar leva à Central, que pede a senha — é lá que se registra
 * quem cobriu, e o valor.
 *
 * ⚠️ SEM VALOR NENHUM. O Início não tem senha, e a auxiliar pode estar com o
 * celular dele na mão: daqui só saem NOMES. A linha é montada campo a campo —
 * nunca um spread da falta —, então `substituta.valor` não tem como chegar à
 * tela por descuido. O teste procura "R$" e o número do valor no texto.
 *
 * `vinculos` é opcional. Quando vem (a lista de `auxiliares` do motorista),
 * só entra quem ainda é auxiliar ATIVA dele. Quando é `null`, vale a falta
 * como está: a rule só deixa NASCER falta de quem tem o vínculo ativo, e o
 * nome viaja dentro da própria falta — o Início não precisa abrir uma escuta
 * de `auxiliares` só para isto.
 */
export function linhasDaFaltaDeHoje(faltas, dateKey, vinculos = null) {
  const ativas = Array.isArray(vinculos)
    ? new Set(vinculos.filter((v) => v?.ativa === true).map((v) => v.auxiliarUid || v.uid))
    : null;
  const vistas = new Set();
  const linhas = [];
  const doDia = (Array.isArray(faltas) ? faltas : [])
    .filter((f) => f && f.auxiliarUid && f.dateKey === dateKey)
    .sort((a, b) => String(a.nomeDaAuxiliar || '').localeCompare(String(b.nomeDaAuxiliar || ''), 'pt-BR'));
  for (const f of doDia) {
    if (vistas.has(f.auxiliarUid)) continue;
    if (ativas && !ativas.has(f.auxiliarUid)) continue;
    vistas.add(f.auxiliarUid);
    const primeiro = String(f.nomeDaAuxiliar || '').trim().split(/\s+/)[0] || 'auxiliar';
    const substituta = nomeDaSubstituta(f.substituta?.nome);
    linhas.push({
      auxiliarUid: f.auxiliarUid,
      titulo: primeiro === 'auxiliar' ? 'A auxiliar faltou hoje' : `A ${primeiro} faltou hoje`,
      sub: substituta ? `Substituta: ${substituta.split(' ')[0]}` : 'Sem substituta registrada',
    });
  }
  return linhas;
}
