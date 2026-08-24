import { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  Database,
  Handshake,
  Percent,
  Plus,
  Server,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import useSpeech, { rotuloDaVoz } from '../../hooks/useSpeech';

/**
 * O pitch da parceria — o que o motorista lê ANTES do formulário da lista.
 *
 * POR QUE ISSO EXISTE
 * Pedir dados de alguém sem explicar o que ele está entrando é o começo de
 * uma relação torta. E tem uma coisa específica que precisa ser dita ANTES,
 * não depois: existe uma TAXA. Um motorista que descobre a taxa na terceira
 * conversa se sente enganado; um que leu isso na primeira tela chega pra
 * negociar. A ordem das quatro telas é essa história:
 *
 *   1. somos uma comunidade  →  2. cada associado dá trabalho (administração
 *   financeira e técnica)  →  3. e essa estrutura tem custo fixo, por isso a
 *   vaga é contada  →  4. e por isso existe uma taxa (que a comunidade reduz)
 *
 * A ordem importa: a ADMINISTRAÇÃO vem antes do CUSTO porque é o que o
 * motorista reconhece na própria pele — ele sabe o que dá trabalho no dia a
 * dia dele. Servidor e backup são abstratos; "conferir pagamento e ajustar
 * rota" não é. Explicado o trabalho, o custo fixo deixa de soar como
 * desculpa e passa a soar como consequência.
 *
 * A IA LÊ CADA TELA EM VOZ ALTA
 * O motorista pode estar de pé no ponto, com a criança puxando a mão. Ler
 * não é a única opção: ao entrar, cada tela é narrada (voz do próprio
 * aparelho, custo zero — ver `useSpeech`). Isso muda a régua do texto: cada
 * passo tem que caber em duas frases curtas, porque texto longo lido em voz
 * alta vira sermão. Então o que está escrito é o que é falado, e é por isso
 * que aqui é conciso e corporativo — sem gíria, sem parágrafo, sem enrolação.
 *
 * São DUAS vozes (as duas melhores e mais distinguíveis que o aparelho tem)
 * e dois alvos na pastilha: o alto-falante LIGA E DESLIGA a narração, e o nome
 * da voz troca pra outra recomeçando a frase. As duas escolhas ficam
 * lembradas no aparelho — quem deixou mudo não é surpreendido na próxima
 * visita.
 *
 * O FUNDO É ESCURO DE PROPÓSITO
 * Aqui é a marca falando (mesmo material da home), e o formulário que vem
 * depois é o produto (claro). A troca de superfície marca a troca de
 * assunto: acabou a conversa, começou o cadastro.
 */

const PASSOS = [
  {
    id: 'parceria',
    eyebrow: 'bem-vindo',
    titulo: 'Um app feito pro seu transporte',
    texto:
      'O Alô Buzinou junta rota, recado e mensalidade num lugar só. Foi feito junto com motoristas escolares, no dia a dia deles.',
    Art: ArtParceria,
    // Grave uma locução e aponte aqui (ex: '/pitch/1.mp3') pra usar a voz da
    // marca em vez da voz do aparelho. Sem arquivo, a IA local lê o texto.
    audio: null,
  },
  {
    id: 'administracao',
    eyebrow: 'administração',
    titulo: 'Cada associado gera administração',
    texto:
      'Financeira e técnica: cadastro, conferência de pagamento, suporte e ajuste da sua rota.',
    Art: ArtVagas,
    audio: null,
  },
  {
    id: 'custo',
    eyebrow: 'operação',
    titulo: 'E essa estrutura tem custo fixo',
    texto:
      'Servidor, banco de dados, backup e notificação são pagos todo mês. Por isso a vaga é limitada: abrimos no ritmo que dá pra sustentar.',
    Art: ArtInfra,
    audio: null,
  },
  {
    id: 'taxa',
    eyebrow: 'a taxa, dita agora',
    titulo: 'A taxa de associação sai da mensalidade',
    texto:
      'Um percentual combinado com você, sem valor fixo caindo do céu e sem surpresa depois.',
    Art: ArtTaxa,
    audio: null,
  },
  {
    id: 'roleta',
    eyebrow: 'condição de entrada',
    titulo: 'Seu primeiro acesso começa com meses sem taxa',
    texto:
      'Quando sua vaga abrir, você gira a roleta uma vez: pode sair um, dois ou três meses sem pagar taxa. É sorte, não desconto negociado.',
    Art: ArtRoleta,
    audio: null,
  },
];

/**
 * O passo atual vem DE FORA (indice/onIndice) em vez de morar aqui.
 *
 * Quem desenha o "Voltar" é a folha, no cabeçalho — mesmo lugar em todas as
 * etapas, inclusive no formulário. Pra ela poder recuar um passo do pitch, o
 * passo tem que ser dela; se ficasse aqui dentro, o botão do cabeçalho não
 * teria como mexer nele (ou precisaria de um segundo "voltar", desenhado em
 * outro canto, que é justamente a confusão que o cabeçalho evita).
 */
export default function PartnerPitch({ indice, onIndice, onDone, onSair }) {
  const i = indice;
  const passo = PASSOS[i];
  const Art = passo.Art;
  const ultimo = i === PASSOS.length - 1;

  const {
    speak,
    silenciar,
    falando,
    mudo,
    toggleMudo,
    suportado,
    vozes,
    vozNome,
    alternarVoz,
  } = useSpeech();

  // A tela que entra é lida. Cada avanço é um toque, então a permissão de
  // áudio do navegador já veio junto com o gesto.
  // A tela que entra é lida; sair do pitch (fechar a folha, ir pro
  // formulário, trocar de aba) cala na hora — inclusive no meio da frase.
  useEffect(() => {
    speak(`${passo.titulo}. ${passo.texto}`, { src: passo.audio });
    return silenciar;
  }, [passo, speak, silenciar]);

  // Uma tela atrás; na primeira, sai da sequência — o passo anterior a ela
  // não existe aqui dentro, é a página que estava atrás da folha.
  const voltar = () => {
    if (i > 0) {
      onIndice(i - 1);
    } else {
      silenciar();
      onSair?.();
    }
  };

  const avancar = () => {
    if (ultimo) {
      silenciar();
      onDone();
    } else {
      onIndice(i + 1);
    }
  };

  // Um clique = outra voz, e a frase recomeça na voz nova. Sem lista, sem
  // painel, sem escolher em menu: o botão É a troca.
  const trocarVoz = () => {
    const nome = alternarVoz();
    speak(`${passo.titulo}. ${passo.texto}`, {
      src: passo.audio,
      voiceName: nome,
    });
  };

  // Liga/desliga o som. Ao LIGAR, lê a tela atual na hora: quem tocou no
  // alto-falante quer ouvir agora, não na tela seguinte. Dá certo porque o
  // toggle marca o mudo num ref na mesma hora — o `speak` logo abaixo já
  // enxerga o som ligado, sem esperar o próximo render.
  const alternarSom = () => {
    const estavaMudo = mudo;
    toggleMudo();
    if (estavaMudo) speak(`${passo.titulo}. ${passo.texto}`, { src: passo.audio });
  };

  return (
    // Sangra até as bordas da folha: o pitch TOMA o popup em vez de ser um
    // cartão dentro dele.
    <div className="relative -mx-5 -mb-6 -mt-5 overflow-hidden bg-[#0B1210] px-5 pb-6 pt-12 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-80 animate-glow-drift"
          style={{
            background:
              'radial-gradient(110% 70% at 0% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
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

      {/* CONTROLE DE SOM: DESLIGAR E TROCAR, DOIS TOQUES DIFERENTES
        * Narração que não dá pra desligar é armadilha — o motorista pode
        * estar no ponto com a criança do lado, ou simplesmente não querer o
        * celular falando. Então a pastilha tem DOIS alvos:
        *
        *   [ 🔊 ]  liga e desliga a narração (a escolha fica no aparelho)
        *   [ GOOGLE · trocar ]  passa pra outra voz e recomeça a frase
        *
        * Ligar o som LÊ A TELA ATUAL na hora: quem toca em "som" quer ouvir
        * agora, não na próxima tela. E o alvo do mudo não depende da lista de
        * vozes ter carregado — senão quem deixou mudo na visita anterior
        * abriria a folha sem ter como religar.
        *
        * As barrinhas animam enquanto a voz fala: é o que diz que o som está
        * vindo DAQUI, e não de outra aba. */}
      {suportado && (
        <div className="absolute right-4 top-4 z-20 inline-flex items-center overflow-hidden rounded-full border border-white/15 bg-white/[0.08] text-[10px] font-bold uppercase tracking-wider text-white/75">
          <button
            type="button"
            onClick={alternarSom}
            aria-pressed={!mudo}
            aria-label={mudo ? 'Ligar a narração' : 'Desligar a narração'}
            className="tap inline-flex items-center gap-1.5 px-3 py-1.5"
          >
            {mudo ? (
              <VolumeX size={13} className="text-white/50" />
            ) : (
              <Volume2 size={13} className="text-emerald-300" />
            )}
            {mudo && <span className="text-white/50">som off</span>}
            {!mudo && falando && (
              <span className="inline-flex items-end gap-[2px]" aria-hidden>
                {[0, 160, 320].map((d) => (
                  <span
                    key={d}
                    className="art-typing block w-[2px] rounded-full bg-emerald-300"
                    style={{ height: 8, animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            )}
          </button>

          {!mudo && vozes.length > 1 && (
            <button
              type="button"
              onClick={trocarVoz}
              aria-label={`Voz: ${rotuloDaVoz(vozNome)}. Toque pra trocar.`}
              className="tap inline-flex items-center gap-1.5 border-l border-white/15 px-3 py-1.5"
            >
              {rotuloDaVoz(vozNome)}
              <span className="normal-case text-white/40">· trocar</span>
            </button>
          )}
        </div>
      )}

      {/* key: força o replay da animação de entrada a cada passo */}
      <div key={passo.id} className="animate-demo-screen-in relative">
        <Art />

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">
          {passo.eyebrow}
        </p>
        <h3 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight">
          {passo.titulo}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-white/70">
          {passo.texto}
        </p>
      </div>

      {/* A LINHA DE NAVEGAÇÃO: BOLINHAS, VOLTAR, CONTINUAR
        * Voltar fica COLADO no Continuar, e não no cabeçalho da folha: os dois
        * são o mesmo gesto (andar na sequência) e o dedo já está ali embaixo,
        * na mão que segura o celular. No cabeçalho, avançar e voltar ficavam
        * a uma tela de distância um do outro.
        *
        * Ele é discreto de propósito — contorno, não preenchimento: recuar é
        * saída de emergência, e ela não deve ter o mesmo peso do caminho. */}
      <div className="relative mt-6 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden>
          {PASSOS.map((p, idx) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i
                  ? 'w-5 bg-emerald-300'
                  : idx < i
                    ? 'w-1.5 bg-emerald-300/50'
                    : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={voltar}
          className="tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-4 text-sm font-bold text-white/70 hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <button
          type="button"
          onClick={avancar}
          className="tap cta-shine-white relative inline-flex h-11 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-emerald-400 px-5 text-sm font-extrabold text-[#0B1210]"
        >
          {ultimo ? 'Quero ser associado' : 'Continuar'}
          <ArrowRight size={16} />
        </button>
      </div>

      {!ultimo && (
        <button
          type="button"
          onClick={() => {
            silenciar();
            onDone();
          }}
          className="relative mt-2 w-full py-1 text-center text-[11px] text-white/40 hover:text-white/70"
        >
          <span className="font-bold text-white/70">Pular</span>
          <span> · ir pra lista de espera</span>
        </button>
      )}
    </div>
  );
}

/* ─────────────── as artes ─────────────── */

/* Duas mãos: o selo no meio, dois pontos em órbita e o halo pulsando. */
function ArtParceria() {
  return (
    <div aria-hidden className="relative flex h-24 items-center justify-center">
      <span className="absolute h-20 w-20 rounded-full bg-emerald-400/20 demo-ping" />
      <span className="art-orbit absolute h-[86px] w-[86px]">
        <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-emerald-300" />
        <span className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-secondary" />
      </span>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.09]">
        <Handshake size={26} className="text-emerald-300" />
      </span>
    </div>
  );
}

/* A pilha de infraestrutura com luzes piscando e dados subindo. */
function ArtInfra() {
  return (
    <div aria-hidden className="relative flex h-24 items-end justify-center gap-3">
      {/* dados subindo */}
      <div className="absolute inset-x-0 top-0 flex justify-center gap-1.5">
        {[0, 300, 600].map((d) => (
          <span
            key={d}
            className="art-typing h-1.5 w-1.5 rounded-full bg-emerald-300"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>

      <span className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.07]">
        <Database size={20} className="text-emerald-300" />
        <span className="flex gap-1">
          {[0, 200].map((d) => (
            <span
              key={d}
              className="art-typing h-1 w-1 rounded-full bg-emerald-300/80"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </span>
      </span>

      <span className="flex h-16 w-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.07]">
        <Server size={20} className="text-white/70" />
        <span className="flex gap-1">
          {[100, 400, 700].map((d) => (
            <span
              key={d}
              className="art-typing h-1 w-1 rounded-full bg-secondary"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </span>
      </span>

      <span className="flex h-12 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07]">
        <Bus size={20} className="text-white/70" />
      </span>
    </div>
  );
}

/* Três estruturas ocupadas e uma vaga piscando — a vaga que ele quer. */
function ArtVagas() {
  return (
    <div aria-hidden className="relative flex h-24 items-center justify-center gap-2">
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className="flex h-16 w-12 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07]"
        >
          <Server size={15} className="text-white/40" />
          <Bus size={13} className="text-white/40" />
        </span>
      ))}
      <span className="art-blink flex h-16 w-12 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-300/70 bg-emerald-400/10">
        <Plus size={16} className="text-emerald-300" />
        <span className="font-mono text-[8px] uppercase tracking-wider text-emerald-300">
          vaga
        </span>
      </span>
    </div>
  );
}

/* A roleta da condição de entrada: quatro fatias girando devagar e o
 * ponteiro fixo em cima. Gira sempre (é enfeite aqui) — a roleta DE VERDADE
 * mora dentro do app, no primeiro acesso, e o resultado dela vem do servidor.
 * Aqui é só a promessa, desenhada. */
function ArtRoleta() {
  return (
    <div aria-hidden className="relative flex h-24 items-center justify-center">
      <span className="absolute -top-1 z-10 h-0 w-0 border-x-[6px] border-t-[10px] border-x-transparent border-t-emerald-300" />
      <span
        className="art-orbit block h-20 w-20 rounded-full border-2 border-white/20"
        style={{
          background:
            'conic-gradient(rgba(82,196,26,.55) 0deg 90deg, rgba(255,255,255,.10) 90deg 180deg, rgba(245,166,35,.5) 180deg 270deg, rgba(255,255,255,.16) 270deg 360deg)',
        }}
      />
      <span className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-[#0B1210] font-mono text-[9px] font-bold text-emerald-300">
        1·2·3
      </span>
      <span className="absolute -right-1 bottom-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-emerald-200">
        meses sem taxa
      </span>
    </div>
  );
}

/* A taxa que cai conforme a comunidade cresce: quatro pessoas aparecendo e
 * o marcador de porcentagem andando pra baixo na trilha. */
function ArtTaxa() {
  return (
    <div aria-hidden className="relative h-24">
      <div className="flex items-center justify-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.09]">
          <Percent size={18} className="text-secondary" />
        </span>
        {[0, 300, 600, 900].map((d) => (
          <span
            key={d}
            className="art-pop flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/15"
            style={{ animationDelay: `${d}ms` }}
          >
            <Users size={14} className="text-emerald-300" />
          </span>
        ))}
      </div>

      {/* trilha: quanto mais comunidade, mais o marcador anda — e a taxa cai */}
      <div className="relative mt-4 h-4">
        <div className="absolute inset-x-2 top-1/2 border-t border-dashed border-white/20" />
        <span className="art-travel absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/40" />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-white/35">
        <span>taxa cheia</span>
        <span className="text-emerald-300/70">taxa menor</span>
      </div>
    </div>
  );
}
