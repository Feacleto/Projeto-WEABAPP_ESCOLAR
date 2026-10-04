import { useState } from 'react';
import { Bus, Info, Wrench } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import AnotarGuardadoSheet from '../../components/financeiro/AnotarGuardadoSheet';
import PlanoDaTrocaSheet from '../../components/financeiro/PlanoDaTrocaSheet';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import {
  mediaDeManutencao,
  metaDaTroca,
  planoValido,
  porMesParaTroca,
  progresso,
  rotuloDoFim,
} from '../../dominio/cobranca/reservaDaPerua.js';
import { paraData } from '../../dominio/cobranca/historicoDeDespesas.js';

/**
 * RESERVA DA PERUA — /tio/finance/reserva (03/10/2026, maquete aprovada,
 * tela 5). Fica atrás da senha do Financeiro sozinha: mora embaixo de
 * `/tio/finance`, e quem decide a tranca é o CAMINHO.
 *
 * Duas caixinhas com a mesma forma: juntar para TROCAR a perua e juntar para
 * a MANUTENÇÃO. Só o ícone e o título mudam, e ele aprende a tela uma vez.
 *
 * ⚠️ O APP NÃO GUARDA DINHEIRO, E A TELA PRECISA DIZER ISSO ANTES DE QUALQUER
 * NÚMERO. O valor de cada caixinha é o que ELE anotou, lido do banco dele,
 * com a data em que anotou ("Anotado por você em 01/10"). O app não soma nada
 * sozinho, não lembra "você não guardou este mês" (separar é escolha dele) e
 * não mostra agência, conta nem chave PIX. As palavras são "anotou",
 * "guardado" e "atualizar"; as do vocabulário de conta bancária ficam de fora,
 * e `npm run testar:perua` varre este arquivo atrás delas.
 *
 * ⚠️ NENHUM NÚMERO INVENTADO. Sem plano, a caixinha da troca pede o plano em
 * vez de mostrar meta zero; sem manutenção lançada, a outra diz de onde o
 * valor vai sair em vez de sugerir um.
 */

