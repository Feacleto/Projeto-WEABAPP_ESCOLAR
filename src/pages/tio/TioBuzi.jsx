import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Eye, EyeOff, FileDown } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useBoletim } from '../../hooks/useBoletim';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { formatBRL } from '../../compartilhado/formatters';
import { PERGUNTA, TEMA, mesDe, nomeDoMes, responder } from '../../dominio/cobranca/boletim.js';
import { PERGUNTA_DA_PERUA, TEMA_DA_PERUA, responderDaPerua } from '../../dominio/cobranca/buziDaPerua.js';

/**
 * O BUZI — o assistente digital do Financeiro (04/10/2026, decisão do dono).
 *
 * Uma conversa no jeito do WhatsApp, mas sem digitar: três botões fixos
 * embaixo, a pergunta tocada vira a bolha DELE à direita, e a resposta vem
 * embaixo. Cada pergunta fala de UM assunto (regras em
 * `dominio/cobranca/boletim.js`), e toda resposta termina com o Boletim.
 *
 * NÃO É IA, e a tela não diz que é: as respostas são montadas no aparelho,
 * com as mensalidades que ele já tem. Tocar mil vezes não custa nada.
 *
 * ── A CONVERSA DO DIA
 * O aparelho guarda SÓ quais perguntas foram tocadas hoje — nunca um valor.
 * Reabrir no mesmo dia mostra a mesma conversa, com os números de AGORA; no
 * dia seguinte ela começa limpa.
 *
 * Atrás da senha: mora embaixo de `/tio/finance`, e o `GuardaDoFinanceiro`
 * protege pelo caminho. O olho de "esconder valores" vale aqui também.
 *
 * ── DOIS GRUPOS DE TRÊS (04/10/2026, pedido do dono)
 * Ele também fala do que NÃO entra no Boletim: combustível, manutenção e
 * quanto sobrou (`dominio/cobranca/buziDaPerua.js`). O dono pediu no máximo
 * três botões à vista — seis empilhados cobririam a conversa num celular de
 * 320 px —, então uma chave em cima troca o grupo: "Mensalidades" ou "Perua
 * e sobra". A conversa guarda os dois tipos misturados, na ordem tocada.
 */
const GRUPOS = [
  { id: 'mensalidades', rotulo: 'Mensalidades', temas: [TEMA.ATRASADOS, TEMA.AVISARAM, TEMA.ENTROU] },
  {
    id: 'perua',
    rotulo: 'Perua e sobra',
    temas: [TEMA_DA_PERUA.COMBUSTIVEL, TEMA_DA_PERUA.MANUTENCAO, TEMA_DA_PERUA.SOBROU],
  },
];
const TEMAS = GRUPOS.flatMap((g) => g.temas);
const DA_PERUA = new Set(GRUPOS[1].temas);
const PERGUNTAS = { ...PERGUNTA, ...PERGUNTA_DA_PERUA };
const MAXIMO_NA_CONVERSA = 12;

const ACAO = {
  [TEMA.ATRASADOS]: { texto: 'Cobrar no caixa', destino: '/tio/finance' },
  [TEMA.AVISARAM]: { texto: 'Conferir no caixa', destino: '/tio/finance' },
  [TEMA_DA_PERUA.COMBUSTIVEL]: { texto: 'Lançar abastecimento', destino: '/tio/abastecer', sempre: true },
  [TEMA_DA_PERUA.MANUTENCAO]: { texto: 'Ver a reserva da perua', destino: '/tio/finance/reserva', sempre: true },
  [TEMA_DA_PERUA.SOBROU]: { texto: 'Ver as despesas', destino: '/tio/finance/expenses', sempre: true },
};

