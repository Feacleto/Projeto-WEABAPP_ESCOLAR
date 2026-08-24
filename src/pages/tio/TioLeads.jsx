import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bus, Check, Undo2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import WhatsAppIcon from '../../components/common/WhatsAppIcon';
import { useAuth } from '../../hooks/useAuth';
import AguardandoAprovacao from '../../components/admin/AguardandoAprovacao';
import { watchDriverLeads, setLeadContacted } from '../../services/waitlistService';
import { unmaskPhone } from '../../utils/masks';

const FLEET_LABELS = {
  '1': '1 perua',
  '2-3': '2 a 3 peruas',
  '4+': '4 ou mais peruas',
};

function relativeDay(date) {
  if (!date) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

/**
 * Lista de motoristas que pediram acesso pela página pública.
 *
 * A coleção `waitlistDrivers` já era gravada desde a landing, mas nenhuma
 * tela do app a lia — o único jeito de ver esses nomes era abrir o console
 * do Firebase. Esta tela fecha esse buraco.
 */
export default function TioLeads() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leads, setLeads] = useState(null); // null = carregando
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsub = watchDriverLeads(setLeads, () => setLeads([]));
    return unsub;
  }, []);

  const { pending, contacted } = useMemo(() => {
    const list = leads || [];
    return {
      pending: list.filter((l) => !l.contacted),
      contacted: list.filter((l) => l.contacted),
    };
  }, [leads]);

  const onToggle = async (lead) => {
    setBusyId(lead.id);
    try {
      await setLeadContacted(lead.id, !lead.contacted, user?.uid);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar. Tente de novo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-20 bg-bg px-5 pt-4 pb-3 border-b border-gray-200">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap inline-flex items-center gap-1 text-sm text-textMuted -ml-1 p-1 mb-2"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-xl font-bold text-text">Interessados</h1>
        <p className="text-sm text-textMuted">
          Motoristas que pediram acesso pela página pública.
        </p>
      </header>

      <div className="px-5 pt-4 space-y-4">
        {/* Contas que JÁ EXISTEM e esperam aprovação vêm antes dos leads.
          * A diferença é de urgência: lead é contato que alguém deixou;
          * isto é gente que já se cadastrou e está vendo a tela de espera
          * neste momento. Quem está esperando na porta vem antes de quem
          * deixou recado. */}
        <AguardandoAprovacao />

        {leads === null && (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        )}

        {leads !== null && leads.length === 0 && (
          <EmptyState
            icon={Bus}
            title="Ninguém na fila ainda"
            description="Quando um motorista se inscrever pela página pública, ele aparece aqui."
          />
        )}

        {pending.length > 0 && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              Aguardando contato · {pending.length}
            </p>
            {pending.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                busy={busyId === lead.id}
                onToggle={() => onToggle(lead)}
              />
            ))}
          </section>
        )}

        {contacted.length > 0 && (
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              Já falei · {contacted.length}
            </p>
            {contacted.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                busy={busyId === lead.id}
                onToggle={() => onToggle(lead)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, busy, onToggle }) {
  const created = lead.createdAt?.toDate?.() || null;
  const initials = (lead.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  // wa.me exige só dígitos com DDI. Assume Brasil quando não tem 55 na frente.
  const digits = unmaskPhone(lead.phone || '');
  const waNumber = digits
    ? digits.startsWith('55')
      ? digits
      : `55${digits}`
    : null;
  const waText = encodeURIComponent(
    `Olá, ${lead.name?.split(' ')[0] || ''}! Aqui é do Alô Buzinou, sobre seu pedido de acesso.`
  );

  return (
    <Card className={`space-y-3 ${lead.contacted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white font-bold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text truncate leading-tight">
            {lead.name || 'Sem nome'}
          </p>
          <p className="text-xs text-textMuted flex items-center gap-1 truncate">
            {lead.city && (
              <>
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{lead.city}</span>
              </>
            )}
            {lead.fleet && (
              <>
                <span className="shrink-0">·</span>
                <span className="shrink-0">
                  {FLEET_LABELS[lead.fleet] || lead.fleet}
                </span>
              </>
            )}
          </p>
        </div>
        {created && (
          <span className="text-[11px] text-textMuted shrink-0">
            {relativeDay(created)}
          </span>
        )}
      </div>

      <div className="text-xs text-textMuted space-y-0.5 break-words">
        {lead.email && <p>{lead.email}</p>}
        {lead.phone && <p>{lead.phone}</p>}
        {lead.message && (
          <p className="text-text bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
            {lead.message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="tap flex-1 h-10 rounded-xl bg-card border border-gray-200 text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <WhatsAppIcon size={15} />
            WhatsApp
          </a>
        )}
        <Button
          size="sm"
          variant={lead.contacted ? 'ghost' : 'primary'}
          icon={lead.contacted ? Undo2 : Check}
          loading={busy}
          onClick={onToggle}
          fullWidth={false}
          className="flex-1"
        >
          {lead.contacted ? 'Reabrir' : 'Já falei'}
        </Button>
      </div>
    </Card>
  );
}
