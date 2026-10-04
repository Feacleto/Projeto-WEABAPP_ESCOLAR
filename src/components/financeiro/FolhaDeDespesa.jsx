import { useMemo, useState } from 'react';
import { Car, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCard, SheetCTA } from '../common/Sheet';
import Input from '../common/Input';
import CampoDeValor from '../common/CampoDeValor';
import { useConfigDoFinanceiro, useDespesasRecentes } from '../../hooks/useDespesas';
import { addExpense, EXPENSE_CATEGORIES, monthKeyOf } from '../../services/expensesService';
import { definirUsoDaPerua } from '../../services/configFinanceiroService';
import {
  CATEGORIAS_COM_KM,
  USO_DA_PERUA,
  fraseDoKm,
  haQuanto,
  kmDesdeOUltimo,
  leituraDeKm,
  maisLancados,
  paraData,
  salariosRecentes,
  sugestaoDeSalario,
  ultimaDaCategoria,
} from '../../dominio/cobranca/historicoDeDespesas.js';
import { nomeDoMes } from '../payments/estadoDaMensalidade';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../compartilhado/formatters';

/**
 * LANÇAR DESPESA — a folha (03/10/2026, protótipo aprovado pelo dono).
 *
 *   <FolhaDeDespesa open onClose comValores />
 *
 * Ela abre de dois lugares: do caixa (com a senha, `comValores`) e da tela
 * TRANCADA do Financeiro (`comValores={false}`), onde quem lança costuma ser a
 * auxiliar. Ela pode lançar o combustível que pôs, mas não vê o salário dela
 * nem o gasto do mês: todo valor do histórico vira "R$ ••••", e a sugestão do
 * salário some junto.
 *
 * ⚠️ É CORTINA, NÃO COFRE — a mesma ressalva de `senhaDoFinanceiroService`: a
 * auxiliar usa a sessão do motorista, e para o Firestore os dois são a mesma
 * conta. Esconder aqui impede que ela VEJA; não impede quem abre o console.
 *
 * O HISTÓRICO VEM ANTES DO VALOR porque é a pergunta que ele faz antes de
 * digitar: quando abasteci, quanto a perua rodou, o que foi a última
 * manutenção. Toda conta é régua pura em `historicoDeDespesas.js`.
 *
 * O KM, DECISÃO DO DONO: a folha pergunta UMA vez "a perua roda só nas
 * rotas?". Só nas rotas → o km vem sozinho, do contador que o celular soma
 * durante as rotas (`configFinanceiro.kmDasRotas`). Também fora → ele digita
 * o km do painel. Os dois são gravados quando existem, para a troca de
 * resposta não perder o histórico. Sem duas leituras, nenhum número aparece.
 */

const PRINCIPAIS = [
  { chave: 'fuel', rotulo: 'Combustível' },
  { chave: 'maintenance', rotulo: 'Manutenção' },
  { chave: 'monitor', rotulo: 'Auxiliar' },
  { chave: 'other', rotulo: 'Outros' },
];

const MAIS = [
  { chave: 'installment', rotulo: 'Parcela do veículo' },
  { chave: 'insurance', rotulo: 'Seguro' },
  { chave: 'tax', rotulo: 'IPVA' },
];

/** Quantas despesas recentes cada categoria precisa para o histórico. */
const QUANTAS = { other: 30, monitor: 12 };

const OCULTO = 'R$ ••••';

export default function FolhaDeDespesa({ open, onClose, comValores = true }) {
  // A folha fechada não guarda nada: abrir de novo começa limpo, em
  // Combustível, sem o valor que ficou digitado da última vez.
  if (!open) return null;
  return <Folha onClose={onClose} comValores={comValores} />;
}

