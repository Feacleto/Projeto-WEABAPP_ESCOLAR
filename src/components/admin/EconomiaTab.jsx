import { useEffect, useMemo, useState } from 'react';
import { Calculator, Layers, Ruler, Users } from 'lucide-react';
import Spinner from '../common/Spinner';
import { getRetratoDaBase } from '../../services/adminMetricsService';
import {
  CRIANCAS_NA_TAXA_CHEIA,
  MINIMO,
  PISO_DA_FATURA,
  PLANO,
  TAXA,
  TAXA_ACIMA_DE_40,
} from '../../dominio/associacao/planos.js';
import { PRECO_DO_CONCORRENTE } from '../../dominio/associacao/vitrineDoPlano.js';
import {
  DEGRAUS_DA_ESCADA,
  MENSALIDADE_MEDIA_PADRAO,
  agruparPorFaixa,
  simularTurma,
  tabelaPorTamanho,
} from '../../dominio/associacao/economiaDoPainel.js';

/**
 * ECONOMIA — como o preço por criança funciona, e quanto cada turma paga.
 *
 * Aba de LEITURA do dono. Nenhum número de preço é escrito aqui: tudo vem de
 * `planos.js` (a régua que cobra) e das contas puras de `economiaDoPainel.js`.
 * A única leitura do banco é o retrato da base, que o Hoje já pede (e que tem
 * cache) — abrir esta aba não custa consulta nova.
 *
 * ⚠️ Nenhum nome de concorrente na tela, nem nesta: a comparação é com "outro
 * app de van escolar", como na tela de venda do motorista.
 */

const brl = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (f) => `${Math.round(f * 1000) / 10}%`.replace('.', ',');

