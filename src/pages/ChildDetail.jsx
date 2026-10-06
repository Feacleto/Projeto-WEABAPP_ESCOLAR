import { useNavigate, useParams } from 'react-router-dom';
import {
  GraduationCap,
  School,
  Clock,
  Pencil,
  Home,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  Trash2,
  Camera,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Printer,
  UserRound,
  Link2,
  CalendarX2,
  MessageCircle,
  Users,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { horariosCombinados, horaCurta } from '../dominio/rota/horarios';
import { horaFalada } from '../dominio/rota/horarioDeCostume.js';
import { useCostumeDaCrianca } from '../hooks/useCostumeDaCrianca';
import { marcarHorarioDeCostumeVisto } from '../services/fatosDoNivelService';
import { faltasDoMes, resumoDeFaltas } from '../dominio/rota/faltas';
import {
  addMonths,
  formatMonthLabel,
  getCurrentMonthKey,
  doDa,
  primeiroNome,
} from '../compartilhado/formatters';
import { useChildAbsenceHistory } from '../hooks/useAbsences';
import { updateChild } from '../services/childrenService';
import EditarOndeSheet from '../components/children/EditarOndeSheet';
import CartaoDoCombinado from '../components/contract/CartaoDoCombinado';
import EditarResponsavelSheet from '../components/children/EditarResponsavelSheet';
import EditarNotasSheet from '../components/children/EditarNotasSheet';
import TelefoneDaEscola from '../components/children/TelefoneDaEscola';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import AppSheet from '../components/common/AppSheet';
import InviteShare from '../components/children/InviteShare';
import ChildPaymentHistory from '../components/payments/ChildPaymentHistory';
import Avatar from '../components/common/Avatar';
import { STORAGE_ENABLED } from '../config/capabilities';
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
import { PERIOD_LABELS, formatPhone } from '../compartilhado/formatters';
import AcessoDeUmDia from '../components/children/AcessoDeUmDia';
import SaudeDaCrianca from '../components/children/SaudeDaCrianca';
import { PerguntaDaFoto } from '../components/comunidade/FotoDaTurmaDaFamilia';
import AvaliarOTio from '../components/comunidade/AvaliarOTio';
import PassarParaOutroTio from '../components/transferencia/PassarParaOutroTio';
import PedirOutroTio from '../components/transferencia/PedirOutroTio';

/**
 * Mini-perfil da criança. Funciona pra Tio (com edit/delete) e pra Pai (read-only).
 *
 * Roteamento:
 *   - /tio/children/:id (tio)
 *   - /pai/child        (pai — pega o childId do próprio profile)
 *
 * ─────────────────────────────────────────────────────────────────
 * TRÊS BLOCOS FIXOS, NA ORDEM DAS PERGUNTAS (03/10/2026).
 *
 * A ficha cresceu cartão a cartão, cada um com o próprio jeito de editar
 * ("Editar", um lápis sem texto, "Mudar", "Corrigir", "Escrever") — cinco
 * nomes para a mesma ação, e quem procurava onde mudar alguma coisa tinha que
 * ler a página inteira. Agora são três blocos, cada um com título e UM
 * "Editar" no canto superior direito:
 *
 *   Topo        foto, nome, status — e, para o motorista, Ligar e WhatsApp
 *   Dia a dia   horários, costume, casa, escola, turma, observações, faltas
 *   Família     o link do responsável, os responsáveis, o acesso de 24 h
 *   Dinheiro    contrato e mensalidade, mensalidades, extrato, papel antigo
 *
 * Partes de um bloco que outra pessoa pode mexer (turma e aniversário, que a
 * família também corrige; observações da parada) têm o próprio "Editar",
 * com a mesma cara. Quando cada edição aparece não mudou — só o nome.
 *
 * Remover a criança fica isolado no fim, longe do dedo.
 * ─────────────────────────────────────────────────────────────────
 */
function ChildDetailBody({ childId: childIdProp, onLeave }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, activeChildId, user, profile, updateProfile } = useAuth();
  const isAdmin = role === 'admin';

  // Pai: usa o childId do próprio profile, ignora :id na URL
  // Pai: o filho em foco vem do seletor (AuthContext), não mais do único
  // childId do perfil. Admin segue usando o :id da URL.
  // A folha passa o id na mão; a página lê da URL. O pai continua vindo do
  // seletor de filho, que não depende de nenhum dos dois.
  const childId = childIdProp || (isAdmin ? id : activeChildId);
  const { child, loading } = useChild(childId);
  const costume = useCostumeDaCrianca(childId);
  // O motorista VIU o horário de costume: marca, uma vez, para a atividade
  // de Platina que pede isso (docs/niveis.md, seção 5).
  const mostraCostume = role === 'admin' && !!costume && (costume.embarque != null || costume.chegada != null);
  const viuCostume = useRef(false);
  useEffect(() => {
    if (!mostraCostume || viuCostume.current || !user?.uid) return;
    if (profile?.marcos?.horarioDeCostumeVisto) return;
    viuCostume.current = true;
    marcarHorarioDeCostumeVisto(user.uid)
      .then(() => updateProfile?.({ marcos: { ...(profile?.marcos || {}), horarioDeCostumeVisto: true } }))
      .catch(() => {});
  }, [mostraCostume, user?.uid, profile, updateProfile]);
  const [editandoOnde, setEditandoOnde] = useState(false);
  const [editandoResponsavel, setEditandoResponsavel] = useState(false);
  const [editandoNotas, setEditandoNotas] = useState(false);
  // O "Editar" do bloco Dinheiro abre a folha que mora dentro do cartão do
  // combinado — o estado sobe pra cá para o botão ficar no título do bloco.
  const [editandoCombinado, setEditandoCombinado] = useState(false);

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
      // A página volta pra lista; a folha só se fecha — a lista já está
      // atrás dela, e navegar por cima recarregaria a tela inteira.
      if (onLeave) onLeave();
      else navigate('/tio/children', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover. Tente novamente.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!child) {
    return (
      <div>
          <Card>
            <p className="text-sm text-text">
              Cadastro não encontrado.
            </p>
          </Card>
      </div>
    );
  }

  // O telefone de quem o motorista liga quando a criança não está na porta.
  // Os dois botões do topo só existem para ele: o responsável tem o "falar
  // com o motorista" no cabeçalho, e ligar para si mesmo não é ação.
  const telefoneDaFamilia = isAdmin ? child.parentPhone : null;
  const nomeDoResponsavel = primeiroNome(child.parentName, 'o responsável');

  return (
    <>
      <div className="space-y-6">
        {/* Cabeçalho com o rosto, nome e status. Tanto Tio quanto Pai
          * podem trocar a foto da criança — backend valida permissão por
          * parentUid (ver firestore.rules + storage.rules).
          * ⚠️ O ROSTO AO LADO DO NOME (05/10/2026, densidade aprovada pelo
          * dono): era um rosto de 96 px centralizado, com o nome, o período e
          * o estado empilhados embaixo — metade da tela antes do "Dia a dia".
          * Agora é uma linha: o rosto à esquerda e o resto ao lado. */}
        <Card>
          <div className="flex items-center gap-4">
            <ChildPhotoEditor child={child} tamanho="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold leading-tight text-text">{child.name}</h2>
              {child.period && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-textMuted">
                  <GraduationCap size={16} />
                  {PERIOD_LABELS[child.period]}
                </p>
              )}
              <div className="mt-1.5">
                <StatusBadge status={child.status} />
              </div>
            </div>
          </div>

          {/* LIGAR E WHATSAPP LOGO ABAIXO DO NOME. É a primeira coisa que o
            * motorista faz com a ficha aberta na porta da casa: a criança não
            * desceu, e ele quer a mãe no telefone. O número morava no fim da
            * página, dentro do bloco de responsáveis. */}
          {telefoneDaFamilia && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={`tel:${telefoneDaFamilia}`}
                className="tap flex h-14 min-w-0 items-center justify-center gap-2 rounded-xl bg-marca px-3 text-base font-bold text-naMarca"
              >
                <Phone size={20} className="shrink-0" />
                <span className="truncate">Ligar para {nomeDoResponsavel}</span>
              </a>
              <a
                href={linkDoWhatsApp(telefoneDaFamilia, child.parentName || 'responsável', child.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="tap flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-base font-bold text-text"
              >
                <MessageCircle size={20} className="shrink-0 text-accentText" />
                WhatsApp
              </a>
            </div>
          )}
        </Card>

        {/* ═══════════ 1. DIA A DIA — onde, quando e como ═══════════
          *
          * O motorista abre a ficha no meio da rota, com a perua andando, pra
          * três perguntas: onde eu pego, que horas, e pra qual escola. O pai
          * abre pra uma: que horas. As respostas vêm antes de tudo, e o
          * dinheiro desce pro fim, que é quando alguém senta pra conferir.
          *
          * O EDITAR DO BLOCO É SÓ DO MOTORISTA e abre casa e escola: o
          * endereço só era escrito no cadastro, e família que muda de casa
          * obrigava a apagar a criança e refazer — perdendo o vínculo com o
          * responsável e o histórico de pagamento junto. Turma e observações
          * têm o próprio "Editar", porque quem pode mexer nelas é outra gente. */}
        <Bloco
          titulo="Dia a dia"
          icon={Clock}
          onEditar={isAdmin ? () => setEditandoOnde(true) : null}
          rotuloEditar="Editar casa e escola"
        >
          <Card className="space-y-4">
            {horariosCombinados(child).presumido ? (
              <p className="text-base text-textMuted">
                {isAdmin
                  ? 'Você ainda não definiu os horários — e até lá o responsável não vê hora nenhuma. Defina em Rota → Ajustar horários.'
                  : 'O motorista ainda não informou os horários. Assim que ele definir, aparecem aqui.'}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow
                    label="Entra na perua"
                    value={horaCurta(horariosCombinados(child).pega)}
                    grande
                  />
                  <InfoRow
                    label="Chega em casa"
                    value={horaCurta(horariosCombinados(child).entrega)}
                    grande
                  />
                </div>
                {/* O QUE ACONTECE DE VERDADE, ao lado do combinado (03/10/2026,
                  * pedido do dono). Os dois lados veem: a família se organiza
                  * pelo costume, e o motorista vê se o combinado ainda é real.
                  * Some enquanto não há viagens bastantes — ver a régua. */}
                {costume && (costume.embarque != null || costume.chegada != null) && (
                  <p className="rounded-xl bg-surface px-3 py-2.5 text-base leading-snug text-textBody">
                    <span className="font-semibold text-text">De costume</span>
                    {costume.embarque != null &&
                      ` · entra na perua por volta de ${horaFalada(costume.embarque)}`}
                    {costume.chegada != null &&
                      ` · chega em casa por volta de ${horaFalada(costume.chegada)}`}
                    <span className="block text-sm text-textMuted">
                      Pelas últimas {costume.viagens} viagens
                    </span>
                  </p>
                )}
              </>
            )}

            <div className="space-y-4 border-t border-neutro pt-4">
              <InfoRow icon={Home} label="Casa" value={child.address} />
              {/* Cadastrada pela rua com "não sei o número agora": a família
                * confirma o número no primeiro acesso dela, e ele aparece aqui. */}
              {child.numeroPendente && (
                <p className="-mt-2 pl-7 text-sm font-semibold text-warningText">
                  Falta o número da casa — a família confirma quando entrar no app.
                </p>
              )}
              <InfoRow icon={School} label="Escola" value={child.school} />
              {child.schoolAddress && (
                <InfoRow icon={MapPin} label="Endereço da escola" value={child.schoolAddress} />
              )}
              <TelefoneDaEscola child={child} isAdmin={isAdmin} />
            </div>

            {/* Turma, professora e aniversário: os DOIS lados corrigem. O
              * motorista pode ter dito a turma no cadastro; a família sabe
              * melhor, e o aniversário é só dela de saber. */}
            <div className="border-t border-neutro pt-4">
              <TurmaSala child={child} podeEditar />
            </div>

            {/* OBSERVAÇÕES DA PARADA — "portão de trás", "tocar o interfone".
              * É o texto que a rota mostra na parada da criança, na hora em que
              * a perua encosta. Até 03/10/2026 só dava para escrever no
              * cadastro: o motorista que descobria o portão lateral na segunda
              * semana não tinha onde anotar. Agora ele escreve e muda aqui. */}
            {(child.notes || isAdmin) && (
              <div className="space-y-2 border-t border-neutro pt-4">
                <SubTitulo
                  icon={StickyNote}
                  titulo="Observações da parada"
                  onEditar={isAdmin ? () => setEditandoNotas(true) : null}
                  rotuloEditar="Editar observações da parada"
                />
                {child.notes ? (
                  <p className="text-base text-text leading-relaxed whitespace-pre-wrap">
                    {child.notes}
                  </p>
                ) : (
                  <p className="text-base text-textMuted">
                    Aparece na rota, na parada desta criança. Ex.: portão de trás.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* QUANTAS VEZES ELA FALTOU — a pergunta que os dois lados fazem.
            *
            * Fica no dia a dia, e não num bloco próprio, porque é presença:
            * o motorista precisa disso pra conversar com a família ("é a
            * quinta este mês") e o responsável pra saber onde está. Não tem
            * "Editar" — falta se avisa pelo app, não se corrige na ficha.
            *
            * O aviso marcado pra frente aparece separado e nunca somado: é
            * combinado, não falta. Somar faria a ficha dizer que a criança
            * faltou num dia que ainda não chegou. */}
          {/* SAÚDE — escrita só pela responsável, lida pelo motorista.
            * Fica no dia a dia porque é para a emergência NO TRAJETO; o
            * porquê inteiro mora no componente. */}
          <SaudeDaCrianca child={child} isAdmin={isAdmin} />

          {/* A FOTO DA TURMA (05/10/2026): só a família responde, e muda aqui.
            * O motorista não vê a pergunta: a resposta aparece para ele na
            * hora de marcar quem está na foto. */}
          {!isAdmin && <PerguntaDaFoto child={child} naFicha />}
          {/* A nota do tio (etapa 2): na ficha sempre, para mudar. */}
          {!isAdmin && <AvaliarOTio child={child} />}

          <FaltasDaCrianca childId={child.id} adminUid={child.adminUid} />
        </Bloco>

        {/* ═══════════ 2. FAMÍLIA — quem é, e como entra ═══════════
          *
          * O LINK DO RESPONSÁVEL VEM PRIMEIRO NO BLOCO, E SEMPRE PRESENTE.
          * O caminho real é o pai perder o link — apaga a conversa, troca de
          * celular, nunca abriu — e pedir pro tio. Antes o bloco só existia
          * enquanto o convite estivesse pendente, e o tio abria a ficha sem
          * achar link nenhum. É O APP que decide qual link mandar:
          *
          *   convite pendente → /convite/CÓDIGO, que cria a conta na hora
          *   já aceito        → o mesmo convite, que abre direto na criança
          *
          * POR QUE NÃO UM "GERAR NOVO CONVITE" AQUI
          * O convite é de uso único no servidor (functions/lib/invites.js
          * recusa código já usado, e é isso que impede um estranho de se
          * vincular a uma criança). Emitir convite novo pra quem já tem conta
          * reabriria essa porta pra resolver um problema que era só de achar
          * uma URL.
          *
          * O "EDITAR" SÓ EXISTE ANTES DE A FAMÍLIA ENTRAR: depois, nome e
          * telefone são dela (ver `EditarResponsavelSheet`). */}
        <Bloco
          titulo="Família"
          icon={Users}
          onEditar={isAdmin && !child.parentUid ? () => setEditandoResponsavel(true) : null}
          rotuloEditar="Editar o responsável"
        >
          {isAdmin && <LinkDoResponsavel child={child} />}

          <Card className="space-y-4">
            <div className="space-y-3 pb-4 border-b border-neutro last:border-0 last:pb-0">
              <p className="text-base font-bold text-text">Responsável principal</p>
              <InfoRow label="Nome" value={child.parentName} />
              {(child.linkedEmail || child.parentEmail) && (
                <InfoRow icon={Mail} label="E-mail" value={child.linkedEmail || child.parentEmail} />
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
              <div className="space-y-3">
                <p className="text-base font-bold text-text">Segundo responsável</p>
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
            {/* O acesso de 24 horas do segundo responsável (03/10/2026). */}
            <AcessoDeUmDia child={child} />
          </Card>
        </Bloco>

        {/* ═══════════ 3. DINHEIRO — o combinado e o que foi pago ═══════════
          *
          * Contrato e mensalidade (o quanto, o até quando e se a família
          * concordou), o histórico mês a mês ("essa família está em dia?"), o
          * extrato pra imprimir e o papel de antes do app. O "Editar" do bloco
          * é o que o cartão do combinado chamava de "Mudar" — depois do aceite
          * ele vira contrato novo, e a folha diz isso antes do botão. */}
        <Bloco
          titulo="Dinheiro"
          icon={Wallet}
          onEditar={isAdmin ? () => setEditandoCombinado(true) : null}
          rotuloEditar="Editar mensalidade e contrato"
        >
          {isAdmin && (
            <CartaoDoCombinado
              child={child}
              editando={editandoCombinado}
              onEditando={setEditandoCombinado}
              onVerContrato={() => {
                onLeave?.();
                navigate(`/tio/children/${child.id}/contract`);
              }}
            />
          )}

          <ChildPaymentHistory
            childId={child.id}
            role={isAdmin ? 'admin' : 'parent'}
          />

          {/* O MESMO HISTÓRICO, EM PAPEL. Tela não leva a conta pra uma
            * conversa: sentar com o responsável, mandar quando alguém contesta
            * um mês, imprimir e anotar o combinado em cima. Só pro tio: o pai
            * já tem o extrato dele em /pai/finance/report. */}
          {isAdmin && (
            <LinhaDePorta
              icon={Printer}
              titulo="Extrato de mensalidades"
              detalhe="Pra imprimir, mandar ou anotar em cima"
              onClick={() => {
                onLeave?.();
                navigate(`/tio/children/${child.id}/extrato`);
              }}
            />
          )}

          {/* O CONTRATO DE ANTES, quando existe. Fica ao lado do contrato do
            * app de propósito: quem procura "o contrato" precisa ver os dois e
            * entender qual é qual — o do app é o que vale, este é o de antes. */}
          {child.contratoAnteriorURL && (
            <LinhaDePorta
              icon={Paperclip}
              titulo="Contrato anterior"
              detalhe="O papel de antes do app — registro, não é o que vale"
              href={child.contratoAnteriorURL}
            />
          )}
        </Bloco>

        {/* PASSAR A FAMÍLIA PARA OUTRO TIO (fase 2 da rede, 05/10/2026): o tio
          * escolhe um parceiro; a família pede ao tio dela. Os dois somem com a
          * cobrança desligada. */}
        {isAdmin ? <PassarParaOutroTio child={child} /> : <PedirOutroTio child={child} />}

        {/* Remover fica isolado no fim, longe do dedo. */}
        {isAdmin && (
          <div className="border-t border-neutro pt-4">
            <Button
              variant="ghost"
              icon={Trash2}
              className="!text-dangerText"
              onClick={() => setConfirmDeactivate(true)}
            >
              Remover criança
            </Button>
          </div>
        )}
      </div>

      {/* A `key` faz a folha renascer com os dados atuais: os campos são
        * estado local inicializado da prop, e sem isso a segunda abertura
        * mostraria o endereço de antes de salvar. */}
      {isAdmin && (
        <EditarOndeSheet
          key={`${child.address}-${child.schoolId}`}
          open={editandoOnde}
          child={child}
          onClose={() => setEditandoOnde(false)}
        />
      )}

      {isAdmin && (
        <EditarNotasSheet
          key={`${child.notes || ''}-${editandoNotas}`}
          open={editandoNotas}
          child={child}
          onClose={() => setEditandoNotas(false)}
        />
      )}

      {isAdmin && !child.parentUid && (
        <EditarResponsavelSheet
          key={`${child.parentName}-${child.parentPhone}-${editandoResponsavel}`}
          open={editandoResponsavel}
          child={child}
          onClose={() => setEditandoResponsavel(false)}
        />
      )}

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

/**
 * CASCA 1 — a página. Link direto, favorito, notificação, e o pai (que chega
 * por /pai/child sem nenhuma lista por trás).
 */
export default function ChildDetail() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <>
      {/* O destino é DECLARADO, não `navigate(-1)`.
        * Esta casca é justamente a de quem chegou por notificação, link do
        * WhatsApp ou recarregando a página — casos em que não existe história
        * e a seta sozinha ou não faz nada, ou joga a pessoa pra fora do app. */}
      <Header
        title="Ficha da criança"
        showBack
        backLabel={isAdmin ? 'Minha turma' : 'Início'}
        backTo={isAdmin ? '/tio/children' : '/pai'}
      />
      <div className="p-4">
        <ChildDetailBody />
      </div>
    </>
  );
}

/**
 * CASCA 2 — a folha. É por onde a lista "Minha turma" abre a ficha.
 *
 * Abrir a ficha custava a lista inteira: o filtro de período, o texto da
 * busca e a rolagem. O tio conferia um telefone e voltava pro começo de uma
 * lista de vinte crianças. Como folha, tudo isso continua atrás, intacto.
 *
 * Altura cheia porque a ficha é longa de verdade — link, mensalidade,
 * contrato, escola, endereço, responsáveis. Folha curta aqui viraria uma
 * janelinha rolando dentro de outra tela, que é pior que as duas opções.
 */
export function ChildDetailSheet({ open, childId, onClose }) {
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Ficha da criança"
      icon={UserRound}
      size="full"
    >
      {open && <ChildDetailBody childId={childId} onLeave={onClose} />}
    </AppSheet>
  );
}

/**
 * O acumulado de faltas, com caminho pro histórico completo.
 *
 * Assina por criança em vez de receber pronto porque a ficha abre de quatro
 * lugares diferentes (rota, turma, painel do pai, home do motorista) e passar
 * o histórico por prop obrigaria os quatro a carregá-lo — inclusive os que
 * abrem a ficha e nunca rolam até aqui.
 */
function FaltasDaCrianca({ childId, adminUid }) {
  const { history, loading } = useChildAbsenceHistory(childId, adminUid);
  const [mes, setMes] = useState(() => getCurrentMonthKey());

  const doMes = useMemo(() => faltasDoMes(history, mes), [history, mes]);
  const futuras = useMemo(() => resumoDeFaltas(history).futuras, [history]);

  // Só anda PRA TRÁS a partir do mês corrente. Mês à frente só teria aviso
  // marcado, que não é falta e já aparece separado logo abaixo — navegar pra
  // lá daria meses vazios sem fim e a sensação de que a tela travou.
  const podeAvancar = mes < getCurrentMonthKey();

  return (
    <Card className="space-y-3">
      <SubTitulo icon={CalendarX2} titulo="Faltas" />

      {/* MÊS A MÊS, E SEM TOTAL ACUMULADO.
        *
        * O "desde o começo" saiu: ele responde uma pergunta que ninguém faz.
        * A conversa real é sempre sobre um mês — a mensalidade é mensal, a
        * reunião da escola é sobre o bimestre, e "faltou muito" quer dizer
        * "muito neste mês". Um número que só cresce vira ruído: depois de um
        * ano ele diz 40 e não distingue a criança que faltou toda semana da
        * que teve uma catapora e nunca mais. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMes((m) => addMonths(m, -1))}
          aria-label="Mês anterior"
          className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-center">
          {loading ? (
            <p className="text-sm text-textMuted">carregando…</p>
          ) : (
            <>
              <p className="text-xl font-extrabold leading-none tabular-nums text-text">
                {doMes.length}
              </p>
              <p className="mt-1 text-sm capitalize leading-tight text-textMuted">
                {formatMonthLabel(mes)}
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={!podeAvancar}
          onClick={() => podeAvancar && setMes((m) => addMonths(m, 1))}
          aria-label="Próximo mês"
          className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {futuras > 0 && (
        <p className="rounded-xl bg-warningSoft px-3 py-2 text-sm leading-relaxed text-warningText">
          <strong>
            {futuras} {futuras === 1 ? 'aviso marcado' : 'avisos marcados'}
          </strong>{' '}
          pra frente. Não entra na conta — ainda não aconteceu.
        </p>
      )}

      {!loading && doMes.length === 0 && futuras === 0 && (
        <p className="text-sm leading-relaxed text-textMuted">
          Só conta o que foi avisado pelo app.
        </p>
      )}
    </Card>
  );
}


/**
 * O bloco do link, que muda de conversa conforme o estado do convite.
 *
 * Pendente, ele é âmbar e chama atenção: há trabalho a fazer, o responsável
 * ainda não entrou. Aceito, ele fica neutro e discreto — não é pendência,
 * é uma ferramenta que fica ali pro dia em que o pai pedir.
 */
function LinkDoResponsavel({ child }) {
  const pendente = child.inviteStatus === 'pending';

  if (pendente) {
    return (
      <Card className="space-y-3 border border-warningBorder bg-warningSoft">
        <div>
          <p className="flex items-center gap-2 text-base font-bold text-warningText">
            <AlertTriangle size={18} className="shrink-0" />
            O responsável ainda não entrou
          </p>
          <p className="mt-1 text-base text-text">
            Mande o link — a conta dele se cria por lá, sem digitar código.
          </p>
        </div>
        <InviteShare
          code={child.inviteCode}
          crianca={child}
          childName={child.name}
          gender={child.gender}
          parentPhone={child.parentPhone}
        />
      </Card>
    );
  }

  // ⚠️ AQUI IA O LINK GENÉRICO DA `/familia`, e ele era o caminho pior.
  //
  // Nove telas do app dizem "peça um link novo pro motorista" — e o motorista
  // abria a ficha e encontrava um link que leva a uma página de entrada onde a
  // mãe precisa se achar sozinha. Não existe botão de regerar convite em lugar
  // nenhum do repositório: `generateUniqueInviteCode` tem UM chamador, o
  // cadastro da criança.
  //
  // O convite JÁ É o ponto de reconexão, e sempre foi: `Invite.jsx` reconhece
  // quando o convite é de quem abriu e abre o app DIRETO na criança certa. É o
  // caminho mais percorrido do app — o pai não guarda endereço de site, ele
  // volta na conversa do WhatsApp e toca no mesmo link, semana após semana.
  //
  // Então o link não muda; muda o texto. Ver `jaEntrou` em `InviteShare`.
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <Link2 size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-text">
            Link de acesso do responsável
          </p>
          <p className="mt-1 text-sm text-textMuted">
            {child.parentName || 'O responsável'} já tem conta. Se perdeu o
            caminho de volta, mande este link — ele abre direto na página
            {child.name
              ? ` ${doDa(String(child.name).split(' ')[0], child.gender)}`
              : ' da criança'}
            .
          </p>
        </div>
      </div>
      <InviteShare
        code={child.inviteCode}
        childName={child.name}
        gender={child.gender}
        parentPhone={child.parentPhone}
        jaEntrou
      />
    </Card>
  );
}

// `AppLinkShare` FOI REMOVIDO EM 06/09/2026.
//
// Ele mandava o link genérico da `/familia` para o responsável que já tinha
// conta — a porta de entrada, onde ela precisa se achar sozinha. O link do
// CONVITE faz melhor: abre o app direto na criança dela. Ver `LinkDoResponsavel`
// logo acima.
//
// A regra que ele carregava continua valendo e mora em `dominio/vitrine/
// frentes.js`: mandar o pai para a raiz é confuso, porque a raiz fala de taxa e
// de negócio — conteúdo endereçado ao motorista.


function ChildPhotoEditor({ child, tamanho = 'xl' }) {
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
        size={tamanho}
      />
      {/* Sem Storage não há upload, então não há botão. O avatar continua
        * ali: ele é gerado no navegador a partir do id, e ninguém fica sem
        * rosto na lista — só não dá pra trocar por uma foto de verdade. */}
      {STORAGE_ENABLED && (
        <label
          htmlFor={`child-photo-${child.id}`}
          // A área de toque continua com 48 px; o círculo VISÍVEL é de 36,
          // para não cobrir metade do rosto, que desde 05/10/2026 tem 64 px.
          className="absolute -bottom-3 -right-4 flex h-12 w-12 cursor-pointer items-center justify-center tap"
        >
          {/* Texto escondido, não `aria-label`: em <label> o leitor de tela
            * ignora o atributo (axe: aria-prohibited-attr). */}
          <span className="sr-only">Trocar foto</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-marca text-naMarca shadow-lg">
            <Camera size={16} />
          </span>
          <input
            id={`child-photo-${child.id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
            disabled={uploading}
          />
        </label>
      )}
      {/* Remover também depende de Storage (deleteObject). */}
      {STORAGE_ENABLED && child.photoURL && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -bottom-2 -left-3 w-12 h-12 rounded-full bg-card text-dangerText border border-border shadow flex items-center justify-center tap"
          aria-label="Remover foto"
        >
          <Trash2 size={18} />
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

/**
 * Rótulo em 14px e valor em 16px (18px no `grande`, que é a hora). O rótulo
 * era 12px: legível de perto, não com a perua andando.
 */
function InfoRow({ icon: Icon, label, value, grande = false }) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={18} className="text-textMuted shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-textMuted">{label}</p>
        <p
          className={`break-words text-text ${
            grande ? 'text-lg font-bold tabular-nums' : 'text-base'
          }`}
        >
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

/** O link do WhatsApp com a mensagem pronta — o topo e os responsáveis usam o mesmo. */
function linkDoWhatsApp(phone, name, childName) {
  const phoneDigits = String(phone).replace(/\D/g, '');
  const phoneE164 = phoneDigits.startsWith('55')
    ? phoneDigits
    : `55${phoneDigits}`;
  const text = encodeURIComponent(
    `Olá, ${name}! Sou do transporte escolar, sobre ${childName}.`
  );
  return `https://wa.me/${phoneE164}?text=${text}`;
}

function PhoneRow({ phone, name, childName }) {
  return (
    <div className="flex items-center gap-2">
      <Phone size={18} className="text-textMuted shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-textMuted">Telefone</p>
        <p className="text-base text-text">{formatPhone(phone)}</p>
      </div>
      <a
        href={linkDoWhatsApp(phone, name, childName)}
        target="_blank"
        rel="noopener noreferrer"
        className="tap inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-primaryChip px-3 text-sm font-semibold text-accentText"
      >
        <MessageCircle size={16} />
        WhatsApp
      </a>
    </div>
  );
}

/**
 * O título de um dos três blocos da ficha, com o "Editar" no canto superior
 * direito — o mesmo lugar, a mesma cara e o mesmo nome nos três. Sem
 * `onEditar` (o pai, ou a família que já entrou) o botão não aparece.
 */
function Bloco({ titulo, icon: Icon, onEditar, rotuloEditar, children }) {
  return (
    <section className="space-y-3">
      <div className="flex min-h-12 items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xl font-bold text-text">
          <Icon size={20} className="text-primary shrink-0" />
          {titulo}
        </h3>
        {onEditar && <BotaoEditar onClick={onEditar} rotulo={rotuloEditar} />}
      </div>
      {children}
    </section>
  );
}

/** Subtítulo dentro de um bloco, com o próprio "Editar" quando houver. */
function SubTitulo({ titulo, icon: Icon, onEditar, rotuloEditar }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-base font-bold text-text">
        {Icon && <Icon size={18} className="text-primary shrink-0" />}
        {titulo}
      </p>
      {onEditar && <BotaoEditar onClick={onEditar} rotulo={rotuloEditar} />}
    </div>
  );
}

/**
 * UM NOME PARA A MESMA AÇÃO. A ficha dizia "Editar", "Mudar", "Corrigir",
 * "Escrever" e tinha um lápis sem texto — e cada nome fazia a pessoa
 * perguntar se era outra coisa. O `rotulo` vai para o leitor de tela, que
 * precisa saber O QUE vai ser editado.
 */
function BotaoEditar({ onClick, rotulo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="tap -mr-2 inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-primary"
    >
      <Pencil size={18} />
      Editar
    </button>
  );
}

/** Linha que leva a outra tela ou a um arquivo — extrato, contrato antigo. */
function LinhaDePorta({ icon: Icon, titulo, detalhe, onClick, href }) {
  const conteudo = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text leading-tight">
          {titulo}
        </span>
        <span className="mt-0.5 block text-sm text-textMuted">{detalhe}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-textMuted" />
    </>
  );
  const classe =
    'tap flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classe}>
      {conteudo}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={classe}>
      {conteudo}
    </button>
  );
}

/**
 * Turma, professora e aniversário. A SALA saiu (02/10/2026, pedido do dono):
 * muda no meio do ano, e ninguém chama criança no portão pelo número da sala.
 * Quem já tinha sala gravada continua com ela no documento, sem tela.
 *
 * O motorista lê pra saber onde chamar a criança quando ela não aparece no
 * portão; o pai escreve porque é o único que sabe. As rules liberam só estes
 * três campos pra ele: nenhum tem efeito em rota, cobrança ou permissão.
 *
 * O ANIVERSÁRIO MUDOU DE MÃO (02/10/2026). Era pedido ao motorista no passo 1
 * do cadastro da criança, e ele quase nunca sabe a data — o campo ficava em
 * branco, ou com um chute. Quem sabe é a família, então é ela que preenche.
 */
function TurmaSala({ child, podeEditar }) {
  const [editando, setEditando] = useState(false);
  const [turma, setTurma] = useState(child.turma || '');
  const [professora, setProfessora] = useState(child.professora || '');
  const [aniversario, setAniversario] = useState(child.birthDate || '');
  const [salvando, setSalvando] = useState(false);

  const vazio = !child.turma && !child.professora && !child.birthDate;

  async function salvar() {
    setSalvando(true);
    try {
      await updateChild(child.id, {
        turma: turma.trim(),
        professora: professora.trim(),
        birthDate: aniversario || '',
      });
      toast.success('Salvo.');
      setEditando(false);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <div className="space-y-2 pt-1">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text">Turma</span>
          <input
            value={turma}
            onChange={(e) => setTurma(e.target.value)}
            placeholder="Digite aqui"
            className="h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-base text-text focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text">Professora</span>
          <input
            value={professora}
            onChange={(e) => setProfessora(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-base text-text focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text">
            Aniversário
          </span>
          <input
            type="date"
            value={aniversario}
            onChange={(e) => setAniversario(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-base text-text focus:outline-none focus:border-primary"
          />
        </label>
        <div className="flex gap-2">
          <Button size="sm" loading={salvando} onClick={salvar}>
            Salvar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={salvando}
            onClick={() => setEditando(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (vazio && !podeEditar) {
    return (
      <p className="text-base text-textMuted">
        O responsável ainda não informou turma, professora e aniversário.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <SubTitulo
        icon={GraduationCap}
        titulo="Turma e aniversário"
        onEditar={podeEditar ? () => setEditando(true) : null}
        rotuloEditar="Editar turma, professora e aniversário"
      />
      <div className="space-y-3">
        <InfoRow label="Turma" value={child.turma || '—'} />
        <InfoRow label="Professora" value={child.professora || '—'} />
        <InfoRow
          label="Aniversário"
          value={
            child.birthDate
              ? child.birthDate.split('-').reverse().slice(0, 2).join('/')
              : '—'
          }
        />
      </div>
    </div>
  );
}
