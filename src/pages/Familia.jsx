import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  ArrowRight,
  BellRing,
  CalendarX2,
  FileText,
  Link2,
  MessageCircle,
  Receipt,
} from 'lucide-react';
import { functions } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import Logo from '../components/common/Logo';
import Spinner from '../components/common/Spinner';
import LoginSheet from '../components/landing/LoginSheet';
import { FRENTE_FAMILIA } from '../utils/frentes';

/**
 * A PORTA DA FAMÍLIA — a home do responsável.
 *
 * POR QUE ELA EXISTE SEPARADA DA HOME DO MOTORISTA
 * As duas frentes do produto falam com públicos opostos. A home (`/`) vende
 * associação: taxa, vaga limitada, credibilidade de negócio, depoimento de
 * outro motorista. É a página certa pra quem está decidindo se entra como
 * parceiro.
 *
 * O responsável não está decidindo nada disso. Ele já tem motorista, já tem
 * filho na perua, e chega aqui em um de três estados: saiu da conta, errou a
 * URL, ou perdeu o link do WhatsApp. Nos três, o que ele precisa é ENTRAR —
 * não ser convencido. Mostrar "vaga limitada" pra ele é pior que inútil:
 * sugere que o lugar do filho dele está em risco.
 *
 * O QUE NÃO ENTRA AQUI, E É REGRA
 * Taxa, vaga, roleta, associação, contagem de associados, depoimento de
 * motorista — nada disso. E principalmente: NENHUMA ESCASSEZ. Sem contador,
 * sem prazo, sem "últimas vagas". Na home do motorista a escassez constrói
 * credibilidade; aqui ela produz medo sobre a vaga de uma criança.
 *
 * O registro é TRANQUILIDADE, não oportunidade. Frase curta, verbo no
 * presente, nada de superlativo.
 *
 * O QUE ENTRA, NESTA ORDEM
 *   1. Reconhecimento — a marca do motorista, não a da plataforma. A primeira
 *      linha diz que a perua do filho dele fica aqui.
 *   2. Entrar, grande e primeiro.
 *   3. "Perdi o link" — o modo de falha REAL dele. Ele não decora endereço de
 *      site; ele volta pelo link do WhatsApp. A resposta honesta é que o link
 *      não vence nem se gasta, então pedir de novo resolve.
 *   4. O que tem dentro, como tranquilidade e não como lista de recursos.
 *
 * O MESMO SISTEMA VISUAL DA HOME
 * Fundo escuro, cartão de vidro, mesma marca — porque é o mesmo produto e o
 * responsável precisa reconhecer onde está. O que muda é o que se diz, não
 * como se parece.
 */

/* Cartão de vidro — mesmo material da home, pra ser o mesmo produto. */
const GLASS = 'bg-white/[0.055] border border-white/10 rounded-3xl';

/**
 * O que ele encontra dentro. Quatro, não seis: é o que ele realmente abre o
 * app pra fazer. Cada linha é uma frase, no presente, sem adjetivo.
 */
const DENTRO = [
  {
    Icon: Receipt,
    titulo: 'A mensalidade e o comprovante',
    texto: 'O que está pago, o que está em aberto, e o comprovante de cada mês.',
  },
  {
    Icon: BellRing,
    titulo: 'Os recados do motorista',
    texto: 'Aviso de atraso, de mudança de horário e de dia sem aula.',
  },
  {
    Icon: CalendarX2,
    titulo: 'Avisar que hoje não vai',
    texto: 'Sem depender de alguém ler mensagem no meio da rota.',
  },
  {
    Icon: FileText,
    titulo: 'O contrato',
    texto: 'O que foi combinado, disponível quando você precisar conferir.',
  },
];