function Folha({ onClose, comValores }) {
  const hoje = new Date();
  const mesAtual = monthKeyOf(hoje);

  const [categoria, setCategoria] = useState('fuel');
  const [mostrarMais, setMostrarMais] = useState(false);
  // `null` = ele ainda não mexeu no valor; é o que deixa a sugestão do
  // salário aparecer sem um efeito copiando estado.
  const [valor, setValor] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [kmPainel, setKmPainel] = useState('');
  const [data, setData] = useState(hoje.toISOString().slice(0, 10));
  const [mudandoData, setMudandoData] = useState(false);
  const [repergunta, setRepergunta] = useState(false);
  const [salvandoUso, setSalvandoUso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const { user } = useAuth();
  const config = useConfigDoFinanceiro();
  const recentes = useDespesasRecentes(categoria, QUANTAS[categoria] || 6);

  const temKm = CATEGORIAS_COM_KM.includes(categoria);
  const uso = config?.usoDaPerua || null;
  const kmDasRotas = leituraDeKm(config?.kmDasRotas);
  const perguntarUso = temKm && config !== null && (!uso || repergunta);

  const reais = (v) => (comValores ? formatCurrency(v) : OCULTO);

  const ultima = useMemo(() => ultimaDaCategoria(recentes || [], categoria), [recentes, categoria]);
  const km = temKm
    ? kmDesdeOUltimo({ ultima, uso, kmDasRotas, kmPainelAgora: kmPainel })
    : null;

  const sugestao =
    categoria === 'monitor' && comValores && recentes
      ? sugestaoDeSalario(recentes, mesAtual)
      : null;
  // O campo de dinheiro fala texto com ponto ("900.00") — ver CampoDeValor.
  const valorNaTela = valor ?? (sugestao != null ? sugestao.toFixed(2) : '');

  const trocarCategoria = (chave) => {
    setCategoria(chave);
    setValor(null);
    setDescricao('');
    setKmPainel('');
    setErro(null);
  };

  const responderUso = async (resposta) => {
    setSalvandoUso(true);
    try {
      await definirUsoDaPerua(user?.uid, resposta);
      setRepergunta(false);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra guardar a resposta. Tente de novo.');
    } finally {
      setSalvandoUso(false);
    }
  };

  const lancar = async () => {
    const numero = Number(valorNaTela);
    if (!Number.isFinite(numero) || numero <= 0) {
      setErro('Escreva quanto foi.');
      return;
    }
    if (kmPainel !== '' && leituraDeKm(kmPainel) === null) {
      toast.error('O km do painel precisa ser um número.');
      return;
    }
    setSalvando(true);
    try {
      await addExpense({
        amount: numero,
        category: categoria,
        description: descricao,
        date: data,
        kmPainel: temKm && kmPainel !== '' ? kmPainel : undefined,
        kmContador: temKm && kmDasRotas !== null ? kmDasRotas : undefined,
      });
      toast.success('Despesa lançada.');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Não deu pra lançar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Lançar despesa">
      <div className="space-y-4">
        {/* As categorias: as quatro de todo mês à vista, as três de vez em
          * quando atrás do "Mais". */}
        <div className="flex flex-wrap gap-2" aria-label="Do que foi">
          {PRINCIPAIS.map((c) => (
            <Pilula key={c.chave} ativa={categoria === c.chave} onClick={() => trocarCategoria(c.chave)}>
              {c.rotulo}
            </Pilula>
          ))}
          {mostrarMais ? (
            MAIS.map((c) => (
              <Pilula key={c.chave} ativa={categoria === c.chave} onClick={() => trocarCategoria(c.chave)}>
                {c.rotulo}
              </Pilula>
            ))
          ) : (
            <button
              type="button"
              onClick={() => setMostrarMais(true)}
              className="tap inline-flex h-12 items-center gap-1.5 rounded-full border-2 border-dashed border-borderStrong bg-card px-4 text-base font-bold text-textBody"
            >
              <Plus size={18} />
              Mais
            </button>
          )}
        </div>

        <Historico
          categoria={categoria}
          recentes={recentes}
          ultima={ultima}
          km={km}
          uso={uso}
          perguntarUso={perguntarUso}
          salvandoUso={salvandoUso}
          onResponderUso={responderUso}
          onMudarUso={() => setRepergunta(true)}
          comValores={comValores}
          reais={reais}
          mesAtual={mesAtual}
          hoje={hoje}
        />

        {categoria === 'other' && (
          <Frequentes
            recentes={recentes}
            escolhido={descricao}
            onEscolher={setDescricao}
          />
        )}

        {categoria === 'other' && (
          <Input falar="texto" semSalvar
            label="Nome da despesa"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={200}
          />
        )}

        {categoria === 'maintenance' && (
          <Input falar="texto" semSalvar
            label="O que foi feito"
            placeholder="Digite aqui"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={200}
          />
        )}

        {temKm && uso && !perguntarUso && (
          <Input semSalvar
            label={uso === USO_DA_PERUA.TAMBEM_FORA ? 'Km do painel' : 'Km do painel (se quiser)'}
            inputMode="numeric"
            value={kmPainel}
            // Só dígitos: "53.012" no hodômetro é cinquenta e três MIL, e
            // deixar o ponto passar o leria como cinquenta e três.
            onChange={(e) => setKmPainel(e.target.value.replace(/\D/g, ''))}
            hint={
              uso === USO_DA_PERUA.TAMBEM_FORA
                ? 'O número do hodômetro agora. É dele que sai quanto a perua rodou.'
                : undefined
            }
          />
        )}

        <div>
          <CampoDeValor
            label="Valor"
            value={valorNaTela}
            onChange={(v) => {
              setValor(v);
              setErro(null);
            }}
            error={erro}
          />
          {valor === null && sugestao != null && (
            <p className="mt-1.5 text-sm text-textMuted">
              Mesmo valor do mês passado. Mude se precisar.
            </p>
          )}
        </div>

        {mudandoData ? (
          <Input type="date" label="Quando" value={data} onChange={(e) => setData(e.target.value)} />
        ) : (
          <p className="text-base text-textBody">
            Data: hoje{' '}
            <button
              type="button"
              onClick={() => setMudandoData(true)}
              className="tap inline-flex min-h-12 items-center px-1 font-bold text-primary underline"
            >
              Mudar
            </button>
          </p>
        )}

        <SheetCTA onClick={lancar} loading={salvando}>
          Lançar
        </SheetCTA>
      </div>
    </Sheet>
  );
}

function Pilula({ ativa, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={onClick}
      className={`tap h-12 rounded-full border-2 px-4 text-base font-bold ${
        ativa ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-textBody'
      }`}
    >
      {children}
    </button>
  );
}

/** Uma linha "rótulo ........ valor" do bloco de histórico. */
function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-base text-textBody">{rotulo}</span>
      <span className="text-right text-base font-bold tabular-nums text-text">{valor}</span>
    </div>
  );
}

