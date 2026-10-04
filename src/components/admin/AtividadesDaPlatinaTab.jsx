import { useEffect, useState } from 'react';
import { CalendarClock, Gem, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmDialog from '../common/ConfirmDialog';
import {
  LIMITES_DA_ATIVIDADE,
  encerrarAtividade,
  lancarAtividade,
  watchTodasAtividades,
} from '../../services/atividadesDaPlatinaService';
import {
  CATALOGO_PLATINA,
  PRAZO_DA_ATIVIDADE_DIAS,
  diasRestantes,
  paraData,
  prazoDaAtividade,
} from '../../dominio/identidade/nivel.js';
import { formatDate } from '../../compartilhado/formatters';

/**
 * AS ATIVIDADES DE PLATINA, DO LADO DO DONO (docs/niveis.md, seção 5).
 *
 * ── NÃO HÁ CAMPO DE "CONDIÇÃO", E É ISSO QUE GUARDA A REGRA 4
 * A atividade nunca pode exigir pagar, contratar, indicar colega, meta de
 * adesão das famílias, nada dirigindo, nem dado de saúde. Em vez de confiar
 * que o dono lembre disso a cada lançamento, a tela não oferece como escrever
 * a condição: a verificação é escolhida SÓ entre as chaves de
 * `CATALOGO_PLATINA`, e nenhuma delas lê plano, fatura ou família. Título e
 * descrição são só texto de tela — não decidem nada.
 *
 * ── NO MÁXIMO UMA POR MÊS, E A TELA AVISA ANTES
 * Se já houver atividade lançada no mês corrente (de Brasília), o botão pede
 * confirmação dizendo isso. Não recusa: o dono pode ter encerrado uma lançada
 * por engano. Mas o normal é uma.
 *
 * ── O PRAZO É A RÉGUA, NÃO A TELA
 * 30 dias contados de `lancadaEm`, pausando nas férias — calculado aqui por
 * `prazoDaAtividade`/`diasRestantes`, as mesmas funções que decidem o nível.
 */

const FUSO_MS = 3 * 60 * 60 * 1000;

/** 'AAAA-MM' em Brasília — o mesmo dia civil que a régua usa. */
function mesDeBrasilia(v) {
  const d = paraData(v);
  if (!d) return null;
  return new Date(d.getTime() - FUSO_MS).toISOString().slice(0, 7);
}

const CHAVES = Object.keys(CATALOGO_PLATINA);

export default function AtividadesDaPlatinaTab() {
  const [lista, setLista] = useState(null);
  const [verificacao, setVerificacao] = useState(CHAVES[0]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [lancando, setLancando] = useState(false);
  const [confirmarLancar, setConfirmarLancar] = useState(false);
  const [paraEncerrar, setParaEncerrar] = useState(null);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(
    () => watchTodasAtividades(setLista, () => setLista(false)),
    []
  );

  const agora = new Date();
  const mesCorrente = mesDeBrasilia(agora);
  const doMes = Array.isArray(lista)
    ? lista.filter((a) => mesDeBrasilia(a.lancadaEm) === mesCorrente)
    : [];

  const lancar = async () => {
    setLancando(true);
    try {
      await lancarAtividade({ titulo, descricao, verificacao });
      toast.success('Atividade lançada.');
      setTitulo('');
      setDescricao('');
      setConfirmarLancar(false);
    } catch {
      toast.error('Não deu pra lançar. Tente de novo.');
    } finally {
      setLancando(false);
    }
  };

  const encerrar = async () => {
    if (!paraEncerrar) return;
    setEncerrando(true);
    try {
      await encerrarAtividade(paraEncerrar.id);
      toast.success('Atividade encerrada.');
      setParaEncerrar(null);
    } catch {
      toast.error('Não deu pra encerrar. Tente de novo.');
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {/* ── LANÇAR ───────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="rotulo">platina</p>
          <h2 className="mt-1 font-display text-lg font-extrabold text-text">
            Lançar atividade do mês
          </h2>
        </div>

        <div className="space-y-2 rounded-xl bg-neutro p-3 text-xs text-textMuted">
          <p className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong className="text-text">No máximo uma por mês.</strong> O
              motorista tem {PRAZO_DA_ATIVIDADE_DIAS} dias para fazer, e o prazo
              PARA nas férias (julho, e de 15/12 a 31/01).
            </span>
          </p>
          <p className="flex gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              O que o app confere é sempre uma das opções abaixo. Nenhuma pede
              pagar, contratar, indicar, meta de família, nada dirigindo ou
              dado de saúde.
            </span>
          </p>
        </div>

        {doMes.length > 0 && (
          <p className="rounded-xl border border-warningBorder bg-warningSoft p-3 text-xs text-warningText">
            Já há {doMes.length === 1 ? 'uma atividade lançada' : `${doMes.length} atividades lançadas`}{' '}
            neste mês ({doMes.map((a) => a.titulo).join(', ')}). Lançar outra vai
            pedir confirmação.
          </p>
        )}

        <div>
          <label
            htmlFor="platina-verificacao"
            className="mb-2 block text-sm font-semibold text-text"
          >
            O que o app confere
          </label>
          <select
            id="platina-verificacao"
            value={verificacao}
            onChange={(e) => setVerificacao(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {CHAVES.map((k) => (
              <option key={k} value={k}>
                {CATALOGO_PLATINA[k].titulo}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Título (curto)"
          hint={`Até ${LIMITES_DA_ATIVIDADE.TITULO_MAX} letras. Vazio, vale o nome da opção acima.`}
          value={titulo}
          maxLength={LIMITES_DA_ATIVIDADE.TITULO_MAX}
          onChange={(e) => setTitulo(e.target.value)}
          avancar={false}
        />
        <Input
          label="Descrição (uma frase)"
          hint={`Até ${LIMITES_DA_ATIVIDADE.DESCRICAO_MAX} letras.`}
          value={descricao}
          maxLength={LIMITES_DA_ATIVIDADE.DESCRICAO_MAX}
          onChange={(e) => setDescricao(e.target.value)}
          avancar={false}
        />

        <Button
          icon={Gem}
          loading={lancando && !confirmarLancar}
          onClick={() => (doMes.length > 0 ? setConfirmarLancar(true) : lancar())}
        >
          Lançar atividade
        </Button>
      </section>

      {/* ── LISTA ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        {lista === false && (
          <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
            Não deu pra carregar as atividades.
          </p>
        )}
        {lista === null && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {Array.isArray(lista) && lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Gem size={22} className="mx-auto text-textMuted" />
            <p className="mt-2 text-xs text-textMuted">
              Nenhuma atividade lançada ainda. Sem atividade, ninguém chega à
              Platina.
            </p>
          </div>
        )}
        {Array.isArray(lista) && lista.length > 0 && (
          <>
            <p className="text-xs text-textMuted">
              {lista.length} {lista.length === 1 ? 'atividade' : 'atividades'} ·{' '}
              <strong className="text-primary">
                {lista.filter((a) => a.ativa !== false).length}
              </strong>{' '}
              ativa{lista.filter((a) => a.ativa !== false).length === 1 ? '' : 's'}
            </p>
            <ul className="space-y-1.5">
              {lista.map((a) => {
                const ativa = a.ativa !== false;
                const conhecida = !!CATALOGO_PLATINA[a.verificacao];
                const prazo = prazoDaAtividade(a.lancadaEm);
                const vencido = prazo && agora.getTime() >= prazo.getTime();
                const restam = diasRestantes(a.lancadaEm, agora);
                return (
                  <li key={a.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold text-text">{a.titulo || '—'}</span>
                      <span
                        className={`rotulo shrink-0 rounded-lg px-1.5 py-0.5 ${
                          ativa ? 'bg-primarySoft text-primary' : 'bg-neutro text-textMuted'
                        }`}
                      >
                        {ativa ? 'ativa' : 'encerrada'}
                      </span>
                    </div>
                    {a.descricao && <p className="mt-0.5 text-textMuted">{a.descricao}</p>}
                    <p className="mt-1 text-textMuted">
                      <code className="text-text">{a.verificacao}</code>
                      {conhecida ? '' : ' · fora do catálogo (a régua ignora)'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-textMuted">
                      <CalendarClock size={13} className="shrink-0" />
                      Lançada em {formatDate(paraData(a.lancadaEm))} · prazo{' '}
                      {prazo ? formatDate(new Date(prazo.getTime() - 1)) : '—'}
                      {ativa && prazo && (vencido ? ' · vencido' : ` · faltam ${restam} dias`)}
                    </p>
                    {ativa && (
                      <div className="mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          fullWidth={false}
                          onClick={() => setParaEncerrar(a)}
                        >
                          Encerrar
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmarLancar}
        title="Lançar uma segunda atividade este mês?"
        description="A regra é no máximo uma por mês. Lance outra só se a deste mês foi um engano — cada atividade a mais é mais uma coisa que o motorista precisa fazer para continuar na Platina."
        confirmLabel="Lançar mesmo assim"
        loading={lancando}
        onConfirm={lancar}
        onCancel={() => setConfirmarLancar(false)}
      />
      <ConfirmDialog
        open={!!paraEncerrar}
        title={`Encerrar "${paraEncerrar?.titulo || ''}"?`}
        description="Ela sai da tela dos motoristas e deixa de contar para a Platina — inclusive para quem já fez. Não dá para reabrir; seria preciso lançar de novo."
        confirmLabel="Encerrar atividade"
        variant="danger"
        loading={encerrando}
        onConfirm={encerrar}
        onCancel={() => setParaEncerrar(null)}
      />
    </div>
  );
}
