import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, Eye, EyeOff, Keyboard, Mic, Phone, PhoneOff, Plus, Send, Volume2 } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useBoletim, lerBoletimVisto } from '../../hooks/useBoletim';
import { useConfigDoFinanceiro, useDespesasDosUltimosMeses } from '../../hooks/useDespesas';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useAbsences, useAvisosDaSemana } from '../../hooks/useAbsences';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { useDitado } from '../../hooks/useDitado';
import useSpeech from '../../hooks/useSpeech';
import { playSound } from '../../services/soundService';
import { formatBRL } from '../../compartilhado/formatters';
import { getDateKey } from '../../dominio/rota/horarios.js';
import { boletimParaAnunciar, mesDe, nomeDoMes, responder } from '../../dominio/cobranca/boletim.js';
import { responderDaPerua } from '../../dominio/cobranca/buziDaPerua.js';
import { responderDoDia, semanaDe, TEMA_DO_DIA } from '../../dominio/rota/buziDoDia.js';
import { responderDaTurma } from '../../dominio/identidade/buziDaTurma.js';
import {
  ASSUNTO,
  ASSUNTOS,
  PERGUNTAS,
  PERGUNTA_INICIAL,
  PRIMEIROS,
  TEMAS,
  VAI_PARA_O_BOLETIM,
  assuntoDoTema,
  entenderPergunta,
  falaDaResposta,
  partesDoBoletim,
} from '../../dominio/cobranca/buziConversa.js';

/**
 * O BUZI CHAT — o assistente digital do motorista (05/10/2026, modelo no
 * jeito do WhatsApp aprovado pelo dono no artifact "Buzi Chat").
 *
 * Mora na Carteira, atrás da senha ("Perguntar ao Buzi", logo abaixo do
 * saldo), e não existe na rota: ali a aba vira "Rota", o lugar da auxiliar.
 *
 * ── COMO A CONVERSA ANDA
 * O Buzi oferece os botões DENTRO da conversa: o assunto, depois a pergunta,
 * depois o próximo passo (a ação, outra pergunta, outro assunto). Só a última
 * mensagem tem botões, e nunca mais de três (regra do dono). Escrever ou falar
 * é a exceção, para quando o botão não basta: o Buzi procura a pergunta
 * pronta mais parecida e diz como entendeu (`entenderPergunta`).
 *
 * ⚠️ NÃO É IA, e a tela não diz que é. As respostas são montadas no aparelho,
 * com o que o app já tem (`buziConversa.js` liga as réguas de cada assunto).
 *
 * ── O BOLETIM SAI DA CONVERSA
 * Toda resposta de dinheiro tem "Pôr no Boletim". O Boletim passa a ser o que
 * ele quis ver, na ordem em que perguntou; "Montar o Boletim" manda o
 * documento na conversa, e abrir leva a `/tio/finance/boletim?partes=…`. Sem
 * nenhuma parte escolhida, o Boletim é o de sempre (entrou, atrasados,
 * avisaram).
 *
 * ── FALAR COM O BUZI (ao vivo)
 * O "Falar" do topo abre uma tela de ligação: ele fala, o Buzi responde
 * falando, e tudo fica escrito na conversa. ⚠️ Com os valores escondidos a
 * voz não fala valor (`falaDaResposta`). O áudio vai ao serviço de voz do
 * aparelho — o mesmo do ditado, declarado na Política (2b). Sem
 * reconhecimento de voz no aparelho, o botão não existe.
 *
 * ── A CONVERSA DO DIA
 * O aparelho guarda as mensagens de hoje e as partes do Boletim — nunca um
 * valor: as respostas são remontadas com os números de AGORA. No dia
 * seguinte ela começa limpa.
 */

