/**
 * A SEGURANÇA DO APP — régua do servidor e espelho da tela.
 * Trava: o espelho igual ao servidor, os limiares, um alerta por escopo por
 * hora (id determinístico) e nenhum uid/IP/hash no resumo.
 *
 * COMO RODAR: node scripts/testar-seguranca-do-app.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as app from '../src/dominio/identidade/segurancaDoApp.js';

const srv = createRequire(import.meta.url)('../functions/lib/reguaDaSeguranca.js');
let ok = 0;
let bad = 0;
const falhas = [];
function checar(nome, esperado, obtido) {
  if (JSON.stringify(esperado) === JSON.stringify(obtido)) ok++;
  else {
    bad++;
    falhas.push(`${nome}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

const HASH = 'a'.repeat(32);
const lim = (escopo, n, contagem = 99) => ({ id: `${escopo}_${HASH}${n}_493000`, escopo, contagem });

console.log('1. espelho igual ao servidor');
checar('escopos (id, rótulo, janela)', srv.ESCOPOS.map(({ id, rotulo, janela }) => ({ id, rotulo, janela })), app.ESCOPOS);
checar('limiares', { ...srv.LIMIARES }, { ...app.LIMIARES });
const horas = {
  '09': { escopos: { convite: { janelasNoLimite: 4 }, pedido: { janelasNoLimite: 2 } }, bloqueiosDaSenha: 1, comprovantesDuplicados: 1, fraudesRegistradas: 0 },
  '14': { escopos: { convite: { janelasNoLimite: 7 }, pedido: { janelasNoLimite: 3 } }, bloqueiosDaSenha: null, comprovantesDuplicados: 2, fraudesRegistradas: 1 },
};
checar('totais do dia iguais', srv.totaisDoDia(horas), app.totaisDoDia(horas));
checar('janela de hora soma, a de dia pega o maior', [11, 3], [srv.totaisDoDia(horas).escopos.convite.bloqueios, srv.totaisDoDia(horas).escopos.pedido.bloqueios]);
checar('hora de pico', '14', srv.totaisDoDia(horas).escopos.convite.horaDePico);
checar('senha nunca lida fica null', null, srv.totaisDoDia({}).bloqueiosDaSenha);

console.log('2. resumo e limiares');
const r = srv.resumoDaHora({
  limites: [lim('convite', 1), lim('convite', 2), lim('convite', 3, 5), lim('desconhecido', 1)],
  senhasBloqueadas: 3,
  comprovantes: 2,
  fraudes: 0,
  appCheckLigado: false,
});
checar('só janelas no teto contam', 2, r.escopos.convite.janelasNoLimite);
checar('quem distinto', 2, r.escopos.convite.quemDistinto);
checar('escopo desconhecido é ignorado', undefined, r.escopos.desconhecido);
checar('senha não lida vira null', null, srv.resumoDaHora({ senhasBloqueadas: null }).bloqueiosDaSenha);
checar('sem estouro, sem alerta', [], srv.precisaAlertar(r));
const muitos = srv.resumoDaHora({ limites: Array.from({ length: 20 }, (_, i) => lim('convite', i)), fraudes: 1 });
checar('20 no convite e 1 fraude alertam', ['convite', 'fraude'], srv.precisaAlertar(muitos).map((a) => a.chave));
checar('19 no convite não alerta', [], srv.precisaAlertar(srv.resumoDaHora({ limites: Array.from({ length: 19 }, (_, i) => lim('convite', i)) })));
checar('texto do alerta sem hash', false, JSON.stringify(srv.textoDoAlerta({ chave: 'convite', valor: 20, limiar: 20 })).includes(HASH));

console.log('3. nada de uid, IP ou hash no resumo');
const json = JSON.stringify(muitos);
checar('sem o hash', false, json.includes(HASH));
checar('sem uid nem ip', false, /uid|"ip"/i.test(json));

console.log('4. um alerta por escopo por hora');
const vigia = readFileSync(new URL('../functions/lib/vigiaDaSeguranca.js', import.meta.url), 'utf8');
checar('id determinístico por escopo, hora e dono', true, vigia.includes('seguranca_${alerta.chave}_${dia}-${hora}_${dono.id}'));
checar('criado com create', true, vigia.includes('.create('));
checar('ALREADY_EXISTS calado', true, vigia.includes('err?.code !== 6'));

console.log('5. tela');
const totais = (n) => ({ escopos: { convite: { bloqueios: n, horaDePico: '14', picoNaHora: n } }, comprovantesDuplicados: n, fraudesRegistradas: 0 });
const dias = [{ dia: '2026-10-05', appCheckLigado: false, totais: totais(3) }, { dia: '2026-10-04', totais: totais(2) }];
const t = app.resumoDaTela(dias, '2026-10-05');
checar('hoje, 7 dias e pico', [3, 5, '14'], [t.escopos[0].hoje, t.escopos[0].seteDias, t.escopos[0].horaDePico]);
checar('App Check desligado', false, t.appCheckLigado);
checar('sem dado', false, app.resumoDaTela([], '2026-10-05').temDado);

console.log(`\n${ok} passaram, ${bad} falharam`);
falhas.forEach((f) => console.log('  x ' + f));
process.exit(bad > 0 ? 1 : 0);
