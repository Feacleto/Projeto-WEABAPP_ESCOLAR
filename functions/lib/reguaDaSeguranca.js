/**
 * A RÉGUA DA SEGURANÇA — o que o app ENXERGA de ataque, em números (05/10/2026,
 * painel do dono, tela Segurança). Espelho em
 * `src/dominio/identidade/segurancaDoApp.js`, comparado em
 * `testar:seguranca-do-app`.
 *
 * ── O QUE ELA MEDE, E O QUE NÃO MEDE
 * Mede só o que o app já registra: janelas de `limitesDeTentativa` que bateram
 * no teto, bloqueios da senha do Financeiro, comprovantes duplicados e
 * suspensões por fraude. Ataque de rede, login barrado pelo Firebase Auth e
 * recusas das rules NÃO passam por aqui — a tela diz isso, em vez de calar e
 * parecer "tudo em paz".
 *
 * ── ⚠️ SÓ NÚMEROS
 * O resumo nunca carrega uid, IP ou hash. `quem` (o sha256 do IP, no id do
 * documento) só serve para CONTAR quantos diferentes; o valor some. Guardar o
 * hash aqui refaria, em outro lugar, o registro de IP que o
 * `limiteDeTentativas` evita.
 *
 * RÉGUA PURA: só requer `reguaDasTentativas` (também pura) — ver
 * `testar:imports`. Quem lê o banco é `vigiaDaSeguranca.js`.
 */

'use strict';

const { REGRAS } = require('./reguaDasTentativas');

const HORA_MS = 60 * 60 * 1000;

const ROTULOS = {
  convite: 'Convite: códigos que não abriram',
  pedido: 'Pedido de acesso pelo telefone',
  investidor: 'Formulário de investidor',
  substituta: 'Link da substituta de um dia',
};

/**
 * Os escopos de `limitesDeTentativa` que o app conhece, com rótulo para a
 * tela. `janela` diz se o contador vive uma hora ou um dia: o do dia aparece
 * em toda hora enquanto não vence, então o total do dia usa o MAIOR valor,
 * não a soma (senão o mesmo bloqueio contaria 24 vezes).
 * Escopo que não está aqui é ignorado.
 */
const ESCOPOS = Object.values(REGRAS).map((r) => ({
  id: r.escopo,
  rotulo: ROTULOS[r.escopo] || r.escopo,
  max: r.max,
  janela: r.janelaMs > HORA_MS ? 'dia' : 'hora',
}));

/**
 * LIMIARES — quantos bloqueios numa hora viram aviso no sino do dono. Valores
 * de partida, sem base histórica: convite e substituta têm teto de 30 erros
 * por IP, então 20 origens diferentes no teto na mesma hora é varredura, não
 * a mãe que errou o link. As outras portas são pequenas: 10 já é fora do
 * comum. Revisar com o primeiro mês de dados.
 */
const LIMIARES = Object.freeze({
  convite: 20,
  pedido: 10,
  investidor: 10,
  substituta: 20,
  senha: 10,
  comprovantes: 10,
  fraude: 1,
});

/** O `quem` do id `{escopo}_{quem}_{janela}`; só para contar distintos. */
function quemDoId(id, escopo) {
  const resto = String(id || '').slice(escopo.length + 1);
  const i = resto.lastIndexOf('_');
  return i > 0 ? resto.slice(0, i) : resto;
}

const naoNegativo = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);

/**
 * O resumo de UMA hora. `dados`: { limites: [{ id, escopo, contagem }],
 * senhasBloqueadas (número ou null se não deu para contar), comprovantes,
 * fraudes, appCheckLigado }.
 */
