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
  Instagram,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import {
  submitDriverWaitlist,
  submitParentWaitlist,
} from '../services/waitlistService';
import { isValidEmail, isValidPhone, maskPhone, unmaskPhone } from '../utils/masks';

// Contatos oficiais da Desenvolva Algo — empresa que desenvolveu o app.
// Centralizado pra facilitar manutenção (CNPJ, telefone, redes sociais).
const DEV_PHONE_RAW = '5511969170709';
const DEV_PHONE_DISPLAY = '(11) 96917-0709';
const DEV_EMAIL = 'desenvolvaalgo@gmail.com';
const DEV_INSTAGRAM_URL =
  'https://www.instagram.com/desenvolvaalgo?igsh=MWR2YnE3cmZieTlraA%3D%3D&utm_source=qr';
const DEV_WHATSAPP_URL = `https://wa.me/${DEV_PHONE_RAW}?text=${encodeURIComponent(
  'Olá! Vi o Tio Nino Digital e gostaria de saber mais sobre um app pra minha perua.'
)}`;
const DEV_MAIL_URL = `mailto:${DEV_EMAIL}?subject=${encodeURIComponent(
  'Quero um app pra minha perua'
)}&body=${encodeURIComponent(
  'Olá! Vi o Tio Nino Digital e gostaria de saber mais.'
)}`;

