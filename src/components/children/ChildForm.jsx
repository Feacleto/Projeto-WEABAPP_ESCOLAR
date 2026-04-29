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
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../layout/Header';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { addChild } from '../../services/childrenService';
import { searchAddress } from '../../services/locationService';

const PERIODS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noite' },
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
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    address: '',
    lat: '',
    lng: '',
    school: '',
    period: 'morning',
    monthlyFee: '',
    notes: '',
  });
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSearchCoords = async () => {
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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.lat || !form.lng) {
      toast.error('Busque as coordenadas do endereço primeiro.');
      return;
    }
    setSubmitting(true);
    try {
      const { inviteCode } = await addChild({
        ...form,
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
            label="Nome da criança"
            placeholder="Ex: Pedro Silva"
            icon={User}
            value={form.name}
            onChange={setField('name')}
            required
          />
          <Input
            label="Escola"
            placeholder="Nome da escola"
            icon={GraduationCap}
            value={form.school}
            onChange={setField('school')}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              Período
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
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
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Responsável</h2>
          <Input
            label="Nome do responsável"
            placeholder="Pai, mãe ou tutor"
            icon={User}
            value={form.parentName}
            onChange={setField('parentName')}
            autoComplete="name"
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
            required
          />
          <Input
            label="Telefone"
            placeholder="(11) 99999-9999"
            icon={Phone}
            inputMode="tel"
            value={form.parentPhone}
            onChange={setField('parentPhone')}
            autoComplete="tel"
            required
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Endereço</h2>
          <Input
            label="Endereço completo"
            placeholder="Rua, número, bairro, cidade"
            icon={Home}
            value={form.address}
            onChange={setField('address')}
            hint="Quanto mais específico, melhor o geocoding."
            required
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Search}
            onClick={onSearchCoords}
            loading={searching}
          >
            Buscar coordenadas
          </Button>
          {form.lat && form.lng && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-success/10 px-3 py-2 rounded-lg">
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