const ACAO = {
  atrasados: { texto: 'Cobrar no caixa', destino: '/tio/finance' },
  avisaram: { texto: 'Conferir no caixa', destino: '/tio/finance' },
  combustivel: { texto: 'Lançar abastecimento', destino: '/tio/abastecer', sempre: true },
  manutencao: { texto: 'Ver a reserva da perua', destino: '/tio/finance/reserva', sempre: true },
  sobrou: { texto: 'Ver as despesas', destino: '/tio/finance/expenses', sempre: true },
  vai: { texto: 'Abrir minha rota', destino: '/tio/rota' },
  naoVai: { texto: 'Abrir minha rota', destino: '/tio/rota' },
  horario: { texto: 'Horários da rota', destino: '/tio/horarios', sempre: true },
  convite: { texto: 'Ver a turma', destino: '/tio/children' },
  contrato: { texto: 'Ver os contratos', destino: '/tio/finance/turma' },
  semHorario: { texto: 'Definir horários', destino: '/tio/horarios' },
  faltas: { texto: 'Ver a semana', destino: '/tio/semana', sempre: true },
};

/**
 * ⚠️ A VOZ DO BUZI ESTÁ DESLIGADA (05/10/2026, à espera do dono). A ligação
 * ("Falar") e o "Ouvir" de cada resposta falam pelo alto-falante — e com o
 * olho aberto isso é "entraram R$ 3.200" dito em voz alta dentro da perua,
 * com a auxiliar do lado, que é exatamente quem a senha do Financeiro
 * protege. O código fica; ligar é decisão do dono. Escrever e o microfone
 * do ditado continuam: eles só ENTRAM, não falam nada.
 */
const VOZ_DO_BUZI = false;

const MAXIMO_NA_CONVERSA = 40;
const TIPOS_DO_BUZI = ['assuntos', 'perguntas', 'resposta', 'naoSei', 'boletim', 'boletimPronto'];

function chaveDoDia(uid) {
  return `buzi:${uid}:${getDateKey()}`;
}

function agoraEmHora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/** A mensagem que abre o dia: o Boletim fechado (dia 1 a 7) ou os assuntos. */
function abertura(uid) {
  const mes = boletimParaAnunciar(Date.now(), lerBoletimVisto(uid));
  if (mes) return [{ de: 'buzi', tipo: 'boletimPronto', mes, hora: agoraEmHora() }];
  return [{ de: 'buzi', tipo: 'assuntos', hora: agoraEmHora() }];
}

function mensagemValida(m) {
  if (!m) return false;
  if (m.de === 'eu') return typeof m.texto === 'string';
  if (!TIPOS_DO_BUZI.includes(m.tipo)) return false;
  if (m.tipo === 'resposta') return TEMAS.includes(m.tema);
  if (m.tipo === 'perguntas') return !!ASSUNTOS[m.assunto];
  return true;
}

function lerConversa(uid) {
  if (!uid) return { msgs: abertura(uid), boletim: [] };
  try {
    const salvo = JSON.parse(localStorage.getItem(chaveDoDia(uid)) || 'null');
    if (salvo?.v === 2 && Array.isArray(salvo.msgs)) {
      const msgs = salvo.msgs.filter(mensagemValida).slice(-MAXIMO_NA_CONVERSA);
      if (msgs.length) return { msgs, boletim: partesDoBoletim(salvo.boletim) };
    }
  } catch {
    /* sem armazenamento, a conversa começa do zero */
  }
  return { msgs: abertura(uid), boletim: [] };
}

