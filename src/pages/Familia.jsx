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
  Users,
} from 'lucide-react';
import { functions } from '../firebase/config';
import { comPiso } from '../config/vitrine';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../utils/papeis';
import Logo from '../components/common/Logo';
import Spinner from '../components/common/Spinner';
import LoginSheet from '../components/landing/LoginSheet';
import { FRENTE_FAMILIA, lembrarFrente } from '../utils/frentes';

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
 * motorista — nada disso. E principalmente: NENHUMA ESCASSEZ. Sem prazo, sem
 * "últimas vagas", sem nada que sugira que o lugar do filho dele pode acabar.
 * Na home do motorista a escassez constrói credibilidade; aqui ela produz
 * medo sobre a vaga de uma criança.
 *
 * O registro é TRANQUILIDADE, não oportunidade. Frase curta, verbo no
 * presente, nada de superlativo.
 *
 * A EXCEÇÃO: O CONTADOR DE RESPONSÁVEIS (29/08/2026)
 * Esta regra dizia "sem contador", e valia pra qualquer número. O que faltava
 * era separar ESCASSEZ de PROVA SOCIAL, que não fazem a mesma coisa com quem
 * lê: "restam 2 vagas" assusta o pai porque fala da vaga DELE; "N responsáveis
 * usam" não fala da vaga de ninguém — diz que ele está no lugar certo, que é
 * a mesma tranquilidade que o resto da página persegue.
 *
 * O que continua proibido é número COM PRAZO ou COM LIMITE. Contador que sobe
 * é registro; contador que desce é ameaça, e ameaça aqui é sobre uma criança.
 *
 * O número tem piso — ver [src/config/vitrine.js](../config/vitrine.js), que
 * é onde a decisão está escrita e onde ela se desfaz.
 *
 * O QUE ENTRA, NESTA ORDEM
 *   1. Reconhecimento — a marca do motorista, não a da plataforma. A primeira
 *      linha diz que a perua do filho dele fica aqui. Fecha com o contador,
 *      que é prova ANTES do pedido, do mesmo jeito que a home do motorista faz.
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
  const [vitrine, setVitrine] = useState(null);

  // Quem já tem sessão não precisa de porta — vai direto pro painel dele.
  // Inclui o motorista que caiu aqui por engano: ele vai pro /tio, não fica
  // lendo uma página escrita pra outra pessoa.
  // ESTA É A PORTA DELE — e o atalho instalado precisa saber disso.
  //
  // O manifesto do PWA tem um `start_url` só, `/`. O responsável instala daqui
  // e o atalho abre na página que vende associação: com sessão a home o
  // reencaminha, sem sessão ele fica lá. Registrar a porta na chegada resolve
  // o caso sem classificar ninguém — `/` continua sendo `/` pra quem digitar.
  useEffect(() => {
    lembrarFrente(FRENTE_FAMILIA);
  }, []);

  useEffect(() => {
    if (!loading && profile?.role) {
      navigate(painelDe(profile), { replace: true });
    }
  }, [loading, profile, navigate]);

  // A vitrine é a mesma que a home do motorista usa, e traz duas coisas pra cá:
  // o nome do motorista (o reconhecimento da primeira linha — "a perua do Tio
  // Nino" diz muito mais a ele que "Alô Buzinou") e a contagem de responsáveis.
  //
  // Guardamos a RESPOSTA INTEIRA, não só o motorista. Extrair um pedaço aqui
  // foi o que fez a contagem precisar de uma segunda chamada quando ela
  // chegou; a resposta inteira no estado deixa o próximo dado ser só uma
  // linha de leitura.
  //
  // Falhar aqui não pode quebrar a porta: sem a vitrine, a página cai no texto
  // genérico, esconde o contador, e continua deixando ele entrar — que é a
  // única coisa que esta página precisa fazer.
  useEffect(() => {
    let vivo = true;
    httpsCallable(functions, 'getShowcase')()
      .then((res) => vivo && setVitrine(res.data || null))
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

  const nomeMotorista = vitrine?.drivers?.[0]?.driverFirstName;

  // RESPONSÁVEIS COM CONTA — não é o número de famílias, e confundir os dois
  // faz esta tela e a home do motorista se contradizerem na frente de quem
  // abrir as duas.
  //
  // `families` (na home) conta CRIANÇA ativa. Este conta GENTE com login. O
  // segundo é sempre menor, por duas razões que o app tem de propósito: a mãe
  // de dois irmãos é UM responsável com DUAS crianças (`childIds`), e criança
  // cadastrada pelo motorista existe antes do pai resgatar o convite.
  //
  // `comPiso` devolve null quando a vitrine não respondeu — e é assim que o
  // contador some em vez de inventar número com o backend fora do ar.
  const responsaveis = comPiso(vitrine ? vitrine.responsaveis : null);

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

          {/* O contador. Quieto de propósito: uma linha, sem número gigante e
            * sem animação de contagem.
            *
            * A home do motorista anima o dela (`useCountUp`) porque lá o
            * número é ARGUMENTO — ele precisa ser notado por quem está
            * decidindo se compra. Aqui ele é só companhia pra quem já é
            * cliente e só quer entrar. Um número saltando na cara de quem veio
            * ver a mensalidade do filho é a página tentando vender algo que
            * ela não tem pra vender.
            *
            * Sem vitrine, não aparece nada — nem a linha, nem o traço. */}
          {responsaveis !== null && (
            <p className="mt-5 flex items-center gap-2.5 border-t border-white/10 pt-4 text-[13px] leading-snug text-white/55">
              <Users size={15} className="shrink-0 text-secondary" />
              <span>
                <strong className="font-bold tabular-nums text-white/85">
                  {responsaveis}
                </strong>{' '}
                responsáveis acompanham a perua do filho por aqui.
              </span>
            </p>
          )}
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