const diaCurto = (d) => {
  const data = paraData(d);
  return data
    ? `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
    : '—';
};

function Historico({
  categoria,
  recentes,
  ultima,
  km,
  uso,
  perguntarUso,
  salvandoUso,
  onResponderUso,
  onMudarUso,
  comValores,
  reais,
  mesAtual,
  hoje,
}) {
  const carregando = recentes === null;
  let titulo;
  let linhas = [];
  let vazio;
  let temValor = false;

  if (categoria === 'fuel') {
    titulo = 'Último abastecimento';
    vazio = 'Nenhum abastecimento lançado ainda.';
    if (ultima) {
      linhas = [
        { rotulo: 'Dia', valor: `${diaCurto(ultima.date)} (${haQuanto(ultima.date, hoje)})` },
        { rotulo: 'Valor', valor: reais(ultima.amount) },
      ];
      temValor = true;
    }
  } else if (categoria === 'maintenance') {
    titulo = 'Última manutenção';
    vazio = 'Nenhuma manutenção lançada ainda.';
    if (ultima) {
      linhas = [
        { rotulo: 'Dia', valor: `${diaCurto(ultima.date)} (${haQuanto(ultima.date, hoje)})` },
        ...(ultima.description ? [{ rotulo: 'O que foi', valor: ultima.description }] : []),
        { rotulo: 'Valor', valor: reais(ultima.amount) },
      ];
      temValor = true;
    }
  } else if (categoria === 'monitor') {
    titulo = 'Salário da auxiliar';
    vazio = 'Nenhum salário lançado nos últimos meses.';
    const salarios = salariosRecentes(recentes || [], mesAtual);
    linhas = salarios.map((s) => {
      const nome = nomeDoMes(s.mes);
      return { rotulo: nome.charAt(0).toUpperCase() + nome.slice(1), valor: reais(s.valor) };
    });
    temValor = salarios.length > 0;
  } else if (categoria === 'other') {
    titulo = 'Outras despesas';
    vazio = 'Nada lançado em Outros ainda.';
    if (ultima) {
      linhas = [
        {
          rotulo: ultima.description ? `Última: ${ultima.description}` : `Última: ${diaCurto(ultima.date)}`,
          valor: reais(ultima.amount),
        },
      ];
      temValor = true;
    }
  } else {
    titulo = `Último lançamento · ${EXPENSE_CATEGORIES[categoria]?.label || ''}`;
    vazio = 'Nada lançado nesta categoria ainda.';
    if (ultima) {
      linhas = [
        { rotulo: 'Dia', valor: `${diaCurto(ultima.date)} (${haQuanto(ultima.date, hoje)})` },
        { rotulo: 'Valor', valor: reais(ultima.amount) },
      ];
      temValor = true;
    }
  }

  return (
    <SheetCard className="space-y-2">
      <p className="rotulo">{titulo}</p>
      {carregando ? (
        <p className="text-base text-textMuted">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-base text-textMuted">{vazio}</p>
      ) : (
        linhas.map((l) => <Linha key={l.rotulo} rotulo={l.rotulo} valor={l.valor} />)
      )}

      {perguntarUso ? (
        <div className="space-y-2 rounded-xl bg-card p-3">
          <p className="text-base font-bold text-text">A perua roda só nas rotas?</p>
          <p className="text-sm text-textMuted">
            Assim o app sabe de onde tirar quanto ela rodou.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={salvandoUso}
              onClick={() => onResponderUso(USO_DA_PERUA.SO_ROTA)}
              className={`tap h-12 rounded-xl border-2 px-2 text-base font-bold ${
                uso === USO_DA_PERUA.SO_ROTA ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
              }`}
            >
              Só nas rotas
            </button>
            <button
              type="button"
              disabled={salvandoUso}
              onClick={() => onResponderUso(USO_DA_PERUA.TAMBEM_FORA)}
              className={`tap h-12 rounded-xl border-2 px-2 text-base font-bold ${
                uso === USO_DA_PERUA.TAMBEM_FORA ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
              }`}
            >
              Também uso fora
            </button>
          </div>
        </div>
      ) : (
        km && (
          <div className="flex items-center gap-2.5 rounded-xl bg-card p-3">
            <Car size={22} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 text-base text-text">{fraseDoKm(km)}</span>
            <button
              type="button"
              onClick={onMudarUso}
              className="tap min-h-12 shrink-0 px-1 text-sm font-bold text-primary underline"
            >
              Mudar
            </button>
          </div>
        )
      )}

      {!comValores && temValor && (
        <p className="text-sm text-textMuted">Os valores aparecem com a senha.</p>
      )}
    </SheetCard>
  );
}

/** "Você mais lança": os nomes mais frequentes em Outros, um toque preenche. */
function Frequentes({ recentes, escolhido, onEscolher }) {
  const lista = useMemo(() => maisLancados(recentes || []), [recentes]);
  if (lista.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-base font-bold text-textBody">Você mais lança</p>
      <div className="flex flex-wrap gap-2">
        {lista.map((q) => (
          <Pilula key={q.nome} ativa={escolhido === q.nome} onClick={() => onEscolher(q.nome)}>
            {q.nome} · {q.vezes} {q.vezes === 1 ? 'vez' : 'vezes'}
          </Pilula>
        ))}
      </div>
    </div>
  );
}