export default function TioBuzi() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const navigate = useNavigate();
  const { pagamentos } = useBoletim();
  const { despesas, carregando: carregandoDespesas } = useDespesasDosUltimosMeses(12);
  const config = useConfigDoFinanceiro();
  const { children, loading: carregandoTurma } = useChildren();
  const { mapa: escolasPorId } = useEscolas();
  const { byChildId: declaracoes, loading: carregandoAvisos } = useAbsences(getDateKey());
  const { visiveis, alternar } = useValoresVisiveis();
  const ditado = useDitado();
  const voz = useSpeech();

  const [conversa, setConversa] = useState(() => lerConversa(uid));
  const [texto, setTexto] = useState('');
  const [ligacao, setLigacao] = useState(null);
  const fim = useRef(null);

  // As faltas da semana só são lidas quando a pergunta aparece na conversa.
  const [semana] = useState(() => semanaDe(Date.now()));
  const perguntouDaSemana = conversa.msgs.some((m) => m.tema === TEMA_DO_DIA.FALTAS);
  const avisosDaSemana = useAvisosDaSemana(semana.de, semana.ate, perguntouDaSemana);

  useEffect(() => {
    if (!uid) return;
    try {
      localStorage.setItem(chaveDoDia(uid), JSON.stringify({ v: 2, ...conversa }));
    } catch {
      /* sem armazenamento, a conversa só não volta mais tarde — agora funciona */
    }
  }, [uid, conversa]);

  // A mensagem nova aparece embaixo: rola até ela.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversa.msgs.length]);

  /** A resposta de um tema com os números de agora — ou null enquanto carrega. */
  const responderTema = useCallback(
    (tema, mostrar) => {
      const assunto = assuntoDoTema(tema);
      if (assunto === ASSUNTO.MENSALIDADES) {
        return pagamentos ? responder(tema, pagamentos, { mostrar }) : null;
      }
      if (assunto === ASSUNTO.PERUA) {
        if (!pagamentos || carregandoDespesas || config === null) return null;
        return responderDaPerua(tema, { pagamentos, despesas, config: config || {}, mostrar });
      }
      if (assunto === ASSUNTO.TURMA) {
        return carregandoTurma ? null : responderDaTurma(tema, { children });
      }
      if (carregandoTurma || carregandoAvisos) return null;
      if (tema === TEMA_DO_DIA.FALTAS) {
        // "Não consegui ler" não é "ninguém avisou".
        if (avisosDaSemana.erro) {
          return { frases: ['Não consegui ler os avisos agora. Tente de novo daqui a pouco.'], linhas: [], quantas: 0 };
        }
        if (!avisosDaSemana.lista) return null;
      }
      return responderDoDia(tema, {
        children,
        declaracoes,
        escolasPorId,
        avisosDaSemana: avisosDaSemana.lista || [],
      });
    },
    [pagamentos, carregandoDespesas, config, despesas, carregandoTurma, children, carregandoAvisos, avisosDaSemana, declaracoes, escolasPorId]
  );

  const somar = (...novas) =>
    setConversa((c) => ({
      ...c,
      msgs: [...c.msgs, ...novas.map((m) => ({ ...m, hora: agoraEmHora() }))].slice(-MAXIMO_NA_CONVERSA),
    }));

  const respostaDoBuzi = (tema, entendi = false) => ({ de: 'buzi', tipo: 'resposta', tema, entendi });

  function abrirBoletim(partes = [], mes = null) {
    const busca = new URLSearchParams();
    if (partes.length) busca.set('partes', partes.join(','));
    if (mes) busca.set('mes', mes);
    const q = busca.toString();
    navigate(`/tio/finance/boletim${q ? `?${q}` : ''}`);
  }

  function tocarBotao(b) {
    playSound('click');
    const a = b.acao;
    if (a.t === 'ir') {
      navigate(a.destino);
      return;
    }
    if (a.t === 'abrirBoletim') {
      abrirBoletim(a.partes, a.mes);
      return;
    }
    let doBuzi = null;
    if (a.t === 'assunto') doBuzi = { de: 'buzi', tipo: 'perguntas', assunto: a.id };
    else if (a.t === 'inicio') doBuzi = { de: 'buzi', tipo: 'assuntos' };
    else if (a.t === 'tema') doBuzi = respostaDoBuzi(a.tema);
    somar({ de: 'eu', texto: b.rotulo }, ...(doBuzi ? [doBuzi] : []));
    playSound('lote');
  }

  function enviarTexto(frase, via) {
    const limpa = String(frase || '').trim();
    if (!limpa) return [];
    const temas = entenderPergunta(limpa);
    somar(
      { de: 'eu', texto: limpa, via },
      ...(temas.length ? temas.map((t) => respostaDoBuzi(t, true)) : [{ de: 'buzi', tipo: 'naoSei' }])
    );
    playSound('lote');
    return temas;
  }

  function alternarNoBoletim(tema) {
    setConversa((c) => ({
      ...c,
      boletim: c.boletim.includes(tema) ? c.boletim.filter((t) => t !== tema) : partesDoBoletim([...c.boletim, tema]),
    }));
    playSound('click');
  }

  function montarBoletim() {
    somar({ de: 'buzi', tipo: 'boletim', partes: conversa.boletim, mes: mesDe(Date.now()) });
    playSound('page_turn');
  }

  function ouvir(tema) {
    voz.speak(falaDaResposta(responderTema(tema, visiveis), { mostrar: visiveis }));
  }

  /** O que o Buzi responde na ligação: a mesma régua, dita em voz alta. */
  function responderNaLigacao(falado) {
    const temas = enviarTexto(falado, 'falado');
    const respostas = temas.map((t) => responderTema(t, visiveis));
    let resposta;
    if (!temas.length) resposta = 'Ainda não sei responder isso.';
    else if (respostas.some((r) => r === null)) resposta = 'Ainda estou juntando os números. Pergunte de novo daqui a pouco.';
    else resposta = respostas.map((r) => falaDaResposta(r, { mostrar: visiveis })).join(' ');
    setLigacao((l) => (l ? { ...l, voce: falado, buzi: resposta } : l));
    voz.speak(resposta);
  }

  const ultima = conversa.msgs[conversa.msgs.length - 1];
  const botoes = ultima?.de === 'buzi' ? botoesDe(ultima, responderTema) : [];
  const temAcaoCheia = botoes.some((b) => b.cheio);
  const n = conversa.boletim.length;

  return (
    <>
      <Header title="Buzi" showBack backLabel="Carteira" backTo="/tio/finance" />

      <div className="px-3 pt-3 pb-3 space-y-3">
        <div className="flex items-center gap-2 rounded-3xl bg-card shadow-rest p-3">
          <span className="w-12 h-12 shrink-0 rounded-full bg-primaryChip flex items-center justify-center">
            <Bot size={28} className="text-primary" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold text-text">Buzi</p>
            <p className="text-sm text-textMuted">seu assistente digital</p>
          </div>
          <button
            type="button"
            onClick={alternar}
            className="tap h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-textBody"
            aria-label={visiveis ? 'Esconder valores' : 'Mostrar valores'}
          >
            {visiveis ? <Eye size={24} aria-hidden="true" /> : <EyeOff size={24} aria-hidden="true" />}
          </button>
          {VOZ_DO_BUZI && ditado.suportado && voz.suportado && (
            <button
              type="button"
              onClick={() => {
                playSound('click');
                setLigacao({ voce: '', buzi: '' });
              }}
              className="tap h-12 shrink-0 rounded-full border border-primaryBorder bg-primarySoft px-4 flex items-center gap-2 text-base font-bold text-primary"
            >
              <Phone size={20} aria-hidden="true" />
              Falar
            </button>
          )}
        </div>

        {conversa.msgs.map((m, i) => {
          if (m.de === 'eu') return <BolhaMinha key={i} m={m} />;
          const primeiraDoGrupo = conversa.msgs[i - 1]?.de !== 'buzi';
          return (
            <BolhaDoBuzi key={i} rosto={primeiraDoGrupo} hora={m.hora}>
              <ConteudoDoBuzi
                m={m}
                responder={responderTema}
                visiveis={visiveis}
                noBoletim={conversa.boletim}
                onBoletim={alternarNoBoletim}
                onOuvir={VOZ_DO_BUZI && voz.suportado ? ouvir : null}
                onAbrir={abrirBoletim}
              />
            </BolhaDoBuzi>
          );
        })}

        {botoes.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-10">
            {botoes.map((b) => (
              <button
                key={b.rotulo}
                type="button"
                onClick={() => tocarBotao(b)}
                className={`tap min-h-12 rounded-full border-2 border-primary px-4 text-[17px] font-bold ${
                  b.cheio ? 'bg-primary text-white' : 'bg-card text-primary'
                }`}
              >
                {b.rotulo}
              </button>
            ))}
          </div>
        )}
        {/* A mensagem nova para ACIMA da barra de escrever, que é fixa. */}
        <div ref={fim} style={{ scrollMarginBottom: '12rem' }} />
      </div>

      <div
        className="sticky z-20 mx-3 mt-2 space-y-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--altura-do-menu) + 0.5rem)' }}
      >
        {n > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-primaryBorder bg-primarySoft py-2 pl-4 pr-2 shadow-rest">
            <p className="flex-1 min-w-0 text-base text-primary">
              <span className="font-bold">Boletim:</span> {n === 1 ? '1 parte' : `${n} partes`}
            </p>
            <button
              type="button"
              onClick={montarBoletim}
              className="tap h-12 shrink-0 rounded-xl border border-primaryBorder bg-card px-4 text-base font-bold text-primary"
            >
              Montar o Boletim
            </button>
          </div>
        )}

        {ditado.ouvindo && !ligacao ? (
          <div className="flex h-14 items-center gap-3 rounded-full bg-card pl-5 pr-2 shadow-float">
            <Mic size={22} className="text-primary" aria-hidden="true" />
            <span className="flex-1 text-base font-bold text-primary">Ouvindo…</span>
            <button type="button" onClick={ditado.parar} className="tap h-12 rounded-full bg-surface px-4 text-base font-bold text-textBody">
              Parar
            </button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enviarTexto(texto, 'escrito');
              setTexto('');
            }}
          >
            <label className="flex h-14 flex-1 min-w-0 items-center gap-2 rounded-full bg-card pl-4 pr-2 shadow-float">
              <Keyboard size={20} className="shrink-0 text-textMuted" aria-hidden="true" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={ditado.suportado ? 'Escreva ou fale' : 'Escreva para o Buzi'}
                aria-label="Escreva para o Buzi"
                className="h-12 flex-1 min-w-0 bg-transparent text-[17px] text-text outline-none placeholder:text-textMuted"
              />
            </label>
            {texto.trim() || !ditado.suportado ? (
              <button
                type="submit"
                className="tap flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-float"
                aria-label="Enviar"
              >
                <Send size={22} aria-hidden="true" />
              </button>
            ) : (
              // ⚠️ Um verde cheio por vez: com uma ação cheia na conversa, o
              // microfone fica de contorno (auditoria da leitura em Z).
              <button
                type="button"
                onClick={() => ditado.comecar((falado) => enviarTexto(falado, 'falado'))}
                className={`tap flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-float ${
                  temAcaoCheia ? 'border-2 border-primary bg-card text-primary' : 'bg-primary text-white'
                }`}
                aria-label="Falar com o Buzi"
              >
                <Mic size={22} aria-hidden="true" />
              </button>
            )}
          </form>
        )}
      </div>

      {VOZ_DO_BUZI && ligacao && (
        <LigacaoComOBuzi
          ligacao={ligacao}
          setLigacao={setLigacao}
          ditado={ditado}
          voz={voz}
          visiveis={visiveis}
          aoOuvir={responderNaLigacao}
        />
      )}
    </>
  );
}

