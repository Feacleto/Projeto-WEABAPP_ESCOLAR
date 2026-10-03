import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bus, LogIn, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import Logo from '../components/common/Logo';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
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
 * DESIGN: CABEÇALHO VERDE, CORPO CLARO (03/10/2026)
 * A tampa era quase-preta, com brilho esmeralda e malha andando, porque
 * "quem chega está comprando". O dono revogou essa justificativa: dentro do
 * app não existe tela escura, e a superfície escura ficou só no site
 * (docs/design-system.md). A porta agora é o cabeçalho VERDE com a marca —
 * o mesmo do login e do site —, e o corpo é a areia do app, onde ficam as
 * escolhas. O fundo animado saiu junto: o sistema só permite movimento
 * contínuo no "ao vivo", e nada aqui está ao vivo.
 */
export default function Welcome() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(painelDe(profile), { replace: true });
    }
  }, [loading, profile, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* ── tampa: a marca ── */}
      <header className="relative overflow-hidden rounded-b-3xl bg-primary px-6 pb-7 pt-5 text-white">
        <div className="relative">
          {/* Volta pro site institucional, que é OUTRO domínio — por isso <a> e
            * não <Link>. Ver SITE_INSTITUCIONAL em config/vitrine.js. */}
          <a
            href={SITE_INSTITUCIONAL}
            className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-primaryChip hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar
          </a>

          <div className="mt-3 text-center">
            <a
              href={SITE_INSTITUCIONAL}
              aria-label="Conhecer o Alô Buzinou"
              className="tap inline-block"
            >
              <Logo variant="stacked" tone="onDark" height={92} className="mx-auto" />
            </a>
            <p className="rotulo mt-4 text-menta">
              primeira vez aqui
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              Quem é você?
            </h1>
            <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-primaryChip">
              É a única vez que perguntamos. Depois que sua conta existe, o app
              te reconhece pelo login.
            </p>
          </div>

          <div className="mt-5">
            <ArtRoad />
          </div>
        </div>
      </header>

      {/* ── corpo: as escolhas ── */}
      <main className="flex flex-1 flex-col gap-3 px-6 py-6">
        <RoleCard
          tone="indigo"
          icon={Users}
          title="Sou pai ou mãe"
          detail="Recebi (ou vou receber) o convite do motorista"
          onClick={() => navigate('/first-access')}
        />
        {/* /welcome é A tela que pergunta o papel — é a única onde as duas
          * portas DEVEM aparecer juntas, porque quem chega aqui pediu pra
          * escolher. Ela só é alcançada por link antigo e pelo caminho de
          * quem ainda não existe no banco. */}
        <RoleCard
          tone="emerald"
          icon={Bus}
          title="Sou motorista escolar"
          detail="Quero ser associado e usar o app na minha rota"
          onClick={() => navigate('/quero-fazer-parte')}
        />

        <div className="rounded-2xl bg-card p-4 shadow-rest">
          <p className="text-sm font-bold text-text">Como o app te reconhece</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-textBody">
            <li>
              <span className="font-semibold text-text">Responsável:</span> a
              conta se cria pelo link que o motorista manda — o filho já vem
              vinculado.
            </li>
            <li>
              {/* Dizia "a vaga é limitada, você entra na fila": deixou de ser
                * verdade em 06/09/2026, quando a entrada virou autoatendimento, e
                * escassez que não existe é propaganda enganosa (CDC art. 37). */}
              <span className="font-semibold text-text">Motorista:</span> você
              mesmo cria a conta, com e-mail, WhatsApp e senha, e já começa a
              usar.
            </li>
          </ul>
        </div>

        {/* Quem já tem conta é a maioria de quem chega aqui — o botão é
          * discreto no visual, mas é o primeiro que faz sentido apertar. */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="tap mt-1 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-bold text-text hover:bg-sunken"
        >
          <LogIn size={18} />
          Já tenho conta
          <ArrowRight size={16} />
        </button>
      </main>

      <footer className="px-6 pb-6 text-center">
        <div className="flex items-center justify-center gap-3 text-xs text-textMuted">
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