/**
 * Landing pública. Apresenta o projeto de forma lúdica e direciona pra:
 *   - Quem já tem acesso: /welcome (login Pai ou Motorista)
 *   - Tios de perua interessados em contratar o app (waitlistDrivers)
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
            App pro tio de perua
          </div>

          <h1 className="text-4xl font-bold leading-tight mt-3">
            Sua perua organizada{' '}
            <span className="underline decoration-white/40 underline-offset-4">
              no celular
            </span>
            .
          </h1>
          <p className="text-white/90 mt-3 leading-relaxed">
            Rota, pagamentos e avisos pros pais — tudo num lugar. O Tio Nino já
            usa. Agora pode ser pra sua perua também.
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

      {/* IMAGEM VAN — bloco visual logo após o hero. Card flutuante com
        * borda arredondada (não bate na borda da tela) pra dar polimento.
        * Gradient escuro inferior pra label legível mesmo em fotos claras. */}
      <section className="px-4 -mt-6 relative z-10">
        <div className="max-w-md mx-auto relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-900/25 ring-1 ring-white/40">
          <img
            src="/imagemvanescolar.png"
            alt="Van escolar com crianças embarcando"
            className="w-full h-56 object-cover"
            loading="lazy"
          />
          {/* Gradient inferior — escurece pra label legível */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
          />
          {/* Label sobreposta */}
          <div className="absolute left-4 right-4 bottom-3">
            <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md">
              <span className="relative inline-flex">
                <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                Pensado pra van escolar de verdade
              </span>
            </div>
            <p className="text-white font-bold text-base leading-tight mt-2 max-w-xs drop-shadow">
              Quem leva sua criança merece a melhor ferramenta.
            </p>
          </div>
        </div>
      </section>

      {/* O QUE É */}
      <section className="px-6 py-10 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted">
          Pra que serve
        </h2>
        <p className="text-2xl font-bold text-text mt-2 leading-tight">
          Menos WhatsApp, mais organização.
        </p>
        <p className="text-textMuted mt-3 leading-relaxed text-sm">
          Você organiza a rota, marca quem faltou, cobra a mensalidade e os pais
          já sabem quando você tá chegando. Sem grupo de WhatsApp lotado.
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

      {/* CTA principal — venda B2B pro tio de perua */}
      <section className="px-6 py-10 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-3">
          Você é tio de perua?
        </h2>
        <p className="text-2xl font-bold text-text leading-tight">
          Tenha esse app pra sua operação.
        </p>
        <p className="text-textMuted mt-2 leading-relaxed text-sm">
          O app foi feito sob medida pro Tio Nino e tá rodando todo dia. Se você
          tem perua escolar e quer o mesmo, deixa seu contato que a gente fala.
        </p>

        <button
          onClick={() => setSheet('driver')}
          className="tap w-full text-left rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/25 mt-5"
        >
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Bus size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold leading-tight">
                Quero esse app pra minha perua
              </p>
              <p className="text-white/90 text-sm mt-1">
                A gente entra em contato
              </p>
            </div>
            <ArrowRight size={22} className="text-white" />
          </div>
        </button>

        {/* Pai — secundário, mais discreto */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-textMuted mb-2">
            É pai ou mãe procurando um motorista que use o app?
          </p>
          <button
            onClick={() => setSheet('parent')}
            className="tap w-full text-left rounded-2xl bg-card border border-gray-200 p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text leading-tight">
                Deixar meu interesse
              </p>
              <p className="text-xs text-textMuted mt-0.5">
                Te avisamos quando tiver motorista na sua região
              </p>
            </div>
            <ArrowRight size={18} className="text-textMuted shrink-0" />
          </button>
        </div>
      </section>

      {/* QUEM FEZ — destaque pra Desenvolva Algo (capta lead via contatos diretos) */}
      <DeveloperSection />

      {/* FOOTER enxuto */}
      <footer className="px-6 py-6 text-center text-[11px] text-textMuted space-y-2 border-t border-gray-100">
        <p>
          Tio Nino Digital · Desenvolvido por{' '}
          <a
            href={DEV_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-text hover:underline"
          >
            Desenvolva Algo
          </a>
        </p>
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

/* ─────────── Quem fez ─────────── */

/**
 * Seção de assinatura da Desenvolva Algo — serve como vitrine pra outros
 * tios entrarem em contato direto (WhatsApp/email/Instagram) sem precisar
 * passar pela waitlist. Captura lead "morno" complementar ao card principal.
 */
function DeveloperSection() {
  return (
    <section className="px-6 py-10 max-w-md mx-auto">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-3">
        Quem fez
      </h2>

      <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
        {/* Cabeçalho com logo */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 flex items-center gap-4">
          <img
            src="/logoDesenvolvalago.svg"
            alt="Desenvolva Algo"
            className="w-14 h-14 shrink-0 rounded-2xl bg-white p-1.5"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">
              Sistema desenvolvido por
            </p>
            <p className="text-xl font-bold leading-tight mt-1">
              Desenvolva Algo
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-text leading-relaxed">
            Software sob medida pra pequenos negócios. Atendimento direto, sem
            intermediário — você fala com quem programa.
          </p>

          {/* Contatos rápidos — botões grandes */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={DEV_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tap rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-3 inline-flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <a
              href={DEV_MAIL_URL}
              className="tap rounded-2xl bg-blue-500 hover:bg-blue-600 text-white px-3 py-3 inline-flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
            >
              <Mail size={18} />
              Email
            </a>
          </div>

          <a
            href={DEV_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-500 text-white px-3 py-3 inline-flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
          >
            <Instagram size={18} />
            @desenvolvaalgo no Instagram
          </a>

          {/* Dados textuais — discretos mas presentes (legais e SEO) */}
          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-textMuted">
            <div className="flex items-center gap-2">
              <Phone size={14} className="shrink-0" />
              <a
                href={DEV_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-text font-medium"
              >
                {DEV_PHONE_DISPLAY}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="shrink-0" />
              <a
                href={DEV_MAIL_URL}
                className="hover:underline text-text font-medium break-all"
              >
                {DEV_EMAIL}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <MapPinIcon size={14} className="shrink-0" />
              <span>Socorro · São Paulo, SP</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>CNPJ 65.000.217/0001-47</span>
            </div>
          </div>
        </div>
      </div>
    </section>
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
    <SheetWrapper onClose={onClose} title="Quero esse app pra minha perua">
      {submitted ? (
        <SuccessMessage
          title="Recebemos!"
          body="A gente entra em contato em até 2 dias úteis pra mostrar o app e ver como funciona pra sua operação."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-textMuted leading-relaxed">
            Conta um pouco da sua operação que a gente entra em contato pra
            apresentar o sistema sem compromisso.
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
