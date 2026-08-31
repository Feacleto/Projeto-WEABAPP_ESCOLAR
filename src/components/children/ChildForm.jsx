import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Clock,
  DollarSign,
  Search,
  Check,
  Home,
  School,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Calendar,
  MessageCircle,
  Paperclip,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../common/Card';
import MapPicker from '../map/MapPicker';
import InviteShare from './InviteShare';
import Input from '../common/Input';
import Button from '../common/Button';
import { addChild, updateChild } from '../../services/childrenService';
import { uploadContratoAnterior } from '../../services/photoService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import { useAuth } from '../../hooks/useAuth';
import { useLimiteCriancas } from '../../hooks/useLimiteCriancas';
import { devWhatsAppLink } from '../../config/developer';
import { searchAddress } from '../../services/locationService';
import { normalizaHora, periodoDaHora, horaCurta } from '../../dominio/rota/horarios';
import { useEscolas } from '../../hooks/useEscolas';
import {
  maskPhone,
  unmaskPhone,
  isValidPhone,
  isValidEmail,
} from '../../compartilhado/masks';

const GENDERS = [
  { value: 'male', label: 'Menino' },
  { value: 'female', label: 'Menina' },
];

const TOTAL_STEPS = 4;

const EMPTY_FORM = {
  name: '',
  // VAZIO, E NÃO 'male'.
  //
  // Vinha pré-selecionado como menino. O tio passava direto pelo passo sem
  // tocar em nada e a criança era gravada como menino em silêncio — não
  // havia como distinguir, depois, quem tinha sido escolhido de quem tinha
  // sido herdado. O avatar saía errado e ninguém sabia por quê.
  //
  // Vazio força a escolha e torna o erro impossível de acontecer calado.
  gender: '',
  birthDate: '', // YYYY-MM-DD — usado pra parabenizar no aniversário
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  parent2Name: '',
  parent2Phone: '',
  address: '',
  lat: '',
  lng: '',
  schoolId: '',
  school: '',
  schoolAddress: '',
  schoolLat: '',
  schoolLng: '',
  // O que foi COMBINADO com o pai: a hora que a perua encosta na porta e a
  // hora que a criança volta. É isto que organiza o dia do motorista e é isto
  // que o pai vê — não o horário da escola, que é outra coisa.
  horaPega: '',
  horaEntrega: '',
  period: 'morning',
  pickupPeriod: 'morning',
  dropoffPeriod: 'afternoon',
  monthlyFee: '',
  dueDay: '10',
  notes: '',
};

/**
 * Cadastro de criança em wizard (4 passos curtos).
 * Cada passo valida antes de avançar. Voltar é livre.
 *   1. Criança         — nome, gênero, período escolar
 *   2. Onde mora       — endereço (com geocoding Nominatim)
 *   3. Escola          — nome, endereço, turnos do transporte
 *   4. Responsável e financeiro — nome/email/tel, mensalidade, dia vencimento
 *
 * Após salvar, mostra modal de invite code pra entregar ao responsável.
 */
