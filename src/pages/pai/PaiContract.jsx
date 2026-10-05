import { useMemo, useState } from 'react';
import { Printer, FileText, AlertCircle } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import AppSheet from '../../components/common/AppSheet';
import ContractView, { ResumoDoCombinado } from '../../components/contract/ContractView';
import PainelDeAceite from '../../components/contract/PainelDeAceite';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useContratos } from '../../hooks/useContratos';
import { buildContractData } from '../../services/contractService';
import { formatPhone } from '../../compartilhado/formatters';

/**
 * O contrato de transporte, do lado do responsável.
 *
 * POR QUE ISTO FALTAVA
 * O pai era obrigado a aceitar o contrato pra entrar no app e depois NUNCA
 * MAIS conseguia lê-lo. Fazer alguém aceitar um documento e depois esconder o
 * documento é o oposto de transparência: se o app pede o aceite, o app guarda
 * a cópia.
 *
 * DESDE 02/10/2026 é também onde ela ACEITA UMA MUDANÇA (o aditivo). A
 * mudança não bloqueia o app — vale o contrato de antes até ela aceitar —,
 * então o lugar dela é aqui, com o que mudou em destaque no topo, e o aviso
 * no Início leva para cá.
 */
export default function PaiContract() {
  const { child, loading } = useActiveChild();
  const { admin, loading: adminLoading } = useAdminProfile(child?.adminUid);
  const { vigente, aguardando, loading: contratosLoading } = useContratos(child, { daFamilia: true });
  const [naoConcordo, setNaoConcordo] = useState(false);

  // Aceite antigo, anterior às versões gravadas: o texto é o que os campos dizem.
  const legado = useMemo(() => {
    if (!child || !admin || vigente || aguardando) return null;
    // O aceite antigo foi dado lendo o TEXTO 1 — remontá-lo no texto de hoje
    // mostraria cláusulas que ela não leu. Sem aceite, é só prévia.
    return buildContractData({
      child,
      admin,
      ...(child.contractAcceptedAt ? { versaoDoTexto: 1 } : {}),
    });
  }, [child, admin, vigente, aguardando]);

  if (loading || adminLoading || contratosLoading) {
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

  const mostrada = aguardando || vigente;
  const dados = mostrada?.dados || legado;

  if (!dados) {
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

  const acceptanceInfo =
    mostrada?.status === 'aceito'
      ? {
          name: mostrada.aceitoNome,
          acceptedAt: mostrada.aceitoEm?.toDate?.()?.toISOString() || null,
          hash: mostrada.hash,
        }
      : !mostrada && child.contractAcceptedAt
        ? {
            name: child.contractAcceptedName,
            acceptedAt: child.contractAcceptedAt?.toDate?.()?.toISOString() || null,
            hash: child.contractHash,
            version: child.contractVersion,
          }
        : null;

  const nomeDele = admin.marcaNome || admin.name || 'o motorista';

  return (
    <div className={aguardando ? 'pb-40' : 'pb-28'}>
      <Header title="Contrato" showBack />

      <div className="p-5 space-y-4">
        {aguardando ? (
          <div className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
            {/* ⚠️ UM CONTRATO NOVO PARA ASSINAR, NÃO UMA "MUDANÇA" (decisão do
              * dono, 03/10/2026). Ela lê o contrato inteiro e assina, como no
              * primeiro — a lista "o que muda" e o "aceito a mudança" saíram
              * da tela dela. */}
            <p className="text-base font-bold text-warningText">
              {aguardando.tipo === 'aditivo'
                ? 'Contrato novo para assinar'
                : 'O contrato espera a sua assinatura'}
            </p>
            <p className="mt-1 text-base leading-relaxed text-warningText">
              {aguardando.tipo === 'aditivo'
                ? 'O motorista mandou um contrato novo. Leia com calma: enquanto você não assinar, vale o contrato atual.'
                : 'Confira o valor e o dia do vencimento antes de assinar.'}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-base font-semibold text-text">Seu contrato com {nomeDele}</p>
            <p className="text-base text-textMuted mt-1">
              {acceptanceInfo
                ? 'Você assinou este contrato. Guarde uma cópia se quiser.'
                : 'Contrato do transporte escolar da sua criança.'}
            </p>
          </div>
        )}

        {/* O resumo do combinado ANTES do texto longo — o mesmo do portão,
          * lido dos mesmos dados do contrato logo abaixo. */}
        <ResumoDoCombinado data={dados} />

        {/* print:* deixa a impressão limpa — é assim que ele salva em PDF
          * pelo próprio celular, sem precisar de nada instalado. */}
        <div className="print:hidden">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Salvar em PDF ou imprimir
          </Button>
        </div>

        <div className="bg-card rounded-3xl shadow-sm p-5 print:p-0 print:shadow-none print:rounded-none">
          <ContractView
            data={dados}
            numero={null}
            acceptanceInfo={acceptanceInfo}
          />
        </div>
      </div>

      {aguardando && (
        <PainelDeAceite
          child={child}
          contrato={aguardando}
          adminUid={child.adminUid}
          onNaoConcordo={() => setNaoConcordo(true)}
        />
      )}

      <AppSheet
        open={naoConcordo}
        onClose={() => setNaoConcordo(false)}
        title="Fale com o motorista"
        icon={AlertCircle}
      >
        <div className="space-y-3 px-5 pb-6 text-base leading-relaxed text-text">
          <p>
            Se algo não está como vocês combinaram, converse com {admin.name || nomeDele}
            {admin.phone ? (
              <>
                {' '}pelo telefone <strong>{formatPhone(admin.phone)}</strong>
              </>
            ) : null}{' '}
            antes de assinar.
          </p>
          {aguardando?.tipo === 'aditivo' && (
            <p className="text-textMuted">
              Enquanto você não assinar, continua valendo o contrato atual.
            </p>
          )}
          <Button variant="secondary" onClick={() => setNaoConcordo(false)}>
            Voltar ao contrato
          </Button>
        </div>
      </AppSheet>
    </div>
  );
}
