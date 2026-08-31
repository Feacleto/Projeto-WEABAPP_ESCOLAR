import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { destinoAposSair } from '../dominio/vitrine/frentes';
import Logo from '../components/common/Logo';

/**
 * A SALA DE ESPERA DO MOTORISTA INSCRITO.
 *
 * A inscrição na lista de associados É o cadastro: quem preenche sai com conta
 * criada e entra aqui. O que falta é a aprovação do dono, que é negociada
 * fora do sistema — por isso a tela não é um "aguarde" mudo, é uma porta pra
 * conversa.
 *
 * POR QUE O APP APARECE ATRÁS, DESFOCADO
 * Ele acabou de se cadastrar; mostrar uma tela de recusa seria estranho, e
 * mostrar o app funcionando seria mentira. O desfoque diz a verdade que
 * importa: existe um produto aqui, ele está do lado de dentro da porta, e o
 * que separa é uma aprovação — não um pagamento nem um teste.
 *
 * O QUE NÃO TEM AQUI, E É DECISÃO
 * Nenhum contador regressivo, nenhum "faltam X dias", nenhuma vaga se
 * esgotando. A posição na fila é um número REAL — quantos se inscreveram
 * antes dele — e é a única escassez que a tela mostra, porque é a única que
 * existe. Prazo inventado é o truque que um motorista reconhece de longe, e
 * quem está decidindo confiar o próprio negócio a uma plataforma repara.
 *
 * O DESFOQUE NÃO É SEGURANÇA
 * Ele é linguagem. Quem garante que o inscrito não alcança nada são as regras
 * do Firestore: `role: 'aguardando'` não passa em `isAdmin()`, não passa em
 * `isOwner()`, e foi excluído de `isAppUser()`. Mesmo que alguém abrisse o
 * console do navegador e removesse este componente, não havia dado atrás dele.
 */

/** WhatsApp de quem negocia a associação. */
const WHATSAPP_CONSULTOR = '5511999999999';

/** De quanto em quanto tempo a tela pergunta se já foi aprovado. */
const INTERVALO_MS = 30_000;

