/**
 * A SEGURANÇA DO APP, do lado da tela — espelho de
 * `functions/lib/reguaDaSeguranca.js` (05/10/2026). Os rótulos, as janelas e
 * os limiares são os mesmos do servidor, e `testar:seguranca-do-app` os
 * compara. Só números: a vigia nunca grava uid, IP ou hash.
 *
 * ⚠️ O que o app NÃO enxerga está em `NAO_ENXERGA`, e a tela o mostra sempre:
 * painel sem dado parece painel em paz, e não é isso que ele sabe dizer.
 */

export const ESCOPOS = [
  { id: 'convite', rotulo: 'Convite: códigos que não abriram', janela: 'hora' },
  { id: 'pedido', rotulo: 'Pedido de acesso pelo telefone', janela: 'dia' },
  { id: 'investidor', rotulo: 'Formulário de investidor', janela: 'hora' },
  { id: 'substituta', rotulo: 'Link da substituta de um dia', janela: 'hora' },
];

export const LIMIARES = Object.freeze({
  convite: 20,
  pedido: 10,
  investidor: 10,
  substituta: 20,
  senha: 10,
  comprovantes: 10,
  fraude: 1,
});

export const NAO_ENXERGA = [
  'Ataque de rede: quem barra é a infraestrutura do Google. Olhe no console do Firebase, nas métricas de Hosting e de Functions.',
  'Login barrado: o Firebase Auth recusa sozinho. Olhe no console, em Authentication.',
  'Recusas das regras de acesso: ficam nas métricas de uso do Firestore, no console.',
];

const naoNegativo = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);

/** Totais do dia a partir de `horas` ({ 'HH': resumo }) — igual ao servidor. */
export function totaisDoDia(horas = {}) {
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
  return {
    escopos,
    bloqueiosDaSenha: lista.some(([, r]) => r.bloqueiosDaSenha != null) ? somar('bloqueiosDaSenha') : null,
    comprovantesDuplicados: somar('comprovantesDuplicados'),
    fraudesRegistradas: somar('fraudesRegistradas'),
  };
}

/**
 * Os últimos dias (do mais novo ao mais velho) viram a tela: por escopo,
 * bloqueios hoje e em 7 dias e a hora de pico; mais fraudes e App Check.
 * `hoje` é a chave 'AAAA-MM-DD' de Brasília.
 */
export function resumoDaTela(dias = [], hoje = '') {
  const lista = Array.isArray(dias) ? dias : [];
  const doDia = lista.find((d) => d?.dia === hoje);
  const soma = (f) => lista.reduce((s, d) => s + naoNegativo(f(d?.totais)), 0);
  const maisRecente = lista[0] || null;
  return {
    temDado: lista.length > 0,
    escopos: ESCOPOS.map((e) => {
      const pico = lista
        .map((d) => d?.totais?.escopos?.[e.id])
        .filter((x) => x && x.horaDePico)
        .sort((a, b) => b.picoNaHora - a.picoNaHora)[0];
      return {
        id: e.id,
        rotulo: e.rotulo,
        hoje: naoNegativo(doDia?.totais?.escopos?.[e.id]?.bloqueios),
        seteDias: soma((t) => t?.escopos?.[e.id]?.bloqueios),
        horaDePico: pico ? pico.horaDePico : null,
      };
    }),
    comprovantesDuplicados: {
      hoje: naoNegativo(doDia?.totais?.comprovantesDuplicados),
      seteDias: soma((t) => t?.comprovantesDuplicados),
    },
    fraudes: {
      hoje: naoNegativo(doDia?.totais?.fraudesRegistradas),
      seteDias: soma((t) => t?.fraudesRegistradas),
    },
    appCheckLigado: maisRecente ? maisRecente.appCheckLigado === true : null,
  };
}