export default function ChildForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const limite = useLimiteCriancas(user?.uid);
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [errors, setErrors] = useState({});

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setPhone = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: maskPhone(e.target.value) }));

  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Diga o nome da criança.';
      // Obrigatório agora que o campo não vem pré-respondido. É o que decide
      // o rosto que a criança vai ter na lista, e um chute do sistema custa
      // mais caro do que um toque a mais aqui.
      if (!form.gender) errs.gender = 'Escolha menino ou menina.';
    }
    if (s === 2) {
      // Só o texto do endereço é obrigatório. A coordenada NÃO bloqueia:
      // o Nominatim não conhece boa parte dos endereços de periferia, e
      // exigir o geocoding deixava o tio sem conseguir cadastrar a criança.
      // Quem ficar sem coordenada é salvo com geoPending e resolve depois.
      if (!form.address.trim()) errs.address = 'Diga o endereço de casa.';
    }
    // Escola é OPCIONAL: o tio muitas vezes cadastra a criança no meio da
    // rota e completa a ficha depois. Validamos só o que foi preenchido.
    if (s === 3) {
      // Horário é o que organiza o dia inteiro. Se ele digitou alguma coisa,
      // ela precisa ser uma hora de verdade — '7' vira 07:00, 'manhã' não vira
      // nada e não pode ser salvo como se fosse.
      if (form.horaPega.trim() && !normalizaHora(form.horaPega)) {
        errs.horaPega = 'Hora inválida. Ex: 06:20';
      }
      if (form.horaEntrega.trim() && !normalizaHora(form.horaEntrega)) {
        errs.horaEntrega = 'Hora inválida. Ex: 12:35';
      }
    }
    // Responsável e financeiro: só o telefone é indispensável — é por ele
    // que o convite chega. Email e mensalidade podem vir depois.
    if (s === 4) {
      if (!isValidPhone(form.parentPhone))
        errs.parentPhone = 'Telefone com DDD — é por aqui que o convite vai.';
      if (form.parentEmail.trim() && !isValidEmail(form.parentEmail))
        errs.parentEmail = 'Email não parece válido.';
      if (form.parent2Phone && !isValidPhone(form.parent2Phone))
        errs.parent2Phone = 'Telefone inválido.';
      const fee = parseFloat(form.monthlyFee);
      if (form.monthlyFee.trim() && (!fee || fee <= 0))
        errs.monthlyFee = 'Valor precisa ser maior que zero.';
      const day = parseInt(form.dueDay, 10);
      if (form.dueDay && (!day || day < 1 || day > 28))
        errs.dueDay = 'Dia entre 1 e 28.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const onAdvance = () => {
    if (!validateStep(step)) {
      toast.error('Confira o que tá destacado.');
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
    else onSubmit();
  };

  const onBack = () => {
    setErrors({});
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  };

  // A partir do passo 2 a criança já tem o mínimo pra existir (nome +
  // endereço). Deixar o tio salvar aqui é o que evita o abandono no meio do
  // formulário — ele volta na ficha e completa quando estiver parado.
  const canSaveEarly = step >= 2 && !!form.name.trim() && !!form.address.trim();

  const onSaveEarly = () => {
    if (!validateStep(step)) {
      toast.error('Confira o que tá destacado.');
      return;
    }
    onSubmit();
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const horaPega = normalizaHora(form.horaPega);
      const horaEntrega = normalizaHora(form.horaEntrega);
      const { id, inviteCode } = await addChild({
        ...form,
        horaPega: horaPega || '',
        horaEntrega: horaEntrega || '',
        // `period` alimenta o filtro da lista de crianças e os rótulos de
        // ChildCard/ChildDetail. `pickupPeriod`/`dropoffPeriod` são ponte pro
        // cadastro anterior ao modelo de horários, lidos só por
        // `horariosCombinados`. Derivados da hora: o motorista informa uma
        // vez e o rótulo se acerta sozinho, em vez de virar mais dois botões.
        //
        // (Dizia "o Kanban dos seis turnos lê esses campos" — o Kanban foi
        // apagado nos mesmos commits.)
        ...(horaPega ? { pickupPeriod: periodoDaHora(horaPega), period: periodoDaHora(horaPega) } : {}),
        ...(horaEntrega ? { dropoffPeriod: periodoDaHora(horaEntrega) } : {}),
        parentPhone: unmaskPhone(form.parentPhone),
        parent2Phone: form.parent2Phone ? unmaskPhone(form.parent2Phone) : '',
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        dueDay: parseInt(form.dueDay, 10) || 10,
      });
      setCreatedCode(inviteCode);
      setCreatedId(id);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCode) {
    return (
      <InviteCodeSuccess
        code={createdCode}
        childId={createdId}
        childName={form.name}
        parentPhone={unmaskPhone(form.parentPhone)}
        onDone={() => navigate('/tio/children', { replace: true })}
      />
    );
  }

  // VAGAS ESGOTADAS — a porta fecha ANTES do formulário.
  //
  // Não é o botão de salvar que fica cinza no fim: ele preencheria oito
  // campos, escolheria o ponto no mapa, e só então descobriria que não cabe.
  // O limite é do contrato, não do preenchimento — então ele aparece onde a
  // decisão começa.
  //
  // Quem impede de verdade são as rules (`allow create` em `children` valida
  // o contador contra o limite). Esta tela existe pra dizer o que aconteceu e
  // dar o caminho: sem ela, o cadastro falharia com erro de permissão, que
  // não é informação pra ninguém.
  if (limite.lotado) {
    return <SemVaga limite={limite} onVoltar={() => navigate('/tio/children')} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header próprio do wizard — sem o Header global pra ter mais espaço */}
      <header className="sticky top-0 z-20 bg-bg px-5 pt-4 pb-3 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="tap inline-flex items-center gap-1 text-sm text-textMuted -ml-1 p-1"
        >
          <ArrowLeft size={18} />
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </button>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              Passo {step} de {TOTAL_STEPS}
            </p>
            <p className="text-[11px] font-semibold text-textMuted">
              {STEP_LABELS[step - 1]}
            </p>
          </div>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>
      </header>

      <main className="flex-1 px-5 pt-3 pb-44 space-y-5">
        {step === 1 && (
          <Step1Child
            form={form}
            setForm={setForm}
            setField={setField}
            errors={errors}
          />
        )}
        {step === 2 && (
          <Step2Home
            form={form}
            setForm={setForm}
            setField={setField}
            errors={errors}
          />
        )}
        {step === 3 && (
          <Step3School
            form={form}
            setForm={setForm}
            setField={setField}
            errors={errors}
          />
        )}
        {step === 4 && (
          <Step4Parent
            form={form}
            setForm={setForm}
            setField={setField}
            setPhone={setPhone}
            errors={errors}
          />
        )}
      </main>

      {/* Footer com botão "Avançar" / "Cadastrar" fixo.
        * z-40 fica acima do BottomNav (z-30) — esse era o bug que impedia
        * o usuário de avançar do passo 1 em diante (o toque caía no nav).
        * Fundo branco com gradient pra cobrir o nav visualmente. */}
      <footer
        className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-40 px-5 pt-3 bg-bg border-t border-neutro"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
      >
        <Button
          onClick={onAdvance}
          loading={submitting}
          icon={step === TOTAL_STEPS ? Check : ArrowRight}
          className="shadow-focus !bg-primary hover:!bg-primary !h-14 !text-base"
        >
          {step === TOTAL_STEPS ? 'Cadastrar criança' : 'Avançar'}
        </Button>

        {/* Saída antecipada: a criança já tem o mínimo pra existir. Sem este
          * botão, quem não sabe o CEP da escola ou o valor combinado ficava
          * preso no meio do cadastro e desistia. */}
        {canSaveEarly && step < TOTAL_STEPS && (
          <button
            type="button"
            onClick={onSaveEarly}
            disabled={submitting}
            className="tap w-full text-sm font-semibold text-textMuted py-3 disabled:opacity-50"
          >
            Salvar e completar depois
          </button>
        )}
      </footer>
    </div>
  );
}

