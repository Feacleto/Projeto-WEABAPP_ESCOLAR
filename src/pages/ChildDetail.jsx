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
  Camera,
  FileText,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import InviteShare from '../components/children/InviteShare';
import ChildPaymentHistory from '../components/payments/ChildPaymentHistory';
import Avatar from '../components/common/Avatar';
import Skeleton from '../components/common/Skeleton';
import Button from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import StatusBadge from '../components/children/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useChild } from '../hooks/useChild';
import { deactivateChildAndParent } from '../services/accountService';
import {
  uploadChildPhoto,
  deleteChildPhoto,
} from '../services/photoService';
import { setChildPhotoURL } from '../services/childrenService';
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
  const { role, activeChildId } = useAuth();
  const isAdmin = role === 'admin';

  // Pai: usa o childId do próprio profile, ignora :id na URL
  // Pai: o filho em foco vem do seletor (AuthContext), não mais do único
  // childId do perfil. Admin segue usando o :id da URL.
  const childId = isAdmin ? id : activeChildId;
  const { child, loading } = useChild(childId);

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const onDeactivate = async () => {
    if (!child) return;
    setDeactivating(true);
    try {
      const { parentRemoved } = await deactivateChildAndParent({
        childId: child.id,
      });
      toast.success(
        parentRemoved
          ? `${child.name} e o responsável foram removidos.`
          : `${child.name} foi removido(a) da lista ativa.`
      );
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
        {/* Cabeçalho com avatar grande, nome e status. Tanto Tio quanto Pai
          * podem trocar a foto da criança — backend valida permissão por
          * parentUid (ver firestore.rules + storage.rules). */}
        <Card className="text-center">
          <div className="flex flex-col items-center gap-3">
            <ChildPhotoEditor child={child} />
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
          <Card className="bg-warning/10 border border-warning/30 space-y-3">
            <div>
              <p className="text-sm font-semibold text-text">Convite pendente</p>
              <p className="text-xs text-textMuted mt-1">
                O responsável ainda não entrou. Mande o link — a conta dele se
                cria por lá.
              </p>
            </div>
            <InviteShare
              code={child.inviteCode}
              childName={child.name}
              parentPhone={child.parentPhone}
            />
          </Card>
        )}

        {/* Histórico de mensalidades desta criança.
          * A pergunta que o tio mais faz ao financeiro é "essa família está
          * em dia?" — e ela nasce AQUI, na ficha, não na tela de meses. */}
        <ChildPaymentHistory
          childId={child.id}
          role={isAdmin ? 'admin' : 'parent'}
        />

        {/* O MESMO HISTÓRICO, EM PAPEL
          * O bloco acima responde "essa família está em dia?" na tela, com o
          * dedo. Mas o motorista também precisa LEVAR essa conta pra uma
          * conversa: sentar com o responsável, mandar quando alguém contesta
          * um mês, imprimir e anotar o combinado em cima. Tela não faz isso —
          * então existe uma versão documento, com nome, período e assinatura.
          * Só pro tio: o pai já tem o extrato dele em /pai/finance/report. */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate(`/tio/children/${child.id}/extrato`)}
            className="tap w-full text-left bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Printer size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text leading-tight">
                Extrato de mensalidades
              </p>
              <p className="text-xs text-textMuted mt-0.5">
                Pra imprimir, mandar ou anotar em cima
              </p>
            </div>
            <ChevronRight size={18} className="text-textMuted shrink-0" />
          </button>
        )}

        {/* Acesso ao contrato (Tio) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate(`/tio/children/${child.id}/contract`)}
            className="tap w-full text-left bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-text leading-tight">
                Contrato de transporte
              </p>
              <p className="text-xs text-textMuted mt-0.5">
                {child.contractAcceptedAt
                  ? `Aceito por ${child.contractAcceptedName || 'responsável'}`
                  : 'Aguardando aceite do responsável'}
              </p>
            </div>
            <ChevronRight size={18} className="text-textMuted shrink-0" />
          </button>
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
        description={
          child.parentUid
            ? `A criança sai da lista ativa e o responsável (${child.parentName || 'pai/mãe'}) é desvinculado do app. O histórico de pagamentos é preservado.`
            : 'A criança vai sair da lista ativa. O histórico de pagamentos é preservado.'
        }
        confirmLabel="Sim, remover"
        variant="danger"
        loading={deactivating}
        onConfirm={onDeactivate}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </>
  );
}

/**
 * Avatar grande da criança com botões pra trocar/remover foto.
 * Só renderiza pro admin (storage.rules garantem permissão).
 */
function ChildPhotoEditor({ child }) {
  const [uploading, setUploading] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadChildPhoto(child.id, file);
      await setChildPhotoURL(child.id, url);
      toast.success('Foto atualizada!');
    } catch (err) {
      console.error('Upload de foto da criança falhou:', err);
      toast.error('Não foi possível enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    setUploading(true);
    try {
      await deleteChildPhoto(child.id);
      await setChildPhotoURL(child.id, null);
      toast.success('Foto removida.');
    } catch (err) {
      console.error('Remover foto falhou:', err);
      toast.error('Não foi possível remover.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <Avatar
        photoURL={child.photoURL}
        gender={child.gender}
        seed={child.id}
        kind="child"
        size="xl"
      />
      <label
        htmlFor={`child-photo-${child.id}`}
        className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg cursor-pointer tap"
        aria-label="Trocar foto"
      >
        <Camera size={18} />
        <input
          id={`child-photo-${child.id}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
      </label>
      {child.photoURL && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full bg-card text-danger border border-gray-200 shadow flex items-center justify-center tap"
          aria-label="Remover foto"
        >
          <Trash2 size={16} />
        </button>
      )}
      {uploading && (
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white text-xs font-semibold">
          ...
        </div>
      )}
    </div>
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
