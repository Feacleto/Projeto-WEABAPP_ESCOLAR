import { useMemo } from 'react';
import { Printer, FileText } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ContractView from '../../components/contract/ContractView';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import {
  buildContractData,
  hasAcceptedContract,
} from '../../services/contractService';

/**
 * O contrato de transporte, do lado do responsável.
 *
 * POR QUE ISTO FALTAVA
 * O pai era obrigado a aceitar o contrato pra entrar no app (o gate em
 * App.jsx) e depois NUNCA MAIS conseguia lê-lo: a única rota existente era
 * /tio/children/:id/contract, restrita ao motorista.
 *
 * Isso é ruim por dois motivos, e o segundo é o pior:
 *   - Prático: ele não lembra o valor combinado, o horário, a regra de
 *     reajuste — e acaba perguntando no WhatsApp, que é justamente o que o
 *     app deveria substituir.
 *   - De confiança: fazer alguém aceitar um documento e depois esconder o
 *     documento é o oposto de transparência. Se o app pede o aceite, o app
 *     guarda a cópia.
 *
 * A mesma tela do tio, sem as ações dele (editar, mandar por WhatsApp) e com
 * o botão de salvar em PDF, que é o que dá a ele uma cópia de verdade.
 */
export default function PaiContract() {
  const { child, loading } = useActiveChild();
  const { admin, loading: adminLoading } = useAdminProfile(child?.adminUid);

  const contractData = useMemo(() => {
    if (!child || !admin) return null;
    return buildContractData({ child, admin });
  }, [child, admin]);

  if (loading || adminLoading) {
    return (
      <>
        <Header title="Contrato" showBack />
        <div className="p-5 space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (!contractData) {
    return (
      <>
        <Header title="Contrato" showBack />
        <EmptyState
          icon={FileText}
          title="Contrato não disponível"
          description="Fale com o motorista — ele gera o contrato na ficha da criança."
        />
      </>
    );
  }

  const accepted = hasAcceptedContract(child);
  const acceptanceInfo = accepted
    ? {
        name: child.contractAcceptedName,
        acceptedAt: child.contractAcceptedAt?.toDate?.()?.toISOString() || null,
        hash: child.contractHash,
        version: child.contractVersion,
      }
    : null;

  return (
    <div className="pb-28">
      <Header title="Contrato" showBack />

      <div className="p-5 space-y-4">
        <div className="bg-card border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-text">
            Seu contrato com {admin.companyName || admin.name || 'o motorista'}
          </p>
          <p className="text-xs text-textMuted mt-1">
            {accepted
              ? 'Você aceitou este contrato. Guarde uma cópia se quiser.'
              : 'Contrato do transporte escolar da sua criança.'}
          </p>
        </div>

        {/* print:* deixa a impressão limpa — é assim que ele salva em PDF
          * pelo próprio celular, sem precisar de nada instalado. */}
        <div className="print:hidden">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Salvar em PDF ou imprimir
          </Button>
        </div>

        <div className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none">
          <ContractView data={contractData} acceptanceInfo={acceptanceInfo} />
        </div>
      </div>
    </div>
  );
}