const STEP_LABELS = [
  'Quem é a criança',
  'Onde mora',
  'Onde estuda',
  'Responsável e mensalidade',
];

/* ─────────────── Barra de progresso ─────────────── */

function ProgressBar({ step, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const done = i + 1 < step;
        const current = i + 1 === step;
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-colors ${
              done
                ? 'bg-primary'
                : current
                ? 'bg-primary'
                : 'bg-border'
            }`}
          />
        );
      })}
    </div>
  );
}

/* ─────────────── Passo 1: Criança ─────────────── */

function Step1Child({ form, setForm, setField, errors }) {
  return (
    <>
      <Heading
        title="Quem é a criança?"
        subtitle="Comece pelo básico — vamos um passo de cada vez."
      />

      <Input
        label="Nome completo"
        placeholder="Ex: Pedro Silva"
        icon={User}
        value={form.name}
        onChange={setField('name')}
        error={errors.name}
        required
        autoFocus
      />

      <div>
        <label className="block text-sm font-semibold text-text mb-2">
          É menino ou menina?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {GENDERS.map((g) => (
            <SelectorButton
              key={g.value}
              label={g.label}
              active={form.gender === g.value}
              onClick={() => setForm((p) => ({ ...p, gender: g.value }))}
            />
          ))}
        </div>
        {errors.gender && (
          <p className="mt-1.5 text-xs font-semibold text-danger">
            {errors.gender}
          </p>
        )}
      </div>

      <Input
        type="date"
        label="Data de aniversário"
        icon={Calendar}
        value={form.birthDate}
        onChange={setField('birthDate')}
        hint="Pra parabenizar a criança no dia (opcional)."
      />

      {/* O seletor de período saiu daqui. Ele era um botão a mais pedindo
        * ao motorista que traduzisse "entra 7h" pra "manhã" — tradução que o
        * app faz sozinho a partir da hora combinada, no passo 3. */}
    </>
  );
}

/* ─────────────── Passo 2: Casa ─────────────── */

function Step2Home({ form, setForm, setField, errors }) {
  const [searching, setSearching] = useState(false);
  // null = nunca buscou · 'found' · 'notFound' — controla a mensagem exibida
  const [searchState, setSearchState] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasCoord = form.lat !== '' && form.lng !== '' && form.lat != null;

  const onSearch = async () => {
    if (!form.address.trim()) {
      toast.error('Digite o endereço primeiro.');
      return;
    }
    setSearching(true);
    try {
      const result = await searchAddress(form.address);
      setForm((prev) => ({
        ...prev,
        lat: result.lat,
        lng: result.lng,
        address: result.displayName || prev.address,
      }));
      setSearchState('found');
      toast.success('Encontramos o local!');
    } catch {
      // Não usamos toast.error aqui: falhar a busca é caso ESPERADO, não erro.
      // O aviso inline explica que dá pra seguir sem a coordenada.
      setSearchState('notFound');
    } finally {
      setSearching(false);
    }
  };

  const onPick = ({ lat, lng }) => {
    setForm((prev) => ({ ...prev, lat, lng }));
    setSearchState('found');
    setPickerOpen(false);
    toast.success('Ponto marcado!');
  };

  return (
    <>
      <Heading
        title="Onde a criança mora?"
        subtitle="O endereço da casa pra você passar todo dia."
      />

      <Input
        label="Endereço completo"
        placeholder="Rua, número, bairro, cidade"
        icon={Home}
        value={form.address}
        onChange={setField('address')}
        hint="Quanto mais completo, melhor o sistema encontra."
        error={errors.address}
        required
        autoFocus
      />

      <Button
        type="button"
        variant="secondary"
        icon={Search}
        onClick={onSearch}
        loading={searching}
      >
        Buscar endereço no mapa
      </Button>

      {hasCoord && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primarySoft border border-primaryBorder px-4 py-3 rounded-xl">
          <MapPin size={18} />
          <span>Local confirmado!</span>
        </div>
      )}

      {/* Endereço não encontrado NÃO é erro de preenchimento — é limite do
        * mapa. A mensagem diz isso e oferece as duas saídas. */}
      {!hasCoord && searchState === 'notFound' && (
        <div className="text-sm bg-warningSoft border border-warningBorder text-warningText px-4 py-3 rounded-xl space-y-1">
          <p className="font-semibold">Não achamos esse endereço no mapa.</p>
          <p className="text-warningText">
            Sem problema — dá pra marcar na mão agora ou seguir e ajustar
            depois. A criança fica salva do mesmo jeito.
          </p>
        </div>
      )}

      {!hasCoord && (
        <Button
          type="button"
          variant="secondary"
          icon={MapPin}
          onClick={() => setPickerOpen(true)}
        >
          Marcar no mapa
        </Button>
      )}

      {pickerOpen && (
        <MapPicker
          kind="home"
          initial={hasCoord ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
          addressLabel={form.address}
          onConfirm={onPick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/* ─────────────── Passo 3: Escola e horários ─────────────── */

/**
 * Aqui mora a informação que organiza o dia inteiro: a hora combinada com o
 * pai. Não é o horário da escola — é a hora em que a perua encosta na porta e
 * a hora em que a criança volta pra casa.
 *
 * A escola virou seleção. Antes eram três campos digitados por criança (nome,
 * endereço, geocoding), o que fazia cinco alunos da mesma escola custarem
 * cinco digitações — e um "E.M." no lugar de "EM" partia a turma em duas no
 * aviso de "não vai ter aula".
 */
function Step3School({ form, setForm, setField, errors }) {
  const navigate = useNavigate();
  const { escolas, loading } = useEscolas();

  const escolhida = escolas.find((e) => e.id === form.schoolId) || null;

  const escolher = (e) =>
    setForm((prev) => ({
      ...prev,
      schoolId: e.id,
      // O nome e as coordenadas continuam copiados dentro da criança: é o que
      // a rota usa e o que o pai vê. Escola apagada por engano não pode apagar
      // o endereço de entrega de ninguém no meio da rota.
      school: e.nome || '',
      schoolAddress: e.endereco || '',
      schoolLat: e.lat ?? '',
      schoolLng: e.lng ?? '',
    }));

  return (
    <>
      <Heading
        title="Escola e horários"
        subtitle="Onde estuda e a que horas você vai pegar e entregar."
      />

      <div>
        <label className="block text-sm font-semibold text-text mb-2">
          Escola
        </label>

        {loading && <div className="h-12 rounded-2xl bg-neutro animate-pulse" />}

        {!loading && escolas.length === 0 && (
          <div className="bg-sunken border border-dashed border-border rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm text-textMuted">
              Você ainda não cadastrou nenhuma escola.
            </p>
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              icon={School}
              onClick={() => navigate('/tio/children/escolas')}
            >
              Cadastrar escola
            </Button>
          </div>
        )}

        {!loading && escolas.length > 0 && (
          <div className="space-y-2">
            {escolas.map((e) => {
              const ativa = form.schoolId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => escolher(e)}
                  aria-pressed={ativa}
                  className={`tap w-full text-left rounded-2xl border-2 px-3.5 py-3 flex items-center gap-3 ${
                    ativa
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      ativa ? 'bg-primary text-white' : 'bg-neutro text-textMuted'
                    }`}
                  >
                    <School size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text leading-tight">
                      {e.nome}
                    </p>
                    {e.endereco && (
                      <p className="text-[11px] text-textMuted truncate">
                        {e.endereco}
                      </p>
                    )}
                  </div>
                  {ativa && <Check size={18} className="text-primary shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate('/tio/children/escolas')}
              className="tap text-xs font-semibold text-primary px-1 py-1"
            >
              + Cadastrar outra escola
            </button>
          </div>
        )}
      </div>

      {/* Os dois horários que o pai vai ler na tela dele */}
      <div className="pt-2 space-y-4">
        <div className="bg-primarySoft border border-primaryBorder rounded-2xl p-3 text-xs text-primary leading-relaxed">
          <b className="block text-sm mb-0.5">O horário que você vai cumprir</b>
          É o que o pai vê pra ficar esperando na hora certa, e é por ele que
          sua rota se organiza sozinha. O horário da escola é outra coisa e não
          entra aqui.
        </div>

        <Input
          label="Que horas você pega em casa?"
          type="time"
          icon={Clock}
          value={form.horaPega}
          onChange={setField('horaPega')}
          error={errors.horaPega}
          hint={
            form.horaPega
              ? `O pai vê: “entra na perua às ${horaCurta(form.horaPega)}”.`
              : 'Pode preencher depois, mas até lá a criança fica com horário presumido.'
          }
        />

        <Input
          label="Que horas você entrega em casa?"
          type="time"
          icon={Clock}
          value={form.horaEntrega}
          onChange={setField('horaEntrega')}
          error={errors.horaEntrega}
          hint={
            form.horaEntrega
              ? `O pai vê: “chega em casa às ${horaCurta(form.horaEntrega)}”.`
              : undefined
          }
        />

        {escolhida?.geoPending && (
          <p className="text-xs text-warningText bg-warningSoft border border-warningBorder rounded-xl px-3 py-2">
            {escolhida.nome} está sem localização no mapa. Dá pra resolver
            depois em Crianças → Escolas.
          </p>
        )}
      </div>
    </>
  );
}

/* ─────────────── Passo 4: Responsável + Financeiro ─────────────── */

function Step4Parent({ form, setField, setPhone, errors }) {
  const [showSecondParent, setShowSecondParent] = useState(false);

  return (
    <>
      <Heading
        title="Responsável e mensalidade"
        subtitle="Quem cuida e como é a cobrança."
      />

      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-text">Responsável principal</h3>
        <Input
          label="Nome"
          placeholder="Pai, mãe ou tutor"
          icon={User}
          value={form.parentName}
          onChange={setField('parentName')}
          error={errors.parentName}
          required
        />
        <Input
          type="email"
          inputMode="email"
          label="Email"
          placeholder="email@exemplo.com"
          icon={Mail}
          value={form.parentEmail}
          onChange={setField('parentEmail')}
          error={errors.parentEmail}
          required
        />
        <Input
          label="Telefone"
          placeholder="(11) 99999-9999"
          icon={Phone}
          inputMode="tel"
          value={form.parentPhone}
          onChange={setPhone('parentPhone')}
          maxLength={15}
          error={errors.parentPhone}
          required
        />

        <button
          type="button"
          onClick={() => setShowSecondParent((v) => !v)}
          className="tap w-full flex items-center justify-between text-sm font-medium text-primary py-2"
        >
          <span>
            {showSecondParent
              ? 'Ocultar segundo responsável'
              : 'Adicionar segundo responsável (opcional)'}
          </span>
          {showSecondParent ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showSecondParent && (
          <div className="space-y-3 pt-1 border-t border-neutro">
            <Input
              label="Nome do segundo responsável"
              icon={User}
              value={form.parent2Name}
              onChange={setField('parent2Name')}
            />
            <Input
              label="Telefone do segundo responsável"
              icon={Phone}
              inputMode="tel"
              value={form.parent2Phone}
              onChange={setPhone('parent2Phone')}
              maxLength={15}
              error={errors.parent2Phone}
            />
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-text">Mensalidade</h3>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          label="Valor (R$)"
          placeholder="450,00"
          icon={DollarSign}
          value={form.monthlyFee}
          onChange={setField('monthlyFee')}
          error={errors.monthlyFee}
          /* O `required` daqui foi REMOVIDO porque era inerte e mentia.
           *
           * Este formulário é um assistente por etapas: o botão chama
           * onSubmit() direto, sem <form> nativo, então a validação do
           * navegador nunca roda e o atributo não bloqueava nada. E deixar
           * sem valor é DELIBERADO — a validação da etapa diz, com todas as
           * letras, que "email e mensalidade podem vir depois", porque nem
           * sempre o valor está combinado no dia do cadastro.
           *
           * O problema não era permitir vazio: era não contar o preço disso.
           * Mensalidade zerada faz a criança ser PULADA na geração de
           * cobrança do mês (billing.js ignora fee <= 0), sem erro nenhum na
           * hora. Quem cadastra trinta crianças e deixa dez sem valor
           * descobre no dia do fechamento, contando dez cobranças que não
           * nasceram. */
          hint={
            form.monthlyFee.trim()
              ? undefined
              : 'Sem valor, esta criança não entra na cobrança do mês. Dá pra preencher depois na ficha dela.'
          }
        />
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          max="28"
          label="Dia do vencimento"
          placeholder="10"
          icon={Calendar}
          value={form.dueDay}
          onChange={setField('dueDay')}
          hint="Em que dia do mês o pai paga (1 a 28)."
          error={errors.dueDay}
          required
        />
      </Card>

      <Card>
        <label className="block text-sm font-bold text-text mb-2">
          Observações (opcional)
        </label>
        <textarea
          value={form.notes}
          onChange={setField('notes')}
          rows={3}
          placeholder="Alergias, instruções especiais..."
          className="w-full rounded-xl border border-border bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-textMuted"
        />
      </Card>
    </>
  );
}

/* ─────────────── Helpers visuais ─────────────── */

function Heading({ title, subtitle }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-bold text-text leading-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm text-textMuted mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function SelectorButton({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-14 rounded-2xl text-sm font-semibold border-2 flex flex-col items-center justify-center gap-0.5 ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-card text-text border-border'
      }`}
    >
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );
}

