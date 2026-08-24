import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  LogOut,
  HelpCircle,
  MessageSquare,
  LifeBuoy,
  Key,
  Bus,
  Bell,
  BellOff,
  UserPlus,
  ChevronRight,
  Pencil,
  Save,
  X,
  User as UserIcon,
  Trash2,
  Camera,
  Volume2,
  VolumeX,
  Building2,
  FileText,
  MapPin as MapPinIcon,
  Sunrise,
  Sunset,
  Moon,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import { watchDriverLeads } from '../services/waitlistService';
import { getChildIds } from '../utils/childIds';
import {
  isPushAvailable,
  permissionState,
  enablePush,
  disablePush,
} from '../services/pushService';
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
import { DEFAULT_GREETING_HOURS } from '../utils/greeting';
import { maskPhone, unmaskPhone, isValidPhone } from '../utils/masks';
import { formatPhone } from '../utils/formatters';
import { PIX_KEY_TYPES } from '../services/userService';
import { APP_VERSION } from '../version';
import ReviewSheet from '../components/feedback/ReviewSheet';
import SupportSheet from '../components/support/SupportSheet';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, role, logout, refreshProfile } = useAuth();
  const isAdmin = role === 'admin';
  const childCount = getChildIds(profile).length;
  const basePath = isAdmin ? '/tio' : '/pai';

  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
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
          childIds: getChildIds(profile),
        });
        toast.success('Conta excluída.');
      }
      // signOut implícito via deleteUser — apenas redireciona
      navigate('/', { replace: true });
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
        navigate('/', { replace: true });
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
              kind={isAdmin ? 'admin' : 'adult'}
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

        {/* Horários das saudações (só Tio) — vale pra todos os usuários */}
        {isAdmin && (
          <GreetingHoursCard profile={profile} onSaved={refreshProfile} />
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

            <div className="h-px bg-gray-100 my-3" />

            <LeadsShortcut onOpen={() => navigate('/tio/leads')} />
          </Card>
        )}

        {/* Atalho do pai pra vincular outra criança. Fica aqui porque o
          * seletor de filho só aparece a partir do segundo — sem este
          * caminho, quem tem um filho não conseguiria adicionar o próximo. */}
        {!isAdmin && (
          <Card>
            <button
              type="button"
              onClick={() => navigate('/pai/adicionar-filho')}
              className="w-full flex items-center gap-3 tap"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <UserPlus size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-text">
                  Adicionar outro filho
                </p>
                <p className="text-xs text-textMuted truncate">
                  {childCount === 1
                    ? '1 criança na sua conta'
                    : `${childCount} crianças na sua conta`}
                </p>
              </div>
              <ChevronRight size={20} className="text-textMuted shrink-0" />
            </button>

            <div className="h-px bg-gray-100 my-3" />

            {/* O pai era obrigado a aceitar o contrato pra entrar e depois
              * não tinha como relê-lo: a única rota era a do tio. Pedir
              * aceite e esconder o documento é o oposto de transparência. */}
            <button
              type="button"
              onClick={() => navigate('/pai/contrato')}
              className="w-full flex items-center gap-3 tap"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-text">
                  Contrato de transporte
                </p>
                <p className="text-xs text-textMuted truncate">
                  Ler de novo ou salvar em PDF
                </p>
              </div>
              <ChevronRight size={20} className="text-textMuted shrink-0" />
            </button>
          </Card>
        )}

        {/* Avisos no celular — vale pros dois papéis */}
        <PushCard uid={user?.uid} />

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
            onClick={() => setSupportOpen(true)}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <LifeBuoy size={20} className="text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm text-text font-medium">
                Abrir chamado de suporte
              </p>
              <p className="text-[11px] text-textMuted">
                Reportar problema ou pedir ajuda
              </p>
            </div>
            <ChevronRight size={20} className="text-textMuted shrink-0" />
          </button>

          <div className="border-t border-gray-100 -mx-4" />

          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <MessageSquare size={20} className="text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm text-text font-medium">
                Avaliar o app
              </p>
              <p className="text-[11px] text-textMuted">
                Conta o que tá funcionando e o que pode melhorar
              </p>
            </div>
            <ChevronRight size={20} className="text-textMuted shrink-0" />
          </button>

          {/* Painel do dono — aparece só pra quem carrega o negócio nas
            * costas. Um parceiro nunca vê esta linha. */}
          {profile?.superAdmin && (
            <>
              <div className="border-t border-gray-100 -mx-4" />
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-3 tap py-2"
              >
                <BarChart3 size={20} className="text-primary shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm text-text font-medium">
                    Painel do dono
                  </p>
                  <p className="text-[11px] text-textMuted">
                    Números da plataforma, pesquisa e fila de parceiros
                  </p>
                </div>
                <ChevronRight size={20} className="text-textMuted shrink-0" />
              </button>
            </>
          )}

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

        {/* Exclusão de conta — discreto, só link textual no fim da página.
          * Confirmação continua avisando do impacto. */}
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap inline-flex items-center gap-1.5 text-xs text-textMuted hover:text-danger transition-colors py-2 px-3"
          >
            <Trash2 size={12} />
            <span className="underline underline-offset-2 decoration-textMuted/30">
              {isAdmin ? 'Encerrar operação' : 'Excluir minha conta'}
            </span>
          </button>
        </div>

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
        <div className="text-center text-[10px] text-textMuted/70">
          Tio Nino Digital · versão {APP_VERSION}
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
          navigate('/', { replace: true });
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <ReviewSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        uid={user?.uid}
        role={role}
        profile={profile}
      />

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        uid={user?.uid}
        role={role}
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
function ProfilePhotoEditor({ uid, name, photoURL, kind = 'adult', onChanged }) {
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
        kind={kind}
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

/* ─────────────── Horários das saudações ─────────────── */

function GreetingHoursCard({ profile, onSaved }) {
  const { user } = useAuth();
  const current = profile.greetingHours || DEFAULT_GREETING_HOURS;
  const [editing, setEditing] = useState(false);
  const [morning, setMorning] = useState(current.morning);
  const [afternoon, setAfternoon] = useState(current.afternoon);
  const [evening, setEvening] = useState(current.evening);
  const [saving, setSaving] = useState(false);

  const isValid = morning < afternoon && afternoon < evening;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) {
      toast.error('Horários devem estar em ordem (manhã < tarde < noite).');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(user.uid, {
        greetingHours: { morning, afternoon, evening },
      });
      toast.success('Horários salvos!');
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
              Horários das saudações
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
          <p className="text-xs text-textMuted leading-relaxed">
            A partir de cada hora, o app começa a dizer a saudação correspondente.
          </p>
          <HourInput
            icon={Sunrise}
            label='"Bom dia" começa às'
            value={morning}
            onChange={setMorning}
          />
          <HourInput
            icon={Sunset}
            label='"Boa tarde" começa às'
            value={afternoon}
            onChange={setAfternoon}
          />
          <HourInput
            icon={Moon}
            label='"Boa noite" começa às'
            value={evening}
            onChange={setEvening}
          />
          {!isValid && (
            <p className="text-xs text-danger">
              Os horários precisam estar em ordem crescente.
            </p>
          )}
          <Button type="submit" icon={Save} loading={saving} disabled={!isValid}>
            Salvar
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Horários das saudações
        </h3>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary tap p-1 inline-flex items-center gap-1 text-xs font-medium"
        >
          <Pencil size={14} /> Editar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <HourPill icon={Sunrise} label="Bom dia" hour={current.morning} />
        <HourPill icon={Sunset} label="Boa tarde" hour={current.afternoon} />
        <HourPill icon={Moon} label="Boa noite" hour={current.evening} />
      </div>
      <p className="text-[11px] text-textMuted pt-1">
        Vale pra você e pros responsáveis.
      </p>
    </Card>
  );
}

