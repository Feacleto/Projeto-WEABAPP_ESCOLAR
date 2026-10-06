import { useMemo, useState } from 'react';
import { CalendarDays, Info } from 'lucide-react';
import {
  TIPO,
  chaveDoDia,
  mesesDoAno,
  vemAi,
} from '../../dominio/associacao/calendarioDoAno.js';

/**
 * CALENDÁRIO DO ANO — quando tem aula, quais datas pesam e o que o negócio pede.
 *
 * Só lê a lista pura de `calendarioDoAno.js`; nenhuma leitura do banco.
 * ⚠️ As férias são ESTIMATIVA (cada rede tem o seu calendário) e a tela diz
 * isso — o dono decide campanha em cima do mês, não do dia exato do recesso.
 */

const FILTROS = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: TIPO.ESCOLA, rotulo: 'Escola' },
  { id: TIPO.FERIADO, rotulo: 'Feriados' },
  { id: TIPO.POPULAR, rotulo: 'Datas populares' },
  { id: TIPO.NEGOCIO, rotulo: 'O que o negócio pede' },
];

// Cada tipo tem a sua cor de chip; o âmbar fica para aviso, então a estimativa
// de escola usa o chip próprio da escola.
const CHIP = {
  [TIPO.ESCOLA]: 'bg-escolaChip text-text',
  [TIPO.FERIADO]: 'bg-dangerChip text-dangerText',
  [TIPO.POPULAR]: 'bg-infoChip text-infoText',
  [TIPO.NEGOCIO]: 'bg-primaryChip text-accentText',
};

const ROTULO = {
  [TIPO.ESCOLA]: 'Escola',
  [TIPO.FERIADO]: 'Feriado',
  [TIPO.POPULAR]: 'Data popular',
  [TIPO.NEGOCIO]: 'Negócio',
};

const diaMes = (data) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

export default function CalendarioTab() {
  const [filtro, setFiltro] = useState('tudo');
  const hoje = useMemo(() => new Date(), []);
  const ano = hoje.getFullYear();

  const meses = useMemo(() => mesesDoAno(ano), [ano]);
  const proximas = useMemo(() => vemAi(hoje, 3), [hoje]);
  const hojeChave = chaveDoDia(hoje);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          Calendário de {ano}
        </h1>
        <p className="mt-1 text-sm text-textMuted">
          Quanto tem aula em cada mês, as datas que pesam e o que o negócio pede.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold text-text">Vem aí</h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-sm text-textMuted">Nenhuma data por perto.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {proximas.map((e) => (
              <li key={`${e.data}-${e.nome}`} className="rounded-xl border border-border p-3">
                <p className="text-lg font-semibold text-text">{diaMes(e.data)}</p>
                <p className="text-sm text-text">{e.nome}</p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${CHIP[e.tipo]}`}>
                  {ROTULO[e.tipo]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-xl bg-infoChip p-3 text-xs text-infoText">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          As férias são estimativa: janeiro inteiro, recesso de julho (de 2 a 4 semanas) e fim das
          aulas em meados de dezembro. Cada rede tem o seu calendário, e feriado municipal o app
          não sabe.
        </span>
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar o calendário">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={`min-h-[40px] rounded-xl border px-4 text-sm font-medium transition-colors ${
              filtro === f.id
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card text-text hover:bg-primaryChip'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {meses.map((m) => {
          const eventos = m.eventos.filter((e) => filtro === 'tudo' || e.tipo === filtro);
          const pctAula = Math.round(m.fracao * 100);
          return (
            <section key={m.mes} className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-text">{m.nome}</h2>

              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-textMuted">
                  <span>Quanto tem aula</span>
                  <span>
                    {m.aula} de {m.uteis} dias úteis
                  </span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-primaryChip"
                  role="img"
                  aria-label={`${pctAula}% dos dias úteis de ${m.nome} têm aula`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pctAula}%` }} />
                </div>
              </div>

              {eventos.length === 0 ? (
                <p className="mt-3 text-xs text-textMuted">Nada neste filtro.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {eventos.map((e) => (
                    <li
                      key={`${e.data}-${e.nome}`}
                      className={`flex items-start gap-2 text-sm ${
                        e.data < hojeChave ? 'text-textMuted' : 'text-text'
                      }`}
                    >
                      <span className="w-12 shrink-0 font-semibold">
                        {e.tipo === TIPO.NEGOCIO && e.data.endsWith('-01') ? 'Mês' : diaMes(e.data)}
                      </span>
                      <span className="min-w-0 flex-1">
                        {e.nome}
                        {e.estimativa && <span className="text-xs text-textMuted"> (estimativa)</span>}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${CHIP[e.tipo]}`}
                      >
                        {ROTULO[e.tipo]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
