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
  Copy,
  Check,
  Home,
  School,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../layout/Header';
import Card from '../common/Card';
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

// Períodos vêm de routePlanService (fonte única — usado pelo kanban também)
const GENDERS = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
];

/**
 * Página de cadastro de criança.
 *
 * Fluxo:
 *   1. Tio preenche os campos e busca coordenadas via Nominatim
 *   2. Submit chama addChild → gera invite code único + cria doc
 *   3. Mostra modal com o código pra ser entregue ao responsável
 */
export default function ChildForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    gender: 'male',
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
    notes: '',
  });
  const [searching, setSearching] = useState(false);
  const [searchingSchool, setSearchingSchool] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [errors, setErrors] = useState({});
  const [showSecondParent, setShowSecondParent] = useState(false);

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setPhone = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: maskPhone(e.target.value) }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Informe o nome da criança.';
    if (!form.school.trim()) errs.school = 'Informe a escola.';
    if (!form.schoolAddress.trim())
      errs.schoolAddress = 'Informe o endereço da escola.';
    if (!form.parentName.trim()) errs.parentName = 'Informe o nome do responsável.';
    if (!isValidEmail(form.parentEmail)) errs.parentEmail = 'Email inválido.';
    if (!isValidPhone(form.parentPhone)) {
      errs.parentPhone = 'Telefone inválido. Use 10 ou 11 dígitos com DDD.';
    }
    // Segundo responsável é opcional, mas se preencheu o telefone, valida
    if (form.parent2Phone && !isValidPhone(form.parent2Phone)) {
      errs.parent2Phone = 'Telefone inválido.';
    }
    if (!form.address.trim()) errs.address = 'Informe o endereço.';
    if (!form.lat || !form.lng) {
      errs.address = 'Busque as coordenadas do endereço primeiro.';
    }
    const fee = parseFloat(form.monthlyFee);
    if (!fee || fee <= 0) errs.monthlyFee = 'Mensalidade deve ser maior que zero.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSearchHomeCoords = async () => {
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
      toast.success('Coordenadas encontradas!');
    } catch (err) {
      toast.error(err?.message || 'Endereço não encontrado.');
    } finally {
      setSearching(false);
    }
  };

  const onSearchSchoolCoords = async () => {
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
      toast.success('Endereço da escola localizado!');
    } catch (err) {
      toast.error(err?.message || 'Endereço não encontrado.');
    } finally {
      setSearchingSchool(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Confira os campos destacados.');
      return;
    }
    setSubmitting(true);
    try {
      const { inviteCode } = await addChild({
        ...form,
        parentPhone: unmaskPhone(form.parentPhone),
        parent2Phone: form.parent2Phone ? unmaskPhone(form.parent2Phone) : '',
        monthlyFee: parseFloat(form.monthlyFee) || 0,
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
        onDone={() => navigate('/tio/children', { replace: true })}
      />
    );
  }

  return (
    <>
      <Header title="Nova criança" showBack />

      <form onSubmit={onSubmit} className="p-4 space-y-4 pb-8">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Criança</h2>
          <Input
            label="Nome completo"
            placeholder="Ex: Pedro Silva"
            icon={User}
            value={form.name}
            onChange={setField('name')}
            error={errors.name}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Gênero
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, gender: g.value }))
                  }
                  className={`h-10 rounded-xl text-sm font-semibold border tap ${
                    form.gender === g.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Período escolar
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, period: p.value }))
                  }
                  className={`h-10 rounded-xl text-sm font-semibold border tap ${
                    form.period === p.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-textMuted mt-1">
              Em qual turno a criança estuda.
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Horários de transporte</h2>
          <p className="text-xs text-textMuted -mt-2">
            Define em qual turno você passa em casa pra buscar e devolver a criança.
          </p>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Turno da coleta (casa → escola)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, pickupPeriod: p.value }))
                  }
                  className={`h-10 rounded-xl text-sm font-semibold border tap ${
                    form.pickupPeriod === p.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Turno da entrega (escola → casa)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, dropoffPeriod: p.value }))
                  }
                  className={`h-10 rounded-xl text-sm font-semibold border tap ${
                    form.dropoffPeriod === p.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Escola</h2>
          <Input
            label="Nome da escola"
            placeholder="Ex: Colégio Tio Nino"
            icon={GraduationCap}
            value={form.school}
            onChange={setField('school')}
            error={errors.school}
            required
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
            size="md"
            icon={Search}
            onClick={onSearchSchoolCoords}
            loading={searchingSchool}
          >
            Buscar coordenadas da escola
          </Button>
          {form.schoolLat && form.schoolLng && (
            <div className="flex items-center gap-2 text-xs text-lime-700 bg-success/10 px-3 py-2 rounded-lg">
              <MapPin size={14} />
              <span>
                {Number(form.schoolLat).toFixed(5)},{' '}
                {Number(form.schoolLng).toFixed(5)}
              </span>
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Responsável principal</h2>
          <Input
            label="Nome"
            placeholder="Pai, mãe ou tutor"
            icon={User}
            value={form.parentName}
            onChange={setField('parentName')}
            autoComplete="name"
            error={errors.parentName}
            required
          />
          <Input
            type="email"
            inputMode="email"
            label="Email do responsável"
            placeholder="email@exemplo.com"
            icon={Mail}
            value={form.parentEmail}
            onChange={setField('parentEmail')}
            autoComplete="email"
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
            autoComplete="tel"
            maxLength={15}
            error={errors.parentPhone}
            required
          />

          {/* Segundo responsável (opcional) */}
          <button
            type="button"
            onClick={() => setShowSecondParent((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-medium text-primary tap py-2"
          >
            <span>
              {showSecondParent
                ? 'Ocultar segundo responsável'
                : 'Adicionar segundo responsável (opcional)'}
            </span>
            {showSecondParent ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>

          {showSecondParent && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <Input
                label="Nome do segundo responsável"
                placeholder="Ex: pai ou mãe"
                icon={User}
                value={form.parent2Name}
                onChange={setField('parent2Name')}
              />
              <Input
                label="Telefone do segundo responsável"
                placeholder="(11) 99999-9999"
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
          <h2 className="text-sm font-semibold text-text">Endereço de casa</h2>
          <Input
            label="Endereço completo"
            placeholder="Rua, número, bairro, cidade"
            icon={Home}
            value={form.address}
            onChange={setField('address')}
            hint="Quanto mais específico, melhor o geocoding."
            error={errors.address}
            required
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Search}
            onClick={onSearchHomeCoords}
            loading={searching}
          >
            Buscar coordenadas
          </Button>
          {form.lat && form.lng && (
            <div className="flex items-center gap-2 text-xs text-lime-700 bg-success/10 px-3 py-2 rounded-lg">
              <MapPin size={14} />
              <span>
                {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
              </span>
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Financeiro</h2>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            label="Mensalidade (R$)"
            placeholder="450.00"
            icon={DollarSign}
            value={form.monthlyFee}
            onChange={setField('monthlyFee')}
            error={errors.monthlyFee}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Observações (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={setField('notes')}
              rows={3}
              placeholder="Alergias, instruções especiais..."
              className="w-full rounded-xl border border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-textMuted"
            />
          </div>
        </Card>

        <Button type="submit" loading={submitting}>
          Cadastrar criança
        </Button>
      </form>
    </>
  );
}

/**
 * Tela de sucesso pós-cadastro: mostra o invite code num card grande
 * com botão de copiar pra área de transferência.
 */
function InviteCodeSuccess({ code, onDone }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Anote o código.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <Check size={28} className="text-success" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-text">Criança cadastrada!</h3>
          <p className="text-sm text-textMuted mt-1">
            Entregue o código abaixo ao responsável (WhatsApp, presencialmente)
            para que ele crie sua conta.
          </p>
        </div>
        <div className="bg-bg rounded-xl p-4">
          <p className="text-xs text-textMuted mb-1">Código de convite</p>
          <p className="text-3xl font-bold tracking-widest text-text">{code}</p>
        </div>
        <Button variant="secondary" icon={copied ? Check : Copy} onClick={onCopy}>
          {copied ? 'Copiado!' : 'Copiar código'}
        </Button>
        <Button onClick={onDone}>Concluir</Button>
      </div>
    </div>
  );
}
