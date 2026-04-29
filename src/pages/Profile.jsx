import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  LogOut,
  HelpCircle,
  Key,
  ChevronRight,
  Pencil,
  Save,
  X,
  User as UserIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { resetTutorial } from '../services/userService';
import { updateProfile } from '../services/profileService';
import { maskPhone, unmaskPhone, isValidPhone } from '../utils/masks';
import { formatPhone } from '../utils/formatters';
import { PIX_KEY_TYPES } from '../services/userService';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, role, logout, refreshProfile } = useAuth();
  const isAdmin = role === 'admin';
  const basePath = isAdmin ? '/tio' : '/pai';

  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!profile) {
    return (
      <>
        <Header title="Meu perfil" showBack />
        <div className="p-4">
          <Card>Carregando...</Card>
        </div>
      </>
    );
  }

  const onResetTutorial = async () => {
    try {
      await resetTutorial(user.uid);
      toast.success('Tutorial reativado! Volte pra tela inicial pra ver.');
      navigate(basePath);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao reativar tutorial.');
    }
  };

  return (
    <>
      <Header title="Meu perfil" showBack />

      <div className="p-4 space-y-4">
        {/* Cabeçalho com avatar + nome */}
        <Card className="text-center">
          <div className="flex flex-col items-center gap-3">
            <Avatar size="xl" />
            <div>
              <h2 className="text-xl font-bold text-text">
                {profile.name || 'Sem nome'}
              </h2>
              <p className="text-xs text-textMuted mt-1">
                {isAdmin ? 'Motorista' : 'Responsável'}
              </p>
            </div>
          </div>
        </Card>

        {editing ? (
          <EditProfileForm
            profile={profile}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              await refreshProfile();
              setEditing(false);
            }}
          />
        ) : (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Dados pessoais</h3>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Editar perfil"
                className="text-primary tap p-1 inline-flex items-center gap-1 text-xs font-medium"
              >
                <Pencil size={14} /> Editar
              </button>
            </div>

            <InfoRow icon={UserIcon} label="Nome" value={profile.name} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow
              icon={Phone}
              label="Telefone"
              value={profile.phone ? formatPhone(profile.phone) : null}
            />
          </Card>
        )}

        {/* Atalhos do tio */}
        {isAdmin && (
          <Card>
            <button
              type="button"
              onClick={() => navigate('/tio/pix')}
              className="w-full flex items-center gap-3 tap"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Key size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-text">Chave PIX</p>
                <p className="text-xs text-textMuted truncate">
                  {profile.pixKey
                    ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey}`
                    : 'Não cadastrada'}
                </p>
              </div>
              <ChevronRight size={20} className="text-textMuted shrink-0" />
            </button>
          </Card>
        )}

        {/* Ações secundárias */}
        <Card className="space-y-2">
          <button
            type="button"
            onClick={onResetTutorial}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <HelpCircle size={20} className="text-textMuted shrink-0" />
            <span className="flex-1 text-left text-sm text-text">
              Ver tutorial novamente
            </span>
            <ChevronRight size={20} className="text-textMuted shrink-0" />
          </button>

          <div className="border-t border-gray-100 -mx-4" />

          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <LogOut size={20} className="text-danger shrink-0" />
            <span className="flex-1 text-left text-sm font-semibold text-danger">
              Sair da conta
            </span>
          </button>
        </Card>

        <div className="text-center text-[11px] text-textMuted flex items-center justify-center gap-3 pt-2">
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:underline">
            Termos de Uso
          </a>
          <span aria-hidden>·</span>
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Política de Privacidade
          </a>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        description="Você precisará entrar de novo com email e senha (ou Google) na próxima vez."
        confirmLabel="Sim, sair"
        variant="danger"
        onConfirm={async () => {
          await logout();
          navigate('/login', { replace: true });
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Icon size={16} className="text-textMuted shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-textMuted uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-text break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

function EditProfileForm({ profile, onCancel, onSaved }) {
  const { user } = useAuth();
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(
    profile.phone ? formatPhone(profile.phone) : ''
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Informe seu nome.';
    if (phone && !isValidPhone(phone)) {
      errs.phone = 'Telefone inválido. Use 10 ou 11 dígitos com DDD.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Confira os campos destacados.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user.uid, {
        name: name.trim(),
        phone: phone ? unmaskPhone(phone) : '',
      });
      toast.success('Perfil atualizado!');
      await onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text">Editar perfil</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-textMuted tap p-1"
            aria-label="Cancelar"
          >
            <X size={18} />
          </button>
        </div>
        <Input
          label="Nome"
          icon={UserIcon}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
          required
        />
        <Input
          label="Telefone"
          icon={Phone}
          inputMode="tel"
          placeholder="(11) 99999-9999"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          maxLength={15}
          error={errors.phone}
          autoComplete="tel"
        />
        <Button type="submit" icon={Save} loading={saving}>
          Salvar
        </Button>
      </form>
    </Card>
  );
}
