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
  FileText,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  Printer,
  UserRound,
  Link2,
  Copy,
  Check,
  CalendarX2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { horariosCombinados, horaCurta } from '../services/horariosService';
import {
  chaveDoMes,
  faltasDoMes,
  resumoDeFaltas,
  rotuloDoMes,
  somaMeses,
} from '../utils/faltas';
import { useChildAbsenceHistory } from '../hooks/useAbsences';
import { updateChild } from '../services/childrenService';
import EditarOndeSheet from '../components/children/EditarOndeSheet';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Card from '../components/common/Card';
import AppSheet from '../components/common/AppSheet';
import InviteShare from '../components/children/InviteShare';
import WhatsAppIcon from '../components/common/WhatsAppIcon';
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
import { PERIOD_LABELS, formatPhone } from '../utils/formatters';

/**
 * Mini-perfil da criança. Funciona pra Tio (com edit/delete) e pra Pai (read-only).
 *
 * Roteamento:
 *   - /tio/children/:id (tio)
 *   - /pai/child        (pai — pega o childId do próprio profile)
 *
 * ─────────────────────────────────────────────────────────────────
 * A ORDEM DA PÁGINA É A ORDEM DAS PERGUNTAS DO TIO.
 *
 * Antes ela era a ordem do cadastro: escola, endereço, responsáveis,
 * observações — e só depois, lá no fim, convite, mensalidade e contrato.
 * Ou seja: o que ele CONSULTA vinha antes do que ele RESOLVE, e as três
 * coisas que geram trabalho ficavam abaixo da dobra.
 *
 * A ordem agora:
 *
 *   1. Link do responsável   o que ele veio buscar quando o pai ligou
 *   2. Mensalidade           "essa família está em dia?"
 *   3. Contrato              o documento da relação
 *   4. Escola                consulta
 *   5. Endereço de casa      consulta
 *   6. Responsável           consulta — e por último de propósito: é o dado
 *                            mais longo e o menos perecível dos três
 *
 * Observações e extrato fecham a página; remover a criança fica no fim,
 * longe do dedo.
 * ─────────────────────────────────────────────────────────────────
 */
