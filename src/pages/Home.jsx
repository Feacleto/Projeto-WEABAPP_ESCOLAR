import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Bus, ArrowRight, MapPin, Users, Star } from 'lucide-react';
import Button from '../components/common/Button';
import Skeleton from '../components/common/Skeleton';
import { functions } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { APP_VERSION } from '../version';

/**
 * Home pública do Alô Buzinou — a porta da rua.
 *
 * Estrutura pensada pra escalar sem redesenho: a vitrine de motoristas já
 * é uma LISTA, mesmo tendo hoje um único parceiro. Quando o segundo entrar,
 * a tela não muda — só ganha um cartão.
 *
 * Os dados da vitrine vêm da Cloud Function `getShowcase`, porque as rules
 * exigem login pra ler `users` e esta tela é pra quem ainda não entrou.
 */
export default function Home() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [showcase, setShowcase] = useState(null);

  // Quem já tem sessão não precisa da vitrine — vai direto pro painel.
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
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <header className="bg-gradient-to-br from-emerald-600 via-primary to-primaryDark text-white px-6 pt-10 pb-8">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 border border-white/25 rounded-full px-3 py-1">
          <Bus size={13} />
          Alô Buzinou
        </span>
        <h1 className="text-3xl font-extrabold leading-tight mt-4">
          A perua escolar do seu filho, no seu celular.
        </h1>
        <p className="text-white/85 mt-3 leading-relaxed">
          Onde a criança está agora, o que o motorista avisou e a mensalidade
          em dia — num lugar só.
        </p>
        <div className="mt-6">
          <Button
            onClick={() => navigate('/login')}
            className="!bg-white !text-primary hover:!bg-emerald-50 shadow-lg shadow-emerald-900/25"
          >
            Entrar
            <ArrowRight size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 py-7 space-y-7">
        {/* Vitrine */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-textMuted">
            Motoristas parceiros
          </h2>

          {showcase === null && <Skeleton className="h-32 rounded-2xl" />}

          {showcase?.drivers?.length === 0 && (
            <div className="bg-card border border-gray-200 rounded-2xl p-5 text-center">
              <p className="text-sm text-textMuted">
                Estamos começando. Em breve os primeiros motoristas parceiros
                aparecem aqui.
              </p>
            </div>
          )}

          {showcase?.drivers?.map((d) => (
            <article
              key={d.name}
              className="bg-card border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {d.photoURL ? (
                  <img
                    src={d.photoURL}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-primary text-white flex items-center justify-center shrink-0">
                    <Bus size={22} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-text truncate leading-tight">
                    {d.name}
                  </h3>
                  <p className="text-xs text-textMuted flex items-center gap-2 mt-0.5">
                    {d.city && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin size={11} />
                        {d.city}
                      </span>
                    )}
                    {d.families > 0 && (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Users size={11} />
                        {d.families}{' '}
                        {d.families === 1 ? 'família' : 'famílias'}
                      </span>
                    )}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                  <Star size={10} fill="currentColor" />
                  ativo
                </span>
              </div>
              <p className="text-xs text-textMuted leading-relaxed">
                Já é cliente? Peça o link de convite pro motorista — sua conta
                se cria por ali, sem código pra digitar.
              </p>
            </article>
          ))}
        </section>

        {/* Porta dos motoristas */}
        <section className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
            <p className="text-sm font-bold text-text">
              Você é motorista de perua?
            </p>
            <p className="text-xs text-emerald-900/75 leading-relaxed">
              As vagas abrem por convite, aos poucos — acompanhamos cada
              parceiro de perto no começo.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/quero-fazer-parte')}>
            Quero fazer parte
          </Button>
          <Link
            to="/conheca"
            className="block text-center text-sm font-semibold text-primary py-1"
          >
            Ver como funciona por dentro →
          </Link>
        </section>
      </main>

      <footer className="px-6 py-6 border-t border-gray-200 text-center space-y-2">
        <p className="text-xs text-textMuted">
          Feito por{' '}
          <span className="font-semibold text-text">Felipe Anacleto</span>
        </p>
        <div className="text-[11px] text-textMuted flex items-center justify-center gap-3">
          <Link to="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
        </div>
        <p className="text-[10px] text-textMuted">v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