/** Os botões que a última mensagem do Buzi oferece — nunca mais de três. */
function botoesDe(m, responderTema) {
  const outroAssunto = { rotulo: 'Outro assunto', acao: { t: 'inicio' } };
  if (m.tipo === 'assuntos' || m.tipo === 'naoSei') {
    return PRIMEIROS.map((id) => ({ rotulo: ASSUNTOS[id].rotulo, acao: { t: 'assunto', id } }));
  }
  if (m.tipo === 'perguntas') {
    const a = ASSUNTOS[m.assunto];
    if (a.assuntos) return a.assuntos.map((id) => ({ rotulo: ASSUNTOS[id].rotulo, acao: { t: 'assunto', id } }));
    return a.temas.map((t) => ({ rotulo: PERGUNTAS[t], acao: { t: 'tema', tema: t } }));
  }
  if (m.tipo === 'resposta') {
    const lista = [];
    const acao = ACAO[m.tema];
    const r = acao && !acao.sempre ? responderTema(m.tema, true) : null;
    if (acao && (acao.sempre || (r && r.quantas > 0))) {
      lista.push({ rotulo: acao.texto, acao: { t: 'ir', destino: acao.destino }, cheio: true });
    }
    lista.push({ rotulo: 'Outra pergunta', acao: { t: 'assunto', id: assuntoDoTema(m.tema) } });
    lista.push(outroAssunto);
    return lista;
  }
  if (m.tipo === 'boletim') {
    return [{ rotulo: 'Abrir o Boletim', acao: { t: 'abrirBoletim', partes: m.partes || [] }, cheio: true }, outroAssunto];
  }
  if (m.tipo === 'boletimPronto') {
    return [
      { rotulo: `Abrir o Boletim de ${nomeDoMes(m.mes)}`, acao: { t: 'abrirBoletim', partes: [], mes: m.mes }, cheio: true },
      outroAssunto,
    ];
  }
  return [];
}

