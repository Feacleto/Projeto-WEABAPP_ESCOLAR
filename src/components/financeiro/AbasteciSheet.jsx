import { useId, useState } from 'react';
import { Check, Fuel, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import Input from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { addExpense } from '../../services/expensesService';
import { guardarPrecoNoPosto } from '../../services/configFinanceiroService';
import { formatCurrency } from '../../compartilhado/formatters';
import {
  TIPOS_DE_COMBUSTIVEL,
  precoDoLitro,
  precoPlausivel,
  rotuloDoTipo,
} from '../../dominio/cobranca/combustivel.js';

/**
 * ABASTECI — a folha que lança o abastecimento (03/10/2026, maquete aprovada).
 *
 *   <AbasteciSheet open onClose posto tipo litros valor kmDasRotas onLancado />
 *
 *   posto       nome do posto ('' se ele não disse)
 *   tipo        chave de TIPOS_DE_COMBUSTIVEL (a da perua)
 *   litros      número vindo da cotação, ou null
 *   valor       número vindo da cotação, ou null
 *   kmDasRotas  leitura de `configFinanceiro.kmDasRotas`, ou null
 *   onLancado   () => void — chamado depois de gravar
 *
 * VEM PREENCHIDA DA COTAÇÃO, E OS DOIS NÚMEROS SÃO EDITÁVEIS: a bomba nunca
 * para exatamente nos R$ 300 que ele pediu, e o que vale é o que está no
 * cupom. Litros e valor ficam LADO A LADO porque são as duas metades do mesmo
 * número; o preço do litro é calculado deles e nunca digitado — é o que o
 * domínio grava (o preço não é gravado: é `amount / litros`).
 *
 * "ONTEM" EXISTE PORQUE ELE LANÇA À NOITE o que abasteceu de manhã, depois da
 * rota. A data é montada no fuso do aparelho: `toISOString()` dá a data em
 * UTC, e às 22h em Brasília ela já é amanhã.
 *
 * O preço guardado no posto só é atualizado quando o abastecimento é de HOJE:
 * lançar um de semana passada não pode apagar o preço que ele viu ontem.
 *
 * O km vai junto quando o contador das rotas existe, como na FolhaDeDespesa —
 * é dele que sai quanto a perua rodou entre dois abastecimentos.
 *
 * A foto do comprovante fica fora desta versão.
 */
export default function AbasteciSheet({ open, ...props }) {
  // Fechada, não guarda nada: abrir de novo começa da cotação atual.
  if (!open) return null;
  return <Folha {...props} />;
}

function dataLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Texto do campo: "47,4" / "300,00". */
function textoDe(n, casas) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: false,
  });
}

/** "47,4", "47.4" e "1.000,50" viram número. Vazio ou zero, null. */
function numeroDoTexto(texto) {
  let t = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const soNumero = (v) => v.replace(/[^\d.,]/g, '');

const QUANDO = [
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: 'ontem', rotulo: 'Ontem' },
  { chave: 'outro', rotulo: 'Outro dia' },
];

