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
  Trash2,
  AlertTriangle,
  Camera,
  Volume2,
  VolumeX,
  Building2,
  FileText,
  MapPin as MapPinIcon,
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
import {
  deleteOwnParentAccount,
  deleteAdminAccount,
  isRecentLoginRequired,
} from '../services/accountService';
import { uploadProfilePhoto, deleteProfilePhoto } from '../services/photoService';
import { setProfilePhotoURL } from '../services/profileService';
import { useSoundsEnabled } from '../hooks/useSoundsEnabled';
import { playSound } from '../services/soundService';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [soundsEnabled, setSoundsEnabledState] = useSoundsEnabled();

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

  const onDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (isAdmin) {
        await deleteAdminAccount(user.uid);
        toast.success('Operação encerrada. Dados apagados.');
      } else {
        await deleteOwnParentAccount({
          uid: user.uid,
          childId: profile.childId,
        });
        toast.success('Conta excluída.');
      }
      // signOut implícito via deleteUser — apenas redireciona
      navigate('/welcome', { replace: true });
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      if (isRecentLoginRequired(err)) {
        toast.error(
          'Por segurança, saia e entre de novo antes de excluir a conta.',
          { duration: 6000 }
        );
        setConfirmDelete(false);
        // Força logout pra forçar relogin
        await logout();
        navigate('/welcome', { replace: true });
      } else {
        toast.error('Não foi possível excluir. Tente novamente.');
        setDeleting(false);
      }
    }
  };

  return (
    <>
      <Header title="Meu perfil" showBack />

      <div className="p-4 space-y-4">
        {/* Cabeçalho com avatar + nome — botão "Trocar foto" embutido */}
        <Card className="text-center">
          <div className="flex flex-col items-center gap-3">
            <ProfilePhotoEditor
              uid={user?.uid}
              name={profile.name}
              photoURL={profile.photoURL}
              onChanged={refreshProfile}
            />
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

        {/* Dados da empresa (só Tio) */}
        {isAdmin && (
          <CompanyDataCard profile={profile} onSaved={refreshProfile} />
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
            onClick={() => {
              const next = !soundsEnabled;
              setSoundsEnabledState(next);
              if (next) playSound('click');
            }}
            className="w-full flex items-center gap-3 tap py-2"
          >
            {soundsEnabled ? (
              <Volume2 size={20} className="text-primary shrink-0" />
            ) : (
              <VolumeX size={20} className="text-textMuted shrink-0" />
            )}
            <div className="flex-1 text-left">
              <p className="text-sm text-text font-medium">
                Sons do app
              </p>
              <p className="text-[11px] text-textMuted">
                {soundsEnabled
                  ? 'Toques nos botões, buzina, notificações'
                  : 'Silencioso — só vibração'}
              </p>
            </div>
            <div
              className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                soundsEnabled ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  soundsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="border-t border-gray-100 -mx-4" />

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

        {/* Zona de perigo — exclusão de conta */}
        <Card className="border border-red-200 bg-red-50/50 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-red-700 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Zona de perigo
          </h3>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <Trash2 size={20} className="text-danger shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-danger leading-tight">
                {isAdmin ? 'Encerrar operação' : 'Excluir minha conta'}
              </p>
              <p className="text-[11px] text-textMuted mt-0.5">
                {isAdmin
                  ? 'Apaga todos os dados do app (crianças, pais, pagamentos)'
                  : 'Apaga seus dados pessoais. O histórico fica com o motorista.'}
              </p>
            </div>
            <ChevronRight size={18} className="text-textMuted shrink-0" />
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
          navigate('/welcome', { replace: true });
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={isAdmin ? 'Encerrar operação?' : 'Excluir sua conta?'}
        description={
          isAdmin
            ? 'Vai apagar TUDO: crianças, responsáveis, pagamentos, ausências, rota padrão e sua conta. Esta ação NÃO pode ser desfeita.'
            : 'Seus dados pessoais (perfil, login, notificações) serão apagados. O histórico de pagamentos fica com o motorista para fins fiscais. Você sairá do app.'
        }
        confirmLabel={isAdmin ? 'Sim, apagar tudo' : 'Sim, excluir minha conta'}
        variant="danger"
        loading={deleting}
        onConfirm={onDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

/**
 * Avatar com botão de câmera flutuante pra trocar/remover foto.
 * Compartilhado entre Tio e Pai — Storage rules garantem permissão.
 */
function ProfilePhotoEditor({ uid, name, photoURL, onChanged }) {
  const [uploading, setUploading] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reuploadar o mesmo arquivo
    if (!file || !uid) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(uid, file);
      await setProfilePhotoURL(uid, url);
      await onChanged?.();
      toast.success('Foto atualizada!');
    } catch (err) {
      console.error('Upload de foto falhou:', err);
      toast.error('Não foi possível enviar a foto. Tente outra.');
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    if (!uid || !photoURL) return;
    setUploading(true);
    try {
      await deleteProfilePhoto(uid);
      await setProfilePhotoURL(uid, null);
      await onChanged?.();
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
        photoURL={photoURL}
        kind="adult"
        seed={uid}
        name={name}
        size="xl"
      />
      <label
        htmlFor="profile-photo-input"
        className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg cursor-pointer tap"
        aria-label="Trocar foto"
      >
        <Camera size={18} />
        <input
          id="profile-photo-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
      </label>
      {photoURL && !uploading && (
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

/* ─────────────── Dados da empresa (Tio) ─────────────── */

function CompanyDataCard({ profile, onSaved }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.companyName || '');
  const [doc, setDoc] = useState(profile.companyDocument || '');
  const [address, setAddress] = useState(profile.companyAddress || '');
  const [saving, setSaving] = useState(false);

  const hasData =
    !!profile.companyName ||
    !!profile.companyDocument ||
    !!profile.companyAddress;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(user.uid, {
        companyName: name.trim(),
        companyDocument: doc.trim(),
        companyAddress: address.trim(),
      });
      toast.success('Dados da empresa salvos!');
      await onSaved();
      setEditing(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text">
              Dados da empresa
            </h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-textMuted tap p-1"
              aria-label="Cancelar"
            >
              <X size={18} />
            </button>
          </div>
          <Input
            label="Nome / Razão social"
            icon={Building2}
            placeholder="Ex: Tio Nino Transporte Escolar"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="CNPJ ou CPF"
            icon={FileText}
            placeholder="00.000.000/0000-00"
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
          />
          <Input
            label="Endereço"
            icon={MapPinIcon}
            placeholder="Rua, número, bairro, cidade"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-[11px] text-textMuted leading-relaxed">
            Esses dados aparecem no contrato que o responsável assina. Você pode
            preencher depois — o app usa placeholders padrão até lá.
          </p>
          <Button type="submit" icon={Save} loading={saving}>
            Salvar
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Dados da empresa</h3>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary tap p-1 inline-flex items-center gap-1 text-xs font-medium"
        >
          <Pencil size={14} /> {hasData ? 'Editar' : 'Preencher'}
        </button>
      </div>
      {hasData ? (
        <>
          <InfoRow
            icon={Building2}
            label="Nome / Razão social"
            value={profile.companyName}
          />
          <InfoRow
            icon={FileText}
            label="Documento"
            value={profile.companyDocument}
          />
          <InfoRow
            icon={MapPinIcon}
            label="Endereço"
            value={profile.companyAddress}
          />
        </>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          Preencha pra aparecer no contrato dos pais. Enquanto não preenche,
          o app usa placeholders.
        </div>
      )}
    </Card>
  );
}