/* ─────────────── Sucesso ─────────────── */

/**
 * Confirmação depois de cadastrar. O foco mudou: antes o tio saía daqui com
 * um código pra ditar; agora ele sai com um LINK pronto pra mandar no
 * WhatsApp. O código continua visível pra quando precisar ditar por telefone.
 */
function InviteCodeSuccess({ code, childId, childName, parentPhone, onDone }) {
  return (
    <div className="min-h-screen flex flex-col p-6 gap-5 justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-primaryChip flex items-center justify-center mx-auto">
          <Check size={32} className="text-accentText" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-text">
            {childName?.split(' ')[0] || 'Criança'} está cadastrad{
              childName?.endsWith('a') ? 'a' : 'o(a)'
            }!
          </h3>
          <p className="text-sm text-textMuted mt-1.5">
            Falta só o responsável entrar. Mande o link — a conta dele se cria
            por lá, sem digitar código.
          </p>
        </div>
      </div>

      <InviteShare code={code} childName={childName} parentPhone={parentPhone} />

      {/* O CONTRATO QUE ELE JÁ TEM — oferecido AQUI, e não num menu.
        *
        * É o único instante em que o motorista está com essa família na
        * cabeça: acabou de digitar o valor, o vencimento e o telefone. Uma
        * semana depois, "anexar o contrato antigo" é tarefa que nunca sobe na
        * lista de ninguém.
        *
        * Fica opcional e discreto de propósito. O contrato que VALE é o do
        * app, gerado dos campos que ele acabou de preencher e assinado pelo
        * responsável; este anexo é memória do que veio antes. Dar a ele o
        * mesmo peso visual do convite faria alguém achar que anexar o papel
        * dispensa o aceite — e aí a família opera sem contrato válido. */}
      <AnexarContratoAnterior childId={childId} />

      <Button onClick={onDone}>Concluir</Button>
    </div>
  );
}