function Folha({ onClose, posto, tipo, litros, valor, kmDasRotas, onLancado }) {
  const { user } = useAuth();
  const hoje = new Date();
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);

  const [litrosTexto, setLitrosTexto] = useState(textoDe(litros, 1));
  const [valorTexto, setValorTexto] = useState(textoDe(valor, 2));
  const [quando, setQuando] = useState('hoje');
  const [outroDia, setOutroDia] = useState(dataLocal(ontem));
  const [tanqueCheio, setTanqueCheio] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const idLitros = useId();
  const idValor = useId();

  const unidade = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === tipo)?.unidade || 'litros';
  const ehM3 = unidade === 'm³';
  const nLitros = numeroDoTexto(litrosTexto);
  const nValor = numeroDoTexto(valorTexto);
  const preco = precoDoLitro({ valor: nValor, litros: nLitros });

  const subtitulo = [posto, tipo ? rotuloDoTipo(tipo) : null].filter(Boolean).join(' · ');

  const lancar = async () => {
    if (!nLitros || nLitros > 500) {
      setErro(ehM3 ? 'Escreva quantos m³ entraram.' : 'Escreva quantos litros entraram.');
      return;
    }
    if (!nValor) {
      setErro('Escreva quanto pagou.');
      return;
    }
    const data =
      quando === 'hoje' ? dataLocal(hoje) : quando === 'ontem' ? dataLocal(ontem) : outroDia;
    if (!data) {
      setErro('Escolha o dia.');
      return;
    }
    // O `max` do campo só vale no calendário: digitado, o dia passa. Um
    // abastecimento de amanhã cairia no mês errado, ou no ano errado.
    if (data > dataLocal(hoje)) {
      setErro('Esse dia ainda não chegou. Escolha hoje ou um dia que passou.');
      return;
    }
    setSalvando(true);
    try {
      await addExpense({
        amount: nValor,
        category: 'fuel',
        description: '',
        date: data,
        kmContador: kmDasRotas ?? undefined,
        litros: nLitros,
        tipoCombustivel: tipo || undefined,
        posto: posto || undefined,
        tanqueCheio,
      });
      // O preço do posto é um extra: se falhar, o abastecimento já está
      // lançado, e dizer "não deu" aqui faria ele lançar de novo.
      if (quando === 'hoje' && posto && tipo && preco) {
        guardarPrecoNoPosto(user?.uid, { nome: posto, preco, tipo }).catch((err) =>
          console.error('[abastecer] preço do posto', err)
        );
      }
      const qtd = nLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      toast.success(`Lançado: ${qtd} ${ehM3 ? 'm³' : 'litros'} por ${formatCurrency(nValor)}`);
      onLancado?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Não deu pra lançar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Abasteci" subtitle={subtitulo || undefined} icon={Fuel}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <CampoNumero
            id={idLitros}
            rotulo={ehM3 ? 'm³' : 'Litros'}
            value={litrosTexto}
            onChange={(v) => {
              setLitrosTexto(v);
              setErro(null);
            }}
          />
          <CampoNumero
            id={idValor}
            rotulo="Pagou (R$)"
            value={valorTexto}
            onChange={(v) => {
              setValorTexto(v);
              setErro(null);
            }}
          />
        </div>

        <div className="flex items-baseline justify-between gap-3" aria-live="polite">
          <span className="text-base text-textBody">Preço do {ehM3 ? 'm³' : 'litro'}</span>
          <span className="text-right text-lg font-bold tabular-nums text-text">
            {preco ? formatCurrency(preco) : '—'}
          </span>
        </div>
        {preco && !precoPlausivel(preco) && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warningBorder bg-warningSoft px-3.5 py-3 text-warningText">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-base">
              Esse preço parece fora do normal. Confira os {ehM3 ? 'm³' : 'litros'} e o valor.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="rotulo">Quando</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quando abasteceu">
            {QUANDO.map((q) => (
              <button
                key={q.chave}
                type="button"
                aria-pressed={quando === q.chave}
                onClick={() => setQuando(q.chave)}
                className={`tap h-12 rounded-full border-2 px-4 text-base font-bold ${
                  quando === q.chave
                    ? 'border-primary bg-primarySoft text-primary'
                    : 'border-border bg-card text-textBody'
                }`}
              >
                {q.rotulo}
              </button>
            ))}
          </div>
          {quando === 'outro' && (
            <Input
              type="date"
              label="Dia"
              value={outroDia}
              max={dataLocal(hoje)}
              onChange={(e) => {
                setOutroDia(e.target.value);
                setErro(null);
              }}
              avancar={false}
            />
          )}
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={tanqueCheio}
          onClick={() => setTanqueCheio((v) => !v)}
          className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 text-left"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-white ${
              tanqueCheio ? 'border-primary bg-primary' : 'border-borderStrong bg-card'
            }`}
          >
            {tanqueCheio && <Check size={18} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold text-text">Enchi o tanque</span>
            <span className="block text-[15px] text-textMuted">
              Assim o app aprende quanto cabe no tanque.
            </span>
          </span>
        </button>

        {erro && <p className="text-base font-semibold text-dangerText">{erro}</p>}

        {/* "Abasteci", não "Lançar" (item 17): é o mesmo gesto do botão que
          * abriu esta folha, e o verbo dele é o que ele fez no posto. */}
        <SheetCTA onClick={lancar} loading={salvando}>
          Abasteci
        </SheetCTA>
      </div>
    </Sheet>
  );
}

function CampoNumero({ id, rotulo, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-bold text-text">
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Digite aqui"
        value={value}
        onChange={(e) => onChange(soNumero(e.target.value))}
        className="h-14 w-full min-w-0 rounded-xl border-2 border-border bg-card px-3.5 text-[22px] font-bold tabular-nums text-text placeholder:text-base placeholder:font-normal placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-4 focus:ring-accent/25"
      />
    </div>
  );
}
