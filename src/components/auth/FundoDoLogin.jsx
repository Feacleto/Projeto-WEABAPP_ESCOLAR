import {
  Home, Users, Clock, Link2, Bus, CalendarX, Check,
  BellRing, MessageCircle, Phone, UserX, Sunrise, Sunset, Copy,
} from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { TRIOS, SLOTS } from '../../marca/fundoDoLogin';

/**
 * O FUNDO DA COLUNA DIREITA DO LOGIN — o app se mostrando enquanto ela entra.
 *
 * O CONTEÚDO NÃO MORA AQUI. As nove peças, as frases e a lista do que não
 * pode aparecer estão em [marca/fundoDoLogin.js](../../marca/fundoDoLogin.js),
 * que é módulo puro e por isso TESTÁVEL (`npm run testar:fundo`). Este
 * arquivo só sabe desenhar os onze blocos.
 *
 * ── ⚠️ O CARD FICA CENTRADO, E É ISSO QUE DEFINE A LARGURA MÍNIMA
 * A regra número um do fundo é **nunca atrás do formulário**. Cartão de fundo
 * cortado lê como bug — e pior quando o que corta é um valor em reais.
 *
 * A primeira versão resolvia isso encostando o formulário à direita, e ela
 * funcionava em 1340px e ficava errada em tudo acima: numa tela de 1900 o
 * card voava para a borda e sobravam ~320px de vazio no meio da coluna.
 *
 * Agora o card fica CENTRADO e os cartões penduram na esquerda dele. O vão
 * entre fundo e formulário é constante em qualquer largura; o que cresce nas
 * pontas é o vazio, e vazio na ponta lê como respiro.
 *
 * O preço é a largura mínima, e ele não é pequeno. Com o card no centro, o
 * espaço à esquerda dele é METADE do que sobra:
 *
 *   coluna direita   = fração · L        (54% no login, 58% no convite)
 *   centro do card   = (1 − fração/2) · L ... na prática: início + metade
 *   borda esquerda do cartão de fundo = centro − cartão/2 − vão − 244
 *   e ela precisa caber depois da borda da coluna, com 16px de margem
 *
 * Login (fração 0,54 · card 380 · vão 24):
 *   0,73·L − 190 − 24 − 244 ≥ 0,46·L + 16   →   0,27·L ≥ 474   →   L ≥ 1756
 *
 * Convite (fração 0,58 · card 520 · vão 24):
 *   0,71·L − 260 − 24 − 244 ≥ 0,42·L + 16   →   0,29·L ≥ 544   →   L ≥ 1876
 *
 * Daí `1800` e `1980`, com ~12px e ~30px de folga. **É bem mais alto que os
 * 1340 de antes** — abaixo disso o fundo simplesmente não existe, e o
 * formulário centrado fica como sempre foi. Fundo comprimido não é
 * meio-fundo, é fundo quebrado.
 *
 * ⚠️ A CONTA DEPENDE DE TRÊS NÚMEROS QUE MORAM FORA DAQUI: a fração da coluna
 * (no `grid-cols` da página), a largura do formulário (`max-w-[…]`) e a
 * porteira. `npm run testar:fundo` refaz a conta a partir dos arquivos, então
 * alargar o formulário falha no teste em vez de aparecer como cartão cortado
 * do outro lado da tela.
 *
 * ── POR QUE OS NOVE FICAM MONTADOS
 * O trio inativo fica em `opacity-0` em vez de sair do DOM, e é o que permite
 * a travessia entre as abas ser um cruzamento em vez de um pisca. Todos são
 * `pointer-events-none` e o container é `aria-hidden`: eles PARECEM interface,
 * e quem tenta tocar e não recebe resposta aprende que o app não responde.
 */

const ICONES = {
  casa: Home,
  turma: Users,
  relogio: Clock,
  elo: Link2,
  perua: Bus,
  falta: CalendarX,
  check: Check,
  sino: BellRing,
  zap: MessageCircle,
  ligar: Phone,
  semEscola: UserX,
  manha: Sunrise,
  tarde: Sunset,
};

/** O quadradinho de ícone do cabeçalho, com halo opcional. */
function Selo({ icone, halo }) {
  const Icone = ICONES[icone] || Home;
  return (
    <span
      className={`relative grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-primaryChip text-primaryDark ${
        halo ? 'fundo-halo' : ''
      }`}
    >
      <Icone size={15} strokeWidth={2.4} />
    </span>
  );
}