function BolhaMinha({ m }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-primaryChip px-4 py-2.5 text-[18px] font-semibold text-text shadow-rest">
        {m.via === 'falado' && (
          <span className="mr-1.5 inline-flex items-center gap-1 align-middle text-sm font-medium text-textMuted">
            <Mic size={14} aria-hidden="true" />
            falado
          </span>
        )}
        {m.texto}
        {m.hora && <span className="mt-0.5 block text-right text-xs font-normal text-textMuted">{m.hora}</span>}
      </div>
    </div>
  );
}

function BolhaDoBuzi({ rosto, hora, children }) {
  return (
    <div className="flex items-end gap-2">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white ${rosto ? '' : 'invisible'}`}
        aria-hidden="true"
      >
        <Bot size={18} />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-card px-4 py-3 text-[18px] leading-relaxed text-textBody shadow-rest">
        {children}
        {hora && <span className="mt-0.5 block text-right text-xs text-textMuted">{hora}</span>}
      </div>
    </div>
  );
}

function ConteudoDoBuzi({ m, responder, visiveis, noBoletim, onBoletim, onOuvir, onAbrir }) {
  if (m.tipo === 'assuntos') return <p>{PERGUNTA_INICIAL}</p>;
  if (m.tipo === 'perguntas') return <p>{ASSUNTOS[m.assunto].pergunta}</p>;
  if (m.tipo === 'naoSei') {
    return (
      <>
        <p className="font-bold text-text">Ainda não sei responder isso.</p>
        <p>Escolha um assunto:</p>
      </>
    );
  }
  if (m.tipo === 'boletimPronto') {
    return <p className="font-bold text-text">O Boletim de {nomeDoMes(m.mes)} está pronto.</p>;
  }
  if (m.tipo === 'boletim') {
    const partes = m.partes || [];
    return (
      <>
        <p>Montei o seu Boletim.</p>
        <button
          type="button"
          onClick={() => onAbrir(partes)}
          className="tap mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
        >
          <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-white">
            PDF
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-text">Boletim de {nomeDoMes(m.mes)}</span>
            <span className="block text-base text-textMuted">
              {partes.length === 1 ? '1 parte' : `${partes.length} partes`}: {partes.map((t) => PERGUNTAS[t]).join(' ')}
            </span>
          </span>
        </button>
      </>
    );
  }

  // A resposta: remontada com os números de agora, a cada desenho.
  const r = responder(m.tema, visiveis);
  if (!r) return <Skeleton className="h-20 rounded-xl" />;
  const vaiProBoletim = VAI_PARA_O_BOLETIM.has(m.tema);
  const noBoletimJa = noBoletim.includes(m.tema);
  const valor = (v) => (typeof v === 'number' ? (visiveis ? formatBRL(v) : `R$ ${VALOR_ESCONDIDO}`) : v);
  return (
    <>
      {m.entendi && (
        <p className="mb-1 text-base text-textMuted">
          Entendi: <span className="font-bold text-primary">{PERGUNTAS[m.tema]}</span>
        </p>
      )}
      <div className="space-y-1">
        {r.frases.map((f, j) => (
          <p key={j} className={j === 0 ? 'font-bold text-text' : ''}>
            {f}
          </p>
        ))}
      </div>
      {r.linhas.length > 0 && (
        <ul className="mt-2 divide-y divide-border border-t border-border">
          {r.linhas.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold text-text">{l.nome}</span>
                {l.detalhe && <span className="block text-base text-textMuted">{l.detalhe}</span>}
              </span>
              {l.valor != null && <span className="shrink-0 font-bold tabular-nums text-text">{valor(l.valor)}</span>}
            </li>
          ))}
        </ul>
      )}
      {(onOuvir || vaiProBoletim) && (
        <div className="mt-3 flex gap-2">
          {onOuvir && (
            <button
              type="button"
              onClick={() => onOuvir(m.tema)}
              className="tap flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-textBody"
            >
              <Volume2 size={20} aria-hidden="true" />
              Ouvir
            </button>
          )}
          {vaiProBoletim && (
            <button
              type="button"
              onClick={() => onBoletim(m.tema)}
              className={`tap flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border text-base font-semibold ${
                noBoletimJa ? 'border-primaryBorder bg-primarySoft text-primary' : 'border-border bg-surface text-textBody'
              }`}
              aria-pressed={noBoletimJa}
            >
              {noBoletimJa ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
              {noBoletimJa ? 'No Boletim' : 'Pôr no Boletim'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * FALAR COM O BUZI — a conversa por voz, numa tela de ligação. Dois botões
 * grandes: Falar e Desligar. Sem relógio de chamada: nada se mexe sozinho, e
 * um cronômetro seria exceção nova ao design system, sem aprovação.
 */
function LigacaoComOBuzi({ ligacao, setLigacao, ditado, voz, visiveis, aoOuvir }) {
  function desligar() {
    ditado.parar();
    voz.stop();
    playSound('click');
    setLigacao(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center bg-primary px-5 text-center text-white"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Conversa por voz com o Buzi"
    >
      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-primary">
        {ditado.ouvindo ? <Mic size={52} aria-hidden="true" /> : <Bot size={56} aria-hidden="true" />}
      </span>
      <p className="mt-4 font-display text-3xl font-extrabold">Buzi</p>
      <p className="text-base text-menta">Falando com o Buzi</p>

      <div className="flex max-w-sm flex-1 flex-col justify-center gap-3">
        {ligacao.voce && <p className="text-lg text-menta">Você: {ligacao.voce}</p>}
        <p className="text-[22px] font-semibold leading-snug">
          {ditado.ouvindo ? 'Ouvindo…' : ligacao.buzi || 'Pode perguntar.'}
        </p>
      </div>

      <p className="mb-5 text-base text-menta">
        {visiveis ? 'Tudo fica escrito na conversa.' : 'Valores escondidos: o Buzi não fala valor.'}
      </p>
      <div className="flex items-start gap-12">
        <div className="flex flex-col items-center gap-2 text-base font-semibold">
          <button
            type="button"
            onClick={() => {
              voz.stop();
              ditado.comecar(aoOuvir);
            }}
            disabled={ditado.ouvindo}
            className="tap flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-primary disabled:opacity-70"
            aria-label="Falar"
          >
            <Mic size={30} aria-hidden="true" />
          </button>
          Falar
        </div>
        <div className="flex flex-col items-center gap-2 text-base font-semibold">
          <button
            type="button"
            onClick={desligar}
            className="tap flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger text-white"
            aria-label="Desligar"
          >
            <PhoneOff size={30} aria-hidden="true" />
          </button>
          Desligar
        </div>
      </div>
    </div>
  );
}