/**
 * A TELA DE "NÃO CABE MAIS" — e por que ela não é um erro.
 *
 * O tom importa. Ele não fez nada errado: preencheu o contrato dele e ele
 * encheu, o que é a melhor notícia possível sobre o negócio dele. Uma tela
 * vermelha de bloqueio trata crescimento como infração.
 *
 * O NÚMERO VEM PRIMEIRO porque é a única pergunta que ele tem ao bater aqui:
 * quantas eu contratei? E o botão é a resposta pra segunda: como aumento?
 *
 * ABRE O WHATSAPP COM O TEXTO PRONTO. Ampliar limite é renegociar contrato e
 * orçamento — não existe botão que faça isso sozinho, e fingir que existe
 * (um "solicitar aumento" que só grava um pedido em algum lugar) criaria uma
 * espera sem prazo. A conversa é o caminho real; o app encurta ela.
 */
function SemVaga({ limite, onVoltar }) {
  const zap = devWhatsAppLink(
    `Olá! Contratei ${limite.limite} vaga(s) de criança no Alô Buzinou e ` +
      'preciso de mais. Podemos atualizar meu contrato?'
  );

  return (
    <div className="min-h-screen px-5 pt-4">
      <button
        type="button"
        onClick={onVoltar}
        className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-textMuted"
      >
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="mx-auto mt-8 max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users size={26} />
        </div>

        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-text">
          Suas vagas acabaram
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-textMuted">
          Você contratou <strong className="text-text">{limite.limite}</strong>{' '}
          {limite.limite === 1 ? 'vaga' : 'vagas'} e está usando{' '}
          <strong className="text-text">{limite.usadas}</strong>. Pra cadastrar
          mais uma criança, a gente atualiza seu contrato e o orçamento junto —
          é rápido.
        </p>

        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          className="tap mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-white"
        >
          <MessageCircle size={17} />
          Falar sobre ampliar
        </a>

        {/* A SAÍDA QUE NÃO CUSTA NADA, e ela é real: o limite conta crianças
          * ATIVAS. Quem parou de atender uma família libera a vaga ao
          * desativá-la, sem falar com ninguém. Esconder isso pra empurrar
          * renegociação seria vender vaga que ele já tem. */}
        <p className="mt-4 text-xs leading-relaxed text-textMuted">
          Parou de atender alguma família? Desative a criança na sua turma — a
          vaga volta na hora, e o histórico dela não se perde.
        </p>
      </div>
    </div>
  );
}