function Pastilha({ children, destaque }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
        destaque
          ? 'border border-primaryBorder bg-primarySoft text-primaryDark'
          : 'border border-border bg-surface text-textMuted'
      }`}
    >
      {children}
    </span>
  );
}

function Iniciais({ children }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-primaryChip text-[9px] font-bold text-primaryDark">
      {children}
    </span>
  );
}

/** Os onze primitivos. Cada `case` é um bloco de `marca/fundoDoLogin.js`. */
function Bloco({ dados }) {
  switch (dados.b) {
    case 'cabecalho':
      return (
        <div className="flex items-start gap-2.5">
          <Selo icone={dados.icone} halo={dados.halo} />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold leading-tight text-text">
              {dados.titulo}
            </span>
            {dados.subtitulo && (
              <span className="mt-0.5 block text-[10.5px] leading-snug text-textMuted">
                {dados.subtitulo}
              </span>
            )}
          </span>
        </div>
      );

    case 'progresso':
      return (
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-neutro">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${Math.round(dados.fracao * 100)}%` }}
          />
        </span>
      );

    case 'linha':
      return (
        <div className="flex items-center gap-2 rounded-[10px] border border-primaryBorder bg-primarySoft px-2.5 py-1.5">
          <span className="font-mono text-[10.5px] font-semibold tabular-nums text-primaryDark">
            {dados.hora}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text">
            {dados.texto}
          </span>
          {dados.check && <Check size={13} strokeWidth={3} className="flex-none text-primary" />}
        </div>
      );

    case 'pessoa':
      return (
        <div className="flex items-center gap-2.5">
          {/* INICIAIS, NUNCA FOTO. Rosto de criança numa página pública é
            * dado sensível — e é o que torna estes cartões possíveis: eles
            * são recriados, não são print de tela. */}
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-primaryChip text-[11px] font-bold text-primaryDark">
            {dados.iniciais}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold leading-tight text-text">
              {dados.nome}
            </span>
            <span className="block truncate text-[10.5px] text-textMuted">{dados.detalhe}</span>
          </span>
          <span className="flex-none font-mono text-[11px] font-semibold tabular-nums text-primary">
            {dados.hora}
          </span>
        </div>
      );

    case 'acao':
      return (
        <span className="block rounded-xl bg-primary py-2 text-center text-[11.5px] font-extrabold tracking-wide text-white">
          {dados.rotulo}
        </span>
      );

    case 'atalhos':
      return (
        <div className="grid grid-cols-3 gap-1.5">
          {dados.itens.map((it) => {
            const Icone = ICONES[it.icone] || BellRing;
            return (
              <span
                key={it.rotulo}
                className={`relative inline-flex h-7 items-center justify-center gap-1 rounded-[9px] text-[10px] font-bold ${
                  it.halo
                    ? 'fundo-halo border border-primaryBorder bg-primarySoft text-primaryDark'
                    : 'border border-border bg-surface text-textMuted'
                }`}
              >
                <Icone size={11} strokeWidth={2.6} />
                {it.rotulo}
              </span>
            );
          })}
        </div>
      );

    case 'numero':
      return (
        <span className="block">
          {dados.rotulo && (
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-textMuted">
              {dados.rotulo}
            </span>
          )}
          {/* UM número, e ele é o Recebido. Ver a lista ⛔ do módulo de dados:
            * o "a receber" saiu do produto porque previsão no dia 3 do mês é
            * quase o faturamento inteiro. */}
          <span className="mt-0.5 block text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-text">
            {dados.valor}
          </span>
        </span>
      );

    case 'iniciais':
      return (
        <span className="block">
          {dados.rotulo && (
            <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-textMuted">
              {dados.rotulo}
            </span>
          )}
          <span className="flex items-center gap-1">
            {dados.itens.map((i) => (
              <Iniciais key={i}>{i}</Iniciais>
            ))}
            <span className="ml-0.5 text-[10px] font-semibold text-textMuted">{dados.mais}</span>
          </span>
        </span>
      );

    case 'paradas':
      return (
        <div className="flex flex-col gap-1.5">
          {dados.itens.map((it) => (
            <span key={it.hora} className="flex items-center gap-2">
              <span className="flex-none font-mono text-[10.5px] tabular-nums text-textMuted">
                {it.hora}
              </span>
              {/* Iniciais em vez de bolinha quando a parada tem rosto: é a
                * mesma pastilha do resto do fundo, e nunca uma foto. */}
              {it.iniciais ? (
                <Iniciais>{it.iniciais}</Iniciais>
              ) : (
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" />
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text">
                {it.nome}
              </span>
            </span>
          ))}
        </div>
      );

    case 'pastilhas':
      return (
        <div className="flex flex-wrap gap-1.5">
          {dados.itens.map((it) => (
            <Pastilha key={it.rotulo} destaque={it.destaque}>
              {it.rotulo}
            </Pastilha>
          ))}
        </div>
      );

    case 'nota':
      return (
        <span className="block font-mono text-[9.5px] leading-snug text-textMuted">
          {dados.texto}
        </span>
      );

    // Título sem ícone: a folha de falta abre com a pergunta, não com um
    // símbolo — o nome da criança já é o assunto.
    case 'titulo':
      return (
        <span className="block">
          <span className="block text-[13px] font-bold leading-tight text-text">
            {dados.titulo}
          </span>
          <span className="mt-0.5 block text-[10.5px] text-textMuted">{dados.subtitulo}</span>
        </span>
      );

    case 'corpo':
      return (
        <span className="block text-[10.5px] leading-relaxed text-textMuted">{dados.texto}</span>
      );

    case 'botao':
      return (
        <span
          className={`block rounded-xl py-2 text-center text-[11.5px] font-bold ${
            dados.contorno
              ? 'border-2 border-primary text-primary'
              : 'bg-primary text-white'
          }`}
        >
          {dados.rotulo}
        </span>
      );

    // ⚠️ O VERDE AQUI É O DO WHATSAPP, NÃO O DA MARCA — e é hex cru de
    // propósito, com precedente no projeto: `components/children/InviteShare.jsx`
    // faz o mesmo, e `WhatsAppIcon` guarda a cor oficial com o porquê.
    // Pintar este botão de `primary` faria ele deixar de ser reconhecido como
    // "isso abre o WhatsApp", que é a única coisa que ele precisa comunicar.
    //
    // O ícone é o do projeto, e não um genérico de mensagem: o fundo copia o
    // app, e no app este botão tem a marca do outro produto.
    case 'botaoZap':
      return (
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2 text-[11.5px] font-bold text-white">
          <WhatsAppIcon size={13} colored={false} />
          {dados.rotulo}
        </span>
      );

    // As duas pontas do dia, do jeito que a operação lê: a ida em destaque
    // (é a que está acontecendo) e a volta ao lado, em repouso.
    case 'faixaHoras':
      return (
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primaryDark px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">
            <Home size={9} strokeWidth={2.8} />
            {dados.ida}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] tabular-nums text-textMuted">
            <Home size={9} strokeWidth={2.4} />
            {dados.volta}
          </span>
        </span>
      );

    case 'opcoes':
      return (
        <div className="flex flex-col gap-1.5">
          {dados.itens.map((it) => {
            const Icone = ICONES[it.icone] || UserX;
            return (
              <span
                key={it.titulo}
                className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2 py-1.5"
              >
                <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-primaryChip text-primaryDark">
                  <Icone size={12} strokeWidth={2.4} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-bold leading-tight text-text">
                    {it.titulo}
                  </span>
                  <span className="block truncate text-[9.5px] text-textMuted">{it.detalhe}</span>
                </span>
              </span>
            );
          })}
        </div>
      );

    // O código do convite, em mono e espaçado — é lido em voz alta e
    // conferido letra por letra, do mesmo jeito que o campo real fazia.
    case 'codigo':
      return (
        <span className="block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-textMuted">
            {dados.rotulo}
          </span>
          <span className="flex items-center justify-between gap-2 rounded-[10px] border border-borderStrong bg-surface px-2.5 py-1.5">
            <span className="font-mono text-[12px] font-bold tracking-[0.28em] text-text">
              {dados.valor}
            </span>
            <Copy size={12} className="flex-none text-textMuted" />
          </span>
        </span>
      );

    case 'pago':
      return (
        <span className="block">
          <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-textMuted">
            {dados.mes}
          </span>
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-primaryChip text-primaryDark">
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="inline-block rounded-md bg-primaryChip px-1.5 py-px text-[9.5px] font-bold text-primaryDark">
                {dados.chip}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-textMuted">{dados.meio}</span>
            </span>
            <span className="flex-none text-[15px] font-extrabold tabular-nums text-text">
              {dados.valor}
            </span>
          </span>
        </span>
      );

    default:
      return null;
  }
}

