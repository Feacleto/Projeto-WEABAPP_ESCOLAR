import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bus,
  Users,
  MapPin,
  Heart,
  Shield,
  Bell,
  ArrowRight,
  X,
  Sparkles,
  Phone,
  Mail,
  User as UserIcon,
  MapPin as MapPinIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import {
  submitDriverWaitlist,
  submitParentWaitlist,
} from '../services/waitlistService';
import { isValidEmail, isValidPhone, maskPhone, unmaskPhone } from '../utils/masks';

/**
 * Landing pública. Apresenta o projeto de forma lúdica e direciona pra:
 *   - Quem já tem acesso: /welcome (login Pai ou Motorista)
 *   - Motoristas curiosos: lista de espera (waitlistDrivers)
 *   - Pais curiosos: lista de interesse (waitlistParents)
 */
export default function Landing() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null); // 'driver' | 'parent' | null

  return (
    <div className="min-h-screen bg-bg">
      {/* HERO */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white">
        <div className="absolute -top-10 -right-10 opacity-15">
          <Bus size={220} strokeWidth={1.2} />
        </div>
        <div className="relative px-6 pt-10 pb-12 max-w-md mx-auto">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/90">
            <Sparkles size={14} />
            Versão teste · exclusivo Tio Nino
          </div>

          <h1 className="text-4xl font-bold leading-tight mt-3">
            Transporte escolar com{' '}
            <span className="underline decoration-white/40 underline-offset-4">
              tranquilidade
            </span>
            .
          </h1>
          <p className="text-white/90 mt-3 leading-relaxed">
            O pai sabe onde a criança está em tempo real. O motorista organiza
            rotas e pagamentos sem dor de cabeça.
          </p>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => navigate('/welcome')}
              className="tap w-full bg-white text-emerald-700 rounded-2xl py-4 font-bold shadow-lg shadow-emerald-900/20 inline-flex items-center justify-center gap-2"
            >
              Já tenho acesso · Entrar
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* O QUE É */}
      <section className="px-6 py-10 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted">
          Pra que serve
        </h2>
        <p className="text-2xl font-bold text-text mt-2 leading-tight">
          Quem leva e quem espera, conectados.
        </p>
        <p className="text-textMuted mt-3 leading-relaxed text-sm">
          Pais acompanham a criança da casa até a escola. Motoristas gerenciam
          ausências, rotas e mensalidades com poucos toques.
        </p>
      </section>

      {/* COMO FUNCIONA — 3 cards */}
      <section className="px-6 py-2 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-4">
          Como funciona
        </h2>
        <div className="space-y-3">
          <FeatureCard
            icon={Users}
            color="from-blue-500 to-indigo-700"
            title="Cadastro simples"
            body="O motorista cadastra a criança. O pai recebe um código e entra no app."
          />
          <FeatureCard
            icon={MapPin}
            color="from-emerald-500 to-green-700"
            title="Mapa ao vivo"
            body="O pai vê onde a perua está em tempo real. Privacidade preservada — a posição só aparece quando o motorista chega perto."
          />
          <FeatureCard
            icon={Bell}
            color="from-amber-500 to-orange-600"
            title="Avisos automáticos"
            body="Quando o motorista chega perto, o pai recebe alerta com vibração. Sem mensagens manuais."
          />
          <FeatureCard
            icon={Heart}
            color="from-pink-500 to-fuchsia-700"
            title="Pagamentos em ordem"
            body="Mensalidades geradas todo mês. PIX, dinheiro ou cartão — o motorista dá baixa quando recebe."
          />
          <FeatureCard
            icon={Shield}
            color="from-violet-500 to-purple-700"
            title="Ausências organizadas"
            body="Se a criança não vai, o pai avisa pelo app. O motorista vê na hora — sem ligação."
          />
        </div>
      </section>

      {/* CTA — quem é você? */}
      <section className="px-6 py-10 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-3">
          Quero usar
        </h2>
        <p className="text-lg font-bold text-text leading-tight">
          O app é exclusivo do Tio Nino enquanto está em testes. Entre numa das
          listas pra ter prioridade quando abrir.
        </p>

        <div className="mt-5 space-y-3">
          <button
            onClick={() => setSheet('driver')}
            className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/15"
          >
            <div className="bg-gradient-to-br from-emerald-500 to-green-700 text-white p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Bus size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold leading-tight">
                  Sou motorista
                </p>
                <p className="text-white/90 text-sm mt-1">
                  Entrar na lista de espera
                </p>
              </div>
              <ArrowRight size={20} className="text-white/80" />
            </div>
          </button>

          <button
            onClick={() => setSheet('parent')}
            className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-indigo-500/15"
          >
            <div className="bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Users size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold leading-tight">Sou pai ou mãe</p>
                <p className="text-white/90 text-sm mt-1">
                  Quero encontrar meu motorista
                </p>
              </div>
              <ArrowRight size={20} className="text-white/80" />
            </div>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-6 text-center text-[11px] text-textMuted space-y-2">
        <p>Tio Nino Digital · Versão teste</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/termos" className="hover:underline">
            Termos
          </Link>
          <span>·</span>
          <Link to="/privacidade" className="hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>

      {/* Sheets de cadastro */}
      {sheet === 'driver' && (
        <DriverWaitlistSheet onClose={() => setSheet(null)} />
      )}
      {sheet === 'parent' && (
        <ParentWaitlistSheet onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ─────────── Feature cards ─────────── */

function FeatureCard({ icon: Icon, color, title, body }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 flex items-start gap-3">
      <div
        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} text-white flex items-center justify-center shrink-0 shadow-md`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">{title}</p>
        <p className="text-sm text-textMuted mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/* ─────────── Sheets de waitlist ─────────── */

function DriverWaitlistSheet({ onClose }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: k === 'phone' ? maskPhone(e.target.value) : e.target.value,
    }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Diga seu nome.';
    if (!isValidEmail(form.email)) errs.email = 'Email inválido.';
    if (form.phone && !isValidPhone(form.phone)) errs.phone = 'Telefone inválido.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Confira os campos.');
      return;
    }

    setSubmitting(true);
    try {
      await submitDriverWaitlist({
        ...form,
        phone: form.phone ? unmaskPhone(form.phone) : '',
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetWrapper onClose={onClose} title="Lista de espera · Motorista">
      {submitted ? (
        <SuccessMessage
          title="Recebemos!"
          body="Vamos entrar em contato assim que abrir vaga pra novos motoristas."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-textMuted leading-relaxed">
            Conta um pouco sobre você que entramos em contato quando o app abrir
            pra mais motoristas.
          </p>
          <Input
            label="Seu nome"
            icon={UserIcon}
            value={form.name}
            onChange={setField('name')}
            error={errors.name}
            required
          />
          <Input
            type="email"
            inputMode="email"
            label="Email"
            icon={Mail}
            value={form.email}
            onChange={setField('email')}
            error={errors.email}
            required
          />
          <Input
            label="Telefone (opcional)"
            icon={Phone}
            inputMode="tel"
            value={form.phone}
            onChange={setField('phone')}
            maxLength={15}
            error={errors.phone}
          />
          <Input
            label="Cidade"
            icon={MapPinIcon}
            value={form.city}
            onChange={setField('city')}
          />
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Conte um pouco sobre seu trabalho (opcional)
            </label>
            <textarea
              value={form.message}
              onChange={setField('message')}
              rows={3}
              placeholder="Quantas crianças você transporta, há quanto tempo..."
              className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
            />
          </div>
          <Button type="submit" loading={submitting}>
            Entrar na lista
          </Button>
        </form>
      )}
    </SheetWrapper>
  );
}

function ParentWaitlistSheet({ onClose }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    childName: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: k === 'phone' ? maskPhone(e.target.value) : e.target.value,
    }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Diga seu nome.';
    if (!isValidEmail(form.email)) errs.email = 'Email inválido.';
    if (form.phone && !isValidPhone(form.phone)) errs.phone = 'Telefone inválido.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Confira os campos.');
      return;
    }

    setSubmitting(true);
    try {
      await submitParentWaitlist({
        ...form,
        phone: form.phone ? unmaskPhone(form.phone) : '',
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetWrapper onClose={onClose} title="Lista de interesse · Pai/Mãe">
      {submitted ? (
        <SuccessMessage
          title="Anotado!"
          body="Vamos te avisar quando seu motorista entrar no app ou se o app abrir pra novas regiões."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-textMuted leading-relaxed">
            Deixe seus dados que ajudamos a conectar você com um motorista.
          </p>
          <Input
            label="Seu nome"
            icon={UserIcon}
            value={form.name}
            onChange={setField('name')}
            error={errors.name}
            required
          />
          <Input
            type="email"
            inputMode="email"
            label="Email"
            icon={Mail}
            value={form.email}
            onChange={setField('email')}
            error={errors.email}
            required
          />
          <Input
            label="Telefone (opcional)"
            icon={Phone}
            inputMode="tel"
            value={form.phone}
            onChange={setField('phone')}
            maxLength={15}
            error={errors.phone}
          />
          <Input
            label="Cidade"
            icon={MapPinIcon}
            value={form.city}
            onChange={setField('city')}
          />
          <Input
            label="Nome da criança (opcional)"
            icon={UserIcon}
            value={form.childName}
            onChange={setField('childName')}
          />
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Já conhece o motorista da sua região? (opcional)
            </label>
            <textarea
              value={form.message}
              onChange={setField('message')}
              rows={3}
              placeholder="Nome do motorista, escola da criança..."
              className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
            />
          </div>
          <Button type="submit" loading={submitting}>
            Entrar na lista
          </Button>
        </form>
      )}
    </SheetWrapper>
  );
}

function SheetWrapper({ onClose, title, children }) {
  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pt-2 pb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-text leading-tight flex-1">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function SuccessMessage({ title, body, onClose }) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <Sparkles size={32} className="text-emerald-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-text">{title}</h3>
        <p className="text-sm text-textMuted mt-2 leading-relaxed">{body}</p>
      </div>
      <Button onClick={onClose}>Fechar</Button>
    </div>
  );
}
