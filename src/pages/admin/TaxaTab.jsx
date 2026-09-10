import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Key, Save, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { PIX_KEY_TYPES, listarParceiros } from '../../services/userService';
import {
  addMonths,
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../../compartilhado/formatters';
import {
  PADRAO,
  fecharFatura,
  marcarFaturaPaga,
  setCondicaoFundador,
  setDiaVencimento,
  setPixPlataforma,
  setPlanoDoParceiro,
  watchFaturasDoMes,
  watchTaxaConfig,
} from '../../services/taxaService';
import {
  FUNDADOR,
    PLANO,
  PLANOS_DISPONIVEIS,
  TAXA,
  planoValido,
  precoDoMes,
} from '../../dominio/associacao/planos.js';

/**
 * A TAXA DE ASSOCIAÇÃO no painel do dono.
 *
 * COMPONENTE SOLTO DE PROPÓSITO
 * Ele não sabe que existe aba, header ou navegação — quem costura é o
 * `AdminPanel`. Duas sessões estavam escrevendo no painel ao mesmo tempo, e um
 * componente que só recebe e devolve pode ser plugado onde a outra decidir.
 *
 * ── ESTA TELA ENCOLHEU DE 930 PARA MENOS DE 400 LINHAS EM 06/09/2026
 * Ela era uma mesa de negociação: percentual × valor fixo × gratuito, piso,
 * periodicidade (mensal / semestral / anual / anual em 12×), carência em meses,
 * desconto de antecipação — e, ao lado de tudo isso, o "padrão calculado" para
 * comparar com o negociado, mais o percentual efetivo para poder comparar
 * parceiros entre si.
 *
 * Nada disso existe. O preço é de tabela, e o que o dono faz aqui é: escolher a
 * FAIXA de cada parceiro, marcar quem é fundador, e fechar o mês.
 *
 * O que sumiu junto foi a pergunta "quanto este parceiro deveria pagar?" — ela
 * era necessária porque cada acordo era único, e era ela que puxava a soma das
 * mensalidades de toda a plataforma para dentro desta tela.
 */
export default function TaxaTab() {
  const { user } = useAuth();
  const [mes, setMes] = useState(getCurrentMonthKey());

  const [config, setConfig] = useState(PADRAO);
  const [motoristas, setMotoristas] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [fechando, setFechando] = useState(false);

  // A régua é reativa: o dono muda e vê o efeito na mesma tela.
  useEffect(() => watchTaxaConfig(setConfig), []);
  useEffect(() => watchFaturasDoMes(mes, setFaturas), [mes]);

  const carregar = useCallback(() => {
    listarParceiros().then(({ lista, falhou }) => {
      if (falhou) toast.error('Não deu pra listar os parceiros.');
      setMotoristas(lista);
    });
  }, []);
  useEffect(carregar, [carregar]);

  const porUid = useMemo(() => {
    const m = {};
    faturas.forEach((f) => {
      m[f.tioUid] = f;
    });
    return m;
  }, [faturas]);

  // A LINHA DE CADA PARCEIRO — a conta inteira, aberta.
  //
  // Ela é calculada aqui e não no service porque é a MESMA conta que o fechamento
  // vai gravar: o dono precisa ver antes de lançar o que vai ser lançado. Se as
  // duas fossem calculadas em lugares diferentes, a tela mostraria uma coisa e a
  // fatura registraria outra — e o parceiro receberia a segunda.
  const linhas = useMemo(() => {
    if (!motoristas) return null;
    return motoristas.map((mot) => {
      const ativas = Number(mot.criancasAtivas) || 0;
      const plano = planoValido(mot.plano) ? mot.plano : null;
      const conta = precoDoMes({
        criancas: ativas,
        plano: plano || PLANO.MENSAL,
        fundador: mot.condicaoFundador || null,
        indicacoesAtivas: Number(mot.indicacoesAtivas) || 0,
        descontos: mot.descontos,
        mes,
      });
      return {
        mot,
        ativas,
        plano,
        conta,
        fatura: porUid[mot.uid] || null,
      };
    });
  }, [motoristas, porUid, mes]);

  const fecharTodas = async () => {
    if (!linhas) return;
    // SÓ QUEM AINDA NÃO TEM FATURA DESTE MÊS. O id é `{uid}_{mes}`, então
    // refechar sobrescreveria uma fatura já paga com uma nova em aberto — e o
    // motorista voltaria a dever um mês que ele quitou.
    const pendentes = linhas.filter((l) => !l.fatura && l.plano);
    if (!pendentes.length) {
      toast('Nada a fechar neste mês.');
      return;
    }
    setFechando(true);
    let ok = 0;
    for (const l of pendentes) {
      try {
        await fecharFatura({ motorista: l.mot, mes, config, ownerUid: user?.uid });
        ok += 1;
      } catch (err) {
        toast.error(`${l.mot.name || l.mot.uid}: ${err.message}`);
      }
    }
    setFechando(false);
    if (ok) toast.success(`${ok} fatura${ok > 1 ? 's' : ''} fechada${ok > 1 ? 's' : ''}.`);
  };

  const semPlano = linhas ? linhas.filter((l) => !l.plano).length : 0;

  return (
    <div className="space-y-5">
      {/* A `key` REMONTA o formulário quando a régua muda no banco.
        * É o jeito que o React recomenda para "reiniciar o estado quando uma
        * prop muda" — a alternativa, sincronizar por efeito, faz o formulário
        * apagar o que a pessoa está digitando num render seguinte, e o lint
        * recusa por isso. */}
      <ConfigDaCasa key={config.atualizadoEm?.seconds ?? 'inicial'} config={config} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-textMuted">
            <Users size={12} />
            Parceiros
          </h2>
          <SeletorDeMes mes={mes} onChange={setMes} />
        </div>

        {/* PARCEIRO SEM PLANO NÃO É DETALHE, É FATURA QUE NÃO SAI. Dizer em voz
          * alta evita o fechamento silencioso que cobra de nove e esquece um. */}
        {semPlano > 0 && (
          <p className="rounded-xl bg-warningSoft p-3 text-xs leading-relaxed text-warningText">
            <strong>
              {semPlano} parceiro{semPlano > 1 ? 's' : ''} sem plano definido.
            </strong>{' '}
            Enquanto o plano não for escolhido, o mês dele não fecha e ele não
            recebe fatura.
          </p>
        )}

        {linhas === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !linhas.length ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-xs text-textMuted">
            Nenhum motorista ainda.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {linhas.map((l) => (
                <LinhaDoParceiro
                  key={l.mot.uid}
                  linha={l}
                  mes={mes}
                  config={config}
                  ownerUid={user?.uid}
                  onMudou={carregar}
                />
              ))}
            </div>

            <Button
              onClick={fecharTodas}
              disabled={fechando}
              className="w-full"
            >
              {fechando ? 'Fechando…' : `Fechar ${formatMonthLabel(mes)}`}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

/* ─────────────── a régua da casa ─────────────── */

/**
 * Para onde o motorista paga, e em que dia.
 *
 * O QUE SAIU DAQUI: `percentual` e `piso`. Eram a régua do modelo negociado, e
 * um percentual sobrando na tela é o convite para alguém somá-lo ao preço de
 * tabela — e cobrar duas vezes o mesmo mês.
 */
function ConfigDaCasa({ config }) {
  const [pixKey, setPixKey] = useState(config.pixKey || '');
  const [pixKeyType, setPixKeyType] = useState(config.pixKeyType || 'random');
  const [nome, setNome] = useState(config.nomePlataforma || '');
  const [cidade, setCidade] = useState(config.cidadePlataforma || '');
  const [dia, setDia] = useState(config.diaVencimento ?? PADRAO.diaVencimento);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await setPixPlataforma({ pixKey, pixKeyType, nome, cidade });
      await setDiaVencimento(dia);
      toast.success('Régua da casa atualizada.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-textMuted">
        <Key size={12} />
        A régua da casa
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-text">Chave PIX da plataforma</span>
          <input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text"
            placeholder="a chave que aparece na fatura do parceiro"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-text">Tipo</span>
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text"
          >
            {Object.entries(PIX_KEY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label || k}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-text">Nome do recebedor</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-text">Cidade</span>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-bold text-text">Dia do vencimento</span>
          <input
            type="number"
            min={1}
            max={28}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs tabular-nums text-text"
          />
          {/* O teto de 28 não é preferência: dia 30 não existe em todo mês, e
            * "o último dia" muda de número quatro vezes por ano. */}
          <span className="mt-1 block leading-tight text-textMuted">
            Vale para todos os parceiros. Máximo 28 — fevereiro não tem 30.
          </span>
        </label>
      </div>

      <Button onClick={salvar} disabled={salvando} variant="secondary" className="w-full sm:w-auto">
        <Save size={14} />
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
    </section>
  );
}

/* ─────────────── um parceiro ─────────────── */

function LinhaDoParceiro({ linha, mes, config, ownerUid, onMudou }) {
  const { mot, ativas, plano, conta, fatura } = linha;
  const [salvando, setSalvando] = useState(false);

  const trocarPlano = async (novo) => {
    setSalvando(true);
    try {
      await setPlanoDoParceiro(mot.uid, novo || null);
      toast.success('Plano atualizado.');
      onMudou();
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const trocarFundador = async (condicao) => {
    setSalvando(true);
    try {
      await setCondicaoFundador(mot.uid, condicao || null);
      toast.success('Condição atualizada.');
      onMudou();
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const fechar = async () => {
    setSalvando(true);
    try {
      await fecharFatura({ motorista: mot, mes, config, ownerUid });
      toast.success('Fatura fechada.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra fechar.');
    } finally {
      setSalvando(false);
    }
  };

  const darBaixa = async () => {
    setSalvando(true);
    try {
      await marcarFaturaPaga(mot.uid, mes, ownerUid);
      toast.success('Baixa dada. A conta dele está paga até o fim do mês que vem.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra dar baixa.');
    } finally {
      setSalvando(false);
    }
  };

  // A faixa contratada é menor do que a operação dele pede. Não é erro: ele
  // PODE escolher menos do que usa. É conversa — ou sobe de faixa, ou aponta
  // quais crianças saem. O app nunca escolhe por ele.


  return (
    <article className="rounded-2xl border border-border bg-card p-4 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-text">{mot.name || mot.uid}</p>
        <p className="tabular-nums text-textMuted">
          {ativas} criança{ativas === 1 ? '' : 's'} ativa{ativas === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-bold text-text">Plano contratado</span>
          <select
            value={plano || ''}
            onChange={(e) => trocarPlano(e.target.value)}
            disabled={salvando}
            className="h-9 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text"
          >
            <option value="">— sem plano —</option>
            {PLANOS_DISPONIVEIS.map((p) => (
              <option key={p} value={p}>
                {p === PLANO.ANUAL ? 'Anual' : 'Mensal'} · {formatCurrency(TAXA[p])}/criança
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-text">Condição de fundador</span>
          <select
            value={mot.condicaoFundador || ''}
            onChange={(e) => trocarFundador(e.target.value)}
            disabled={salvando}
            className="h-9 w-full rounded-xl border border-border bg-surface px-2 text-xs text-text"
          >
            <option value="">— nenhuma —</option>
            <option value={FUNDADOR.VITALICIO}>Vitalício (não paga)</option>
            <option value={FUNDADOR.METADE}>Metade</option>
          </select>
        </label>
      </div>

      {/* O QUE O GATEWAY DISSE POR ÚLTIMO SOBRE ESTA FATURA.
        *
        * ⚠️ `asaasUltimoEvento` E `asaasUltimoMotivo` ERAM GRAVADOS SEM
        * LEITOR. O webhook os escreve justamente nos casos em que alguém
        * precisa entender por que a fatura mudou sozinha — estorno,
        * chargeback, cobrança apagada no painel do Asaas — e a tela do dono
        * mostrava só o status final. A fatura reabria e o motivo ficava no
        * banco.
        *
        * Some quando não há cobrança no gateway, que é o estado de hoje. */}
      {fatura?.asaasUltimoEvento && (
        <p className="mt-3 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-textMuted">
          gateway: {fatura.asaasUltimoEvento}
          {fatura.asaasUltimoMotivo ? ` · ${fatura.asaasUltimoMotivo}` : ''}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-3 border-t border-border pt-3">
        <div className="flex-1">
          {conta.liquido === null ? (
            <p className="text-textMuted">Plano desconhecido — corrija acima.</p>
          ) : (
            <p className="tabular-nums">
              <span className="text-base font-extrabold text-text">
                {formatCurrency(conta.liquido)}
              </span>
              {conta.desconto > 0 && (
                <span className="ml-2 text-textMuted">
                  <s>{formatCurrency(conta.bruto)}</s> · −{Math.round(conta.desconto * 100)}%
                </span>
              )}
            </p>
          )}
        </div>

        {fatura ? (
          fatura.status === 'quitada' ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primarySoft px-2 py-1 font-bold text-primary">
              <Check size={12} />
              paga
            </span>
          ) : (
            <button
              type="button"
              onClick={darBaixa}
              disabled={salvando}
              className="tap h-9 rounded-xl bg-primary px-3 font-bold text-white"
            >
              Dar baixa
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={fechar}
            disabled={salvando || !plano}
            className="tap h-9 rounded-xl border border-border px-3 font-bold text-text disabled:opacity-40"
          >
            Fechar o mês
          </button>
        )}
      </div>
    </article>
  );
}

/* ─────────────── peças ─────────────── */

function SeletorDeMes({ mes, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-1">
      <button
        type="button"
        onClick={() => onChange(addMonths(mes, -1))}
        className="tap h-8 w-8 text-textMuted"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={14} className="mx-auto" />
      </button>
      <span className="min-w-[7rem] text-center text-xs font-bold tabular-nums text-text">
        {formatMonthLabel(mes)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(mes, 1))}
        className="tap h-8 w-8 text-textMuted"
        aria-label="Próximo mês"
      >
        <ChevronRight size={14} className="mx-auto" />
      </button>
    </div>
  );
}
