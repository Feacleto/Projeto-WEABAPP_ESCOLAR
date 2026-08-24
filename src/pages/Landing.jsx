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
  CheckCircle2,
} from 'lucide-react';
import WhatsAppIcon from '../components/common/WhatsAppIcon';
import ScreensCarousel from '../components/landing/ScreensCarousel';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import Reveal from '../components/common/Reveal';
import toast from 'react-hot-toast';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import {
  submitDriverWaitlist,
  submitParentWaitlist,
} from '../services/waitlistService';
import { isValidEmail, isValidPhone, maskPhone, unmaskPhone } from '../utils/masks';
import {
  DEV_CNPJ,
  DEV_EMAIL,
  DEV_INSTAGRAM_URL,
  DEV_PHONE_DISPLAY,
  devMailLink,
  devWhatsAppLink,
} from '../config/developer';

// Os contatos e o CNPJ da Desenvolva Algo moraram aqui até a home também
// precisar deles. Agora vêm de src/config/developer.js — um lugar só pra
// dado legal, porque CNPJ certo numa tela e errado na outra ninguém percebe.
const DEV_WHATSAPP_URL = devWhatsAppLink(
  'Olá! Vi o Alô Buzinou e gostaria de saber mais sobre um app pro meu transporte escolar.'
);
const DEV_MAIL_URL = devMailLink(
  'Quero um app pro meu transporte escolar',
  'Olá! Vi o Alô Buzinou e gostaria de saber mais.'
);

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
          {/* Marca grande — "Alô Buzinou!" é o nome do app. A frase é
            * propositalmente repetida em sutis pra fixar na cabeça do usuário. */}
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/85 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
            <Sparkles size={12} />
            App pro tio de perua
          </div>
          <h1 className="text-5xl font-black leading-[0.95] mt-4 drop-shadow-sm">
            Alô<br />
            <span className="text-white/90">Buzinou!</span>
          </h1>
          <p className="text-white/90 mt-4 text-lg leading-snug font-medium">
            Sua perua organizada no celular.
          </p>
          <p className="text-white/85 mt-3 leading-relaxed text-sm">
            Rota, pagamentos e avisos pros pais — tudo num lugar. Já tá rodando
            em peruas escolares de verdade.
          </p>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => navigate('/welcome')}
              className="tap w-full bg-white text-emerald-700 rounded-2xl py-4 font-bold shadow-lg shadow-emerald-900/20 inline-flex items-center justify-center gap-2"
            >
              Fazer login exclusivo
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* IMAGEM VAN — bloco visual logo após o hero. Card flutuante com
        * borda arredondada (não bate na borda da tela) pra dar polimento.
        * Gradient escuro inferior pra label legível mesmo em fotos claras. */}
      <Reveal as="section" className="px-4 -mt-6 relative z-10">
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
      </Reveal>

      {/* O QUE É */}
      <Reveal as="section" className="px-6 py-10 max-w-md mx-auto">
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
      </Reveal>

      {/* CARROSSEL DE TELAS — preview swipe das interfaces Tio/Pai.
        * Sem Reveal envolvendo: garante que as imagens carreguem
        * imediatamente independente da animação. */}
      <ScreensCarousel />

      {/* COMO FUNCIONA — carrossel arrastável, texto emocional que mostra
        * o valor (não só feature). Termina com um CTA pra entrar no app. */}
      <Reveal as="section" className="py-8">
        <div className="px-6 max-w-md mx-auto">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
            Por que vai mudar seu dia
          </h2>
          <p className="text-2xl font-bold text-text leading-tight">
            Menos preocupação. Mais tempo pra família.
          </p>
          <p className="text-textMuted mt-2 text-sm">
            Arraste pro lado pra ver o que o app faz por você todo dia.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          <div className="flex gap-4 px-6 pb-2">
            <ValueCard
              icon={MapPin}
              color="from-emerald-500 to-green-700"
              kicker="Pai · tranquilidade no peito"
              title="Você vê a perua chegando"
              body="Não precisa mais ficar olhando o relógio nem ligando perguntando 'cadê?'. Quando o motorista está perto, o celular vibra. Você desce na hora certa, sem correria."
            />
            <ValueCard
              icon={Bell}
              color="from-amber-500 to-orange-600"
              kicker="Pai · zero ansiedade"
              title="Avisos sem precisar perguntar"
              body="A criança embarcou, chegou na escola, voltou pra casa — você acompanha tudo no celular. Sem grupo lotado de WhatsApp, sem mensagem perdida."
            />
            <ValueCard
              icon={Heart}
              color="from-pink-500 to-fuchsia-700"
              kicker="Pai · sem dor de cabeça"
              title="Mensalidade no automático"
              body="O valor aparece no app todo mês, com data certa. Paga por PIX direto da tela ou marca como pago em dinheiro. Nada de boleto perdido na sacola."
            />
            <ValueCard
              icon={Bus}
              color="from-blue-500 to-indigo-700"
              kicker="Motorista · rota descomplicada"
              title="Sua turma na palma da mão"
              body="Embarcou, na escola, entregou — três toques e pronto. Reordenar a fila é arrastar. Marcar quem faltou é um botão. Sem caderninho, sem confusão."
            />
            <ValueCard
              icon={Shield}
              color="from-violet-500 to-purple-700"
              kicker="Motorista · cobrança em ordem"
              title="Você sabe quem pagou"
              body="A mensalidade é gerada sozinha todo mês. Quem pagou, quem deve, quem tá atrasado — tudo numa tela só. No fim do mês, exporta o relatório completo."
            />
            <ValueCard
              icon={Users}
              color="from-cyan-500 to-blue-600"
              kicker="Pai e motorista juntos"
              title="Comunicação que funciona"
              body="O pai avisa que a criança vai faltar com dois toques. O motorista manda recados pré-prontos quando algo acontece. Tudo na linguagem certa, sem mal-entendido."
            />
          </div>
        </div>

        {/* CTA pós-carrossel — convida pra fazer login escolhendo acesso */}
        <div className="px-6 max-w-md mx-auto mt-8 space-y-3">
          <p className="text-center text-sm font-semibold text-text mb-2">
            Pronto pra começar?
          </p>
          <button
            onClick={() => navigate('/first-access')}
            className="tap w-full text-left rounded-2xl overflow-hidden shadow-md shadow-indigo-500/15"
          >
            <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">Entrar como pai ou mãe</p>
                <p className="text-white/85 text-xs mt-0.5">
                  Acompanhar meu filho na rota
                </p>
              </div>
              <ArrowRight size={18} className="text-white/85" />
            </div>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="tap w-full text-left rounded-2xl overflow-hidden shadow-md shadow-emerald-500/20"
          >
            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Bus size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">
                  Entrar como motorista
                </p>
                <p className="text-white/85 text-xs mt-0.5">
                  Eu transporto as crianças
                </p>
              </div>
              <ArrowRight size={18} className="text-white/85" />
            </div>
          </button>
        </div>
      </Reveal>

      {/* CTA principal — capta lead pra receber código de convite.
        * 2 botões (motorista / pai) abrem o MESMO formulário, com a
        * resposta "quem é" pré-selecionada (o usuário pode trocar dentro). */}
      <Reveal as="section" className="px-6 py-10 max-w-md mx-auto">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-3">
          Tá curtindo o que viu?
        </h2>
        <p className="text-2xl font-bold text-text leading-tight">
          Tenha esse app no seu dia a dia.
        </p>
        <p className="text-textMuted mt-2 leading-relaxed text-sm">
          Inscreva-se pra receber seu código de convite. O acesso é por
          convite — a gente entra em contato e te manda direitinho.
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            onClick={() => setSheet('driver')}
            className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/25"
          >
            <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Bus size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold leading-tight">
                  Sou motorista
                </p>
                <p className="text-white/90 text-xs mt-0.5">
                  Tenho perua escolar e quero usar
                </p>
              </div>
              <ArrowRight size={20} className="text-white" />
            </div>
          </button>

          <button
            onClick={() => setSheet('parent')}
            className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-indigo-500/20"
          >
            <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Users size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold leading-tight">
                  Sou pai ou mãe
                </p>
                <p className="text-white/90 text-xs mt-0.5">
                  Quero acompanhar meu filho na rota
                </p>
              </div>
              <ArrowRight size={20} className="text-white" />
            </div>
          </button>
        </div>
      </Reveal>

      {/* DEPOIMENTOS — prova social vinda do feedback dentro do app */}
      <Reveal>
        <TestimonialsSection />
      </Reveal>

      {/* QUEM FEZ — destaque pra Desenvolva Algo (capta lead via contatos diretos) */}
      <Reveal>
        <DeveloperSection />
      </Reveal>

      {/* FOOTER enxuto */}
      <footer className="px-6 py-8 text-center text-[11px] text-textMuted space-y-4 border-t border-gray-100">
        <div className="space-y-2">
          <p>Alô Buzinou! · feito por</p>
          <a
            href={DEV_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Desenvolva Algo"
            className="tap inline-flex"
          >
            <img
              src="/logoDesenvolvalago.svg"
              alt="Desenvolva Algo"
              className="h-16 mx-auto"
            />
          </a>
        </div>
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

      {/* Sheet único de inscrição — pré-seleciona "Sou motorista" ou
        * "Sou pai/mãe" baseado em qual botão foi clicado, mas deixa
        * o usuário trocar dentro do próprio formulário. */}
      {sheet && (
        <InviteWaitlistSheet
          defaultRole={sheet}
          onClose={() => setSheet(null)}
        />
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
        {/* Cabeçalho com logo (SVG já contém o nome da empresa).
          * Área escura compacta; logo mantém o tamanho generoso. */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
            Sistema desenvolvido por
          </p>
          <img
            src="/logoDesenvolvalago.svg"
            alt="Desenvolva Algo"
            className="w-full max-w-[280px] mx-auto"
          />
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
              <WhatsAppIcon size={20} colored={false} />
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
              <span>CNPJ {DEV_CNPJ}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Value card (carrossel "Por que vai mudar seu dia") ───────── */

/**
 * Card grande pra um único valor do app. Formato vertical (width fixa) pra
 * funcionar dentro do scroll-snap horizontal. Topo colorido com ícone
 * grande + kicker; corpo branco com título e descrição emocional.
 */
function ValueCard({ icon: Icon, color, kicker, title, body }) {
  return (
    <div className="snap-center shrink-0 w-72 rounded-3xl bg-card shadow-md overflow-hidden border border-gray-100">
      <div
        className={`bg-gradient-to-br ${color} text-white p-5`}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
          <Icon size={26} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/85">
          {kicker}
        </p>
        <p className="text-lg font-bold leading-tight mt-1">{title}</p>
      </div>
      <div className="p-5">
        <p className="text-sm text-text leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/* ─────────── Sheet único de inscrição (Tio ou Pai) ─────────── */

/**
 * Sheet unificado pra captação de lead. Pergunta "quem é você" no topo
 * (toggle Motorista / Pai-Mãe) e mostra os campos comuns + específicos.
 *
 * Submit chama o service apropriado (driver/parent waitlist). Mensagem
 * final é a mesma: o usuário vai receber código de convite quando
 * abrir vaga.
 *
 * Layout corrige o problema do topo batendo na barra do navegador:
 * usa `paddingTop` com safe-area no overlay e header sticky separado
 * do scroll do conteúdo (igual o FeedbackSheet).
 */
// Como o lead conheceu o app — pra ajustar canais de marketing.
const HEARD_FROM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Indicação' },
  { value: 'google', label: 'Google' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'event', label: 'Evento' },
  { value: 'other', label: 'Outro' },
];

function InviteWaitlistSheet({ defaultRole = 'driver', onClose }) {
  const [role, setRole] = useState(defaultRole);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    childName: '',
    heardFrom: '',
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
    if (form.phone && !isValidPhone(form.phone))
      errs.phone = 'Telefone inválido.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Confira os campos.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        phone: form.phone ? unmaskPhone(form.phone) : '',
      };
      if (role === 'driver') {
        await submitDriverWaitlist(payload);
      } else {
        await submitParentWaitlist(payload);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky — handle + título + fechar. Conteúdo rola separado */}
        <div className="shrink-0 bg-card rounded-t-3xl border-b border-gray-100">
          <div className="pt-3 pb-1 flex justify-center">
            <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
          </div>
          <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text leading-tight">
                {submitted ? 'Recebemos!' : 'Receba seu código de convite'}
              </h2>
              {!submitted && (
                <p className="text-xs text-textMuted mt-0.5">
                  A gente avisa quando abrir vaga pra você.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {submitted ? (
            <SuccessMessage
              title="Tá na lista!"
              body={
                role === 'driver'
                  ? 'A gente vai te chamar em até 2 dias úteis pra apresentar o app e mandar seu código de convite.'
                  : 'Assim que abrir vaga pra mais pais, a gente te avisa e manda seu código de convite.'
              }
              onClose={onClose}
            />
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              {/* Toggle "quem é você" — pré-selecionado pelo botão clicado */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-textMuted mb-2">
                  Você é
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <RoleChip
                    icon={Bus}
                    label="Motorista"
                    active={role === 'driver'}
                    onClick={() => setRole('driver')}
                  />
                  <RoleChip
                    icon={Users}
                    label="Pai ou Mãe"
                    active={role === 'parent'}
                    onClick={() => setRole('parent')}
                  />
                </div>
              </div>

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

              {role === 'parent' && (
                <Input
                  label="Nome da criança (opcional)"
                  icon={UserIcon}
                  value={form.childName}
                  onChange={setField('childName')}
                />
              )}

              {/* Como conheceu — chips clicáveis pra entender canal de aquisição */}
              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  Como conheceu a gente?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {HEARD_FROM_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          heardFrom:
                            p.heardFrom === opt.value ? '' : opt.value,
                        }))
                      }
                      className={`tap h-9 px-3 rounded-full text-sm font-semibold border transition-colors ${
                        form.heardFrom === opt.value
                          ? 'bg-primary text-white border-primary'
                          : 'bg-card text-text border-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  {role === 'driver'
                    ? 'Conte um pouco sobre seu trabalho (opcional)'
                    : 'Já conhece o motorista da sua região? (opcional)'}
                </label>
                <textarea
                  value={form.message}
                  onChange={setField('message')}
                  rows={3}
                  placeholder={
                    role === 'driver'
                      ? 'Quantas crianças você transporta, há quanto tempo...'
                      : 'Nome do motorista, escola da criança...'
                  }
                  className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
                />
              </div>

              <Button type="submit" loading={submitting}>
                Quero receber meu código
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chip do toggle "quem é você". Estilo pílula com ícone + label.
 */
function RoleChip({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-12 rounded-2xl border-2 px-3 inline-flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
        active
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-card border-gray-200 text-text'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
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
