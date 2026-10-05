import { ListChecks } from 'lucide-react';
import { fraseDoEvento, horaDoEvento, tituloDoRegistro, ultimosEventos } from '../../dominio/rota/registroDaRota.js';

/**
 * "O QUE A CIDA MARCOU" — no topo da rota do tio (05/10/2026, decisão do
 * dono). Parado no portão da escola, ele quer saber o que a auxiliar marcou
 * e a que horas: "06:52 Ana entrou na perua". Os 6 mais recentes, o mais
 * novo em cima.
 *
 * Só aparece para quem tem auxiliar ATIVA (`nomes` vazio = nada na tela).
 * Os eventos vêm de UMA escuta no documento do dia (`useRegistroDaRota`),
 * escritos só pelo servidor, na mesma transação da marcação dela.
 *
 * Não tira nada da operação dele: ele continua marcando, desfazendo e
 * avisando como antes, na linha do tempo logo abaixo.
 */
export default function RegistroDaAuxiliar({ nomes, eventos }) {
  if (!nomes?.length) return null;
  const { titulo, comNome } = tituloDoRegistro(nomes);
  const ultimos = ultimosEventos(eventos);
  return (
    <section className="rounded-2xl bg-card p-3 shadow-rest" aria-live="polite">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-text">
        <ListChecks size={20} className="text-primary" aria-hidden="true" />
        {titulo}
      </h2>
      {ultimos.length === 0 ? (
        <p className="mt-2 text-base text-textMuted">
          {comNome ? 'Assim que elas marcarem, aparece aqui.' : `Assim que a ${nomes[0]} marcar, aparece aqui.`}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {ultimos.map((e, i) => (
            <li key={`${horaDoEvento(e)}-${e.criancaNome}-${e.passo}-${i}`} className="flex items-baseline gap-3 py-2">
              <time className="w-14 shrink-0 font-mono text-base font-semibold tabular-nums text-textMuted">{horaDoEvento(e)}</time>
              <span className="text-base text-text">
                {comNome && <b>{e.auxiliarNome}: </b>}
                {fraseDoEvento(e)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
