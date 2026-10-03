import { useState } from 'react';
import { destinoAposSair } from '../../dominio/vitrine/frentes';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogOut, FileText } from 'lucide-react';
import Button from '../common/Button';
import ContractView from './ContractView';
import PainelDeAceite from './PainelDeAceite';
import Skeleton from '../common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useContratos } from '../../hooks/useContratos';

/**
 * Gate de aceite do PRIMEIRO contrato — só pro Pai/Mãe.
 *
 * Bloqueia o app até o responsável ler, digitar o nome completo, marcar o
 * aceite e tocar em "Aceitar contrato".
 *
 * ⚠️ DESDE 02/10/2026 O QUE ELA LÊ É A VERSÃO GRAVADA
 * (`children/{id}/contratos/{n}`), não um texto montado na hora, e quem
 * registra o aceite e o hash é o servidor (`PainelDeAceite` →
 * `aceitarContrato`). O portão só aparece quando há versão esperando aceite
 * (`ParentContractGate`, em App.jsx): sem contrato emitido, ela passa —
 * bloqueá-la por um contrato que o MOTORISTA não emitiu seria punir quem não
 * tem como consertar.
 *
 * MUDANÇA DEPOIS DO ACEITE (o aditivo) NÃO PASSA POR AQUI: ela não bloqueia o
 * app — vale o contrato de antes até ela aceitar, e o aviso mora no Início e
 * em /pai/contrato.
 *
 * Se o pai não concordar, pode tocar em "Não concordo" → explica e oferece
 * sair (não exclui conta — assim o Tio consegue conversar).
 */
export default function ContractAcceptanceGate() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const { child, loading: childLoading } = useActiveChild();
  const { admin, loading: adminLoading } = useAdminProfile(child?.adminUid);
  const { aguardando, loading: contratosLoading } = useContratos(child, { daFamilia: true });

  const [rejecting, setRejecting] = useState(false);
  const [showReject, setShowReject] = useState(false);

  if (childLoading || adminLoading || contratosLoading || (child && !aguardando)) {
    return (
      <div className="min-h-screen bg-bg p-5 space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-lg font-bold text-text">
            Cadastro não encontrado
          </h2>
          <p className="text-sm text-textMuted mt-2">
            Sua conta ainda não está vinculada a uma criança.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              const destino = destinoAposSair(profile?.role);
              await logout();
              navigate(destino, { replace: true });
            }}
            className="mt-4"
          >
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const onReject = async () => {
    setRejecting(true);
    try {
      // O papel ANTES do logout: depois dele o perfil é null.
      const destino = destinoAposSair(profile?.role);
      await logout();
      navigate(destino, { replace: true });
    } catch (err) {
      console.error(err);
      setRejecting(false);
    }
  };

  // Tela de "não concordo" — explica e oferece sair
  if (showReject) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-5">
        <div className="bg-card rounded-3xl shadow-lg p-6 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-warningChip flex items-center justify-center">
            <AlertCircle size={32} className="text-warningText" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">
              Fale com o motorista
            </h2>
            <p className="text-sm text-textMuted mt-2 leading-relaxed">
              Pra usar o app, é preciso assinar o contrato de prestação de
              serviço. Se você tem dúvidas, fale com {admin?.name || 'o motorista'}{' '}
              {admin?.phone && (
                <span>
                  pelo telefone{' '}
                  <strong className="text-text">{admin.phone}</strong>
                </span>
              )}{' '}
              pra esclarecer antes de assinar.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              variant="primary"
              onClick={() => setShowReject(false)}
            >
              Voltar e ler de novo
            </Button>
            <Button
              variant="ghost"
              icon={LogOut}
              loading={rejecting}
              onClick={onReject}
            >
              Sair da conta por agora
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-80">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-card border-b border-neutro p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primaryChip text-primary flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="rotulo">
              1º acesso
            </p>
            <h1 className="text-base font-bold text-text leading-tight">
              Leia e assine o contrato
            </h1>
          </div>
        </div>
      </header>

      {/* MIGRAÇÃO: ELE PROVAVELMENTE JÁ COMBINOU ISSO NO PAPEL.
        *
        * O motorista que chega ao app já tem acordo com as famílias dele. O
        * responsável abre a primeira tela e lê "leia e aceite o contrato" —
        * e a reação natural é "de novo? eu já assinei um".
        *
        * Sem essa frase, o aceite parece um segundo contrato aparecendo do
        * nada, e a pessoa desconfia justamente no primeiro contato com o app.
        * Com ela, o aceite vira o que de fato é: o mesmo combinado, agora
        * registrado num lugar em que os dois conseguem consultar.
        *
        * Ela não promete que os valores estão certos — quem digitou foi o
        * motorista. Promete que é o mesmo acordo, e manda conferir. Se o
        * número estiver errado, é AQUI que a pessoa tem que reclamar, antes
        * de assinar, e não depois da primeira cobrança. */}
      <div className="px-5 pt-5">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text">
            Já combinou tudo com o motorista?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-textMuted">
            Então este é o mesmo acordo, escrito aqui pra vocês dois poderem
            consultar. <strong>Confira o valor e o dia do vencimento</strong> —
            se estiver diferente do que vocês combinaram, fale com ele antes de
            assinar.
          </p>
        </div>
      </div>

      {/* Conteúdo do contrato — a versão GRAVADA */}
      <div className="p-5">
        <div className="bg-card rounded-3xl shadow-sm p-6">
          <ContractView data={aguardando.dados} numero={aguardando.numero} tipo={aguardando.tipo} />
        </div>
      </div>

      <PainelDeAceite
        child={child}
        contrato={aguardando}
        adminUid={admin?.uid || admin?.id || child.adminUid}
        onNaoConcordo={() => setShowReject(true)}
      />
    </div>
  );
}
