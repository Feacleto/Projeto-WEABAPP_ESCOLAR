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
  Medal,
  PauseCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import { getChildIds } from '../dominio/identidade/childIds';
import { ehDono } from '../dominio/identidade/papeis';
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
import AppSheet from '../components/common/AppSheet';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from '../services/profileService';
import DadosDoContratoForm from '../components/contract/DadosDoContratoForm';
import { dadosDaContratadaFaltando } from '../services/contractService';
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
import { destinoAposSair } from '../dominio/vitrine/frentes';
import { setProfilePhotoURL } from '../services/profileService';
import { useSoundsEnabled } from '../hooks/useSoundsEnabled';
import { playSound } from '../services/soundService';
import { maskPhone, unmaskPhone, isValidPhone } from '../compartilhado/masks';
import { formatPhone } from '../compartilhado/formatters';
import { PIX_KEY_TYPES, setMarca } from '../services/userService';
import { APP_VERSION } from '../version';
import AvaliarOAppSheet from '../components/feedback/AvaliarOAppSheet';
import SupportSheet from '../components/support/SupportSheet';
import CorDaMarca from '../components/tio/CorDaMarca';
import { lerCoresDoLogo } from '../services/coresDoLogoService';
import PreferenciasDeAviso from '../components/notifications/PreferenciasDeAviso';
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
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [saidasAbertas, setSaidasAbertas] = useState(false);
  const [soundsEnabled, setSoundsEnabledState] = useSoundsEnabled();

  if (!profile) {
    return (
      <>
        <Header
        title="Meu perfil"
        showBack
        backLabel="Início"
        backTo={isAdmin ? '/tio' : '/pai'}
      />
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
    // ⚠️ O MOTORISTA COM HISTÓRICO VOLTOU A PODER SAIR (03/10/2026). O
    // `allow delete` de `users` exigia "sem trialInicio", e esta tela barrava
    // quem já tinha rodado — a LGPD garante a exclusão, e o app a negava. Hoje
    // a rule pede `criancasAtivas == 0` (contado pelo SERVIDOR), e
    // `deleteAdminAccount` apaga a turma e ESPERA o contador zerar antes de
    // apagar o documento. O teste não recomeça: o servidor guarda uma cópia do
    // início do teste e a restaura se a conta for recriada.

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
        // A espera da turma zerada (`accountService.esperarTurmaZerada`) já
        // traz a frase certa: as crianças saíram, falta o servidor recontar.
        toast.error(
          err?.code === 'conta/turma-nao-zerada'
            ? err.message
            : 'Não foi possível excluir. Tente novamente.',
          { duration: 6000 }
        );
        setDeleting(false);
      }
    }
  };

  /* COMO ELA ENTRA, e não só qual é o email.
   *
   * ⚠️ `user.email` E NÃO `profile.email`. O segundo é um CAMPO do Firestore,
   * e no caso do responsável ele pode ter sido digitado pelo MOTORISTA no
   * cadastro da criança (`child.parentEmail`) — o `redeemInvite` até grava
   * `linkedEmailMatchesCadastro` porque sabe que os dois divergem. Esta linha
   * existe para responder "em qual conta eu estou", e só o email da SESSÃO
   * responde isso. Mostrar o campo aqui é responder a pergunta errada com
   * cara de resposta certa.
   *
   * E o provedor vai junto porque a pergunta seguinte é sempre a mesma: "então
   * eu aperto qual botão da próxima vez?". Saber o email sem saber se ele
   * entra pelo Google ou por senha não fecha a dúvida — e é justamente na
   * próxima vez, num aparelho novo, que ela precisa acertar de primeira. */
  const provedorDaConta = user?.providerData?.[0]?.providerId;
  const comoEntra =
    provedorDaConta === 'google.com'
      ? 'Você entra com o Google'
      : provedorDaConta === 'password'
        ? 'Você entra com email e senha'
        : null;

  return (
    <>
      <Header
        title="Meu perfil"
        showBack
        backLabel="Início"
        backTo={isAdmin ? '/tio' : '/pai'}
      />

      <div className="p-4 space-y-7">
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
              <p className="text-base text-textMuted mt-1">
                {isAdmin ? 'Motorista' : 'Responsável'}
              </p>
            </div>
          </div>
        </Card>

        {/* O PERFIL EM BLOCOS (03/10/2026, pedido do dono).
          *
          * Era uma pilha de cartões sem nome — dados, empresa, PIX, marca,
          * avisos, sons, tutorial, suporte, sair e excluir na mesma rolagem,
          * e quem tem quarenta anos procura pela PALAVRA do assunto, não pela
          * posição do cartão. Agora são cinco blocos com título grande, na
          * ordem de quem usa: quem eu sou, o meu trabalho (ou os meus
          * filhos), o que toca no celular, onde pedir ajuda, e por último o
          * que mexe na conta — sair, os meus dados e a saída. */}
        <Bloco titulo="Você">
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
              <InfoRow icon={UserIcon} label="Nome" value={profile.name} />
              <InfoRow
                icon={Mail}
                label="Email da conta"
                value={user?.email || profile.email}
                hint={comoEntra}
              />
              <InfoRow
                icon={Phone}
                label="Telefone"
                value={profile.phone ? formatPhone(profile.phone) : null}
              />
              <Button
                variant="secondary"
                icon={Pencil}
                onClick={() => setEditing(true)}
              >
                Editar meus dados
              </Button>
            </Card>
          )}
        </Bloco>

        {isAdmin ? (
          <Bloco titulo="Seu transporte">
            {/* A marca vem primeiro: é como as famílias o veem. */}
            <MarcaCard
              uid={user?.uid}
              nome={profile?.marcaNome || ''}
              logoURL={profile?.marcaLogoURL || null}
              cor={profile?.marcaCor || null}
              cores={profile?.marcaCoresSugeridas || []}
              onChanged={refreshProfile}
            />
            {/* ⚠️ A CHAVE PIX NÃO SE TROCA AQUI (D2, 04/10/2026). O Perfil
              * não pede senha, e a auxiliar com o celular na mão trocava a
              * chave pela dela: as mensalidades da turma passavam a cair
              * noutra conta. Daqui só se VÊ a chave e se vai a `/tio/pix`,
              * que está atrás da senha do Financeiro (trancaDoFinanceiro). */}
            <Card>
              <Linha
                icon={Key}
                titulo="Chave PIX"
                sub={
                  profile.pixKey
                    ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey} · trocar pede a senha do Financeiro`
                    : 'Não cadastrada · cadastrar pede a senha do Financeiro'
                }
                onClick={() => navigate('/tio/pix')}
              />
            </Card>
            {/* O NÍVEL (docs/niveis.md): selo e o que fazer para subir. */}
            <Card>
              <Linha
                icon={Medal}
                titulo="Meu nível"
                sub="Seu selo e o que fazer para subir"
                onClick={() => navigate('/tio/nivel')}
              />
            </Card>
            <CompanyDataCard profile={profile} onSaved={refreshProfile} />
          </Bloco>
        ) : (
          <Bloco titulo={childCount > 1 ? 'Seus filhos' : 'Seu filho'}>
            {/* "Adicionar outro filho" mora aqui porque o seletor de filho só
              * aparece a partir do segundo — sem este caminho, quem tem um
              * filho não conseguiria adicionar o próximo. E o contrato: o pai
              * era obrigado a aceitá-lo e depois não tinha como relê-lo. */}
            <Card className="space-y-1">
              <Linha
                icon={UserPlus}
                titulo="Adicionar outro filho"
                sub={
                  childCount === 1
                    ? '1 criança na sua conta'
                    : `${childCount} crianças na sua conta`
                }
                onClick={() => setAddChildOpen(true)}
              />
              <Divisor />
              <Linha
                icon={FileText}
                titulo="Contrato de transporte"
                sub="Ler de novo ou salvar em PDF"
                onClick={() => navigate('/pai/contrato')}
              />
            </Card>
          </Bloco>
        )}

        {/* Avisos: o celular aceitar avisos, QUAIS tocam (a mesma escolha que
          * mora no fim do sino) e os sons. Três perguntas sobre o mesmo
          * assunto, que antes ficavam em lugares diferentes. */}
        <Bloco titulo="Avisos">
          <PushCard uid={user?.uid} />
          <PreferenciasDeAviso />
          <Card>
            <button
              type="button"
              onClick={() => {
                const next = !soundsEnabled;
                setSoundsEnabledState(next);
                if (next) playSound('click');
              }}
              aria-pressed={soundsEnabled}
              className="w-full flex items-center gap-3 tap"
            >
              <span className="w-10 h-10 rounded-lg bg-primaryChip flex items-center justify-center shrink-0">
                {soundsEnabled ? (
                  <Volume2 size={20} className="text-primary" />
                ) : (
                  <VolumeX size={20} className="text-textMuted" />
                )}
              </span>
              <div className="flex-1 text-left">
                <p className="text-base font-semibold text-text">Sons do app</p>
                <p className="text-sm text-textMuted">
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
          </Card>
        </Bloco>

        <Bloco titulo="Ajuda">
          <Card className="space-y-1">
            <Linha
              icon={LifeBuoy}
              titulo="Falar com o suporte"
              sub="Pelo WhatsApp do Alô Buzinou"
              onClick={() => setSupportOpen(true)}
            />
            <Divisor />
            <Linha
              icon={HelpCircle}
              titulo="Ver o tutorial de novo"
              sub="Um passeio rápido pelas telas"
              onClick={onReplayTutorial}
            />
            <Divisor />
            <Linha
              icon={MessageSquare}
              titulo="Avaliar o app"
              sub="Conta o que tá funcionando e o que pode melhorar"
              onClick={() => setFeedbackOpen(true)}
            />
            {/* Painel do dono — só para quem tem o papel. ⚠️ `ehDono(profile)`,
              * NÃO `profile.superAdmin`: o campo legado saiu em 06/09/2026 e
              * a condição antiga nunca disparava. Não é tranca (quem entra
              * pelo endereço entra pelo papel), é só o atalho. */}
            {ehDono(profile) && (
              <>
                <Divisor />
                <Linha
                  icon={BarChart3}
                  titulo="Painel do dono"
                  sub="Números da plataforma, pesquisa e fila de parceiros"
                  onClick={() => navigate('/admin')}
                />
              </>
            )}
          </Card>
        </Bloco>

        {/* CONTA E PRIVACIDADE — por último.
          *
          * A CÓPIA DOS DADOS SAIU DA TELA (03/10/2026, decisão do dono): ela
          * só é enviada a quem pede, e o pedido vai pelo suporte. O direito
          * continua com caminho — os Termos e o contrato nomeiam o e-mail de
          * config/developer.js —, só não é mais um botão no perfil.
          *
          * AS SAÍDAS FICAM NO FIM, DISCRETAS, ATRÁS DE UM LINK (mesmo dia).
          * Eram uma linha vermelha no meio do cartão, a um toque errado de
          * distância. Agora o link abre uma folha que separa as duas pelo
          * que fazem — ver `SaidasDaConta`. */}
        <Bloco titulo="Conta e privacidade">
          <Card>
            <Linha
              icon={LogOut}
              titulo="Sair da conta"
              sub="Seus dados continuam guardados"
              onClick={sair}
            />
          </Card>

          <div className="text-center text-sm text-textMuted flex items-center justify-center gap-3 pt-2">
            <a href="/termos" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center hover:underline">
              Termos de Uso
            </a>
            <span aria-hidden>·</span>
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center hover:underline"
            >
              Política de Privacidade
            </a>
          </div>
          <div className="text-center text-sm text-textMuted">
            Alô Buzinou · versão {APP_VERSION}
          </div>
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setSaidasAbertas(true)}
              className="tap inline-flex min-h-12 items-center px-3 text-sm text-textMuted underline underline-offset-2 decoration-textMuted/40"
            >
              {isAdmin ? 'Pausar ou excluir a conta' : 'Excluir a conta'}
            </button>
          </div>
        </Bloco>
      </div>



      <AddChildSheet
        open={addChildOpen}
        onClose={() => setAddChildOpen(false)}
      />

      <AvaliarOAppSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        uid={user?.uid}
        role={role}
      />

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        uid={user?.uid}
        role={role}
        profile={profile}
        email={user?.email}
      />

      <SaidasDaConta
        open={saidasAbertas}
        isAdmin={isAdmin}
        onClose={() => setSaidasAbertas(false)}
        onPausar={() => {
          setSaidasAbertas(false);
          navigate('/tio/encerrar');
        }}
        onExcluir={() => {
          setSaidasAbertas(false);
          setConfirmDelete(true);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={isAdmin ? 'Apagar sua conta e todos os dados?' : 'Excluir sua conta?'}
        description={
          isAdmin
            ? 'Vai apagar TUDO: crianças, contratos, pagamentos, recados e a sua conta. As famílias perdem o acesso. Não dá para desfazer. Para só parar de pagar a plataforma, use "Pausar a conta".'
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

function InfoRow({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Icon size={16} className="text-textMuted shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="rotulo">
          {label}
        </p>
        <p className="text-sm text-text break-words">{value || '—'}</p>
        {/* A dica fica ABAIXO do valor e menor: ela explica o valor, não
            compete com ele. */}
        {hint && <p className="text-sm text-textMuted mt-0.5">{hint}</p>}
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
        <Input semSalvar
          label="Nome"
          icon={UserIcon}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
          required
        />
        <Input semSalvar
          label="Telefone"
          icon={Phone}
          inputMode="tel"
          placeholder="Digite aqui"
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
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'female', label: 'Mulher' },
              { value: 'male', label: 'Homem' },
            ].map((g) => (
              <button
                key={g.value || 'none'}
                type="button"
                onClick={() => setGender(g.value)}
                className={`tap rounded-xl border-2 min-h-12 px-2 py-2.5 text-sm font-semibold ${
                  gender === g.value
                    ? 'border-primary bg-primarySoft text-primary'
                    : 'border-border bg-card text-textMuted'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sm leading-snug text-textMuted">
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

/* ──── Dados para o contrato com o responsável (Tio) ────
 *
 * ⚠️ ERA "DADOS DA EMPRESA" (02/10/2026). O motorista autônomo não tem
 * empresa e não se reconhecia ali — o teste no navegador mostrou o aviso do
 * contrato mandando para cá e a seção com um nome que não era dele. O texto
 * também prometia "o app usa placeholders padrão até lá", o que não é
 * verdade: sem esses dados o contrato simplesmente não é gerado.
 * O formulário é o mesmo do convite — `DadosDoContratoForm`. */

function CompanyDataCard({ profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const faltando = dadosDaContratadaFaltando(profile);
  const titulo = 'Dados para o seu contrato com o responsável';

  if (editing) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">{titulo}</h3>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center text-textMuted"
            aria-label="Cancelar"
          >
            <X size={18} />
          </button>
        </div>
        <DadosDoContratoForm
          onSalvo={async () => {
            await onSaved?.();
            setEditing(false);
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{titulo}</h3>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="tap inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-primary"
        >
          <Pencil size={14} /> {faltando.length ? 'Preencher' : 'Editar'}
        </button>
      </div>
      {faltando.length === 0 ? (
        <>
          <InfoRow icon={Building2} label="Nome" value={profile.companyName} />
          <InfoRow icon={FileText} label="CPF ou CNPJ" value={profile.companyDocument} />
          <InfoRow icon={MapPinIcon} label="Endereço" value={profile.companyAddress} />
        </>
      ) : (
        <div className="rounded-xl border border-warningBorder bg-warningSoft p-3 text-sm leading-relaxed text-warningText">
          Sem estes dados o contrato com as famílias não é gerado — e o convite
          só sai depois que você preencher.
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
        <div className="w-10 h-10 rounded-lg bg-primaryChip flex items-center justify-center shrink-0">
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
          <p className="text-sm text-textMuted">
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
function MarcaCard({ uid, nome, logoURL, cor, cores, onChanged }) {
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
      // A COR ACOMPANHA O LOGO (03/10/2026): trocou o logo, a cor mais
      // forte dele vira a cor do app — lida do ARQUIVO, no aparelho, antes
      // de qualquer rede. Logo sem cor viva volta ao verde da casa.
      const achadas = await lerCoresDoLogo(file);
      await setMarca(uid, { logoURL: url, cor: achadas[0] || null, cores: achadas });
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
      await setMarca(uid, { logoURL: null, cor: null, cores: [] });
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
        <p className="mt-0.5 text-sm leading-relaxed text-textMuted">
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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
            <Bus size={16} />
          </span>
        )}
        <span className="truncate text-base font-semibold text-text">
          {valor.trim() || 'Início'}
        </span>
      </div>

      <Input semSalvar
        id="marca-nome"
        label="Como suas famílias te chamam"
        placeholder="Digite aqui"
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
          <label className="tap flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-borderStrong text-sm font-semibold text-text">
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
              className="tap min-h-[48px] rounded-xl border border-borderStrong px-4 text-sm font-semibold text-textMuted"
            >
              Remover
            </button>
          )}
        </div>
      )}

      <CorDaMarca uid={uid} logoURL={logoURL} cor={cor} cores={cores} onChanged={onChanged} />
    </Card>
  );
}

/** Um bloco do perfil: título grande e o que é daquele assunto. */
function Bloco({ titulo, children }) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-lg font-extrabold text-text">{titulo}</h2>
      {children}
    </section>
  );
}

