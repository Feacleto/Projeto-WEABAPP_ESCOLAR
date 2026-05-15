import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Bus, ChevronRight, ArrowLeft, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * Tela de boas-vindas. Pergunta "quem é você?" e direciona pra fluxo
 * adequado: Pai/Mãe vai pra /first-access (login direto OU primeira vez
 * com invite); Motorista vai pra /login direto.
 *
 * Se já tem sessão ativa, redireciona pelo role.
 */
export default function Welcome() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(profile.role === 'admin' ? '/tio' : '/pai', { replace: true });
    }
  }, [loading, profile, navigate]);

  return (
    <div className="min-h-screen flex flex-col px-5 py-6 relative overflow-hidden">
      {/* Decorações de fundo em cinza — van atravessando e estrelas girando.
        * z-0 (não -z-10) garante que ficam acima do bg-bg mas abaixo dos
        * elementos com z-10/posicionamento relativo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-x-0 top-24 animate-van-drive">
          <Bus
            size={96}
            strokeWidth={1.3}
            className="text-gray-300 mx-auto opacity-70"
          />
        </div>
        <div className="absolute top-32 left-6 animate-celebrate opacity-80">
          <Star
            size={40}
            strokeWidth={1.4}
            fill="currentColor"
            className="text-gray-300"
          />
        </div>
        <div
          className="absolute bottom-32 right-6 animate-celebrate opacity-80"
          style={{ animationDelay: '1.5s' }}
        >
          <Star
            size={32}
            strokeWidth={1.4}
            fill="currentColor"
            className="text-gray-300"
          />
        </div>
        <div className="absolute bottom-48 left-8 animate-house-rest opacity-70">
          <Star
            size={24}
            strokeWidth={1.4}
            fill="currentColor"
            className="text-gray-400"
          />
        </div>
        <div
          className="absolute top-60 right-10 animate-house-rest opacity-70"
          style={{ animationDelay: '0.7s' }}
        >
          <Star
            size={18}
            strokeWidth={1.4}
            fill="currentColor"
            className="text-gray-400"
          />
        </div>
      </div>

      {/* Voltar pra landing — quem entra aqui sem querer pode recuar */}
      <Link
        to="/conheca"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-2 tap self-start p-1 -ml-1 relative"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      {/* Logo clicável — leva pra landing pública (pra quem tá curioso) */}
      <div className="text-center mb-6 relative z-10">
        <Link
          to="/conheca"
          aria-label="Conhecer o Alô Buzinou"
          className="tap inline-block"
        >
          <img
            src="/logo.png"
            alt="Tio Nino Digital"
            className="w-24 h-24 mx-auto mb-3 rounded-full object-cover bg-white shadow-md ring-2 ring-emerald-200"
          />
        </Link>
        <h1 className="text-2xl font-bold text-text">Bem-vindo!</h1>
        <p className="text-sm text-textMuted mt-1">
          Para começar, nos diga quem é você
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3 max-w-md mx-auto w-full relative z-10">
        {/* Card Pai */}
        <button
          onClick={() => navigate('/first-access')}
          className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-indigo-500/15"
        >
          <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shrink-0 border-2 border-white/30">
                <Users size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold leading-tight">
                  Sou pai ou mãe
                </p>
                <p className="text-sm text-white/80 mt-1">
                  Acompanho meu filho na rota
                </p>
              </div>
              <ChevronRight size={22} className="text-white/80 shrink-0" />
            </div>
          </div>
        </button>

        {/* Card Tio */}
        <button
          onClick={() => navigate('/login')}
          className="tap w-full text-left rounded-3xl overflow-hidden shadow-lg shadow-emerald-500/20"
        >
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border-2 border-white/30">
                <Bus size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold leading-tight">
                  Sou o motorista
                </p>
                <p className="text-sm text-white/80 mt-1">
                  Eu transporto as crianças
                </p>
              </div>
              <ChevronRight size={22} className="text-white/80 shrink-0" />
            </div>
          </div>
        </button>
      </div>

      <div className="pt-4 space-y-3 text-center relative z-10">
        <Link
          to="/conheca"
          className="block text-sm text-primary font-medium hover:underline tap"
        >
          Não tem acesso? Conheça o projeto →
        </Link>
        <div className="text-[11px] text-textMuted flex items-center justify-center gap-3">
          <Link to="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
