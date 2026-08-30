import { useEffect, useMemo, useState } from 'react';
import { destinoAposSair } from '../../utils/frentes';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, LogOut, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import ContractView from './ContractView';
import Skeleton from '../common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import {
  buildContractData,
  acceptContract,
  computeContractHash,
} from '../../services/contractService';
import {
  notifyContractAccepted,
} from '../../services/notificationsService';

/**
 * Gate de aceite do contrato — só pro Pai/Mãe.
 *
 * Bloqueia 100% o app até o responsável:
 *   1. Ler o contrato preenchido
 *   2. Digitar o nome completo (snapshot pra evidência)
 *   3. Marcar o checkbox de aceite
 *   4. Tocar em "Aceitar contrato"
 *
 * O serviço calcula um hash SHA-256 do conteúdo e grava junto com timestamp
 * do servidor — evidência forense razoável pra MVP.
 *
 * Se o pai não concordar, pode tocar em "Não concordo, sair" → faz logout
 * (não exclui conta — assim o Tio consegue conversar e reativar). Vê uma
 * mensagem orientando a falar com o motorista.
 */
export default function ContractAcceptanceGate() {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useAuth();
  const { child, loading: childLoading } = useActiveChild();
  const { admin, loading: adminLoading } = useAdminProfile(child?.adminUid);

  const [confirmName, setConfirmName] = useState('');
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showReject, setShowReject] = useState(false);

  // Pre-fill com o nome do pai (do users/{uid}) — facilita pra idoso
  useEffect(() => {
    if (profile?.name && !confirmName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmName(profile.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.name]);

  const contractData = useMemo(() => {
    if (!child || !admin) return null;
    return buildContractData({ child, admin });
  }, [child, admin]);

  if (childLoading || adminLoading || !contractData) {
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
              // Este gate é SÓ do responsável, e ia pra `/` fixo: quem
              // desistia aqui caía na página que vende associação.
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

  const isValidName =
    confirmName.trim().split(/\s+/).filter(Boolean).length >= 2;

  const onAccept = async () => {
    if (!isValidName) {
      toast.error('Digite seu nome completo (nome + sobrenome).');
      return;
    }
    if (!checked) {
      toast.error('Marque o "Li e aceito as condições" pra continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const hash = await computeContractHash(contractData);
      await acceptContract({
        childId: child.id,
        parentUid: user.uid,
        parentName: confirmName,
        contractHash: hash,
      });

      // Notifica o Tio
      notifyContractAccepted({
        adminUid: admin?.uid || admin?.id,
        parentName: confirmName,
        childName: child.name,
      });

      await refreshProfile?.();
      toast.success('Contrato aceito. Bem-vindo(a)!');
    } catch (err) {
      console.error('Falha ao aceitar contrato:', err);
      toast.error('Não foi possível registrar o aceite. Tente novamente.');
      setSubmitting(false);
    }
  };

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
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">
              Fale com o motorista
            </h2>
            <p className="text-sm text-textMuted mt-2 leading-relaxed">
              Pra usar o app, é preciso aceitar o contrato de prestação de
              serviço. Se você tem dúvidas, fale com {admin?.name || 'o motorista'}{' '}
              {admin?.phone && (
                <span>
                  pelo telefone{' '}
                  <strong className="text-text">{admin.phone}</strong>
                </span>
              )}{' '}
              pra esclarecer antes de aceitar.
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
    <div className="min-h-screen bg-bg pb-32">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-card border-b border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-textMuted">
              1º acesso
            </p>
            <h1 className="text-base font-bold text-text leading-tight">
              Leia e aceite o contrato
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
        <div className="rounded-2xl border border-gray-200 bg-surface p-4">
          <p className="text-sm font-semibold text-text">
            Já combinou tudo com o motorista?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-textMuted">
            Então este é o mesmo acordo, escrito aqui pra vocês dois poderem
            consultar. <strong>Confira o valor e o dia do vencimento</strong> —
            se estiver diferente do que vocês combinaram, fale com ele antes de
            aceitar.
          </p>
        </div>
      </div>

      {/* Conteúdo do contrato */}
      <div className="p-5">
        <div className="bg-card rounded-3xl shadow-sm p-6">
          <ContractView data={contractData} />
        </div>
      </div>

      {/* Form de aceite — fixo no rodapé */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto bg-card border-t border-gray-200 shadow-2xl shadow-black/10 p-4 space-y-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
      >
        <input
          type="text"
          placeholder="Digite seu nome completo"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          className="w-full h-12 rounded-xl border-2 border-gray-200 px-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoComplete="name"
          disabled={submitting}
        />

        <label className="flex items-start gap-2.5 text-sm text-text cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={submitting}
            className="w-5 h-5 rounded mt-0.5 shrink-0 accent-primary"
          />
          <span className="leading-snug">
            Li e aceito todas as cláusulas deste contrato de prestação de
            serviços de transporte escolar.
          </span>
        </label>

        <Button
          icon={CheckCircle2}
          loading={submitting}
          disabled={!isValidName || !checked}
          onClick={onAccept}
        >
          Aceitar contrato
        </Button>

        <button
          type="button"
          onClick={() => setShowReject(true)}
          disabled={submitting}
          className="tap w-full text-xs text-textMuted py-1 hover:text-text disabled:opacity-50"
        >
          Não concordo
        </button>
      </div>
    </div>
  );
}
