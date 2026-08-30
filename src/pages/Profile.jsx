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
  BarChart3,
  Bus,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
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
import { updateProfile } from '../services/profileService';
import {
  deleteOwnParentAccount,
  deleteAdminAccount,
  isRecentLoginRequired,
} from '../services/accountService';
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadMarcaLogo,
  deleteMarcaLogo,
} from '../services/photoService';
import { STORAGE_ENABLED } from '../config/capabilities';
import { destinoAposSair } from '../utils/frentes';
import { setProfilePhotoURL } from '../services/profileService';
import { useSoundsEnabled } from '../hooks/useSoundsEnabled';
import { playSound } from '../services/soundService';
import { maskPhone, unmaskPhone, isValidPhone } from '../utils/masks';
import { formatPhone } from '../utils/formatters';
import { PIX_KEY_TYPES, setMarca } from '../services/userService';
import { APP_VERSION } from '../version';
import ReviewSheet from '../components/feedback/ReviewSheet';
import SupportSheet from '../components/support/SupportSheet';
import PixSheet from '../components/payments/PixSheet';
import { AddChildSheet } from './pai/AddChild';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, role, logout, refreshProfile } = useAuth();
  const isAdmin = role === 'admin';
  const childCount = getChildIds(profile).length;
  const basePath = isAdmin ? '/tio' : '/pai';

  const [editing, setEditing] = useState(false);
  /**
   * SAIR É DIRETO, igual ao menu do rosto — e a consistência é o ponto.
   *
   * A mesma ação tinha dois comportamentos: aqui pedia confirmação, e no
   * `ProfileMenu` também. Tirar de um só ensinaria que "Sair" às vezes
   * pergunta e às vezes não, o que é pior que qualquer um dos dois.
   *
   * O que a confirmação evitava era barato (reentrar) e o que cobrava era de
   * todo mundo, toda vez. A exclusão de conta, logo abaixo, CONTINUA com
   * diálogo: aquilo é irreversível, e é outra conversa.
   *
   * O papel é lido ANTES do logout — depois dele o profile vira null. Cada
   * papel volta pra porta dele: o motorista pra home, que é a vitrine DELE;
   * o responsável pra `/familia`, e não pra uma página que vende associação
   * com escassez que, pra ele, sugere que a vaga do filho corre risco.
   */
  const sair = async () => {
    const destino = destinoAposSair(role);
    await logout();
    navigate(destino, { replace: true });
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
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

  // Rever o tutorial não desfaz o "já concluí": só leva pra tela inicial —
  // o tour precisa dela embaixo pra iluminar — e manda o layout abrir na hora.
  const onReplayTutorial = () => {
    navigate(basePath, { state: { openTour: true } });
  };

  const onDeleteAccount = async () => {
    // Lido AGORA, antes de qualquer coisa: `deleteUser` derruba a sessão e
    // `profile` vira null no meio do caminho.
    const destinoDaExclusao = destinoAposSair(profile?.role);
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
      // signOut implícito via deleteUser — só falta escolher a porta.
      //
      // Era `/` pros dois papéis. Quem encerra operação é motorista e volta
      // pra vitrine, certo; mas o responsável que exclui a conta também caía
      // lá. O papel tem que ser lido ANTES, porque `deleteUser` já apagou a
      // sessão quando chegamos aqui.
      navigate(destinoDaExclusao, { replace: true });
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
              gender={profile.gender}
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
              onClick={() => setPixOpen(true)}
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

            {/* O atalho da fila de parceiros saiu daqui: ela é do dono, e
              * este bloco é do motorista. Agora vive no /admin. */}
          </Card>
        )}

        {/* Atalho do pai pra vincular outra criança. Fica aqui porque o
          * seletor de filho só aparece a partir do segundo — sem este
          * caminho, quem tem um filho não conseguiria adicionar o próximo. */}
        {!isAdmin && (
          <Card>
            <button
              type="button"
              onClick={() => setAddChildOpen(true)}
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

            <div className="h-px bg-neutro my-3" />

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

        {/* A MARCA — só do motorista, porque só ele tem público.
          * Fica ANTES dos avisos e depois do contrato: é configuração de
          * vitrine, e vitrine vem antes de preferência de aparelho. */}
        {isAdmin && (
          <MarcaCard
            uid={user?.uid}
            nome={profile?.marcaNome || ''}
            logoURL={profile?.marcaLogoURL || null}
            onChanged={refreshProfile}
          />
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
                soundsEnabled ? 'bg-primary' : 'bg-borderStrong'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  soundsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="border-t border-neutro -mx-4" />

          <button
            type="button"
            onClick={onReplayTutorial}
            className="w-full flex items-center gap-3 tap py-2"
          >
            <HelpCircle size={20} className="text-textMuted shrink-0" />
            <span className="flex-1 text-left text-sm text-text">
              Ver tutorial de novo
            </span>
            <ChevronRight size={20} className="text-textMuted shrink-0" />
          </button>

          <div className="border-t border-neutro -mx-4" />

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

          <div className="border-t border-neutro -mx-4" />

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
              <div className="border-t border-neutro -mx-4" />
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

          <div className="border-t border-neutro -mx-4" />

          <button
            type="button"
            onClick={sair}
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


      <PixSheet open={pixOpen} onClose={() => setPixOpen(false)} />

      <AddChildSheet
        open={addChildOpen}
        onClose={() => setAddChildOpen(false)}
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
function ProfilePhotoEditor({
  uid,
  name,
  photoURL,
  kind = 'adult',
  gender,
  onChanged,
}) {
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
        gender={gender}
        seed={uid}
        name={name}
        size="xl"
      />
      {/* Sem Storage não há upload, então não há botão. O avatar continua
        * ali: ele é gerado no navegador a partir do id, e ninguém fica sem
        * rosto na lista — só não dá pra trocar por uma foto de verdade. */}
      {STORAGE_ENABLED && (
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
      )}
      {/* Remover também depende de Storage (deleteObject). Uma foto
        * legada de antes do desligamento fica visível e não removível —
        * botão que erra é pior que botão que não está lá. */}
      {STORAGE_ENABLED && photoURL && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full bg-card text-danger border border-border shadow flex items-center justify-center tap"
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
  // Vazio pra toda conta criada antes deste campo existir. Não há migração
  // possível — ninguém sabe o gênero de quem nunca foi perguntado — então o
  // avatar segue sorteado até a pessoa responder aqui, uma vez.
  const [gender, setGender] = useState(profile.gender || '');
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
        gender: gender || null,
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
        {/* O GÊNERO EXISTE PRO ROSTO, E O TEXTO DIZ ISSO.
          *
          * Os dois adultos do app — motorista e responsável — nunca foram
          * perguntados, e por isso saíam com rosto sorteado. O do motorista
          * é o pior caso: ele o vê no canto de TODA tela, e metade das vezes
          * não se reconhece nele.
          *
          * O campo é opcional de propósito. É pra desenhar um avatar, não
          * pra classificar ninguém: quem não quiser responder continua com o
          * rosto de sempre, e nada no app muda por causa disso. Dizer pra que
          * serve, ali embaixo, é o que torna a pergunta justa. */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-text">
            Seu avatar
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'female', label: 'Mulher' },
              { value: 'male', label: 'Homem' },
              { value: '', label: 'Prefiro não dizer' },
            ].map((g) => (
              <button
                key={g.value || 'none'}
                type="button"
                onClick={() => setGender(g.value)}
                className={`tap rounded-xl border-2 px-2 py-2.5 text-xs font-semibold ${
                  gender === g.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-textMuted'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-textMuted">
            Serve só pra desenhar seu rosto automático. Se você enviou uma
            foto, ela continua valendo.
          </p>
        </div>

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


/**
 * Atalho pra lista de motoristas interessados, com contagem de quem ainda
 * não foi contatado. Sem isso o tio não tem sinal nenhum de que alguém
 * pediu acesso — a coleção existia mas nenhuma tela a lia.
 */
// LeadsShortcut foi REMOVIDO: ele mostrava a contagem da fila de parceiros
// no perfil do motorista, e essa fila passou a ser do dono. A porta agora é a
// aba "Fila" do /admin — o bloco da Visão geral troca de aba em vez de
// navegar, desde que a tela separada foi unificada no painel.

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
            on ? 'bg-primary' : 'bg-borderStrong'
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

/**
 * A MARCA DO MOTORISTA — o que as famílias dele veem no topo da tela.
 *
 * POR QUE NÃO BASTAVA A FOTO DE PERFIL
 * A foto é o rosto dele, e vira um avatar de 32px no canto. A marca é a
 * identidade do transporte, e ocupa o cabeçalho de todo responsável que ele
 * atende. Muitos são conhecidos só pelo apelido — "Tio Nino", "Tia Lene" — e
 * apresentar "José Ednaldo dos Santos" pras famílias que o chamam de Nino é o
 * app criando um estranho onde já havia uma relação.
 *
 * O NOME MUDA SOZINHO, SEM O LOGO. São duas decisões com ritmos diferentes:
 * o apelido ele já tem; o logo depende de achar um arquivo no celular. Um
 * formulário só, com salvar único, faria a segunda travar a primeira — e o
 * cabeçalho ficaria escrito "Início" por meses esperando uma imagem.
 *
 * A PRÉVIA MOSTRA O CABEÇALHO DE VERDADE, e não um cartão bonito: é onde isso
 * vai aparecer, e o tamanho real é a única informação útil aqui. Logo que
 * funciona em 200px e some em 32px é o erro que essa prévia evita.
 */
function MarcaCard({ uid, nome, logoURL, onChanged }) {
  const [valor, setValor] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);

  const mudou = valor.trim() !== (nome || '').trim();

  const salvarNome = async () => {
    setSalvando(true);
    try {
      await setMarca(uid, { nome: valor });
      await onChanged?.();
      toast.success('Pronto — é assim que suas famílias vão te ver.');
    } catch (err) {
      console.error('Falha ao salvar a marca:', err);
      toast.error('Não deu pra salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  const escolherLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file || !uid) return;
    setSubindo(true);
    try {
      const url = await uploadMarcaLogo(uid, file);
      await setMarca(uid, { logoURL: url });
      await onChanged?.();
      toast.success('Logo atualizado!');
    } catch (err) {
      console.error('Upload do logo falhou:', err);
      toast.error('Não deu pra enviar a imagem.');
    } finally {
      setSubindo(false);
    }
  };

  const removerLogo = async () => {
    setSubindo(true);
    try {
      await deleteMarcaLogo(uid);
      // `null` explícito: `undefined` seria ignorado pelo Firestore e o
      // cabeçalho continuaria mostrando um logo que já não existe no Storage.
      await setMarca(uid, { logoURL: null });
      await onChanged?.();
    } catch (err) {
      console.error('Falha ao remover o logo:', err);
      toast.error('Não deu pra remover agora.');
    } finally {
      setSubindo(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text">Sua marca</p>
        <p className="mt-0.5 text-xs leading-relaxed text-textMuted">
          É o que aparece no topo do app — no seu e no das famílias que você
          atende. Muda quando você quiser.
        </p>
      </div>

      {/* A prévia é o cabeçalho real, no tamanho real. */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
        {logoURL ? (
          <img
            src={logoURL}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bus size={16} />
          </span>
        )}
        <span className="truncate text-base font-semibold text-text">
          {valor.trim() || 'Início'}
        </span>
      </div>

      <Input
        id="marca-nome"
        label="Como suas famílias te chamam"
        placeholder="Ex.: Tio Nino"
        value={valor}
        maxLength={40}
        onChange={(e) => setValor(e.target.value)}
        hint="Sem preencher, o topo continua escrito “Início”."
      />

      {mudou && (
        <Button size="md" loading={salvando} onClick={salvarNome}>
          Salvar nome
        </Button>
      )}

      {/* O anexo some quando não há Storage — mesma regra do resto do app:
        * botão que não pode dar certo não aparece. O NOME continua editável,
        * e ele sozinho já resolve o cabeçalho. */}
      {STORAGE_ENABLED && (
        <div className="flex gap-2">
          <label className="tap flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-borderStrong text-sm font-semibold text-text">
            <ImageIcon size={15} />
            {subindo ? 'Enviando…' : logoURL ? 'Trocar logo' : 'Enviar logo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subindo}
              onChange={escolherLogo}
            />
          </label>
          {logoURL && (
            <button
              type="button"
              onClick={removerLogo}
              disabled={subindo}
              className="tap h-10 rounded-xl border border-borderStrong px-3 text-sm font-semibold text-textMuted"
            >
              Remover
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
