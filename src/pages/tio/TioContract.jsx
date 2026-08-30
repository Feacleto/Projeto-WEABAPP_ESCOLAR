import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, MessageCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import ContractView from '../../components/contract/ContractView';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { buildContractData, hasAcceptedContract } from '../../services/contractService';

/**
 * Tela do Tio: visualizar contrato da criança + imprimir/salvar PDF +
 * enviar pro responsável via WhatsApp.
 *
 * Rota: /tio/children/:id/contract
 */
export default function TioContract() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { child, loading } = useChild(id);

  const contractData = useMemo(() => {
    if (!child || !profile) return null;
    return buildContractData({ child, admin: profile });
  }, [child, profile]);

  if (loading || !contractData) {
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

  const accepted = hasAcceptedContract(child);
  const acceptanceInfo = accepted
    ? {
        name: child.contractAcceptedName,
        acceptedAt: child.contractAcceptedAt?.toDate?.()?.toISOString() || null,
        hash: child.contractHash,
        version: child.contractVersion,
      }
    : null;

  const onPrint = () => {
    window.print();
  };

  const onShareWhatsApp = () => {
    if (!child.parentPhone) {
      toast.error('Telefone do responsável não cadastrado.');
      return;
    }
    const phone = String(child.parentPhone).replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const appUrl = window.location.origin;
    const message = encodeURIComponent(
      `Olá ${child.parentName || ''}! Sou ${profile.name || 'do Tio Nino'}.\n\n` +
        `Aqui está o código de acesso ao app pra você cadastrar e visualizar o ` +
        `contrato de transporte escolar do(a) ${child.name}:\n\n` +
        `*Código:* ${child.inviteCode}\n\n` +
        `Baixe o app: ${appUrl}\n\n` +
        `Ao entrar, você verá o contrato pra ler e aceitar.`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
  };

  return (
    <>
      <Header title="Contrato" showBack />

      <div className="p-5 space-y-4">
        {/* Status do aceite */}
        {accepted ? (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 border border-primaryBorder p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary leading-tight">
                Aceito pelo responsável
              </p>
              <p className="text-xs text-primary mt-0.5">
                {child.contractAcceptedName}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-warningBorder p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-warningText leading-tight">
                Aguardando aceite
              </p>
              <p className="text-xs text-warningText mt-0.5">
                O responsável aceita quando entrar no app com o código de
                convite.
              </p>
            </div>
          </div>
        )}

        {/* Ações (print:hidden) */}
        <div className="grid grid-cols-2 gap-2 print:hidden">
          <Button
            variant="secondary"
            icon={Printer}
            onClick={onPrint}
            size="md"
          >
            Imprimir / PDF
          </Button>
          <Button
            variant="success"
            icon={MessageCircle}
            onClick={onShareWhatsApp}
            size="md"
          >
            Enviar pelo WhatsApp
          </Button>
        </div>

        {/* Conteúdo do contrato */}
        <div className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none">
          <ContractView
            data={contractData}
            acceptanceInfo={acceptanceInfo}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap w-full text-xs text-textMuted py-2 print:hidden"
        >
          Voltar
        </button>
      </div>
    </>
  );
}
