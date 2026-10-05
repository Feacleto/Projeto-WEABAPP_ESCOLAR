import MiniPerua from './MiniPerua';
import { useVagasDaPerua } from '../../hooks/useVagasDaPerua';
import { formatCurrency } from '../../compartilhado/formatters';
import { frasesDaPerua } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * A PERUA NA CONTA DOS PLANOS (05/10/2026, decisão do dono).
 *
 * A mesma miniatura do Início explica a conta: "14 crianças × R$ 5,90". A
 * conta é pelas crianças da turma, nunca pelas vagas.
 *
 * ⚠️ ELA NÃO SUGERE ENCHER A PERUA. Vaga livre é dado dele, e a tela de
 * planos usar o espaço vazio para vender criança seria a plataforma metida no
 * negócio que ela hospeda — o mesmo cuidado de não avisar as famílias dele.
 *
 * A multiplicação só aparece até 40 crianças: acima disso a taxa é marginal
 * (`TAXA_ACIMA_DE_40`) e "N × taxa" não fecharia com o valor ao lado.
 */
export default function PeruaNaConta({ criancas = [], taxa }) {
  const { vagas } = useVagasDaPerua();
  if (typeof vagas !== 'number') return null;
  const n = criancas.length;
  const frases = frasesDaPerua({ vagas, criancas });
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold text-text">Sua perua</span>
        <span className="text-base text-textMuted">{frases.contagem}</span>
      </div>
      <div className="my-2">
        <MiniPerua vagas={vagas} criancas={criancas} />
      </div>
      {n > 0 && n <= 40 && Number.isFinite(taxa) && (
        <p className="text-base text-text">
          {n} {n === 1 ? 'criança' : 'crianças'} × {formatCurrency(taxa)}
        </p>
      )}
      <p className="text-base text-textMuted">Vaga livre não entra na conta.</p>
    </div>
  );
}
