import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { calcularNivel } from '../../dominio/identidade/nivel.js';

/**
 * "MEU NEGÓCIO" no Financeiro — a porta da trilha do negócio
 * (docs/niveis.md, seção 6). Mostra em que fase ele está, das três que
 * contam, e leva a /tio/finance/negocio (atrás da mesma senha).
 *
 * A barra é ESTÁTICA (nada se mexe sozinho): a largura é a fração de fases
 * completas, sem transição. A fase 4 não entra na conta — ela não existe
 * ainda para ninguém.
 *
 * Enquanto os fatos carregam, a linha de baixo diz "…" em vez de "fase 1":
 * afirmar o começo para quem já está na fase 3 seria a tela mentindo.
 */
export default function CartaoMeuNegocio() {
  const navigate = useNavigate();
  const { fatos, carregando } = useFatosDoNivel();

  const resumo = useMemo(() => {
    if (carregando || !fatos) return null;
    const fases = calcularNivel(fatos).trilha.fases.filter((f) => f.contaParaDiamante);
    const completas = fases.filter((f) => f.completa).length;
    const atual = fases.find((f) => !f.completa) || null;
    return { total: fases.length, completas, atual };
  }, [fatos, carregando]);

  let detalhe = '…';
  if (resumo) {
    detalhe = resumo.atual
      ? `Fase ${resumo.atual.numero} de ${resumo.total} · ${resumo.atual.titulo}`
      : 'Trilha completa';
  }
  const fracao = resumo ? resumo.completas / resumo.total : 0;

  return (
    <button
      type="button"
      onClick={() => navigate('/tio/finance/negocio')}
      className="tap flex w-full flex-col gap-3 rounded-3xl bg-card p-4 text-left shadow-rest"
    >
      <span className="flex w-full items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <Briefcase size={22} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">Meu negócio</span>
          <span className="block text-sm text-textMuted">{detalhe}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-textBody" aria-hidden />
      </span>
      <span
        className="block h-2.5 w-full overflow-hidden rounded-full bg-neutro"
        role="progressbar"
        aria-label="Fases da trilha completas"
        aria-valuemin={0}
        aria-valuemax={resumo ? resumo.total : 3}
        aria-valuenow={resumo ? resumo.completas : 0}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${fracao * 100}%` }} />
      </span>
    </button>
  );
}