/**
 * ANEXAR O CONTRATO QUE JÁ EXISTIA — foto ou arquivo.
 *
 * O QUE ESTE ANEXO É, E O QUE ELE NÃO É
 * Não é o contrato do app, e a tela diz isso em voz alta. O contrato que vale
 * é gerado dos campos que o motorista acabou de preencher — mensalidade,
 * vencimento, vigência — e passa a existir quando o responsável aceita. Este
 * arquivo é memória do que foi combinado ANTES, e serve pra uma discussão
 * sobre o passado que o contrato novo não cobre.
 *
 * A confusão é perigosa e por isso está escrita: quem achar que anexar o
 * papel dispensa o aceite fica operando sem contrato válido nenhum.
 *
 * SOME QUANDO NÃO HÁ STORAGE, como todo anexo do app: botão que não pode dar
 * certo não aparece.
 */
function AnexarContratoAnterior({ childId }) {
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  if (!STORAGE_ENABLED || !childId) return null;

  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file) return;
    setEnviando(true);
    try {
      const url = await uploadContratoAnterior(childId, file);
      await updateChild(childId, {
        contratoAnteriorURL: url,
        contratoAnteriorEm: new Date().toISOString(),
      });
      setPronto(true);
      toast.success('Contrato guardado junto da criança.');
    } catch (err) {
      console.error('Falha ao anexar contrato anterior:', err);
      toast.error('Não deu pra enviar o arquivo.');
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-primary">
        <Check size={14} />
        Contrato anterior guardado na ficha
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-borderStrong p-3.5">
      <p className="text-xs font-semibold text-text">
        Já tem contrato com essa família?
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-textMuted">
        Anexe o papel ou o PDF que vocês já assinaram. Ele fica guardado na
        ficha como registro do que foi combinado antes —{' '}
        <strong>o contrato que vale continua sendo o do app</strong>, com os
        valores que você acabou de preencher.
      </p>
      <label className="tap mt-2.5 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-borderStrong text-xs font-bold text-text">
        <Paperclip size={14} />
        {enviando ? 'Enviando…' : 'Anexar ou fotografar'}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={enviando}
          onChange={escolher}
        />
      </label>
    </div>
  );
}