function resumoDaHora(dados = {}) {
  const limites = Array.isArray(dados.limites) ? dados.limites : [];
  const escopos = {};
  for (const e of ESCOPOS) {
    const noLimite = limites.filter(
      (l) => l && l.escopo === e.id && (Number(l.contagem) || 0) >= e.max
    );
    escopos[e.id] = {
      janelasNoLimite: noLimite.length,
      quemDistinto: new Set(noLimite.map((l) => quemDoId(l.id, e.id))).size,
    };
  }
  return {
    escopos,
    bloqueiosDaSenha: dados.senhasBloqueadas == null ? null : naoNegativo(dados.senhasBloqueadas),
    comprovantesDuplicados: naoNegativo(dados.comprovantes),
    fraudesRegistradas: naoNegativo(dados.fraudes),
    appCheckLigado: dados.appCheckLigado === true,
  };
}

/** Quais limiares estouraram: [{ chave, valor, limiar }]. */
function precisaAlertar(resumo, limiares = LIMIARES) {
  const alertas = [];
  const olha = (chave, valor) => {
    const limiar = limiares[chave];
    if (Number.isFinite(limiar) && valor != null && valor >= limiar) {
      alertas.push({ chave, valor, limiar });
    }
  };
  for (const e of ESCOPOS) olha(e.id, resumo?.escopos?.[e.id]?.janelasNoLimite ?? 0);
  olha('senha', resumo?.bloqueiosDaSenha);
  olha('comprovantes', resumo?.comprovantesDuplicados ?? 0);
  olha('fraude', resumo?.fraudesRegistradas ?? 0);
  return alertas;
}

/** O aviso do sino: só o assunto e o número, nunca quem. */
function textoDoAlerta(alerta) {
  const n = alerta.valor;
  const rotulo = ESCOPOS.find((e) => e.id === alerta.chave)?.rotulo;
  if (rotulo) {
    return {
      title: 'Muitas tentativas barradas',
      body: `${rotulo}: ${n} origem${n === 1 ? '' : 'ns'} no limite na última hora.`,
    };
  }
  if (alerta.chave === 'senha') {
    return {
      title: 'Senha do Financeiro sendo forçada',
      body: `${n} conta${n === 1 ? '' : 's'} bloqueada${n === 1 ? '' : 's'} por erros na última hora.`,
    };
  }
  if (alerta.chave === 'comprovantes') {
    return {
      title: 'Comprovantes duplicados em alta',
      body: `${n} comprovante${n === 1 ? '' : 's'} repetido${n === 1 ? '' : 's'} na última hora.`,
    };
  }
  return {
    title: 'Suspensão por fraude registrada',
    body: `${n} registro${n === 1 ? '' : 's'} de fraude ou documento falso na última hora.`,
  };
}

/**
 * Os totais do dia a partir do mapa `horas` ({ 'HH': resumo }). Por escopo:
 * `bloqueios` (soma das horas; o MAIOR valor se a janela é de um dia),
 * `horaDePico` e `picoNaHora`.
 */
function totaisDoDia(horas = {}) {
  const lista = Object.entries(horas || {}).filter(([, r]) => r && typeof r === 'object');
  const escopos = {};
  for (const e of ESCOPOS) {
    let soma = 0;
    let maior = 0;
    let horaDePico = null;
    let picoNaHora = 0;
    for (const [hh, r] of lista) {
      const v = naoNegativo(r.escopos?.[e.id]?.janelasNoLimite);
      soma += v;
      maior = Math.max(maior, v);
      if (v > picoNaHora) {
        picoNaHora = v;
        horaDePico = hh;
      }
    }
    escopos[e.id] = { bloqueios: e.janela === 'dia' ? maior : soma, horaDePico, picoNaHora };
  }
  const somar = (campo) => lista.reduce((s, [, r]) => s + naoNegativo(r[campo]), 0);
  const algumaSenha = lista.some(([, r]) => r.bloqueiosDaSenha != null);
  return {
    escopos,
    bloqueiosDaSenha: algumaSenha ? somar('bloqueiosDaSenha') : null,
    comprovantesDuplicados: somar('comprovantesDuplicados'),
    fraudesRegistradas: somar('fraudesRegistradas'),
  };
}

module.exports = { ESCOPOS, LIMIARES, resumoDaHora, precisaAlertar, textoDoAlerta, totaisDoDia };
