import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Fuel, PiggyBank, Scale } from 'lucide-react';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { TIPOS_DE_COMBUSTIVEL, abastecimentosDe } from '../../dominio/cobranca/combustivel.js';
import { planoValido, porMesParaTroca } from '../../dominio/cobranca/reservaDaPerua.js';
import { proximaRenovacao } from '../../dominio/cobranca/precisoAumentar.js';

/**
 * "SUA PERUA" — o grupo do caixa com as três telas da perua (03/10/2026,
 * maquete aprovada, tela 2): Combustível, Reserva da perua e Preciso
 * aumentar?. Fica separado das portas do negócio, com título próprio, e cada
 * linha já mostra o número que importa — no mesmo formato das outras portas
 * do caixa (`Porta` em TioFinance), para ele aprender a forma uma vez.
 *
 * ⚠️ SEM DADO, A LINHA DIZ O QUE FALTA, NUNCA UM ZERO. "Anotado: R$ 0" para
 * quem nunca anotou nada seria o app afirmando uma coisa que ele não sabe.
 *
 * Props:
 *   - criancas: a turma inteira (a mesma lista de `useTurmaInteira` que o
 *     caixa já assina — passada por prop para não abrir uma segunda escuta);
 *   - visiveis: o olho do caixa (`useValoresVisiveis` do TioFinance). Vem por
 *     prop porque o estado do olho é de quem o desenha: um segundo hook aqui
 *     não acompanharia o toque no olho.
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const reais = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const reaisComCentavos = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const numero = (v) => typeof v === 'number' && Number.isFinite(v);

function diaEMes(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "01/10 · 47 litros · R$ 6,33 o litro" (GNV em m³). */
function linhaDoAbastecimento(a, visiveis) {
  const m3 = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === a.tipo)?.unidade === 'm³';
  const qtd = a.litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const partes = [diaEMes(a.data), `${qtd} ${m3 ? 'm³' : 'litros'}`];
  if (a.precoLitro !== null) {
    partes.push(`${visiveis ? reaisComCentavos(a.precoLitro) : VALOR_ESCONDIDO} o ${m3 ? 'm³' : 'litro'}`);
  }
  return partes.join(' · ');
}

function mesDaRenovacao(data, hoje) {
  const meses = (data.getFullYear() - hoje.getFullYear()) * 12 + (data.getMonth() - hoje.getMonth());
  return meses >= 12 ? `${MESES[data.getMonth()]} de ${data.getFullYear()}` : MESES[data.getMonth()];
}

export default function BlocoSuaPerua({ criancas = [], visiveis = true }) {
  const navigate = useNavigate();
  const config = useConfigDoFinanceiro();
  const { despesas, carregando } = useDespesasDosUltimosMeses(12);

  const ultimo = useMemo(() => abastecimentosDe(despesas)[0] || null, [despesas]);
  const renovacao = useMemo(() => proximaRenovacao(criancas, new Date()), [criancas]);

  const combustivel = carregando
    ? '…'
    : ultimo
      ? linhaDoAbastecimento(ultimo, visiveis)
      : 'Nenhum abastecimento lançado';

  let reserva = 'Faça seu plano';
  if (config === null) {
    reserva = '…';
  } else {
    const troca = config.guardado?.troca?.valor;
    const manutencao = config.guardado?.manutencao?.valor;
    if (numero(troca) || numero(manutencao)) {
      const soma = (numero(troca) ? troca : 0) + (numero(manutencao) ? manutencao : 0);
      reserva = `Anotado: ${visiveis ? reais(soma) : VALOR_ESCONDIDO}`;
    } else if (planoValido(config.planoDaTroca)) {
      const porMes = porMesParaTroca(config.planoDaTroca);
      reserva = `Separar ${visiveis ? reais(porMes) : VALOR_ESCONDIDO} por mês`;
    }
  }

  const aumentar = renovacao
    ? `Seus contratos renovam em ${mesDaRenovacao(renovacao, new Date())}`
    : 'Seus custos por criança';

  return (
    <div className="space-y-2.5">
      <h2 className="px-1 font-display text-xl font-bold text-text">Sua perua</h2>
      <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
        <Linha icon={Fuel} titulo="Combustível" detalhe={combustivel} onClick={() => navigate('/tio/abastecer')} />
        <Linha
          divisor
          icon={PiggyBank}
          titulo="Reserva da perua"
          detalhe={reserva}
          onClick={() => navigate('/tio/finance/reserva')}
        />
        <Linha
          divisor
          icon={Scale}
          titulo="Preciso aumentar?"
          detalhe={aumentar}
          onClick={() => navigate('/tio/finance/aumentar')}
        />
      </section>
    </div>
  );
}

/** Mesma forma da `Porta` do caixa: ícone, título, detalhe e a seta. */
function Linha({ icon: Icon, titulo, detalhe, onClick, divisor = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-16 w-full items-center gap-3.5 px-4 py-4 text-left ${
        divisor ? 'border-t border-neutro' : ''
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text">{titulo}</span>
        <span className="block truncate text-sm tabular-nums text-textMuted">{detalhe}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-textBody" />
    </button>
  );
}
