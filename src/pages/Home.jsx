import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  Bus,
  ArrowRight,
  MapPin,
  Users,
  Star,
  Wallet,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Button from '../components/common/Button';
import Reveal from '../components/common/Reveal';
import { functions } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import {
  listPublicTestimonials,
  getPublicRatingStats,
} from '../services/feedbackService';
import { APP_VERSION } from '../version';

/**
 * Home pública do Alô Buzinou — a porta da rua.
 *
 * A QUEM ELA FALA, NESTA ORDEM
 * 1. O responsável que recebeu o link e quer entender onde está entrando.
 * 2. O motorista de perua que ouviu falar e quer o app pra ele.
 *
 * DECISÕES DE CREDIBILIDADE
 * Todo número aqui vem do banco: famílias atendidas, motoristas parceiros,
 * nota média e depoimentos reais de quem usa. Nada de "+1000 clientes" ou
 * selo inventado — com um parceiro e dezoito famílias, a honestidade é o
 * argumento mais forte que existe. Quando os números crescerem, a mesma tela
 * cresce com eles, sem retoque.
 *
 * A vitrine de motoristas já é uma LISTA, mesmo com um parceiro só: quando o
 * segundo entrar, a tela não muda de forma — ganha um cartão.
 */
export default function Home() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const [showcase, setShowcase] = useState(null);
  const [testimonials, setTestimonials] = useState([]);
  const [rating, setRating] = useState(null);

  // Quem já tem sessão não precisa de vitrine — vai direto pro painel.
  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(profile.role === 'admin' ? '/tio' : '/pai', { replace: true });
    }
  }, [loading, profile, navigate]);

  useEffect(() => {
    let alive = true;
    httpsCallable(functions, 'getShowcase')()
      .then((res) => alive && setShowcase(res.data))
      .catch(() => alive && setShowcase({ drivers: [] }));

    // Depoimentos e nota são públicos por regra (só os que autorizaram).
    listPublicTestimonials(6).then((list) => alive && setTestimonials(list));
    getPublicRatingStats().then((s) => alive && setRating(s));
    return () => {
      alive = false;
    };
  }, []);

  const driver = showcase?.drivers?.[0] || null;
  const families = driver?.families || 0;

  return (
    <div className="min-h-screen bg-bg">
      {/* ───────────── HERO ─────────────
        * Fundo quase-preto com brilho esmeralda, e não gradiente verde chapado.
        * Escuro lê como "produto de tecnologia"; verde institucional lê como
        * folheto de prefeitura. A cor da marca aparece como LUZ, não como
        * preenchimento. */}
      <header className="relative overflow-hidden bg-[#0B1210] text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(120% 80% at 15% 0%, rgba(31,95,63,.55) 0%, rgba(11,18,16,0) 60%), radial-gradient(90% 60% at 100% 20%, rgba(82,196,26,.22) 0%, rgba(11,18,16,0) 55%)',
          }}
        />
        {/* Malha sutil: dá textura de interface sem virar padrão decorativo. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative px-6 pt-10 pb-12">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
              <Bus size={18} />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Alô Buzinou
            </span>
          </div>

          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">
            transporte escolar · tempo real
          </p>

          <h1 className="mt-3 text-[2rem] leading-[1.1] font-extrabold tracking-tight">
            O transporte do seu filho{' '}
            <span className="text-emerald-300">deixa de ser um mistério</span>.
          </h1>

          <p className="mt-4 text-white/70 leading-relaxed">
            Onde a perua está agora, o que o motorista avisou e a mensalidade em
            dia — num lugar só, sem grupo de WhatsApp e sem planilha.
          </p>

          <div className="mt-7 space-y-2.5">
            <Button
              onClick={() => navigate('/login')}
              className="!bg-white !text-[#0B1210] hover:!bg-emerald-50 shadow-xl shadow-emerald-900/30 !font-bold"
            >
              Entrar
              <ArrowRight size={18} />
            </Button>
            <button
              type="button"
              onClick={() => navigate('/quero-fazer-parte')}
              className="tap w-full h-12 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-semibold"
            >
              Sou motorista de perua
            </button>
          </div>

          {/* Prova social imediata, com número de verdade. Se ainda não há
            * dados, o bloco não aparece — melhor silêncio que placeholder. */}
          {(families > 0 || rating?.count > 0) && (
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-6">
              {families > 0 && (
                <Metric
                  value={families}
                  label={families === 1 ? 'família atendida' : 'famílias atendidas'}
                />
              )}
              {rating?.count > 0 && (
                <Metric
                  value={rating.average.toFixed(1).replace('.', ',')}
                  label={`de nota · ${rating.count} ${rating.count === 1 ? 'avaliação' : 'avaliações'}`}
                  icon={Star}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* ───────────── O QUE O APP FAZ ───────────── */}
      <section className="px-6 py-10 space-y-4">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-textMuted">
            o que você acompanha
          </p>
          <h2 className="text-xl font-extrabold text-text tracking-tight mt-1">
            Três perguntas, sempre respondidas
          </h2>
        </Reveal>

        <div className="space-y-3">
          <Reveal delay={60}>
            <Capability
              icon={MapPin}
              title="Onde meu filho está agora"
              detail="Status da rota em tempo real e aviso quando a perua estiver chegando. Quando o app não tem certeza, ele diz que não tem — nunca inventa."
            />
          </Reveal>
          <Reveal delay={120}>
            <Capability
              icon={Wallet}
              title="A mensalidade está em dia?"
              detail="PIX copia-e-cola com o valor certo, comprovante anexado no próprio app e histórico mês a mês. Sem print perdido na conversa."
            />
          </Reveal>
          <Reveal delay={180}>
            <Capability
              icon={MessageSquare}
              title="O que o motorista avisou"
              detail="Recados, faltas e mudanças de rota chegam no celular — inclusive com o app fechado."
            />
          </Reveal>
        </div>
      </section>

      {/* ───────────── COMO FUNCIONA ─────────────
        * Numerado porque É uma sequência: o pai não escolhe a ordem. */}
      <section className="px-6 pb-10">
        <Reveal className="bg-card border border-gray-200 rounded-3xl p-6 space-y-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-textMuted">
              começar leva um minuto
            </p>
            <h2 className="text-xl font-extrabold text-text tracking-tight mt-1">
              Sem cadastro, sem código
            </h2>
          </div>

          <ol className="space-y-4">
            <Step n="1" title="O motorista te manda um link">
              Pelo WhatsApp, como ele já faz com tudo.
            </Step>
            <Step n="2" title="Você abre e já vê seu filho">
              Nome, mensalidade e recados aparecem antes de qualquer cadastro.
            </Step>
            <Step n="3" title="Um toque com o Google e pronto">
              Nada pra digitar. O mesmo link vira seu atalho pro app.
            </Step>
          </ol>
        </Reveal>
      </section>

      {/* ───────────── QUEM JÁ USA ───────────── */}
      <section className="px-6 pb-10 space-y-3">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-textMuted">
            motoristas parceiros
          </p>
        </Reveal>

        {driver ? (
          <Reveal delay={60}>
            <article className="bg-card border border-gray-200 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                {driver.photoURL ? (
                  <img
                    src={driver.photoURL}
                    alt=""
                    className="w-14 h-14 rounded-2xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-primary text-white flex items-center justify-center shrink-0">
                    <Bus size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-text truncate tracking-tight">
                    {driver.name}
                  </h3>
                  <p className="text-xs text-textMuted flex items-center gap-2 mt-0.5">
                    {driver.city && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin size={11} />
                        {driver.city}
                      </span>
                    )}
                    {driver.families > 0 && (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Users size={11} />
                        {driver.families}{' '}
                        {driver.families === 1 ? 'família' : 'famílias'}
                      </span>
                    )}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ativo
                </span>
              </div>
              <p className="text-xs text-textMuted leading-relaxed border-t border-gray-100 pt-3">
                Já é cliente dele? Peça o link de convite — sua conta se cria por
                ali, sem código pra digitar.
              </p>
            </article>
          </Reveal>
        ) : (
          <div className="bg-card border border-dashed border-gray-300 rounded-3xl p-5 text-center">
            <p className="text-sm text-textMuted">
              Estamos começando. Os primeiros motoristas parceiros aparecem aqui.
            </p>
          </div>
        )}
      </section>

      {/* ───────────── DEPOIMENTOS ─────────────
        * Só aparece com depoimento real e autorizado. Sem estoque de frase
        * genérica esperando alguém preencher. */}
      {testimonials.length > 0 && (
        <section className="pb-10 space-y-3">
          <Reveal className="px-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-textMuted">
              quem usa
            </p>
          </Reveal>
          <div className="flex gap-3 overflow-x-auto px-6 pb-2 snap-x">
            {testimonials.map((t, i) => (
              <article
                key={i}
                className="snap-start shrink-0 w-[17rem] bg-card border border-gray-200 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      size={13}
                      className={
                        s < t.rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-200 fill-gray-200'
                      }
                    />
                  ))}
                </div>
                <p className="text-sm text-text leading-snug">“{t.comment}”</p>
                <p className="text-xs font-semibold text-textMuted">
                  {t.firstName}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── PORTA DO MOTORISTA ───────────── */}
      <section className="px-6 pb-12">
        <Reveal className="relative overflow-hidden rounded-3xl bg-[#0B1210] text-white p-6">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(100% 80% at 100% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 60%)',
            }}
          />
          <div className="relative space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
              <Sparkles size={12} />
              vagas por convite
            </span>
            <h2 className="text-xl font-extrabold tracking-tight leading-tight">
              Você roda com perua escolar?
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Abrimos vaga aos poucos porque acompanhamos cada parceiro de perto
              no começo — dá pra ajustar o app junto com quem usa.
            </p>
            <button
              type="button"
              onClick={() => navigate('/quero-fazer-parte')}
              className="tap w-full h-12 rounded-xl bg-white text-[#0B1210] text-sm font-bold inline-flex items-center justify-center gap-2 mt-1"
            >
              Entrar na lista
              <ArrowRight size={16} />
            </button>
            <p className="text-[11px] text-white/50 text-center">
              Sem cobrança e sem compromisso.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ───────────── RODAPÉ ───────────── */}
      <footer className="px-6 py-8 border-t border-gray-200 space-y-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-textMuted leading-relaxed">
            Dados de criança são tratados conforme a LGPD. Endereço e localização
            só aparecem pra quem tem vínculo com a criança.
          </p>
        </div>

        <div className="text-center space-y-2 pt-2">
          <p className="text-xs text-textMuted">
            Desenvolvido por{' '}
            <span className="font-semibold text-text">Felipe Anacleto</span>
          </p>
          <div className="text-[11px] text-textMuted flex items-center justify-center gap-3">
            <Link to="/termos" className="hover:underline">
              Termos de Uso
            </Link>
            <span aria-hidden>·</span>
            <Link to="/privacidade" className="hover:underline">
              Privacidade
            </Link>
            <span aria-hidden>·</span>
            <Link to="/conheca" className="hover:underline">
              Por dentro
            </Link>
          </div>
          <p className="font-mono text-[10px] text-textMuted/70">
            v{APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── peças ─────────────── */

function Metric({ value, label, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums inline-flex items-center gap-1">
        {Icon && <Icon size={16} className="text-amber-400 fill-amber-400" />}
        {value}
      </p>
      <p className="text-[11px] text-white/50 leading-tight">{label}</p>
    </div>
  );
}

function Capability({ icon: Icon, title, detail }) {
  return (
    <article className="bg-card border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-text leading-tight tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-textMuted mt-1 leading-relaxed">{detail}</p>
      </div>
    </article>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="font-mono text-xs font-bold text-primary bg-primary/10 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted mt-0.5 leading-relaxed">
          {children}
        </p>
      </div>
    </li>
  );
}
