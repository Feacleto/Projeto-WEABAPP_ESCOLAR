import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bus, LogIn, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/common/Logo';
import { RoleCard } from '../components/common/Sheet';
import { ArtRoad } from '../components/landing/BlockArt';

/**
 * Primeira vez aqui — a única tela que pergunta "quem é você?".
 *
 * POR QUE ELA SÓ SERVE PRA QUEM NÃO TEM CONTA
 * O papel mora em `users/{uid}.role`. Quem já tem conta não precisa (e não
 * deve) escolher nada: entra, e o app abre a tela dele. Perguntar antes do
 * login era pedir pra pessoa repetir o que o sistema já sabe — e deixava ela
 * errar a porta e achar que a senha estava errada. Por isso "Já tenho conta"
 * é o primeiro botão daqui, e a escolha de papel virou o caminho de quem
 * ainda não existe no banco.
 *
 * E os dois caminhos são de verdade diferentes:
 *   - Responsável entra por CONVITE do motorista (o vínculo com a criança
 *     precisa existir antes da conta).
 *   - Motorista entra pela LISTA DE PARCEIROS — não há autocadastro; cada
 *     parceiro é liberado por nós.
 *
 * DESIGN: TAMPA ESCURA, CORPO CLARO
 * A mesma regra da folha modal (Sheet.jsx). A tampa é o material da home —
 * quase-preto, brilho esmeralda, malha, a estradinha com a van andando — e o
 * corpo é o claro do app, onde ficam as escolhas. Marca em cima, produto
 * embaixo, costura de esmeralda no meio.
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
    <div className="min-h-screen flex flex-col bg-bg">
      {/* ── tampa: a marca ── */}
      <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-6 pb-7 pt-5 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-80 animate-glow-drift"
            style={{
              background:
                'radial-gradient(110% 80% at 10% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60 animate-glow-drift-slow"
            style={{
              background:
                'radial-gradient(90% 70% at 100% 10%, rgba(82,196,26,.2) 0%, rgba(11,18,16,0) 58%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] animate-grid-drift"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        <div className="relative">
          <Link
            to="/"
            className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar
          </Link>

          <div className="mt-3 text-center">
            <Link to="/" aria-label="Conhecer o Alô Buzinou" className="tap inline-block">
              <Logo variant="stacked" tone="onDark" height={92} className="mx-auto" />
            </Link>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">
              primeira vez aqui
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Quem é você?
            </h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-white/65">
              É a única vez que perguntamos. Depois que sua conta existe, o app
              te reconhece pelo login.
            </p>
          </div>

          <div className="mt-5">
            <ArtRoad />
          </div>
        </div>
      </header>

      {/* Costura entre a marca e o produto. */}
      <div
        aria-hidden
        className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary"
      />

      {/* ── corpo: as escolhas ── */}
      <main className="flex flex-1 flex-col gap-3 px-6 py-6">
        <RoleCard
          tone="indigo"
          icon={Users}
          title="Sou pai ou mãe"
          detail="Recebi (ou vou receber) o convite do motorista"
          onClick={() => navigate('/first-access')}
        />
        <RoleCard
          tone="emerald"
          icon={Bus}
          title="Sou motorista escolar"
          detail="Quero ser associado e usar o app na minha rota"
          onClick={() => navigate('/quero-fazer-parte')}
        />

        <div className="rounded-2xl border border-gray-200 bg-card p-4 shadow-sm">
          <p className="text-sm font-bold text-text">Como o app te reconhece</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-textMuted">
            <li>
              <span className="font-semibold text-text">Responsável:</span> a
              conta se cria pelo link que o motorista manda — o filho já vem
              vinculado.
            </li>
            <li>
              <span className="font-semibold text-text">Motorista:</span> a vaga
              de associado é limitada — cada associado gera administração
              financeira e técnica. Você entra na fila e a gente chama.
            </li>
          </ul>
        </div>

        {/* Quem já tem conta é a maioria de quem chega aqui — o botão é
          * discreto no visual, mas é o primeiro que faz sentido apertar. */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="tap mt-1 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-card text-base font-bold text-text hover:bg-gray-50"
        >
          <LogIn size={18} />
          Já tenho conta
          <ArrowRight size={16} />
        </button>
      </main>

      <footer className="px-6 pb-6 text-center">
        <div className="flex items-center justify-center gap-3 text-[11px] text-textMuted">
          <Link to="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
