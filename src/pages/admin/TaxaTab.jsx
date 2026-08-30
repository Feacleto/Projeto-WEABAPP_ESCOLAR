import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarParceiros } from '../../services/userService';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Key,
  Percent,
  Save,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { PIX_KEY_TYPES } from '../../services/userService';
import {
  addMonths,
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
} from '../../utils/formatters';
import {
  MODOS,
  PADRAO,
  calcularTaxa,
  carregarBasePorMotorista,
  fecharFatura,
  isentoEm,
  marcarFaturaPaga,
  setNegociacao,
  setPixPlataforma,
  setTaxaConfig,
  watchFaturasDoMes,
  watchNegociacoes,
  watchTaxaConfig,
} from '../../services/taxaService';
import {
  diasParaVencer,
  precisaRenovar,
  watchContratos,
} from '../../services/contratoAssociacaoService';

/**
 * A TAXA DE ASSOCIAÇÃO no painel do dono.
 *
 * COMPONENTE SOLTO DE PROPÓSITO
 * Ele não sabe que existe aba, header ou navegação — quem costura é o
 * `AdminPanel`. Duas sessões estavam escrevendo no painel ao mesmo tempo, e a
 * casca é de outra; um componente que só recebe e devolve pode ser plugado
 * onde ela decidir sem ninguém reescrever o arquivo do outro.
 *
 * O QUE ESTA TELA RESOLVE
 * A negociação é COM CADA MOTORISTA — não existe tabela de preço. Então a régua
 * da casa não é o preço: é a REFERÊNCIA. A tela mostra sempre os dois lado a
 * lado (padrão calculado × negociado) e a distância entre eles, porque negociar
 * sem saber de onde se está partindo é como se fecha um acordo ruim sem perceber.
 *
 * O PERCENTUAL EFETIVO É O QUE PERMITE COMPARAR PARCEIROS
 * R$ 90 de quem tem base de R$ 2.240 e R$ 90 de quem tem base de R$ 800 são
 * negócios diferentes. Na lista, o valor absoluto engana; o efetivo não.
 */
