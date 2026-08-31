import { useMemo, useState } from 'react';
import { chaveDoNome } from '../../dominio/escola/nomeEscola';
import { primeiroNome } from '../../compartilhado/formatters';
import { useNavigate } from 'react-router-dom';
import {
  Notebook,
  X,
  ArrowLeft,
  Send,
  School,
  Users,
  History,
  Megaphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import {
  AGENDA_TYPES,
  createChildEntry,
  createSchoolEntry,
  createBroadcastEntry,
} from '../../services/agendaService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Botão flutuante de agenda na tela do Tio. Tap abre um sheet em 3 passos:
 *
 *   1. Alvo: "uma criança" ou "toda a escola X"
 *   2. Tipo do aviso (chip com emoji + label)
 *   3. Revisão/edição do texto pronto, e envio
 *
 * O input é deliberadamente guiado — o Tio NÃO escreve do zero. Os templates
 * cobrem 80% dos casos comuns (criança doente, briga, recado da professora,
 * reunião, evento, sem aula, outro). "Outro" deixa o texto vazio pra ele
 * digitar livremente.
 */
export default function TioAgendaFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB com label persistente "Avisar" — sinaliza claramente que esse
        * botão serve pra mandar recado pros pais (não é só um ícone solto). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Avisar os pais"
        className="fixed bottom-24 right-4 z-40 h-14 px-5 rounded-full bg-gradient-to-br from-escola to-escola text-white shadow-focus flex items-center gap-2 tap font-bold print:hidden"
      >
        <Notebook size={22} />
        <span className="text-sm">Avisar pais</span>
      </button>

      {open && <AgendaSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function AgendaSheet({ onClose }) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { children } = useChildren();
  const [step, setStep] = useState('target'); // target | type | confirm
  const [scope, setScope] = useState(null); // 'child' | 'school' | 'todos'
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [typeKey, setTypeKey] = useState(null);
  const [message, setMessage] = useState('');
  // Data DO EVENTO — separada da data de envio. "Festa junina dia 12/09"
  // vivia dentro do texto: o pai não via numa data e o app não sabia que
  // naquele dia a rota muda.
  const [eventDate, setEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Escolas únicas vindas das crianças cadastradas — pro Tio escolher.
  const schools = useMemo(() => {
    // AGRUPA PELA CHAVE NORMALIZADA, não pelo nome digitado.
    //
    // `c.school?.trim()` como chave é o mesmo bug que motivou a coleção de
    // escolas existir: "E.M. Rui Barbosa" numa criança e "EM Rui Barbosa" na
    // outra viram dois grupos, e o aviso alcança metade da turma. A correção
    // foi feita no aviso em massa e não chegou até aqui.
    const map = new Map();
    for (const c of children) {
      const name = c.school?.trim();
      if (!name) continue;
      const chave = chaveDoNome(name);
      const entry = map.get(chave) || { name, schoolId: c.schoolId || null, children: [] };
      if (!entry.schoolId && c.schoolId) entry.schoolId = c.schoolId;
      entry.children.push({
        id: c.id,
        name: c.name,
        parentUid: c.parentUid || null,
      });
      map.set(chave, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
  }, [children]);

  const pickChild = (child) => {
    setScope('child');
    setSelectedChild(child);
    setStep('type');
  };

  /**
   * Aviso pra TODAS as famílias.
   *
   * É o caso que não cabia em "criança" nem em "escola": a perua quebrou, ele
   * vai atrasar. Antes disso ele teria que disparar um aviso por escola, um de
   * cada vez, parado no acostamento.
   */
  const pickTodos = () => {
    setScope('todos');
    setSelectedChild(null);
    setSelectedSchool(null);
    setStep('type');
  };

  /**
   * ATALHO DOS URGENTES — pula o passo de escolher o tipo.
   *
   * "Vou atrasar" e "perua quebrou" custavam os mesmos quatro passos de um
   * recado sobre briga no recreio: alvo, tipo, revisar, enviar. Só que estes
   * dois são disparados de dentro do carro parado no acostamento, com o
   * motorista fazendo mais três coisas ao mesmo tempo.
   *
   * O passo de revisão FICA. É uma mensagem que vai pra todas as famílias de
   * uma vez — mandar sem ver o texto seria trocar quatro toques por um
   * arrependimento que não tem desfazer.
   */
  const atalhoUrgente = (tipo) => {
    setScope('todos');
    setSelectedChild(null);
    setSelectedSchool(null);
    setTypeKey(tipo);
    setMessage(AGENDA_TYPES[tipo].template());
    setStep('confirm');
  };

  const pickSchool = (school) => {
    setScope('school');
    setSelectedSchool(school);
    setStep('type');
  };

  const pickType = (key) => {
    setTypeKey(key);
    // Pré-preenche o template do template baseado no alvo
    const tpl = AGENDA_TYPES[key]?.template;
    const target =
      scope === 'child'
        ? selectedChild?.name?.split(' ')[0] || 'a criança'
        : 'a turma';
    setMessage(tpl ? tpl(target) : '');
    setStep('confirm');
  };

  const onBack = () => {
    if (step === 'confirm') setStep('type');
    else if (step === 'type') setStep('target');
  };

  const onSubmit = async () => {
    if (!message.trim()) {
      toast.error('Escreve uma mensagem antes de enviar.');
      return;
    }
    setSubmitting(true);
    try {
      if (scope === 'todos') {
        const { alcance } = await createBroadcastEntry({
          adminUid: user?.uid,
          type: typeKey,
          message,
          eventDate: eventDate || null,
          children,
        });
        toast.success(
          alcance === 1
            ? 'Aviso enviado pra 1 família.'
            : `Aviso enviado pra ${alcance} famílias.`
        );
      } else if (scope === 'child') {
        await createChildEntry({
          adminUid: user?.uid,
          child: selectedChild,
          type: typeKey,
          message,
          eventDate: eventDate || null,
        });
        toast.success(`Aviso enviado pra ${primeiroNome(selectedChild.name, 'a família')}!`);
      } else {
        await createSchoolEntry({
          adminUid: user?.uid,
          schoolName: selectedSchool.name,
          schoolId: selectedSchool.schoolId || null,
          type: typeKey,
          message,
          eventDate: eventDate || null,
          childrenInSchool: selectedSchool.children,
        });
        toast.success(`Aviso geral enviado · ${selectedSchool.name}`);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10 ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
        </div>

        <div className="px-5 pt-2 pb-6">
          <SheetHeader
            step={step}
            onBack={onBack}
            onClose={onClose}
            onHistory={() => {
              onClose();
              navigate('/tio/agenda');
            }}
          />

          {step === 'target' && (
            <TargetStep
              children={children}
              schools={schools}
              onPickChild={pickChild}
              onPickSchool={pickSchool}
              onPickTodos={pickTodos}
              onAtalho={atalhoUrgente}
            />
          )}

          {step === 'type' && (
            <TypeStep
              scope={scope}
              target={scope === 'child' ? selectedChild : selectedSchool}
              onPick={pickType}
            />
          )}

          {step === 'confirm' && (
            <ConfirmStep
              scope={scope}
              target={scope === 'child' ? selectedChild : selectedSchool}
              typeKey={typeKey}
              message={message}
              onChange={setMessage}
              eventDate={eventDate}
              onEventDateChange={setEventDate}
              onSubmit={onSubmit}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SheetHeader({ step, onBack, onClose, onHistory }) {
  const titles = {
    target: 'Quem precisa saber?',
    type: 'O que aconteceu?',
    confirm: 'Confirmar e enviar',
  };
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      {step !== 'target' ? (
        <button
          type="button"
          onClick={onBack}
          className="tap text-textMuted -ml-1 p-1 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      ) : (
        <button
          type="button"
          onClick={onHistory}
          className="tap text-textMuted -ml-1 p-1 inline-flex items-center gap-1 text-xs"
        >
          <History size={14} /> Ver enviados
        </button>
      )}
      <h2 className="text-base font-bold text-text leading-tight flex-1 text-center">
        {titles[step]}
      </h2>
      <button
        onClick={onClose}
        className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
        aria-label="Fechar"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function TargetStep({
  children,
  schools,
  onPickChild,
  onPickSchool,
  onPickTodos,
  onAtalho,
}) {
  const [search, setSearch] = useState('');
  const filteredChildren = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return children;
    return children.filter((c) => c.name?.toLowerCase().includes(term));
  }, [children, search]);

  if (children.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-textMuted">
        Cadastre crianças primeiro pra mandar avisos pelos pais.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* OS DOIS URGENTES, PRONTOS.
        * Vêm primeiro e já com texto escrito: são os únicos avisos disparados
        * de dentro do carro parado, e ali cada passo custa. Um toque leva
        * direto pra revisão. */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
          Aconteceu agora · avisa todo mundo
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAtalho('atraso')}
            className="tap rounded-2xl bg-gradient-to-br from-warning to-warning text-white px-3 py-3 flex flex-col items-center gap-1 shadow-sm"
          >
            <span className="text-2xl" aria-hidden>
              ⏰
            </span>
            <span className="text-sm font-bold">Vou atrasar</span>
          </button>
          <button
            type="button"
            onClick={() => onAtalho('quebrou')}
            className="tap rounded-2xl bg-gradient-to-br from-danger to-dangerText text-white px-3 py-3 flex flex-col items-center gap-1 shadow-sm"
          >
            <span className="text-2xl" aria-hidden>
              🚨
            </span>
            <span className="text-sm font-bold">Perua quebrou</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onPickTodos}
          className="tap w-full mt-2 rounded-2xl border border-border bg-card px-4 py-2.5 flex items-center gap-3"
        >
          <Megaphone size={17} className="text-textMuted shrink-0" />
          <span className="flex-1 min-w-0 text-left text-sm font-semibold text-text">
            Outro aviso pra todas as famílias
          </span>
        </button>
      </section>

      {/* Bloco "Toda uma escola" */}
      {schools.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
            Aviso geral · escola
          </p>
          <div className="grid grid-cols-1 gap-2">
            {schools.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => onPickSchool(s)}
                className="tap w-full text-left rounded-2xl bg-gradient-to-r from-primary to-primaryDark text-white px-4 py-3 flex items-center gap-3 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <School size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-tight truncate">{s.name}</p>
                  <p className="text-xs text-white/85 mt-0.5">
                    {s.children.length}{' '}
                    {s.children.length === 1 ? 'criança' : 'crianças'} · enviar
                    pra todos
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Bloco "Uma criança" */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2 flex items-center gap-1.5">
          <Users size={12} /> Aviso pessoal · criança
        </p>
        <input
          type="search"
          placeholder="Buscar pelo nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 px-3 mb-2 rounded-2xl bg-card border border-border text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {filteredChildren.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPickChild(c)}
              className="tap w-full text-left bg-card rounded-2xl border border-border px-3 py-2.5 flex items-center gap-3"
            >
              <Avatar
                photoURL={c.photoURL}
                gender={c.gender}
                seed={c.id}
                kind="child"
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text text-sm leading-tight truncate">
                  {c.name}
                </p>
                <p className="text-[11px] text-textMuted truncate">
                  {c.school || 'Sem escola'}
                </p>
              </div>
            </button>
          ))}
          {filteredChildren.length === 0 && (
            <p className="text-xs text-textMuted text-center py-3">
              Ninguém encontrado.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function TypeStep({ scope, target, onPick }) {
  const subtitle =
    scope === 'child'
      ? `Pra ${target?.name?.split(' ')[0] || 'a criança'}`
      : `Pra todas as crianças de ${target?.name || 'a escola'}`;

  return (
    <div className="space-y-3">
      <p className="text-sm text-textMuted text-center">{subtitle}</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(AGENDA_TYPES).map(([key, t]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className={`tap min-h-20 rounded-2xl bg-gradient-to-br ${t.color} text-white px-3 py-3 flex flex-col items-center justify-center gap-1 shadow-sm`}
          >
            <span className="text-2xl" aria-hidden>
              {t.emoji}
            </span>
            <span className="text-[11px] font-bold leading-tight text-center">
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep({
  scope,
  target,
  typeKey,
  message,
  onChange,
  eventDate,
  onEventDateChange,
  onSubmit,
  submitting,
}) {
  const typeData = AGENDA_TYPES[typeKey];
  const recipient =
    scope === 'todos'
      ? 'Pra todas as famílias'
      : scope === 'child'
      ? `Pra ${target?.name?.split(' ')[0] || 'a criança'}`
      : `Aviso geral · ${target?.name}`;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl bg-gradient-to-r ${typeData.color} text-white p-4 flex items-center gap-3`}
      >
        <span className="text-3xl" aria-hidden>
          {typeData.emoji}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/85 font-bold">
            {recipient}
          </p>
          <p className="font-bold leading-tight">{typeData.label}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-textMuted mb-2">
          Mensagem que o pai vai receber
        </label>
        <textarea
          value={message}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          maxLength={1500}
          placeholder="Escreve aqui o que aconteceu…"
          className="w-full rounded-2xl border-2 border-border bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted leading-relaxed"
        />
        <p className="text-[11px] text-textMuted mt-1.5">
          Pode editar o texto antes de enviar. O pai recebe na agenda dele.
        </p>
      </div>

      <div>
        <label
          htmlFor="agenda-event-date"
          className="block text-xs font-bold uppercase tracking-widest text-textMuted mb-2"
        >
          Dia do evento{' '}
          <span className="font-medium normal-case tracking-normal">
            (opcional)
          </span>
        </label>
        <input
          id="agenda-event-date"
          type="date"
          value={eventDate}
          onChange={(e) => onEventDateChange(e.target.value)}
          className="w-full h-12 rounded-2xl border-2 border-border bg-card px-3 text-sm text-text focus:outline-none focus:border-primary"
        />
        <p className="text-[11px] text-textMuted mt-1.5">
          Passeio, festa, reunião. O pai vê o aviso na data, em vez de ter que
          achar o dia no meio do texto.
        </p>
      </div>

      <Button onClick={onSubmit} icon={Send} loading={submitting}>
        Enviar aviso
      </Button>
    </div>
  );
}