function Divisor() {
  return <div className="h-px bg-neutro -mx-4" />;
}

/** Uma linha tocável dentro de um bloco — botão, ou link quando há `href`. */
function Linha({ icon: Icon, titulo, sub, onClick, href, tom = 'normal' }) {
  const perigo = tom === 'perigo';
  const conteudo = (
    <>
      <span
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          perigo ? 'bg-dangerChip' : 'bg-primaryChip'
        }`}
      >
        <Icon size={20} className={perigo ? 'text-dangerText' : 'text-primary'} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className={`block text-sm font-semibold ${perigo ? 'text-dangerText' : 'text-text'}`}>
          {titulo}
        </span>
        {sub && <span className="block text-sm text-textMuted truncate">{sub}</span>}
      </span>
      <ChevronRight size={20} className="text-textMuted shrink-0" />
    </>
  );
  const classe = 'w-full flex items-center gap-3 tap py-2';
  if (href) {
    return (
      <a href={href} className={classe}>
        {conteudo}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classe}>
      {conteudo}
    </button>
  );
}

/**
 * PAUSAR OU EXCLUIR — as duas saídas, separadas pelo que fazem (03/10/2026).
 *
 * PAUSAR é só do motorista, e é o "Encerrar a associação" (/tio/encerrar):
 * para de pagar a plataforma, NADA é apagado, e religar não custa nada. A
 * família não paga a plataforma, então para ela não existe pausa — só a
 * exclusão.
 *
 * EXCLUIR continua passando pelo diálogo de confirmação, que diz o que se
 * perde. A pausa vem primeiro e em verde porque é a saída que não destrói
 * nada: quem quer parar de pagar acha ela antes da que apaga.
 */
function SaidasDaConta({ open, isAdmin, onClose, onPausar, onExcluir }) {
  return (
    <AppSheet open={open} onClose={onClose} title="Sua conta" icon={UserIcon}>
      <div className="space-y-3 pb-1">
        {isAdmin && (
          <button
            type="button"
            onClick={onPausar}
            className="tap flex w-full items-start gap-3 rounded-2xl border-2 border-primaryBorder bg-primarySoft p-4 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
              <PauseCircle size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-text">Pausar a conta</span>
              <span className="mt-0.5 block text-sm text-textBody">
                Encerra a associação: para de pagar a plataforma. Nada é apagado, e dá para voltar quando quiser.
              </span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onExcluir}
          className="tap flex w-full items-start gap-3 rounded-2xl border-2 border-dangerBorder bg-card p-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dangerChip text-dangerText">
            <Trash2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-dangerText">
              Excluir a conta e apagar os dados
            </span>
            <span className="mt-0.5 block text-sm text-textBody">
              {isAdmin
                ? 'Apaga turma, pagamentos e a conta. Não tem volta.'
                : 'Apaga a sua conta. Não tem volta.'}
            </span>
          </span>
        </button>
      </div>
    </AppSheet>
  );
}