const DURACAO = { 1: '', 2: 'fundo-flutua-b', 3: 'fundo-flutua-c' };

/**
 * ⚠️ O BREAKPOINT É POR TELA, E AS DUAS CLASSES FICAM ESCRITAS AQUI.
 *
 * A conta do cabeçalho depende da largura do FORMULÁRIO, e ele não é o mesmo
 * nas duas telas: 380px no login, 520px no convite da família. Um número
 * fixo aqui deixava o fundo aparecer no convite entre 1340 e 1500px com o
 * cartão ainda centrado — sobreposição, que é a regra número um sendo
 * quebrada. Foi `npm run testar:fundo` que pegou.
 *
 * As duas variantes são LITERAIS de propósito: o Tailwind gera classe lendo o
 * TEXTO do código-fonte. Uma classe montada em tempo de execução, com a
 * largura interpolada numa variável, não existiria no CSS — ela sairia no
 * HTML e não pintaria nada.
 *
 * ⚠️ E ESTE COMENTÁRIO JÁ QUEBROU A TELA. Ele trazia o exemplo da classe
 * interpolada escrito por extenso, com a sintaxe de colchete e um `${...}`
 * dentro. O extrator não sabe o que é comentário: ele leu aquilo como um
 * candidato de classe com valor inválido e **derrubou a geração inteira da
 * variante de largura mínima** — inclusive as classes válidas deste arquivo e
 * as do `Login.jsx`. O fundo nunca apareceu, e a única pista era o CSS
 * publicado não ter nenhuma media query de 1340px.
 *
 * Por isso o exemplo agora está em PROSA. `npm run testar:fundo` recusa
 * qualquer `min-[` com interpolação em `src/`, em comentário ou não.
 */
