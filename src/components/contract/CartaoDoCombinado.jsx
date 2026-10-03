import { useState } from 'react';
import { FileText, Pencil, ChevronRight, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../common/Card';
import EditarCombinadoSheet from './EditarCombinadoSheet';
import { useContratos } from '../../hooks/useContratos';
import { useGarantirContrato } from '../../hooks/useGarantirContrato';
import { useAuth } from '../../hooks/useAuth';
import { retirarMudanca } from '../../services/contratosDaFamiliaService';
import { dadosDaContratadaFaltando } from '../../services/contractService';
import { formatBRL } from '../../compartilhado/formatters';
import {
  dataBR,
  estadoDoContrato,
  vigenciaDaCrianca,
} from '../../dominio/cobranca/contratoDaFamilia.js';

/**
 * CONTRATO E MENSALIDADE, NUM CARTÃO SÓ (02/10/2026) — na ficha da criança,
 * do lado do motorista.
 *
 * Eram duas coisas separadas: o valor só existia no cadastro (sem como mudar)
 * e o contrato era uma linha "Aguardando aceite" que levava a outra tela. O
 * combinado é UM assunto — quanto, até quando, e se a família concordou —, e
 * as duas ações dele (mudar, ver o documento) moram aqui.
 */
export default function CartaoDoCombinado({ child, onVerContrato }) {
  const { profile } = useAuth();
  const { contratos, vigente, aguardando } = useContratos(child);
  useGarantirContrato(child, contratos);
  const [editando, setEditando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const estado = estadoDoContrato(child);
  const faltaDados = dadosDaContratadaFaltando(profile).length > 0;
  const periodo = vigente?.dados?.period;
  const vig = periodo
    ? { inicio: periodo.inicio, fim: periodo.fim }
    : vigenciaDaCrianca(child);

  const desfazer = async () => {
    setDesfazendo(true);
    try {
      await retirarMudanca({ child });
      toast.success('Contrato novo cancelado. Vale o que a família assinou.');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra desfazer. Tente de novo.');
    } finally {
      setDesfazendo(false);
    }
  };

  const status = {
    'sem-contrato': faltaDados
      ? { cor: 'text-warningText', texto: 'Complete seus dados para o contrato ser emitido.' }
      : { cor: 'text-textMuted', texto: 'Preparando o contrato…' },
    aguardando: { cor: 'text-warningText', texto: 'Esperando a família assinar.' },
    aceito: {
      cor: 'text-accentText',
      texto: `Assinado por ${child.contratoVigente?.aceitoNome || child.contractAcceptedName || 'responsável'}.`,
    },
    mudanca: { cor: 'text-warningText', texto: 'Contrato novo esperando a família assinar.' },
  }[estado];

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <FileText size={16} className="text-primary" />
            Contrato e mensalidade
          </h3>
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={!contratos}
            className="tap -mr-1 -mt-1 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Pencil size={14} /> Mudar
          </button>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-textMuted">Mensalidade</dt>
            <dd className="font-semibold text-text">
              {child.monthlyFee ? formatBRL(child.monthlyFee) : 'não definida'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-textMuted">Vence</dt>
            <dd className="font-semibold text-text">todo dia {child.dueDay || 10}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-textMuted">Prazo</dt>
            <dd className="font-semibold text-text">
              {dataBR(vig.inicio)} a {dataBR(vig.fim)}
            </dd>
          </div>
        </dl>

        <p className={`text-sm font-semibold ${status.cor}`}>{status.texto}</p>

        {estado === 'mudanca' && aguardando?.mudancas?.length > 0 && (
          <div className="rounded-xl bg-warningSoft p-3">
            <ul className="space-y-1 text-sm text-text">
              {aguardando.mudancas.map((m) => (
                <li key={m.rotulo}>
                  {m.rotulo}: <span className="text-textMuted line-through">{m.de}</span> →{' '}
                  <strong>{m.para}</strong>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={desfazer}
              disabled={desfazendo}
              className="tap mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-warningText disabled:opacity-50"
            >
              <Undo2 size={15} /> Cancelar o contrato novo
            </button>
          </div>
        )}

        {onVerContrato && (
        <button
          type="button"
          onClick={onVerContrato}
          className="tap flex min-h-11 w-full items-center justify-between rounded-xl border border-border px-3 text-sm font-semibold text-text"
        >
          Ver o contrato
          <ChevronRight size={18} className="text-textMuted" />
        </button>
        )}
      </Card>

      <EditarCombinadoSheet
        key={`${child.monthlyFee}-${child.dueDay}-${child.vigenciaInicio}-${child.vigenciaFim}-${editando}`}
        open={editando}
        onClose={() => setEditando(false)}
        child={child}
        contratos={contratos}
      />
    </>
  );
}