export default function TaxaTab() {
  const { user } = useAuth();
  const [mes, setMes] = useState(getCurrentMonthKey());

  const [config, setConfig] = useState(PADRAO);
  const [motoristas, setMotoristas] = useState(null);
  const [bases, setBases] = useState(null);
  const [semDono, setSemDono] = useState([]);
  const [negociacoes, setNegociacoes] = useState({});
  const [faturas, setFaturas] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [contratos, setContratos] = useState([]);
  const [fechando, setFechando] = useState(false);

  // Régua e negociações são reativas: o dono muda e vê o efeito na mesma tela.
  useEffect(() => watchTaxaConfig(setConfig), []);
  // Contratos, só pra saber quais estão perto de vencer.
  useEffect(() => watchContratos(setContratos, () => setContratos([])), []);
  useEffect(() => watchNegociacoes(setNegociacoes), []);
  useEffect(() => watchFaturasDoMes(mes, setFaturas), [mes]);

  // Um CONTADOR de recarga, e não uma função que grava estado: a ficha
  // incrementa ao salvar, e o efeito abaixo relê. Efeito que chama setState
  // direto no corpo encadeia render — e o eslint deste projeto recusa.
  const [recarga, setRecarga] = useState(0);
  const recarregarBases = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    // Pelo service. A mesma consulta estava escrita à mão aqui e no FunilTab,
    // com tratamento de erro divergente — e as duas telas importavam
    // `firebase/firestore` direto, fora da regra de camada.
    listarParceiros().then(({ lista, falhou }) => {
      if (!vivo) return;
      setMotoristas(lista);
      if (falhou) toast.error('Não deu pra listar os parceiros.');
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarBasePorMotorista()
      .then(({ resumos, semDono: orfas }) => {
        if (!vivo) return;
        setBases(resumos);
        setSemDono(orfas);
      })
      .catch((err) => {
        console.error(err);
        if (!vivo) return;
        setBases({});
        toast.error('Não deu pra ler a base das crianças.');
      });
    return () => {
      vivo = false;
    };
  }, [recarga]);

  const porUid = useMemo(() => {
    const m = {};
    faturas.forEach((f) => {
      m[f.tioUid] = f;
    });
    return m;
  }, [faturas]);

  const linhas = useMemo(() => {
    if (!motoristas || !bases) return null;
    return motoristas.map((mot) => {
      const resumo = bases[mot.uid] || {
        criancas: 0,
        semMensalidade: 0,
        base: 0,
        ticketMedio: 0,
        menor: 0,
        maior: 0,
      };
      const neg = negociacoes[mot.uid] || null;
      return {
        mot,
        resumo,
        neg,
        calc: calcularTaxa({ base: resumo.base, negociacao: neg, config }),
        isento: isentoEm(neg, mes),
        fatura: porUid[mot.uid] || null,
      };
    });
  }, [motoristas, bases, negociacoes, config, mes, porUid]);

  const previsto = useMemo(
    () =>
      (linhas || []).reduce((s, l) => s + (l.isento ? 0 : l.calc.cobrada), 0),
    [linhas]
  );

  const fecharMes = async () => {
    if (!linhas?.length) return;
    setFechando(true);
    try {
      for (const l of linhas) {
        await fecharFatura({
          tioUid: l.mot.uid,
          mes,
          resumo: l.resumo,
          negociacao: l.neg,
          config,
          ownerUid: user?.uid,
        });
      }
      toast.success(`${linhas.length} fatura(s) de ${formatMonthLabel(mes)}.`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não deu pra fechar o mês.');
    } finally {
      setFechando(false);
    }
  };

  return (
    <div className="space-y-4">
      <SeletorDeMes mes={mes} onChange={setMes} />

      {/* CONTRATO VENCENDO ENTRA NA FILA DO DONO — o que o serviço prometia.
        *
        * `diasParaVencer` e `precisaRenovar` existiam com a intenção escrita
        * no cabeçalho ("o que o vencimento faz é entrar na fila do dono") e
        * não chegavam em fila nenhuma: nada as chamava. Vigência vencia em
        * silêncio, e a renovação só aconteceria se alguém lembrasse.
        *
        * VENCER NÃO SUSPENDE, e o serviço é explícito nisso: cortar por
        * vencimento de papel suspenderia quem está pagando em dia. O que
        * vencido faz é aparecer aqui, ao lado da negociação, que é onde o
        * dono já está quando pensa em preço. */}
      <ContratosVencendo contratos={contratos} />

      {/* A base incompleta tem que gritar ANTES dos números, senão o dono
        * fecha o mês somando o que sobrou e a fatura sai menor que a real. */}
      {semDono.length > 0 && (
        <div className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
            <AlertTriangle size={15} className="text-warning" />
            {semDono.length} criança(s) sem motorista definido
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warningText/80">
            Elas não entram na base de ninguém, então a fatura de algum parceiro
            sai menor que o real. Rode o backfill de <code>adminUid</code> antes
            de fechar o mês.
          </p>
        </div>
      )}

      {/* A `key` faz o formulário RENASCER quando a régua muda de fora (a
        * config chega por assinatura). É o que dispensa um efeito
        * sincronizando prop em estado — e efeito assim encadeia render.
        * Digitar não muda a key: só salvar muda, e aí o valor já é o novo. */}
      <ReguaDaCasa
        key={`${config.percentual}-${config.piso}-${config.diaVencimento}`}
        config={config}
      />

      <PixDaPlataforma key={`pix-${config.pixKey}`} config={config} />

      <section>
        <Titulo icon={Users}>Parceiros em {formatMonthLabel(mes)}</Titulo>

        {linhas === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : linhas.length === 0 ? (
          <p className="px-1 text-sm text-textMuted">
            Nenhum motorista parceiro ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {linhas.map((l) => (
              <LinhaParceiro
                key={l.mot.uid}
                linha={l}
                mes={mes}
                config={config}
                expandida={aberta === l.mot.uid}
                onToggle={() =>
                  setAberta(aberta === l.mot.uid ? null : l.mot.uid)
                }
                onSalvou={recarregarBases}
                ownerUid={user?.uid}
              />
            ))}
          </div>
        )}
      </section>

      {linhas?.length > 0 && (
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-textMuted">
              previsto no mês
            </span>
            <span className="text-2xl font-bold text-text">
              {formatCurrency(previsto)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-textMuted">
            Esta é a <strong>receita da plataforma</strong> — não o GMV. O GMV é
            o dinheiro que passou entre pai e motorista, e a plataforma não toca
            nele.
          </p>
          <div className="mt-3">
            <Button loading={fechando} onClick={fecharMes} icon={Check}>
              Fechar {formatMonthLabel(mes)} — {linhas.length} fatura(s)
            </Button>
          </div>
          <p className="mt-2 text-xs text-textMuted">
            Fechar congela a régua usada em cada fatura. Renegociar depois não
            reescreve o que já foi cobrado.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────── a régua da casa ─────────────── */

/**
 * O padrão que alimenta a coluna "padrão" de todo mundo.
 *
 * Não é o preço de ninguém — é a referência contra a qual cada negociação é
 * lida. Mora aqui, editável, porque calibrar preço é decisão de calendário e
 * não de release: numa constante, mudar exigiria build e deploy, e na prática
 * isso significa que não muda.
 */
function ReguaDaCasa({ config }) {
  const [percentual, setPercentual] = useState(String(config.percentual));
  const [piso, setPiso] = useState(String(config.piso));
  const [dia, setDia] = useState(String(config.diaVencimento));
  const [salvando, setSalvando] = useState(false);

  const mudou =
    Number(percentual) !== Number(config.percentual) ||
    Number(piso) !== Number(config.piso) ||
    Number(dia) !== Number(config.diaVencimento);

  const salvar = async () => {
    setSalvando(true);
    try {
      await setTaxaConfig({ percentual, piso, diaVencimento: dia });
      toast.success('Régua atualizada.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section>
      <Titulo icon={Percent}>Régua da casa</Titulo>
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <div className="flex gap-3">
          <CampoCurto
            label="Percentual"
            sufixo="%"
            value={percentual}
            onChange={setPercentual}
          />
          <CampoCurto
            label="Piso"
            prefixo="R$"
            value={piso}
            onChange={setPiso}
          />
          <CampoCurto label="Vence dia" value={dia} onChange={setDia} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-textMuted">
          O piso não é ganância: fatura de R$ 4,50 custa mais pra emitir e
          conferir do que rende.
        </p>
        {/* O DIA VALE PRA TODO MUNDO, e o contrato passa a dizer isso.
          * Data por parceiro seria N datas pra acompanhar num fechamento que
          * roda em lote — ver o cabeçalho de `diaVencimento` no service.
          * Mudar aqui não mexe em fatura já fechada: o dia viaja congelado
          * dentro dela, como o percentual e o piso. */}
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          O vencimento entra no contrato de quem assinar daqui pra frente — e é
          ele que define o que conta como atraso. Entre 1 e 28: dia 30 não
          existe em fevereiro.
        </p>
        {mudou && (
          <div className="mt-3">
            <Button size="md" loading={salvando} onClick={salvar} icon={Save}>
              Salvar régua
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Onde o parceiro paga.
 *
 * Esta chave é COPIADA pra dentro de cada fatura no fechamento, e não lida de
 * `taxaConfig` pelo motorista — ele não tem (nem deve ter) leitura na
 * configuração de preço da plataforma. O efeito colateral é bom: fatura antiga
 * continua mostrando a chave que valia quando foi emitida.
 */
function PixDaPlataforma({ config }) {
  const [tipo, setTipo] = useState(config.pixKeyType || 'random');
  const [chave, setChave] = useState(config.pixKey || '');
  const [nome, setNome] = useState(config.nomePlataforma || '');
  const [cidade, setCidade] = useState(config.cidadePlataforma || '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await setPixPlataforma({ pixKey: chave, pixKeyType: tipo, nome, cidade });
      toast.success('Chave PIX da plataforma salva.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section>
      <Titulo icon={Key}>Onde o parceiro paga</Titulo>
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        {!config.pixKey && (
          <Aviso>
            Sem chave cadastrada, a fatura chega ao parceiro sem código de
            pagamento — e ele vai ter que perguntar por fora.
          </Aviso>
        )}

        <div className="mt-2 grid grid-cols-3 gap-2">
          {Object.entries(PIX_KEY_TYPES).map(([valor, { label }]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setTipo(valor);
                setChave('');
              }}
              className={`tap h-10 rounded-xl border text-xs font-semibold ${
                tipo === valor
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          <CampoCurto label="Chave PIX" value={chave} onChange={setChave} />
          <div className="flex gap-2">
            <CampoCurto label="Nome" value={nome} onChange={setNome} />
            <CampoCurto label="Cidade" value={cidade} onChange={setCidade} />
          </div>
        </div>

        <div className="mt-3">
          <Button size="md" loading={salvando} onClick={salvar} icon={Save}>
            Salvar chave
          </Button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-textMuted">
          Ela é copiada pra dentro de cada fatura no fechamento. Trocar aqui não
          altera fatura já emitida.
        </p>
      </div>
    </section>
  );
}

/* ─────────────── a linha e a ficha ─────────────── */

function LinhaParceiro({
  linha,
  mes,
  config,
  expandida,
  onToggle,
  onSalvou,
  ownerUid,
}) {
  const { mot, resumo, calc, isento, fatura } = linha;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="tap w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text">
              {mot.name || mot.email || mot.uid}
            </p>
            <p className="mt-0.5 text-xs text-textMuted">
              {resumo.criancas} criança(s) · base{' '}
              {formatCurrency(resumo.base)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Selo fatura={fatura} isento={isento} />
            <ChevronDown
              size={16}
              className={`text-textMuted transition-transform ${
                expandida ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-textMuted line-through decoration-textMuted/40">
            {formatCurrency(calc.padrao)}
          </span>
          <span className="font-bold text-text">
            {isento ? 'isento' : formatCurrency(calc.cobrada)}
          </span>
          {!isento && calc.negociada && (
            <Delta calc={calc} />
          )}
        </div>
      </button>

      {expandida && (
        <Ficha
          linha={linha}
          mes={mes}
          config={config}
          onSalvou={onSalvou}
          ownerUid={ownerUid}
        />
      )}
    </div>
  );
}

/** A distância até o padrão, e o efetivo — os dois números da negociação. */
function Delta({ calc }) {
  const abaixo = calc.delta < 0;
  const pct = calc.padrao > 0 ? (calc.delta / calc.padrao) * 100 : 0;
  return (
    <span
      className={`text-xs font-semibold ${
        abaixo ? 'text-danger' : 'text-primary'
      }`}
    >
      {abaixo ? '−' : '+'}
      {formatCurrency(Math.abs(calc.delta)).replace('R$', '').trim()} (
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%) · efetivo {calc.efetivo.toFixed(2)}%
    </span>
  );
}

function Selo({ fatura, isento }) {
  if (isento) {
    return <Etiqueta tone="violet">isento</Etiqueta>;
  }
  if (!fatura) return <Etiqueta tone="neutral">sem fatura</Etiqueta>;
  if (fatura.status === 'quitada') {
    return <Etiqueta tone="emerald">quitada</Etiqueta>;
  }
  return <Etiqueta tone="warning">aberta</Etiqueta>;
}

function Ficha({ linha, mes, config, onSalvou, ownerUid }) {
  const { mot, resumo, neg, fatura } = linha;

  const [modo, setModo] = useState(neg?.modo || MODOS.PERCENTUAL);
  const [valor, setValor] = useState(
    neg?.valor != null ? String(neg.valor) : ''
  );
  const [meses, setMeses] = useState(String(neg?.isencaoMeses ?? 0));
  const [notas, setNotas] = useState(neg?.notas || '');
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  // Prévia ao vivo: o dono digita e vê o resultado antes de salvar.
  const previa = useMemo(
    () =>
      calcularTaxa({
        base: resumo.base,
        negociacao: valor === '' ? null : { modo, valor: Number(valor) },
        config,
      }),
    [resumo.base, modo, valor, config]
  );

  const salvar = async () => {
    setSalvando(true);
    try {
      await setNegociacao(mot.uid, {
        modo,
        valor: valor === '' ? 0 : valor,
        isencaoMeses: meses,
        notas,
        desdeMes: mes,
      });
      toast.success('Negociação salva.');
      onSalvou?.();
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const darBaixa = async () => {
    setBaixando(true);
    try {
      await marcarFaturaPaga(mot.uid, mes, ownerUid);
      toast.success('Fatura quitada.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra dar baixa.');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-neutro bg-sunken/60 p-4">
      {/* A BASE — e por que não existe "a mensalidade dele" */}
      <div>
        <Rotulo>a base</Rotulo>
        <Par label="Crianças ativas" valor={String(resumo.criancas)} />
        <Par label="Total contratado" valor={formatCurrency(resumo.base)} forte />
        <Par
          label="Ticket médio"
          valor={
            resumo.criancas
              ? `${formatCurrency(resumo.ticketMedio)} (${formatCurrency(
                  resumo.menor
                )}–${formatCurrency(resumo.maior)})`
              : '—'
          }
        />
        {resumo.semMensalidade > 0 && (
          <p className="mt-1 text-xs text-warning">
            {resumo.semMensalidade} criança(s) sem mensalidade configurada — não
            entram na base.
          </p>
        )}
      </div>

      {/* A NEGOCIAÇÃO */}
      <div>
        <Rotulo>a negociação</Rotulo>
        <Par label="Taxa padrão" valor={formatCurrency(previa.padrao)} />

        <div className="mt-2 flex gap-2">
          {[MODOS.PERCENTUAL, MODOS.FIXO].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`tap h-10 flex-1 rounded-xl border text-xs font-semibold ${
                modo === m
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card text-text'
              }`}
            >
              {m === MODOS.PERCENTUAL ? 'Percentual' : 'Valor fixo'}
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-end gap-3">
          <CampoCurto
            label="Combinado"
            sufixo={modo === MODOS.PERCENTUAL ? '%' : null}
            prefixo={modo === MODOS.FIXO ? 'R$' : null}
            value={valor}
            onChange={setValor}
          />
          <div className="pb-1">
            <p className="text-xs text-textMuted">dá</p>
            <p className="text-lg font-bold text-text">
              {formatCurrency(previa.cobrada)}
            </p>
          </div>
        </div>

        {valor !== '' && (
          <p className="mt-2 text-xs">
            <Delta calc={previa} />
          </p>
        )}

        {/* Avisos, nunca bloqueios: a negociação é do dono. */}
        {previa.naoAcompanhaCrescimento && (
          <Aviso>
            Valor fixo não acompanha crescimento. Se entrar criança ou subir
            mensalidade, a plataforma continua recebendo o mesmo — e você
            renegocia à mão. Percentual acompanha sozinho.
          </Aviso>
        )}
        {previa.abaixoDoPiso && valor !== '' && (
          <Aviso>
            Abaixo do piso de {formatCurrency(config.piso)} — nesta faixa a
            cobrança custa mais do que rende.
          </Aviso>
        )}
      </div>

      {/* A ISENÇÃO */}
      <div>
        <Rotulo>isenção</Rotulo>
        <div className="flex items-end gap-3">
          <CampoCurto
            label="Meses sem taxa"
            value={meses}
            onChange={setMeses}
          />
          <p className="pb-2 text-xs text-textMuted">
            {Number(meses) > 0
              ? `até ${formatMonthLabel(addMonths(mes, Number(meses) - 1))}`
              : 'sem isenção'}
          </p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Conta a partir de {formatMonthLabel(mes)}. A roleta de entrada não
          gira hoje (depende de Cloud Functions), então a isenção é lançada aqui
          à mão.
        </p>
      </div>

      {/* NOTA INTERNA — nunca sai desta tela */}
      <div>
        <Rotulo>nota interna</Rotulo>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="O que foi combinado, e por quê."
          className="w-full rounded-xl border border-border bg-card p-3 text-sm text-text placeholder:text-textMuted/60 focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-textMuted">
          Só o dono lê. O motorista não tem acesso a este campo.
        </p>
      </div>

      <Button size="md" loading={salvando} onClick={salvar} icon={Save}>
        Salvar negociação
      </Button>

      {fatura && fatura.status !== 'quitada' && (
        <Button
          size="md"
          variant="success"
          loading={baixando}
          onClick={darBaixa}
          icon={Check}
        >
          Dar baixa em {formatCurrency(fatura.total)}
        </Button>
      )}

      {fatura && (
        <div>
          <Rotulo>fatura de {formatMonthLabel(mes)}</Rotulo>
          <Par label="Régua usada" valor={`${fatura.reguaPercentual}% · piso ${formatCurrency(fatura.reguaPiso)}`} />
          <Par label="Cobrada" valor={formatCurrency(fatura.taxaCobrada)} />
          {fatura.desconto > 0 && (
            <Par label="Desconto" valor={`− ${formatCurrency(fatura.desconto)}`} />
          )}
          <Par label="Total" valor={formatCurrency(fatura.total)} forte />
        </div>
      )}
    </div>
  );
}

/* ─────────────── peças ─────────────── */

function SeletorDeMes({ mes, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-2 shadow-sm">
      <Seta dir="ant" onClick={() => onChange(addMonths(mes, -1))} />
      <span className="text-sm font-bold capitalize text-text">
        {formatMonthLabel(mes)}
      </span>
      <Seta dir="prox" onClick={() => onChange(addMonths(mes, 1))} />
    </div>
  );
}

function Seta({ dir, onClick }) {
  const Icon = dir === 'ant' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'ant' ? 'Mês anterior' : 'Mês seguinte'}
      className="tap flex h-9 w-9 items-center justify-center rounded-xl text-textMuted"
    >
      <Icon size={18} />
    </button>
  );
}

function CampoCurto({ label, value, onChange, prefixo, sufixo }) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </span>
      <span className="flex items-center gap-1 rounded-xl border border-border bg-card px-3">
        {prefixo && <span className="text-xs text-textMuted">{prefixo}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
          className="h-11 w-full bg-transparent text-sm font-semibold text-text focus:outline-none"
        />
        {sufixo && <span className="text-xs text-textMuted">{sufixo}</span>}
      </span>
    </label>
  );
}

function Titulo({ icon: Icon, children }) {
  return (
    <h2 className="mb-2 inline-flex items-center gap-1.5 px-1 text-sm font-bold text-text">
      {Icon && <Icon size={15} className="text-primary" />}
      {children}
    </h2>
  );
}

function Rotulo({ children }) {
  return (
    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-textMuted">
      {children}
    </p>
  );
}

function Par({ label, valor, forte }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-textMuted">{label}</span>
      <span
        className={`text-right text-sm ${
          forte ? 'font-bold text-text' : 'text-text'
        }`}
      >
        {valor}
      </span>
    </div>
  );
}

function Aviso({ children }) {
  return (
    <p className="mt-2 rounded-xl border border-warningBorder bg-warningSoft p-2.5 text-xs leading-relaxed text-warningText/90">
      {children}
    </p>
  );
}

const TONS = {
  neutral: 'bg-neutro text-textMuted',
  emerald: 'bg-primaryChip text-primary',
  warning: 'bg-warningChip text-warningText',
  violet: 'bg-escolaChip text-escola',
};

function Etiqueta({ tone = 'neutral', children }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${TONS[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * OS CONTRATOS PERTO DE VENCER — a fila que o serviço prometia.
 *
 * SÓ O CONTRATO ACEITO CONTA. Um documento emitido e nunca aceito não está
 * vencendo, está parado: a cobrança dele é outra (o associado precisa aceitar),
 * e misturar as duas listas faria o dono ligar pra renovar algo que nunca
 * começou.
 *
 * UM POR PARCEIRO, o mais recente. Renovar cria documento novo e o anterior
 * fica no histórico — sem esse corte, um parceiro de três anos apareceria três
 * vezes na fila, todas as vezes vencidas.
 *
 * VENCIDO E VENCENDO NA MESMA LISTA, com o número de dias dizendo qual é qual.
 * Separar em dois blocos daria mais destaque ao vencido, e o que precisa de
 * ação é justamente o outro: quem já venceu continua operando (vencimento não
 * suspende), quem vence em duas semanas ainda dá pra renovar sem atropelo.
 */
function ContratosVencendo({ contratos }) {
  const fila = useMemo(() => {
    const porParceiro = new Map();
    for (const c of contratos || []) {
      if (!c.aceitoEm) continue; // não aceito não está vencendo, está parado
      const atual = porParceiro.get(c.tioUid);
      const maisNovo =
        !atual ||
        String(c.conteudo?.emitidoEm || '') > String(atual.conteudo?.emitidoEm || '');
      if (maisNovo) porParceiro.set(c.tioUid, c);
    }
    return [...porParceiro.values()]
      .filter((c) => precisaRenovar(c))
      .map((c) => ({ c, dias: diasParaVencer(c) }))
      .sort((a, b) => a.dias - b.dias);
  }, [contratos]);

  if (fila.length === 0) return null;

  return (
    <section className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
        <AlertTriangle size={15} className="text-warning" />
        {fila.length}{' '}
        {fila.length === 1 ? 'contrato pra renovar' : 'contratos pra renovar'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-warningText/80">
        Vencer não suspende ninguém — quem está em dia continua operando. Mas
        renovar antes é o que evita cobrar sem papel vigente.
      </p>
      <div className="mt-3 space-y-1.5">
        {fila.map(({ c, dias }) => (
          <div
            key={c.id}
            className="flex items-baseline justify-between gap-2 rounded-xl bg-card px-3 py-2"
          >
            <span className="truncate text-sm font-semibold text-text">
              {c.conteudo?.associado?.nome || 'Parceiro'}
            </span>
            <span
              className={`shrink-0 text-xs font-bold tabular-nums ${
                dias < 0 ? 'text-dangerText' : 'text-warningText'
              }`}
            >
              {dias < 0
                ? `venceu há ${Math.abs(dias)}d`
                : dias === 0
                  ? 'vence hoje'
                  : `${dias}d`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
