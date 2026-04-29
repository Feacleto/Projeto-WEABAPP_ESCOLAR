import { useNavigate, useParams } from 'react-router-dom';
import {
  GraduationCap,
  School,
  Home,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Skeleton from '../components/common/Skeleton';
import Button from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import StatusBadge from '../components/children/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useChild } from '../hooks/useChild';
import { deactivateChild } from '../services/childrenService';
import { PERIOD_LABELS, formatPhone } from '../utils/formatters';

/**
 * Mini-perfil da criança. Funciona pra Tio (com edit/delete) e pra Pai (read-only).
 *
 * Roteamento:
 *   - /tio/children/:id (tio)
 *   - /pai/child        (pai — pega o childId do próprio profile)
 */
export default function ChildDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';

  // Pai: usa o childId do próprio profile, ignora :id na URL
  const childId = isAdmin ? id : profile?.childId;
  const { child, loading } = useChild(childId);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const onDeactivate = async () => {
    if (!child) return;
    setDeactivating(true);
    try {
      await deactivateChild(child.id);
      toast.success(`${child.name} foi removido(a) da lista ativa.`);
      navigate('/tio/children', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover. Tente novamente.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Perfil da criança" showBack />
        <div className="p-4 space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (!child) {
    return (
      <>
        <Header title="Perfil da criança" showBack />
        <div className="p-4">
          <Card>
            <p className="text-sm text-text">
              Cadastro não encontrado.
            </p>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Perfil da criança" showBack />

      <div className="p-4 space-y-4">
        {/* Cabeçalho com avatar grande, nome e status */}
        <Card className="text-center">
          <div className="flex flex-col items-center gap-3">
            <Avatar gender={child.gender} size="xl" />
            <div>
              <h2 className="text-xl font-bold text-text">{child.name}</h2>
              <p className="text-xs text-textMuted mt-1 flex items-center justify-center gap-1">
                <GraduationCap size={12} />
                {PERIOD_LABELS[child.period]}
              </p>
            </div>
            <StatusBadge status={child.status} size="lg" />
          </div>
        </Card>

        {/* Escola */}
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <School size={16} className="text-primary" />
            Escola
          </h3>
          <InfoRow label="Nome" value={child.school} />
          {child.schoolAddress && (
            <InfoRow
              icon={MapPin}
              label="Endereço"
              value={child.schoolAddress}
            />
          )}
        </Card>

        {/* Endereço de casa */}
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Home size={16} className="text-primary" />
            Endereço de casa
          </h3>
          <InfoRow icon={MapPin} label="Endereço" value={child.address} />
        </Card>

        {/* Responsáveis */}
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-text">
            Responsáveis
          </h3>

          <div className="space-y-2 pb-2 border-b border-gray-100 last:border-0 last:pb-0">
            <p className="text-[11px] text-textMuted uppercase tracking-wide">
              Principal
            </p>
            <InfoRow label="Nome" value={child.parentName} />
            {child.parentEmail && (
              <InfoRow icon={Mail} label="Email" value={child.parentEmail} />
            )}
            {child.parentPhone && (
              <PhoneRow
                phone={child.parentPhone}
                name={child.parentName || 'responsável'}
                childName={child.name}
              />
            )}
          </div>

          {(child.parent2Name || child.parent2Phone) && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-textMuted uppercase tracking-wide">
                Segundo responsável
              </p>
              {child.parent2Name && (
                <InfoRow label="Nome" value={child.parent2Name} />
              )}
              {child.parent2Phone && (
                <PhoneRow
                  phone={child.parent2Phone}
                  name={child.parent2Name || 'responsável'}
                  childName={child.name}
                />
              )}
            </div>
          )}
        </Card>

        {/* Observações */}
        {child.notes && (
          <Card className="space-y-2">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <StickyNote size={16} className="text-primary" />
              Observações
            </h3>
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">
              {child.notes}
            </p>
          </Card>
        )}

        {/* Convite pendente — só faz sentido pro tio ver */}
        {isAdmin && child.inviteStatus === 'pending' && (
          <Card className="bg-warning/10 border border-warning/30">
            <p className="text-sm font-semibold text-text">
              Convite pendente
            </p>
            <p className="text-xs text-textMuted mt-1">
              O responsável ainda não criou a conta. Entregue o código:
            </p>
            <p className="text-2xl font-bold tracking-widest text-text mt-2">
              {child.inviteCode}
            </p>
          </Card>
        )}

        {/* Ações do tio */}
        {isAdmin && (
          <Button
            variant="ghost"
            icon={Trash2}
            className="!text-danger"
            onClick={() => setConfirmDeactivate(true)}
          >
            Remover criança
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        title={`Remover ${child.name}?`}
        description="A criança vai sair da lista ativa, mas o histórico de pagamentos é preservado. Você pode reativar depois manualmente."
        confirmLabel="Sim, remover"
        variant="danger"
        loading={deactivating}
        onConfirm={onDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={14} className="text-textMuted shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-textMuted">{label}</p>
        <p className="text-sm text-text break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

function PhoneRow({ phone, name, childName }) {
  const phoneDigits = String(phone).replace(/\D/g, '');
  const phoneE164 = phoneDigits.startsWith('55')
    ? phoneDigits
    : `55${phoneDigits}`;
  const text = encodeURIComponent(
    `Olá, ${name}! Sou do Tio Nino Digital, sobre ${childName}.`
  );
  const waLink = `https://wa.me/${phoneE164}?text=${text}`;

  return (
    <div className="flex items-center gap-2">
      <Phone size={14} className="text-textMuted shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-textMuted">Telefone</p>
        <p className="text-sm text-text">{formatPhone(phone)}</p>
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-success tap px-2 py-1 bg-success/10 rounded-lg"
      >
        WhatsApp
      </a>
    </div>
  );
}