function HourInput({ icon: Icon, label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-text mb-1.5 inline-flex items-center gap-1.5">
        <Icon size={14} />
        {label}
      </label>
      <input
        type="number"
        min="0"
        max="23"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-12 rounded-2xl border-2 border-gray-200 px-4 text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  );
}

function HourPill({ icon: Icon, label, hour }) {
  return (
    <div className="bg-bg rounded-xl p-2 text-center">
      <Icon size={14} className="mx-auto text-textMuted" />
      <p className="text-[10px] text-textMuted uppercase tracking-wide mt-1">
        {label}
      </p>
      <p className="text-base font-bold text-text mt-0.5 tabular-nums">
        {String(hour).padStart(2, '0')}h
      </p>
    </div>
  );
}

/**
 * Atalho pra lista de motoristas interessados, com contagem de quem ainda
 * não foi contatado. Sem isso o tio não tem sinal nenhum de que alguém
 * pediu acesso — a coleção existia mas nenhuma tela a lia.
 */
function LeadsShortcut({ onOpen }) {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    const unsub = watchDriverLeads(
      (list) => setPending(list.filter((l) => !l.contacted).length),
      () => setPending(0)
    );
    return unsub;
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 tap"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Bus size={20} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-text">Interessados</p>
        <p className="text-xs text-textMuted truncate">
          {pending === null
            ? 'Carregando...'
            : pending === 0
            ? 'Ninguém aguardando contato'
            : pending === 1
            ? '1 motorista aguardando contato'
            : `${pending} motoristas aguardando contato`}
        </p>
      </div>
      {pending > 0 && (
        <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {pending > 9 ? '9+' : pending}
        </span>
      )}
      <ChevronRight size={20} className="text-textMuted shrink-0" />
    </button>
  );
}

/**
 * Liga/desliga os avisos no celular.
 *
 * Não renderiza quando o push não está disponível — navegador sem suporte
 * ou projeto sem a chave VAPID configurada. Melhor não existir do que
 * existir e não funcionar.
 */
function PushCard({ uid }) {
  const [available, setAvailable] = useState(null);
  const [state, setState] = useState(permissionState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isPushAvailable().then(setAvailable);
  }, []);

  if (available !== true) return null;

  const on = state === 'granted';

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush(uid);
        toast.success('Avisos desligados neste aparelho.');
        setState('default');
      } else {
        const res = await enablePush(uid);
        if (res.ok) {
          toast.success('Pronto! Você recebe avisos mesmo com o app fechado.');
          setState('granted');
        } else if (res.reason === 'negado') {
          toast.error(
            'O navegador bloqueou os avisos. Libere nas configurações do site.',
            { duration: 6000 }
          );
          setState('denied');
        } else {
          toast.error('Não conseguimos ligar os avisos agora.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="w-full flex items-center gap-3 tap disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {on ? (
            <Bell size={20} className="text-primary" />
          ) : (
            <BellOff size={20} className="text-textMuted" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-text">
            Avisos no celular
          </p>
          <p className="text-xs text-textMuted">
            {state === 'denied'
              ? 'Bloqueado pelo navegador'
              : on
              ? 'Ligado — chega mesmo com o app fechado'
              : 'Desligado'}
          </p>
        </div>
        <span
          className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${
            on ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              on ? 'left-[1.375rem]' : 'left-0.5'
            }`}
          />
        </span>
      </button>
    </Card>
  );
}