export default function Aguardando() {
  const { profile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saindo, setSaindo] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  /**
   * ESTA TELA PERGUNTA SOZINHA SE JÁ FOI APROVADO.
   *
   * O perfil só era buscado quando a sessão iniciava (`onAuthStateChanged`).
   * Na prática isso funcionava — o motorista fecha e abre o app pra conferir,
   * e cada abertura traz o papel novo. Mas é justamente o comportamento que a
   * gente quer evitar: alguém checando de hora em hora, sem saber se checou
   * cedo demais.
   *
   * Três gatilhos, e cada um cobre um jeito de esperar:
   *   - ao voltar pra aba (`visibilitychange`), que é o gesto de quem deixou
   *     aberto e foi fazer outra coisa;
   *   - a cada 30s enquanto a tela está VISÍVEL — parado com o app aberto,
   *     esperando, que é o caso mais provável logo depois do cadastro;
   *   - no botão, porque quem espera precisa de algo pra fazer. Dar uma ação
   *     a quem está ansioso vale mais que a ação em si.
   *
   * O intervalo só roda com a aba visível de propósito: 30s num app em
   * segundo plano é bateria e leitura gastas com ninguém olhando.
   */
  useEffect(() => {
    if (profile?.role === 'admin') {
      navigate('/tio', { replace: true });
      return undefined;
    }

    const conferir = () => {
      if (document.visibilityState === 'visible') refreshProfile();
    };

    const id = setInterval(conferir, INTERVALO_MS);
    document.addEventListener('visibilitychange', conferir);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', conferir);
    };
  }, [profile?.role, navigate, refreshProfile]);

  const conferirAgora = async () => {
    setConferindo(true);
    try {
      const atualizado = await refreshProfile();
      // Só avisa quando a resposta é "ainda não". O "sim" não precisa de
      // aviso: a tela troca pro painel sozinha, e isso já é a resposta.
      if (atualizado?.role !== 'admin') {
        toast('Ainda em análise. A gente te avisa assim que liberar.');
      }
    } finally {
      setConferindo(false);
    }
  };

  const posicao = profile?.posicaoNaFila;
  const primeiroNome = String(profile?.name || '').trim().split(/\s+/)[0];

  const sair = async () => {
    setSaindo(true);
    const destino = destinoAposSair(profile?.role);
    await logout();
    navigate(destino, { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-primaryDark text-white">
      {/* ── o app, desfocado ──────────────────────────────────────────────
        * Não é o app de verdade renderizado por baixo: é uma silhueta das
        * formas dele. Renderizar o app real exigiria dados que ele não tem
        * (e não deve ter), e as consultas voltariam negadas — desfoque em
        * cima de erro não é vitrine, é defeito escondido. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none blur-[6px]">
        <div className="mx-auto w-full max-w-mobile px-5 pt-8">
          <div className="h-9 w-40 rounded-lg bg-white/10" />
          <div className="mt-6 h-28 rounded-3xl bg-white/[0.07]" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-white/[0.06]" />
            <div className="h-20 rounded-2xl bg-white/[0.06]" />
          </div>
          <div className="mt-6 h-4 w-32 rounded bg-white/[0.08]" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mt-3 flex gap-3 rounded-2xl bg-white/[0.05] p-4">
              <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-2/3 rounded bg-white/10" />
                <div className="h-2.5 w-1/3 rounded bg-white/[0.07]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden className="absolute inset-0 bg-primaryDark/55" />

      {/* ── o cartão, nítido ─────────────────────────────────────────────── */}
      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[26rem] rounded-3xl border border-white/12 bg-white/[0.07] p-7 shadow-float backdrop-blur-xl">
          <Logo tone="onDark" height={24} />

          <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
            sua inscrição foi recebida
          </p>

          {posicao ? (
            <>
              <h1 className="mt-3 text-[2.1rem] font-extrabold leading-none tracking-tight">
                Você é o {posicao}
                <span className="text-ouro">º</span> da fila
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                {primeiroNome ? `${primeiroNome}, sua` : 'Sua'} conta já existe.
                Ela abre assim que a associação for aprovada — e quem aprova
                conversa com você antes.
              </p>
            </>
          ) : (
            // Sem número não inventamos um. A conta existe e a fila também;
            // o que falta é um dado, e fingir seria a única coisa pior.
            <>
              <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight">
                Você está na fila
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                {primeiroNome ? `${primeiroNome}, sua` : 'Sua'} conta já existe.
                Ela abre assim que a associação for aprovada.
              </p>
            </>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ouro" />
            <p className="text-[13.5px] leading-relaxed text-white/65">
              A aprovação não é automática de propósito: cada associado é
              conversado, porque a plataforma responde pelas famílias que ele
              transporta.
            </p>
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_CONSULTOR}?text=${encodeURIComponent(
              'Olá! Me inscrevi na lista de associados do Alô Buzinou e queria conversar sobre a aprovação.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-primaryDark shadow-float"
          >
            <MessageCircle size={19} />
            Pedir ajuda a um consultor
          </a>

          <button
            type="button"
            onClick={conferirAgora}
            disabled={conferindo}
            className="tap mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] text-[13.5px] font-semibold text-white/75 disabled:opacity-50"
          >
            <RefreshCw size={15} className={conferindo ? 'animate-spin' : undefined} />
            {conferindo ? 'Conferindo…' : 'Já fui aprovado?'}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-white/40">
            <Clock size={13} />
            A tela abre sozinha quando liberarem.
          </p>

          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="tap mt-6 flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-white/45 hover:text-white/70 disabled:opacity-50"
          >
            <LogOut size={14} />
            {saindo ? 'Saindo…' : 'Sair da conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