function Cartao({ icone: Icone, titulo, subtitulo, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text">
        <Icone className="h-4 w-4 text-primary" aria-hidden="true" />
        {titulo}
      </h2>
      {subtitulo && <p className="mt-1 text-xs text-textMuted">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Regua() {
  const linhas = [
    `${brl(TAXA[PLANO.MENSAL])} por criança no mensal e ${brl(TAXA[PLANO.ANUAL])} no anual.`,
    `Da ${CRIANCAS_NA_TAXA_CHEIA + 1}ª criança em diante, ${brl(TAXA_ACIMA_DE_40[PLANO.MENSAL])} e ${brl(TAXA_ACIMA_DE_40[PLANO.ANUAL])}: só o excedente paga menos, as primeiras ${CRIANCAS_NA_TAXA_CHEIA} não mudam.`,
    `Mínimo de tabela de ${brl(MINIMO[PLANO.MENSAL])} no mensal e ${brl(MINIMO[PLANO.ANUAL])} no anual, antes de qualquer desconto.`,
    `Nenhuma fatura fica abaixo de ${brl(PISO_DA_FATURA)} depois dos descontos.`,
  ];
  return (
    <Cartao icone={Ruler} titulo="A régua em quatro linhas">
      <ol className="space-y-2">
        {linhas.map((l, i) => (
          <li key={l} className="flex gap-3 text-sm text-text">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primaryChip text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span>{l}</span>
          </li>
        ))}
      </ol>
    </Cartao>
  );
}

function Botao({ ativo, desligado, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligado}
      aria-pressed={ativo}
      className={`min-h-[40px] rounded-xl border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        ativo
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-card text-text hover:bg-primaryChip'
      }`}
    >
      {children}
    </button>
  );
}

function Numero({ rotulo, valor, destaque = false }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-textMuted">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold ${destaque ? 'text-accentText' : 'text-text'}`}>
        {valor}
      </p>
    </div>
  );
}

function Simulador() {
  const [criancas, setCriancas] = useState(15);
  const [plano, setPlano] = useState(PLANO.MENSAL);
  const [escada, setEscada] = useState(0);
  const [mensalidade, setMensalidade] = useState(MENSALIDADE_MEDIA_PADRAO);

  const r = useMemo(
    () => simularTurma({ criancas, plano, escada, mensalidade }),
    [criancas, plano, escada, mensalidade]
  );
  const mensal = plano === PLANO.MENSAL;

  return (
    <Cartao
      icone={Calculator}
      titulo="Simular uma turma"
      subtitulo="Mexa nos controles: o número é o que a régua de verdade cobraria."
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="eco-criancas" className="flex items-center justify-between text-sm text-text">
            <span>Crianças na turma</span>
            <span className="font-semibold">{criancas}</span>
          </label>
          <input
            id="eco-criancas"
            type="range"
            min={1}
            max={80}
            value={criancas}
            onChange={(e) => setCriancas(Number(e.target.value))}
            className="mt-2 h-10 w-full accent-primary"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao ativo={mensal} onClick={() => setPlano(PLANO.MENSAL)}>Mensal</Botao>
          <Botao ativo={!mensal} onClick={() => setPlano(PLANO.ANUAL)}>Anual</Botao>
        </div>

        <div>
          <p className="text-xs text-textMuted">
            Desconto da escada de fechamento{!mensal && ' (só vale no mensal)'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEGRAUS_DA_ESCADA.map((f) => (
              <Botao
                key={f}
                ativo={mensal && escada === f}
                desligado={!mensal}
                onClick={() => setEscada(f)}
              >
                {f === 0 ? 'Sem' : pct(f)}
              </Botao>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="eco-mensalidade" className="text-xs text-textMuted">
            Mensalidade média por criança (R$)
          </label>
          <input
            id="eco-mensalidade"
            type="number"
            inputMode="decimal"
            min={0}
            value={mensalidade}
            onChange={(e) => setMensalidade(e.target.value)}
            className="mt-1 block min-h-[40px] w-full max-w-[10rem] rounded-xl border border-border bg-card px-3 text-sm text-text"
          />
        </div>

        {r && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Numero rotulo="Fatura do mês" valor={brl(r.liquido)} destaque />
              <Numero rotulo="Por criança" valor={brl(r.porCrianca)} />
              <Numero
                rotulo="Outro app, plano mensal"
                valor={brl(r.mercado)}
              />
              <Numero
                rotulo="Peso na receita do tio"
                valor={r.peso === null ? '—' : pct(r.peso)}
              />
            </div>

            <ul className="space-y-1 text-xs text-textMuted">
              <li>
                Tabela antes do desconto: {brl(r.bruto)}
                {r.desconto > 0 && ` · desconto de ${pct(r.desconto)}`}.
              </li>
              <li>
                O outro app cobra {brl(PRECO_DO_CONCORRENTE.porCrianca)} por criança no mensal
                (referência {PRECO_DO_CONCORRENTE.referencia}); a diferença nesta turma é de{' '}
                {brl(r.diferencaParaOMercado)} por mês.
              </li>
            </ul>

            {r.pisoAplicado && (
              <p className="rounded-xl bg-warningChip p-3 text-xs text-warningText">
                O piso de {brl(PISO_DA_FATURA)} segurou o desconto: ele comeria mais{' '}
                {brl(r.descontoAbsorvido)} da fatura. O motorista paga o piso, e a tela dele precisa
                dizer isso.
              </p>
            )}
          </>
        )}
      </div>
    </Cartao>
  );
}

function TabelaDeTamanhos() {
  const linhas = useMemo(() => tabelaPorTamanho(), []);
  return (
    <Cartao
      icone={Layers}
      titulo="Preço por tamanho de turma"
      subtitulo="Tabela cheia, antes de qualquer desconto."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-textMuted">
              <th className="py-2 pr-3 font-medium">Crianças</th>
              <th className="py-2 pr-3 font-medium">Mensal</th>
              <th className="py-2 pr-3 font-medium">Por criança</th>
              <th className="py-2 pr-3 font-medium">Anual</th>
              <th className="py-2 font-medium">Por criança</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.criancas} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 font-semibold text-text">{l.criancas}</td>
                <td className="py-2 pr-3 text-text">{brl(l.mensal)}</td>
                <td className="py-2 pr-3 text-textMuted">{brl(l.mensalPorCrianca)}</td>
                <td className="py-2 pr-3 text-text">{brl(l.anual)}</td>
                <td className="py-2 text-textMuted">{brl(l.anualPorCrianca)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function BaseHoje() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;
    getRetratoDaBase()
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setDados(false));
    return () => {
      vivo = false;
    };
  }, []);

  const faixas = useMemo(() => (dados ? agruparPorFaixa(dados.assinantes) : []), [dados]);
  const total = useMemo(
    () =>
      faixas.reduce(
        (t, f) => ({
          motoristas: t.motoristas + f.motoristas,
          criancas: t.criancas + f.criancas,
          pagaria: t.pagaria + f.pagaria,
        }),
        { motoristas: 0, criancas: 0, pagaria: 0 }
      ),
    [faixas]
  );

  return (
    <Cartao
      icone={Users}
      titulo="Onde a base está hoje"
      subtitulo="Motoristas com turma cadastrada, por tamanho. O que cada faixa pagaria vale para o mês, com a cobrança ligada."
    >
      {dados === null && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {dados === false && (
        <p className="rounded-xl bg-dangerChip p-3 text-xs text-dangerText">
          Não deu para carregar a base agora.
        </p>
      )}
      {dados && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-textMuted">
                <th className="py-2 pr-3 font-medium">Faixa</th>
                <th className="py-2 pr-3 font-medium">Motoristas</th>
                <th className="py-2 pr-3 font-medium">Crianças</th>
                <th className="py-2 font-medium">Pagariam</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f) => (
                <tr key={f.id} className="border-b border-border">
                  <td className="py-2 pr-3 text-text">{f.rotulo}</td>
                  <td className="py-2 pr-3 text-text">{f.motoristas}</td>
                  <td className="py-2 pr-3 text-text">{f.criancas}</td>
                  <td className="py-2 text-text">{brl(f.pagaria)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-semibold text-text">Total</td>
                <td className="py-2 pr-3 font-semibold text-text">{total.motoristas}</td>
                <td className="py-2 pr-3 font-semibold text-text">{total.criancas}</td>
                <td className="py-2 font-semibold text-text">{brl(total.pagaria)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

export default function EconomiaTab() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Economia</h1>
        <p className="mt-1 text-sm text-textMuted">
          Como o preço por criança funciona, e quanto cada turma paga.
        </p>
      </div>
      <Regua />
      <Simulador />
      <TabelaDeTamanhos />
      <BaseHoje />
    </div>
  );
}