function ChildDetailBody({ childId: childIdProp, onLeave }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, activeChildId } = useAuth();
  const isAdmin = role === 'admin';

  // Pai: usa o childId do próprio profile, ignora :id na URL
  // Pai: o filho em foco vem do seletor (AuthContext), não mais do único
  // childId do perfil. Admin segue usando o :id da URL.
  // A folha passa o id na mão; a página lê da URL. O pai continua vindo do
  // seletor de filho, que não depende de nenhum dos dois.
  const childId = childIdProp || (isAdmin ? id : activeChildId);
  const { child, loading } = useChild(childId);
  const [editandoOnde, setEditandoOnde] = useState(false);

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

  return (
    <>
      <div className="space-y-4">
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

        {/* ─────────── ONDE E QUANDO — a operação primeiro ───────────
          *
          * A ficha estava ordenada por ordem de implementação: link do
          * responsável, mensalidade, contrato, e só então escola, horário e
          * endereço. Mas ninguém abre a ficha de uma criança pra ver contrato.
          *
          * O motorista abre no meio da rota, com a perua andando, pra três
          * perguntas: onde eu pego, que horas, e pra qual escola. O pai abre
          * pra uma: que horas. As duas respostas são as mesmas três linhas —
          * então elas vêm antes de tudo, e o dinheiro desce pro fim, que é
          * quando alguém senta pra conferir.
          *
          * O EDITAR É SÓ DO MOTORISTA, e existe porque não existia: o
          * endereço só era escrito no cadastro, e família que muda de casa
          * obrigava a apagar a criança e refazer — perdendo o vínculo com o
          * responsável e o histórico de pagamento junto. */}
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Clock size={16} className="text-primary" />
              Onde e quando
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditandoOnde(true)}
                className="tap -mr-1 -mt-1 inline-flex items-center gap-1 p-1 text-xs font-semibold text-primary"
              >
                <Pencil size={13} /> Editar
              </button>
            )}
          </div>

          {horariosCombinados(child).presumido ? (
            <p className="text-sm text-textMuted">
              {isAdmin
                ? 'Você ainda não definiu os horários — e até lá o responsável não vê hora nenhuma. Defina em Rota → Ajustar horários.'
                : 'O motorista ainda não informou os horários. Assim que ele definir, aparecem aqui.'}
            </p>
          ) : (
            <>
              <InfoRow
                label="Entra na perua"
                value={horaCurta(horariosCombinados(child).pega)}
              />
              <InfoRow
                label="Chega em casa"
                value={horaCurta(horariosCombinados(child).entrega)}
              />
            </>
          )}

          <div className="space-y-3 border-t border-gray-100 pt-3">
            <InfoRow icon={Home} label="Casa" value={child.address} />
            <InfoRow icon={School} label="Escola" value={child.school} />
            {child.schoolAddress && (
              <InfoRow icon={MapPin} label="Endereço da escola" value={child.schoolAddress} />
            )}
            {/* Turma e sala: quem sabe é o RESPONSÁVEL. O motorista não
              * acompanha a criança até a porta da sala, então perguntar a ele
              * seria perguntar pra quem não tem a resposta. Ele lê aqui pra
              * saber onde chamar quando precisa. */}
            <TurmaSala child={child} podeEditar={!isAdmin} />
          </div>
        </Card>

        {/* ─────────── 1. O LINK DO RESPONSÁVEL ───────────
          *
          * PRIMEIRO DE TUDO, E SEMPRE PRESENTE.
          *
          * Antes este bloco era o sexto da página e só existia enquanto o
          * convite estivesse pendente. O caminho real é outro: o pai perde o
          * link — apaga a conversa, troca de celular, nunca abriu — e pede
          * pro tio. Aí o tio abria a ficha, não achava link nenhum, e o
          * assunto virava chamado de suporte por uma URL.
          *
          * Agora tem um alvo só, sempre no topo, e é O APP que decide qual
          * link mandar. O tio nunca precisa saber a diferença:
          *
          *   convite pendente → /convite/CÓDIGO, que cria a conta na hora
          *   já aceito        → a porta da família, que é onde ele entra
          *
          * POR QUE NÃO UM "GERAR NOVO CONVITE"
          * Porque o convite é de uso único no servidor (functions/lib/
          * invites.js recusa código já usado, e é isso que impede um estranho
          * de se vincular a uma criança). Emitir convite novo pra quem já tem
          * conta reabriria essa porta pra resolver um problema que era só de
          * achar uma URL. */}
        {isAdmin && <LinkDoResponsavel child={child} />}

        {/* Histórico de mensalidades desta criança.
          * A pergunta que o tio mais faz ao financeiro é "essa família está
          * em dia?" — e ela nasce AQUI, na ficha, não na tela de meses. */}
        <ChildPaymentHistory
          childId={child.id}
          role={isAdmin ? 'admin' : 'parent'}
        />

        {/* O CONTRATO DE ANTES, quando existe.
          * Fica ao lado do contrato do app de propósito: quem abre a ficha
          * procurando "o contrato" precisa ver os dois e entender qual é
          * qual — o do app é o que vale, este é o que veio antes. */}
        {child.contratoAnteriorURL && (
          <a
            href={child.contratoAnteriorURL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap flex items-center gap-3 rounded-2xl border border-gray-200 bg-card px-4 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-textMuted">
              <Paperclip size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text">
                Contrato anterior
              </span>
              <span className="block text-[11px] text-textMuted">
                O papel de antes do app — registro, não é o que vale
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-textMuted" />
          </a>
        )}

        {/* Acesso ao contrato (Tio) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              onLeave?.();
              navigate(`/tio/children/${child.id}/contract`);
            }}
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

        {/* QUANTAS VEZES ELA FALTOU — a pergunta que os dois lados fazem.
          *
          * O motorista precisa disso pra conversar com a família ("é a quinta
          * este mês") e o responsável pra saber onde está. Estava só no painel
          * do pai, e o motorista não tinha nenhum lugar onde ler o número:
          * ele via a falta do DIA na rota e nunca o acumulado.
          *
          * O aviso marcado pra frente aparece separado e nunca somado: é
          * combinado, não falta. Somar faria a ficha dizer que a criança
          * faltou num dia que ainda não chegou. */}
        <FaltasDaCrianca childId={child.id} />

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
            onClick={() => {
              onLeave?.();
              navigate(`/tio/children/${child.id}/extrato`);
            }}
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
        title="Perfil da criança"
        showBack
        backLabel={isAdmin ? 'Crianças' : 'Início'}
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
function FaltasDaCrianca({ childId }) {
  const { history, loading } = useChildAbsenceHistory(childId);
  const [mes, setMes] = useState(() => chaveDoMes());

  const doMes = useMemo(() => faltasDoMes(history, mes), [history, mes]);
  const futuras = useMemo(() => resumoDeFaltas(history).futuras, [history]);

  // Só anda PRA TRÁS a partir do mês corrente. Mês à frente só teria aviso
  // marcado, que não é falta e já aparece separado logo abaixo — navegar pra
  // lá daria meses vazios sem fim e a sensação de que a tela travou.
  const podeAvancar = mes < chaveDoMes();

  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <CalendarX2 size={16} className="text-primary" />
        Faltas
      </h3>

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
          onClick={() => setMes((m) => somaMeses(m, -1))}
          aria-label="Mês anterior"
          className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-textMuted"
        >
          <ChevronLeft size={15} />
        </button>

        <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-surface px-3 py-2 text-center">
          {loading ? (
            <p className="text-sm text-textMuted">carregando…</p>
          ) : (
            <>
              <p className="text-xl font-extrabold leading-none tabular-nums text-text">
                {doMes.length}
              </p>
              <p className="mt-1 text-[11px] capitalize leading-tight text-textMuted">
                {rotuloDoMes(mes)}
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={!podeAvancar}
          onClick={() => podeAvancar && setMes((m) => somaMeses(m, 1))}
          aria-label="Próximo mês"
          className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-textMuted disabled:opacity-30"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {futuras > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          <strong>
            {futuras} {futuras === 1 ? 'aviso marcado' : 'avisos marcados'}
          </strong>{' '}
          pra frente. Não entra na conta — ainda não aconteceu.
        </p>
      )}

      {!loading && doMes.length === 0 && futuras === 0 && (
        <p className="text-xs leading-relaxed text-textMuted">
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
      <Card className="space-y-3 border border-warning/30 bg-warning/10">
        <div>
          <p className="text-sm font-semibold text-text">
            O responsável ainda não entrou
          </p>
          <p className="mt-1 text-xs text-textMuted">
            Mande o link — a conta dele se cria por lá, sem digitar código.
          </p>
        </div>
        <InviteShare
          code={child.inviteCode}
          childName={child.name}
          parentPhone={child.parentPhone}
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Link2 size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">
            Link de acesso do responsável
          </p>
          <p className="mt-1 text-xs text-textMuted">
            {child.parentName || 'O responsável'} já tem conta. Se perdeu o
            caminho de volta, mande este link.
          </p>
        </div>
      </div>
      <AppLinkShare childName={child.name} parentPhone={child.parentPhone} />
    </Card>
  );
}

/**
 * Copiar / mandar no WhatsApp a porta da família.
 *
 * `/familia` e não `/`: a raiz é a vitrine de associação, que fala de taxa,
 * de vaga e de negócio — conteúdo endereçado ao motorista. Mandar o pai pra
 * lá é, no mínimo, confuso; no pior caso sugere que a vaga do filho dele
 * corre risco. A regra vive em utils/frentes.js e vale aqui também.
 */
function AppLinkShare({ childName, parentPhone }) {
  const [copiado, setCopiado] = useState(false);
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}/familia` : '';

  const primeiro = String(childName || '').trim().split(/\s+/)[0] || '';
  const texto = `Oi! Aqui é o link pra você acompanhar o transporte d${
    primeiro ? `o(a) ${primeiro}` : 'a criança'
  }: ${url}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não deu pra copiar. Segure no link pra copiar à mão.');
    }
  };

  const digits = String(parentPhone || '').replace(/\D/g, '');
  const e164 = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={copiar}
        className="tap flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-card text-sm font-bold text-text"
      >
        {copiado ? <Check size={16} /> : <Copy size={16} />}
        {copiado ? 'Copiado' : 'Copiar link'}
      </button>
      <a
        href={`https://wa.me/${e164}?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="tap flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white"
      >
        <WhatsAppIcon size={16} />
        WhatsApp
      </a>
    </div>
  );
}

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
      {/* Sem Storage não há upload, então não há botão. O avatar continua
        * ali: ele é gerado no navegador a partir do id, e ninguém fica sem
        * rosto na lista — só não dá pra trocar por uma foto de verdade. */}
      {STORAGE_ENABLED && (
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
      )}
      {/* Remover também depende de Storage (deleteObject). */}
      {STORAGE_ENABLED && child.photoURL && !uploading && (
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

/**
 * Turma e sala — preenchidos pelo RESPONSÁVEL.
 *
 * O motorista lê pra saber onde chamar a criança quando ela não aparece no
 * portão; o pai escreve porque é o único que sabe. As rules liberam só estes
 * dois campos pra ele: são texto sem efeito em rota, cobrança ou permissão.
 */
function TurmaSala({ child, podeEditar }) {
  const [editando, setEditando] = useState(false);
  const [turma, setTurma] = useState(child.turma || '');
  const [sala, setSala] = useState(child.sala || '');
  const [salvando, setSalvando] = useState(false);

  const vazio = !child.turma && !child.sala;

  async function salvar() {
    setSalvando(true);
    try {
      await updateChild(child.id, {
        turma: turma.trim(),
        sala: sala.trim(),
      });
      toast.success('Turma e sala atualizadas.');
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
        <div className="grid grid-cols-2 gap-2">
          <input
            value={turma}
            onChange={(e) => setTurma(e.target.value)}
            placeholder="Turma (3º B)"
            className="h-11 rounded-xl border-2 border-gray-200 bg-card px-3 text-sm text-text focus:outline-none focus:border-primary"
          />
          <input
            value={sala}
            onChange={(e) => setSala(e.target.value)}
            placeholder="Sala (12)"
            className="h-11 rounded-xl border-2 border-gray-200 bg-card px-3 text-sm text-text focus:outline-none focus:border-primary"
          />
        </div>
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
      <p className="text-xs text-textMuted">
        O responsável ainda não informou a turma e a sala.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0 space-y-3">
        <InfoRow label="Turma" value={child.turma || '—'} />
        <InfoRow label="Sala" value={child.sala || '—'} />
      </div>
      {podeEditar && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar turma e sala"
          className="tap w-9 h-9 rounded-xl border border-gray-200 text-textMuted flex items-center justify-center shrink-0"
        >
          <Pencil size={15} />
        </button>
      )}
    </div>
  );
}
