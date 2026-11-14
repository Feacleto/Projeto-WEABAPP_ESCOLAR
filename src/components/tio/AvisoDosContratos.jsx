import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { contagemDoAviso } from '../../dominio/cobranca/avisoDosContratos.js';
import { linhasDoAviso, DESTINO } from '../../marca/contratosQueVencem.js';

/**
 * OS CONTRATOS ACABAM — o aviso do Início (RC1.1, 14/11/2026).
 *
 * A mensalidade de uma criança só nasce DENTRO da vigência do contrato, e a
 * vigência padrão acaba em 31/12. Quem foi cadastrado antes de ~1º de
 * novembro tem janeiro sem cobrança, e nada dizia isso.
 *
 * ⚠️ O NÚMERO É O DA FILA "RENOVAR CONTRATOS", e é por construção: a conta
 * (`dominio/cobranca/avisoDosContratos.js`) LÊ a fila de renovação, não tem
 * régua própria. O toque leva a ela (`/tio/finance/renovar`), onde cada linha
 * diz em que pé está: renovar, esperando a família assinar, ou o primeiro
 * contrato ainda sem assinatura. O texto, em `marca/contratosQueVencem.js`.
 *
 * ⚠️ É ÂMBAR PORQUE É ALGO A ATENDER. Diz ONDE renovar, nunca que já renovou:
 * renovar é mandar um contrato novo, e ele só vale quando a família assina.
 *
 * ⚠️ NÃO É NOTIFICAÇÃO: nada é gravado e nenhum push sai daqui. Ele aparece
 * quando o motorista abre o Início, e some quando a conta zera.
 *
 * Recebe as crianças POR PROP: o Início já assina `children`, e reassinar aqui
 * abriria uma segunda leitura permanente do mesmo dado.
 */
export default function AvisoDosContratos({ criancas, hoje, className = '' }) {
  const navigate = useNavigate();
  const linhas = useMemo(
    () => linhasDoAviso(contagemDoAviso(criancas, hoje || new Date())),
    [criancas, hoje]
  );
  if (!linhas.length) return null;

  return (
    <section data-aviso="contratos-que-vencem" className={`space-y-2.5 ${className}`}>
      {linhas.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => navigate(DESTINO)}
          className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warningChip text-warningText">
            <FileText size={19} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-text">{l.titulo}</span>
            <span className="block text-base text-textBody">{l.sub}</span>
            <span className="block text-base font-semibold text-warningText">{l.acao}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-warningText" />
        </button>
      ))}
    </section>
  );
}