const PORTEIRA = {
  1800: 'hidden min-[1800px]:block',
  1980: 'hidden min-[1980px]:block',
};

function Cartao({ cartao, ativo, largura }) {
  const slot = SLOTS[cartao.slot];
  // `50% + metade do formulário + vão` — ver o comentário de SLOTS.
  const direita = `calc(50% + ${largura / 2 + slot.vao}px)`;
  return (
    <div
      className={`fundo-flutua ${DURACAO[cartao.slot]} absolute w-[244px] rounded-[18px] bg-card p-4 shadow-fundo transition-[opacity,transform] duration-[420ms] ease-out ${
        ativo ? 'opacity-100' : 'translate-y-3.5 opacity-0'
      }`}
      style={{
        right: direita,
        top: slot.top,
        bottom: slot.bottom,
        animationDelay: slot.atraso,
      }}
    >
      <div className="flex flex-col gap-2.5">
        {cartao.blocos.map((bloco, i) => (
          <Bloco key={`${cartao.id}-${i}`} dados={bloco} />
        ))}
      </div>
    </div>
  );
}

export default function FundoDoLogin({ assunto, assuntos, desde = 1800, largura = 380 }) {
  const montados = assuntos && assuntos.length ? assuntos : [assunto];
  const porteira = PORTEIRA[desde] || PORTEIRA[1800];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 select-none overflow-hidden ${porteira}`}
    >
      {/* A textura: a marca diluída em pontos de 24px. Ela é o que impede a
        * coluna de ler como "página não carregou" quando o trio troca. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--fundo-ponto) 1.4px, transparent 1.4px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* O brilho no canto de baixo, longe dos cartões e atrás do formulário:
        * ele existe para a coluna ter um centro de gravidade. */}
      <div
        className="absolute h-[420px] w-[420px] rounded-full"
        style={{
          right: -120,
          bottom: -140,
          background:
            'radial-gradient(circle, var(--fundo-brilho) 0%, var(--fundo-brilho-fim) 70%)',
        }}
      />

      {montados.map((chave) =>
        (TRIOS[chave] || []).map((cartao) => (
          <Cartao
            key={`${chave}-${cartao.id}`}
            cartao={cartao}
            ativo={chave === assunto}
            largura={largura}
          />
        ))
      )}
    </div>
  );
}
