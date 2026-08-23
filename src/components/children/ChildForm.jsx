import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
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
  Sunrise,
  Sunset,
  Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../common/Card';
import MapPicker from '../map/MapPicker';
import InviteShare from './InviteShare';
import Input from '../common/Input';
import Button from '../common/Button';
import { addChild } from '../../services/childrenService';
import { searchAddress } from '../../services/locationService';
import { PERIOD_OPTIONS } from '../../services/routePlanService';
import {
  maskPhone,
  unmaskPhone,
  isValidPhone,
  isValidEmail,
} from '../../utils/masks';

const GENDERS = [
  { value: 'male', label: 'Menino' },
  { value: 'female', label: 'Menina' },
];

const PERIOD_ICONS = {
  morning: Sunrise,
  afternoon: Sunset,
  evening: Moon,
};

const TOTAL_STEPS = 4;

const EMPTY_FORM = {
  name: '',
  gender: 'male',
  birthDate: '', // YYYY-MM-DD — usado pra parabenizar no aniversário
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  parent2Name: '',
  parent2Phone: '',
  address: '',
  lat: '',
  lng: '',
  school: '',
  schoolAddress: '',
  schoolLat: '',
  schoolLng: '',
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [errors, setErrors] = useState({});

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setPhone = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: maskPhone(e.target.value) }));

  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Diga o nome da criança.';
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
      if (form.schoolAddress.trim() && !form.school.trim()) {
        errs.school = 'Se informou o endereço, diga também o nome da escola.';
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
      const { inviteCode } = await addChild({
        ...form,
        parentPhone: unmaskPhone(form.parentPhone),
        parent2Phone: form.parent2Phone ? unmaskPhone(form.parent2Phone) : '',
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        dueDay: parseInt(form.dueDay, 10) || 10,
      });
      setCreatedCode(inviteCode);
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
        childName={form.name}
        parentPhone={unmaskPhone(form.parentPhone)}
        onDone={() => navigate('/tio/children', { replace: true })}
      />
    );
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
        className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-40 px-5 pt-3 bg-bg border-t border-gray-100"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
      >
        <Button
          onClick={onAdvance}
          loading={submitting}
          icon={step === TOTAL_STEPS ? Check : ArrowRight}
          className="shadow-2xl shadow-emerald-500/30 !bg-emerald-600 hover:!bg-emerald-700 !h-14 !text-base"
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
                ? 'bg-emerald-500'
                : current
                ? 'bg-emerald-500'
                : 'bg-gray-200'
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
      </div>

      <Input
        type="date"
        label="Data de aniversário"
        icon={Calendar}
        value={form.birthDate}
        onChange={setField('birthDate')}
        hint="Pra parabenizar a criança no dia (opcional)."
      />

      <div>
        <label className="block text-sm font-semibold text-text mb-2">
          Em qual período estuda?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PERIOD_OPTIONS.map((p) => {
            const Icon = PERIOD_ICONS[p.value] || Sunrise;
            return (
              <SelectorButton
                key={p.value}
                label={p.label}
                icon={Icon}
                active={form.period === p.value}
                onClick={() => setForm((prev) => ({ ...prev, period: p.value }))}
              />
            );
          })}
        </div>
      </div>
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
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
          <MapPin size={18} />
          <span>Local confirmado!</span>
        </div>
      )}

      {/* Endereço não encontrado NÃO é erro de preenchimento — é limite do
        * mapa. A mensagem diz isso e oferece as duas saídas. */}
      {!hasCoord && searchState === 'notFound' && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl space-y-1">
          <p className="font-semibold">Não achamos esse endereço no mapa.</p>
          <p className="text-amber-700">
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

/* ─────────────── Passo 3: Escola ─────────────── */

function Step3School({ form, setForm, setField, errors }) {
  const [searchingSchool, setSearchingSchool] = useState(false);

  const onSearchSchool = async () => {
    if (!form.schoolAddress.trim()) {
      toast.error('Digite o endereço da escola primeiro.');
      return;
    }
    setSearchingSchool(true);
    try {
      const result = await searchAddress(form.schoolAddress);
      setForm((prev) => ({
        ...prev,
        schoolLat: result.lat,
        schoolLng: result.lng,
        schoolAddress: result.displayName || prev.schoolAddress,
      }));
      toast.success('Encontramos a escola!');
    } catch (err) {
      toast.error(err?.message || 'Endereço não encontrado.');
    } finally {
      setSearchingSchool(false);
    }
  };

  return (
    <>
      <Heading
        title="Onde estuda?"
        subtitle="Nome da escola e endereço — pra entregar e buscar."
      />

      <Input
        label="Nome da escola"
        placeholder="Ex: Colégio Sol"
        icon={GraduationCap}
        value={form.school}
        onChange={setField('school')}
        error={errors.school}
        required
        autoFocus
      />

      <Input
        label="Endereço da escola"
        placeholder="Rua, número, bairro, cidade"
        icon={School}
        value={form.schoolAddress}
        onChange={setField('schoolAddress')}
        error={errors.schoolAddress}
        required
      />

      <Button
        type="button"
        variant="secondary"
        icon={Search}
        onClick={onSearchSchool}
        loading={searchingSchool}
      >
        Buscar endereço da escola
      </Button>

      {form.schoolLat && form.schoolLng && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl">
          <MapPin size={18} />
          <span>Local confirmado!</span>
        </div>
      )}

      <div className="pt-2">
        <label className="block text-sm font-semibold text-text mb-2">
          Quando você busca em casa?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PERIOD_OPTIONS.map((p) => {
            const Icon = PERIOD_ICONS[p.value] || Sunrise;
            return (
              <SelectorButton
                key={p.value}
                label={p.label}
                icon={Icon}
                active={form.pickupPeriod === p.value}
                onClick={() =>
                  setForm((prev) => ({ ...prev, pickupPeriod: p.value }))
                }
              />
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-text mb-2">
          Quando você devolve em casa?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PERIOD_OPTIONS.map((p) => {
            const Icon = PERIOD_ICONS[p.value] || Sunrise;
            return (
              <SelectorButton
                key={p.value}
                label={p.label}
                icon={Icon}
                active={form.dropoffPeriod === p.value}
                onClick={() =>
                  setForm((prev) => ({ ...prev, dropoffPeriod: p.value }))
                }
              />
            );
          })}
        </div>
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
          <div className="space-y-3 pt-1 border-t border-gray-100">
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
          required
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
          className="w-full rounded-xl border border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-textMuted"
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
          : 'bg-card text-text border-gray-200'
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
function InviteCodeSuccess({ code, childName, parentPhone, onDone }) {
  return (
    <div className="min-h-screen flex flex-col p-6 gap-5 justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <Check size={32} className="text-emerald-600" />
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

      <Button onClick={onDone}>Concluir</Button>
    </div>
  );
}