function chaveDoDia(uid) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `buzi:${uid}:${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lerConversa(uid) {
  if (!uid) return [];
  try {
    const lista = JSON.parse(localStorage.getItem(chaveDoDia(uid)) || '[]');
    return Array.isArray(lista) ? lista.filter((t) => TEMAS.includes(t)).slice(-MAXIMO_NA_CONVERSA) : [];
  } catch {
    return [];
  }
}

function hora(d) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TioBuzi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pagamentos, atualizadoEm } = useBoletim();
  const { despesas, carregando: carregandoDespesas } = useDespesasDosUltimosMeses(12);
  const config = useConfigDoFinanceiro();
  const [grupo, setGrupo] = useState(GRUPOS[0].id);
  const { visiveis, alternar } = useValoresVisiveis();
  const [conversa, setConversa] = useState(() => lerConversa(user?.uid));
  const fim = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    try {
      localStorage.setItem(chaveDoDia(user.uid), JSON.stringify(conversa));
    } catch {
      /* sem armazenamento, a conversa só não volta amanhã — hoje funciona */
    }
  }, [user?.uid, conversa]);

  // A resposta nova aparece embaixo: rola até ela.
  useEffect(() => {
    if (conversa.length) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversa.length]);

  const agora = atualizadoEm || null;
  const [mes] = useState(() => mesDe(Date.now()));
  const perguntar = (tema) => setConversa((c) => [...c, tema].slice(-MAXIMO_NA_CONVERSA));
  const valor = (v) => (visiveis ? formatBRL(v) : `R$ ${VALOR_ESCONDIDO}`);

  return (
    <>
      <Header title="Buzi" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="px-4 pt-4 pb-3 space-y-4">
        <div className="flex items-center gap-3 rounded-3xl bg-card shadow-rest p-4">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-primaryChip flex items-center justify-center">
            <Bot size={30} className="text-primary" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold text-text">Buzi</p>
            <p className="text-base text-textMuted">seu assistente digital</p>
            <p className="text-sm text-textMuted">
              Números de {nomeDoMes(mes)}
              {agora ? ` · atualizado às ${hora(agora)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={alternar}
            className="tap w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-textBody"
            aria-label={visiveis ? 'Esconder valores' : 'Mostrar valores'}
          >
            {visiveis ? <Eye size={24} aria-hidden="true" /> : <EyeOff size={24} aria-hidden="true" />}
          </button>
        </div>

        <BolhaDoBuzi>
          <p>Escolha uma pergunta aqui embaixo.</p>
        </BolhaDoBuzi>

        {conversa.map((tema, i) => {
          const daPerua = DA_PERUA.has(tema);
          let r = null;
          if (daPerua) {
            if (pagamentos && !carregandoDespesas && config !== null) {
              r = responderDaPerua(tema, { pagamentos, despesas, config: config || {}, mostrar: visiveis });
            }
          } else if (pagamentos) {
            r = responder(tema, pagamentos, { mostrar: visiveis });
          }
          return (
            <div key={i} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-[18px] font-semibold text-white">
                  {PERGUNTAS[tema]}
                </p>
              </div>
              {!r ? (
                <Skeleton className="h-24 rounded-2xl" />
              ) : (
                <BolhaDoBuzi>
                  {r.frases.map((f, j) => (
                    <p key={j} className={j === 0 ? 'font-bold text-text' : ''}>
                      {f}
                    </p>
                  ))}
                  {r.linhas.length > 0 && (
                    <ul className="mt-2 divide-y divide-border border-t border-border">
                      {r.linhas.map((l) => (
                        <li key={l.id} className="flex items-baseline justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block font-semibold text-text">{l.nome}</span>
                            <span className="block text-base text-textMuted">{l.detalhe}</span>
                          </span>
                          <span className="shrink-0 font-bold text-text">{valor(l.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {ACAO[tema] && (ACAO[tema].sempre || r.quantas > 0) && (
                    <button
                      type="button"
                      onClick={() => navigate(ACAO[tema].destino)}
                      className="tap mt-3 h-12 w-full rounded-2xl border border-borderStrong bg-card text-base font-bold text-primary"
                    >
                      {ACAO[tema].texto}
                    </button>
                  )}
                  {!daPerua && (
                  <button
                    type="button"
                    onClick={() => navigate('/tio/finance/boletim')}
                    className="tap mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-borderStrong bg-card text-base font-bold text-primary"
                  >
                    <FileDown size={20} aria-hidden="true" />
                    Baixar o Boletim
                  </button>
                  )}
                </BolhaDoBuzi>
              )}
            </div>
          );
        })}
        {/* A resposta nova para ACIMA do painel de perguntas, que é fixo e alto
          * (a chave dos grupos e três botões): sem esta margem, rolar até o fim
          * deixava o final da resposta escondido atrás dele. */}
        <div ref={fim} style={{ scrollMarginBottom: '20rem' }} />
      </div>

      {/* As três perguntas, fixas acima das abas — o mesmo lugar e a mesma
        * forma da barra do Início. Botões de contorno: nenhum deles é "o"
        * próximo passo, e a tela não tem protagonista verde. */}
      <div
        className="sticky z-20 mx-3 mt-2 rounded-2xl bg-card p-2 shadow-float space-y-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}
      >
        <div role="tablist" aria-label="Assunto das perguntas" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          {GRUPOS.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={grupo === g.id}
              onClick={() => setGrupo(g.id)}
              className={`tap h-11 rounded-lg text-base font-bold ${
                grupo === g.id ? 'bg-primary text-white' : 'text-textMuted'
              }`}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        {GRUPOS.find((g) => g.id === grupo).temas.map((tema) => (
          <button
            key={tema}
            type="button"
            onClick={() => perguntar(tema)}
            className="tap h-14 w-full rounded-2xl border border-borderStrong bg-card px-4 text-left text-[18px] font-bold text-text"
          >
            {PERGUNTAS[tema]}
          </button>
        ))}
      </div>
    </>
  );
}

function BolhaDoBuzi({ children }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-card shadow-rest px-4 py-3 text-[18px] leading-relaxed text-textBody space-y-1">
      {children}
    </div>
  );
}