const reais = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function diaEMes(em) {
  const d = paraData(em);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TioReserva() {
  const config = useConfigDoFinanceiro();
  const { despesas, carregando } = useDespesasDosUltimosMeses(12);
  const { visiveis } = useValoresVisiveis();
  const [anotando, setAnotando] = useState(null); // 'troca' | 'manutencao' | null
  const [planejando, setPlanejando] = useState(false);

  const dinheiro = (v) => (visiveis ? reais(v) : VALOR_ESCONDIDO);

  const plano = config?.planoDaTroca || null;
  const temPlano = planoValido(plano);
  const guardado = config?.guardado || {};
  const manutencao = carregando ? null : mediaDeManutencao(despesas);

  return (
    <div className="pb-28">
      <Header title="Reserva da perua" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        {/* O aviso vem antes de qualquer número, no topo esquerdo. */}
        <div className="flex gap-3 rounded-2xl border-2 border-infoBorder bg-infoSoft p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-infoChip text-infoText">
            <Info size={22} aria-hidden />
          </span>
          <p className="text-base leading-snug text-textBody">
            <b className="text-text">O app não guarda dinheiro.</b> Separe esse valor numa reserva do
            seu banco (poupança ou caixinha) e anote aqui quanto tem nela, para acompanhar.
          </p>
        </div>

        {config === null ? (
          <>
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
          </>
        ) : (
          <>
            {/* ── Para trocar a perua ── */}
            <Caixinha
              icon={Bus}
              titulo="Para trocar a perua"
              detalhe={temPlano ? [`Em ${plano.anos} ${plano.anos === 1 ? 'ano' : 'anos'}`, rotuloDoFim(plano)].filter(Boolean).join(' · ') : null}
            >
              {temPlano ? (
                <CaixaDaTroca
                  plano={plano}
                  anotado={guardado.troca}
                  dinheiro={dinheiro}
                  onAtualizar={() => setAnotando('troca')}
                  onMudarPlano={() => setPlanejando(true)}
                />
              ) : (
                <>
                  <p className="text-base leading-snug text-textBody">
                    Diga quanto a perua vale hoje, quando quer trocar e quanto ela vai valer na troca.
                    O app mostra quanto separar por mês.
                  </p>
                  <BotaoCheio onClick={() => setPlanejando(true)}>Fazer o plano da troca</BotaoCheio>
                </>
              )}
            </Caixinha>

            {/* ── Para manutenção ── */}
            <Caixinha icon={Wrench} titulo="Para manutenção" detalhe="Pneu, freio, revisão">
              <Anotado anotado={guardado.manutencao} dinheiro={dinheiro} />
              {carregando ? (
                <Skeleton className="h-12 rounded-xl" />
              ) : manutencao ? (
                <Linha
                  rotulo="Separar por mês"
                  apoio={`Sua média de manutenção em ${manutencao.meses} ${manutencao.meses === 1 ? 'mês' : 'meses'}`}
                  valor={dinheiro(manutencao.porMes)}
                />
              ) : (
                <p className="text-base leading-snug text-textMuted">
                  Quanto separar por mês vem da manutenção que você lançar nas despesas.
                </p>
              )}
              <DataDaAnotacao anotado={guardado.manutencao} />
              <BotaoContorno onClick={() => setAnotando('manutencao')}>
                Atualizar o que tenho guardado
              </BotaoContorno>
            </Caixinha>
          </>
        )}
      </div>

      <AnotarGuardadoSheet
        open={anotando !== null}
        onClose={() => setAnotando(null)}
        caixa={anotando}
        valorAtual={anotando ? numeroOuNulo(guardado[anotando]?.valor) : null}
      />
      <PlanoDaTrocaSheet
        open={planejando}
        onClose={() => setPlanejando(false)}
        planoAtual={temPlano ? plano : null}
      />
    </div>
  );
}

const numeroOuNulo = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function CaixaDaTroca({ plano, anotado, dinheiro, onAtualizar, onMudarPlano }) {
  const meta = metaDaTroca(plano);
  const valor = numeroOuNulo(anotado?.valor);
  const fracao = progresso(valor ?? 0, meta) ?? 0;
  const faltam = Math.max(0, meta - (valor ?? 0));

  return (
    <>
      <Anotado anotado={anotado} dinheiro={dinheiro} />
      <div
        className="h-3 overflow-hidden rounded-full bg-neutro"
        role="progressbar"
        aria-label="Quanto do caminho já foi anotado"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fracao * 100)}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${fracao * 100}%` }} />
      </div>
      <Linha rotulo={`Faltam para a meta de ${dinheiro(meta)}`} valor={dinheiro(faltam)} />
      <Linha rotulo="Separar por mês" valor={dinheiro(porMesParaTroca(plano))} />
      <DataDaAnotacao anotado={anotado} />
      <BotaoContorno onClick={onAtualizar}>Atualizar o que tenho guardado</BotaoContorno>
      <button
        type="button"
        onClick={onMudarPlano}
        className="tap -ml-2 flex min-h-12 items-center self-start px-2 text-base font-bold text-primary"
      >
        Mudar o plano da troca
      </button>
    </>
  );
}

function Caixinha({ icon: Icon, titulo, detalhe, children }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-rest">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <Icon size={22} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-tight text-text">{titulo}</span>
          {detalhe && <span className="block text-sm text-textMuted">{detalhe}</span>}
        </span>
      </div>
      {children}
    </section>
  );
}

/** "Você anotou que tem guardado" e o número — ou que nada foi anotado. */
function Anotado({ anotado, dinheiro }) {
  const valor = numeroOuNulo(anotado?.valor);
  if (valor === null) {
    return <p className="text-base text-textMuted">Você ainda não anotou quanto tem guardado.</p>;
  }
  return (
    <div className="flex flex-col">
      <span className="text-sm text-textMuted">Você anotou que tem guardado</span>
      <b className="font-display text-3xl font-extrabold tabular-nums text-text">{dinheiro(valor)}</b>
    </div>
  );
}

function DataDaAnotacao({ anotado }) {
  const dia = diaEMes(anotado?.em);
  if (!dia) return null;
  return <p className="text-sm text-textMuted">Anotado por você em {dia}</p>;
}

function Linha({ rotulo, apoio, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-neutro pt-3">
      <span className="min-w-0 text-base text-textBody">
        {rotulo}
        {apoio && <span className="block text-sm text-textMuted">{apoio}</span>}
      </span>
      <span className="shrink-0 text-lg font-bold tabular-nums text-text">{valor}</span>
    </div>
  );
}

function BotaoContorno({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-text"
    >
      {children}
    </button>
  );
}

function BotaoCheio({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-white"
    >
      {children}
    </button>
  );
}
