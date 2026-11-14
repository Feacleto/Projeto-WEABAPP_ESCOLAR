import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { contratosQueVencem } from '../../dominio/cobranca/contratosQueVencem.js';
import { linhasDoAviso } from '../../marca/contratosQueVencem.js';

/**
 * OS CONTRATOS ACABAM — o aviso do Início (RC1.1, 14/11/2026).
 *
 * A mensalidade de uma criança só nasce DENTRO da vigência do contrato, e a
 * vigência padrão acaba em 31/12. Quem foi cadastrado antes de ~1º de
 * novembro tem janeiro sem cobrança, e nada dizia isso. A conta está em
 * `dominio/cobranca/contratosQueVencem.js`; o texto, em
 * `marca/contratosQueVencem.js`.
 *
 * ⚠️ É ÂMBAR PORQUE É ALGO A ATENDER, e é só leitura: o toque leva à lista de
 * crianças. NÃO diz "renovar aqui" — o fluxo de renovação (novo aceite da
 * família) ainda não existe, e prometê-lo seria o aviso mentindo.
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
    () => linhasDoAviso(contratosQueVencem(criancas, hoje || new Date())),
    [criancas, hoje]
  );
  if (!linhas.length) return null;

  return (
    <section data-aviso="contratos-que-vencem" className={`space-y-2.5 ${className}`}>
      {linhas.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => navigate('/tio/children')}
          className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warningChip text-warningText">
            <FileText size={19} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-text">{l.titulo}</span>
            <span className="block text-base text-textBody">{l.sub}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-warningText" />
        </button>
      ))}
    </section>
  );
}