export default function Familia() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [loginAberto, setLoginAberto] = useState(false);
  const [motorista, setMotorista] = useState(null);

  // Quem já tem sessão não precisa de porta — vai direto pro painel dele.
  // Inclui o motorista que caiu aqui por engano: ele vai pro /tio, não fica
  // lendo uma página escrita pra outra pessoa.
  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(profile.role === 'admin' ? '/tio' : '/pai', { replace: true });
    }
  }, [loading, profile, navigate]);

  // O nome do motorista vem da mesma vitrine que a home usa. Serve pra o
  // reconhecimento da primeira linha: "a perua do Tio Nino" diz muito mais a
  // ele que "Alô Buzinou".
  //
  // Falhar aqui não pode quebrar a porta: sem o nome, a página cai num texto
  // genérico e continua deixando ele entrar, que é o que importa.
  useEffect(() => {
    let vivo = true;
    httpsCallable(functions, 'getShowcase')()
      .then((res) => vivo && setMotorista(res.data?.drivers?.[0] || null))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-primaryDark flex items-center justify-center">
        <Spinner size={32} className="text-white" />
      </div>
    );
  }

  // Sessão sem doc de usuário (conta recém-criada, ou órfã) — deixa o fluxo
  // normal de login resolver em vez de mostrar a porta pra quem já entrou.
  // Leva a frente junto: sem isso o /login mostra as portas do motorista a
  // quem estava na porta da família.
  if (user && !profile) {
    return (
      <Navigate to="/login" replace state={{ frente: FRENTE_FAMILIA }} />
    );
  }

  const nomeMotorista = motorista?.driverFirstName;

  return (
    <div className="min-h-screen bg-primaryDark text-white">
      <div className="mx-auto w-full max-w-mobile px-5 pb-16 pt-7">
        <header className="flex items-center justify-between">
          <Logo tone="onDark" height={26} />
        </header>

        {/* ── 1. RECONHECIMENTO ────────────────────────────────────────── */}
        <section className="mt-11">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
            área da família
          </p>
          <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.08] tracking-tight text-balance">
            {nomeMotorista ? (
              <>
                A perua do Tio {nomeMotorista}
                <br />
                fica aqui.
              </>
            ) : (
              <>
                A perua do seu filho
                <br />
                fica aqui.
              </>
            )}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Entre para ver a mensalidade, os recados e o contrato. É a mesma
            conta que você criou pelo link do motorista.
          </p>
        </section>

        {/* ── 2. ENTRAR ────────────────────────────────────────────────── */}
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setLoginAberto(true)}
            className="tap flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-primaryDark shadow-lg shadow-black/20"
          >
            Entrar na minha conta
            <ArrowRight size={18} />
          </button>
        </section>

        {/* ── 3. PERDI O LINK — o modo de falha real dele ───────────────── */}
        <section className={`mt-4 ${GLASS} p-5`}>
          <p className="flex items-center gap-2 text-sm font-bold">
            <Link2 size={16} className="text-secondary" />
            Perdeu o link?
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/70">
            Pode pedir de novo sem preocupação: o link do convite não vence e
            não se gasta. É o mesmo link, sempre — e ele abre a sua conta
            direto, sem senha.
          </p>
          {/* SEM BOTÃO DE WHATSAPP AQUI, e é decisão, não falta.
            *
            * Pra ter o botão, `getShowcase` teria que devolver o telefone do
            * motorista — e ela é callable PÚBLICA, que roda sem login.
            * Telefone em endpoint aberto é telefone raspável, e essa mesma
            * função já teve que parar de devolver a foto de perfil dele pelo
            * mesmo motivo.
            *
            * E não faz falta: quem chega aqui recebeu o link pelo WhatsApp do
            * motorista, então já tem o contato. O que ele não tem é a certeza
            * de que pode pedir de novo — e é isso que o texto resolve. */}
          <p className="mt-3 flex items-center gap-2 text-[13px] text-white/50">
            <MessageCircle size={14} className="shrink-0" />
            Chame o motorista no WhatsApp e peça o link de novo.
          </p>
        </section>

        {/* ── 4. O QUE TEM DENTRO — tranquilidade, não recurso ──────────── */}
        <section className="mt-9">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            o que você encontra
          </h2>
          <ul className="mt-4 space-y-3">
            {DENTRO.map(({ Icon, titulo, texto }) => (
              <li key={titulo} className={`${GLASS} flex gap-3.5 p-4`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
                  <Icon size={18} className="text-secondary" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug">{titulo}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                    {texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Não existe pé de página com "seja parceiro" aqui, e é deliberado:
          * o responsável não é público de aquisição. Quem quer conhecer a
          * plataforma chega pela home, que é a porta do motorista. */}
        <p className="mt-10 text-center text-[12px] leading-relaxed text-white/35">
          Alô Buzinou — o transporte escolar do seu filho, organizado.
        </p>
      </div>

      {/* publico="familia" é o que impede a folha de oferecer o cadastro
        * de motorista a quem entrou pela porta do responsável. */}
      <LoginSheet
        open={loginAberto}
        onClose={() => setLoginAberto(false)}
        publico="familia"
      />
    </div>
  );
}
