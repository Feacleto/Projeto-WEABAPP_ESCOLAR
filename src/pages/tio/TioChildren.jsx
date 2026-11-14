import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, X, School, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RecadoDaRota from '../../components/route/RecadoDaRota';
import { ChildDetailSheet } from '../../pages/ChildDetail';
import { ConviteEnxuto } from '../../components/children/InviteShare';
import LinhaDaTurma from '../../components/children/LinhaDaTurma';
import CabecalhoDaEscola from '../../components/children/CabecalhoDaEscola';
import AdicionarCrianca from '../../components/children/AdicionarCrianca';
import ACompletar from '../../components/children/ACompletar';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useAuth } from '../../hooks/useAuth';
import { deactivateChildAndParent } from '../../services/accountService';
import { salvarCampoDaLista } from '../../services/listaDaTurmaService';
import { useSalvadorDaLista } from '../../hooks/useSalvarNaLista';
import { useAgoraAoVoltar } from '../../hooks/useAgoraAoVoltar';
import {
  contadorDeFamilias,
  textoEsperandoSinal,
  textoDeTirar,
  ROTULOS,
  TODAS_CONVIDADAS,
  VAZIA_TEXTO,
} from '../../marca/textosDaLista.js';
import {
  resumoDosConvites,
  proximaParaConvidar,
  agruparPorEscola,
  foraDaRota,
  completaParaARota,
  temIrmaoNaTurma,
} from '../../dominio/escola/listaDaTurma.js';

/**
 * MINHA TURMA — A LISTA COMO SUPERFÍCIE DE TRABALHO (RC2, 14/11/2026;
 * docs/analise/11-lista-da-turma.md e o protótipo A1 a A9 aprovado pelo dono).
 *
 * Numa tela só, o motorista ADICIONA, VÊ, COMPLETA, CONVIDA e TIRA as
 * crianças, sem entrar e sair de ficha. O passeio visual mediu 75 toques para
 * cadastrar 4 crianças pelo formulário de 4 passos, e recarregar no passo 2
 * perdia tudo. Aqui:
 *   - o TOPO diz quantas famílias entraram e manda o convite de quem falta,
 *     um toque por família (o WhatsApp não aceita envio automático);
 *   - a caixa "A COMPLETAR" junta o que ele deixou para depois, por tipo;
 *   - as crianças vêm AGRUPADAS POR ESCOLA, com a entrada da escola e a hora
 *     de pegar PROPOSTA (nunca a mesma para todas);
 *   - cada LINHA abre no lugar e salva campo a campo;
 *   - a linha "+ Nome da criança" fica sempre aberta no fim.
 *
 * A FICHA (contrato, saúde, extrato) e o CADASTRO COMPLETO continuam: a lista
 * é o dia a dia, a ficha é o fundo.
 *
 * ⚠️ "TIRAR DA TURMA" NÃO TEM DESFAZER, porque não existe reativar: a
 * confirmação diz TUDO o que se perde (`textoDeTirar`, conferido contra o
 * serviço pelo teste) e ignora toques nos primeiros 400 ms — o segundo toque
 * do toque duplo cairia no botão que acabou de aparecer. "Pausar" é RC3.
 *
 * ⚠️ A PRIMEIRA TELA MOSTRA CRIANÇAS (achado M6, 360x640): o título vai na
 * barra, o topo é um cartão de ~100 px, "A completar" é UMA linha (os grupos
 * moram na folha), a busca é um botão ao lado dela, o cabeçalho da escola é
 * uma linha com o chip da entrada, e a linha da criança tem duas linhas.
 *
 * ⚠️ O ESTADO DE SALVAR MORA AQUI (`useSalvadorDaLista`), por criança e por
 * campo — não na linha, que fecha e pula de grupo. Escrita que passou do
 * tempo sem resposta acende a faixa "N alterações esperando sinal": o cache
 * do Firestore deste app é só em memória (`firebase/config.js`), e fechar o
 * app com escrita pendente a perde.
 *
 * O filtro por período saiu: o período virou cosmético (sai da hora), e cada
 * linha de filtro empurrava a turma para baixo da dobra. A busca aparece só
 * em turma grande.
 */
const ACIMA_DISSO_TEM_BUSCA = 12;

function emMs(v) {
  if (v == null) return Infinity; // carimbo do servidor a caminho: a mais nova
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return Number(v) || 0;
}

export default function TioChildren() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { children, loading } = useChildren();
  const { escolas, mapa: escolasPorId } = useEscolas();
  const salvador = useSalvadorDaLista();

  // A ficha abre POR CIMA da lista: a rolagem e a linha aberta ficam onde
  // estavam.
  const [fichaDe, setFichaDe] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [recadoDe, setRecadoDe] = useState(null);
  const [tirarDe, setTirarDe] = useState(null);
  const [tirando, setTirando] = useState(false);
  const tirandoAgora = useRef(false);
  const [search, setSearch] = useState('');
  const [buscando, setBuscando] = useState(false);

  // OS CONVITES. `tocados` guarda o toque desta abertura da tela até o
  // carimbo do servidor chegar; `ultimoConvidado` faz o botão do topo andar
  // para a próxima família depois de cada toque. `agora` acerta quando o app
  // volta ao primeiro plano (o link vence em dias, e o app fica aberto).
  const agora = useAgoraAoVoltar();
  const [tocados, setTocados] = useState(() => new Set());
  const [ultimoConvidado, setUltimoConvidado] = useState(null);
  const marcarTocado = (id) => {
    setTocados((prev) => new Set(prev).add(id));
    setUltimoConvidado(id);
  };
  const esquecerToque = (id) =>
    setTocados((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  const convites = useMemo(() => resumoDosConvites(children, agora, tocados), [children, agora, tocados]);
  const proxima = useMemo(
    () => proximaParaConvidar(children, agora, ultimoConvidado, tocados),
    [children, agora, ultimoConvidado, tocados]
  );

  const porId = useMemo(() => new Map(children.map((c) => [c.id, c])), [children]);
  const filtradas = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return termo ? children.filter((c) => c.name?.toLowerCase().includes(termo)) : children;
  }, [children, search]);
  const grupos = useMemo(() => agruparPorEscola(filtradas, escolas), [filtradas, escolas]);
  const temBusca = children.length > ACIMA_DISSO_TEM_BUSCA;

  // A ESCOLA DA PRÓXIMA CRIANÇA: a da criança cadastrada por último. Quem
  // cadastra a turma cadastra várias da mesma escola em sequência.
  const ultimaEscola = useMemo(() => {
    const comEscola = children
      .filter((c) => c.schoolId && escolasPorId?.[c.schoolId])
      .sort((a, b) => emMs(b.createdAt) - emMs(a.createdAt));
    return comEscola.length ? escolasPorId[comEscola[0].schoolId] : null;
  }, [children, escolasPorId]);

  // O VALOR E O VENCIMENTO DA PRÓXIMA CRIANÇA: os da última cadastrada com
  // valor (decisão do dono: a mensalidade é obrigatória e vem herdada).
  const anterior = useMemo(() => {
    const comValor = children
      .filter((c) => Number(c.monthlyFee) > 0)
      .sort((a, b) => emMs(b.createdAt) - emMs(a.createdAt));
    return comValor.length ? { monthlyFee: comValor[0].monthlyFee, dueDay: comValor[0].dueDay } : null;
  }, [children]);

  // ⚠️ A CRIANÇA QUE FICOU COMPLETA SEM PERDER A MARCA. O fim do
  // `cadastroRapido` vai no mesmo write que completa a rua ou a hora
  // (`camposAoSalvar`); se dois campos foram salvos antes de a escuta trazer o
  // primeiro, o segundo não sabia do primeiro. Aqui a lista confere o que o
  // banco tem e fecha a conta — uma vez por criança por abertura da tela.
  const reconciliadas = useRef(new Set());
  useEffect(() => {
    for (const c of children) {
      if (foraDaRota(c) && completaParaARota(c) && !reconciliadas.current.has(c.id)) {
        reconciliadas.current.add(c.id);
        salvarCampoDaLista(c, {}).catch(() => {});
      }
    }
  }, [children]);

  // "Pôr o valor": abre a linha da criança, onde o campo da mensalidade está.
  const abrirCrianca = (id) => {
    setSearch('');
    setAberta(id);
    setTimeout(() => document.getElementById(`linha-${id}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 50);
  };

  const tirar = async () => {
    // A ref fecha na hora: o segundo toque chega antes do `loading` redesenhar.
    if (!tirarDe || tirandoAgora.current) return;
    tirandoAgora.current = true;
    setTirando(true);
    try {
      await deactivateChildAndParent({ childId: tirarDe.id });
      toast.success(`${String(tirarDe.name || '').split(' ')[0]} saiu da turma.`);
      if (aberta === tirarDe.id) setAberta(null);
      setTirarDe(null);
    } catch (err) {
      console.error('[lista da turma] não tirou:', err?.code || 'erro');
      toast.error('Não deu pra tirar da turma. Tente de novo.');
    } finally {
      tirandoAgora.current = false;
      setTirando(false);
    }
  };
  const textoTirar = tirarDe
    ? textoDeTirar({
        nome: tirarDe.name,
        temFamilia: !!tirarDe.parentUid,
        irmaoNaTurma: temIrmaoNaTurma(tirarDe, children),
        temAceite: !!(tirarDe.contractAcceptedAt || tirarDe.contratoVigente),
        temContratoEsperando: tirarDe.contratoAguardando != null,
        temFoto: !!tirarDe.photoURL,
      })
    : null;
  const criancaDoRecado = recadoDe ? children.find((c) => c.id === recadoDe) || null : null;
  const semSinal = salvador.esperandoSinal();

  return (
    <>
      <Header
        title={ROTULOS.titulo}
        tituloNaBarra
        showBack
        backLabel="Início"
        backTo="/tio"
        action={
          <button
            type="button"
            onClick={() => navigate('/tio/children/escolas')}
            className="tap inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-base font-bold text-primary"
          >
            <School size={18} aria-hidden="true" />
            Escolas
          </button>
        }
      />

      <div className="space-y-2 px-4 pb-8 pt-2">
        {semSinal > 0 && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-neutro px-3 py-2 text-sm font-semibold text-textBody">
            <WifiOff size={16} aria-hidden="true" className="shrink-0" />
            {textoEsperandoSinal(semSinal)}
          </p>
        )}

        {!loading && children.length > 0 && (
          <ContadorDeConvites
            convites={convites}
            proxima={proxima}
            agora={agora}
            onEnviado={marcarTocado}
            onLinkNovo={esquecerToque}
            onPedirValor={abrirCrianca}
          />
        )}

        {!loading && (
          <div className="flex items-center gap-2 empty:hidden">
            <div className="min-w-0 flex-1 empty:hidden">
              <ACompletar criancas={children} salvador={salvador} onAbrirCrianca={abrirCrianca} />
            </div>
            {temBusca && (
              <button
                type="button"
                onClick={() => {
                  setBuscando((b) => !b);
                  setSearch('');
                }}
                aria-label={ROTULOS.buscar}
                aria-expanded={buscando}
                className="tap flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-rest"
              >
                <Search size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {temBusca && buscando && (
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              id="busca-da-turma"
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite aqui"
              aria-label={ROTULOS.buscar}
              className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-14 text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="tap absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-textMuted"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : children.length === 0 ? (
          <EmptyState icon={Users} title={ROTULOS.vaziaTitulo} description={VAZIA_TEXTO.texto} />
        ) : (
          grupos.map((g) => (
            <section key={g.chave} className="space-y-1">
              {/* `key` é só o grupo: com a entrada na chave, salvar a entrada
                * remontava o cabeçalho e apagava a proposta aberta (M3). */}
              <CabecalhoDaEscola key={g.chave} grupo={g} salvador={salvador} criancasAoVivo={porId} />
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {g.criancas.map((child) => (
                  <LinhaDaTurma
                    key={child.id}
                    child={child}
                    escolas={escolas}
                    aberta={aberta === child.id}
                    onAlternar={() => setAberta((a) => (a === child.id ? null : child.id))}
                    tocou={tocados.has(child.id)}
                    agora={agora}
                    salvador={salvador}
                    onEnviado={marcarTocado}
                    onLinkNovo={esquecerToque}
                    onPedirValor={abrirCrianca}
                    onAbrirFicha={() => setFichaDe(child.id)}
                    onRecado={() => setRecadoDe(child.id)}
                    onTirar={() => setTirarDe(child)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        {!loading && <AdicionarCrianca escola={ultimaEscola} anterior={anterior} />}

        <button
          type="button"
          onClick={() => navigate('/tio/children/new')}
          className="tap min-h-12 w-full text-base font-semibold text-primary"
        >
          {ROTULOS.cadastroCompleto}
        </button>
      </div>

      <ChildDetailSheet open={!!fichaDe} childId={fichaDe} onClose={() => setFichaDe(null)} />

      {criancaDoRecado && (
        <RecadoDaRota
          open={!!criancaDoRecado}
          onClose={() => setRecadoDe(null)}
          child={criancaDoRecado}
          adminUid={user?.uid}
          tipoInicial="other"
        />
      )}

      <ConfirmDialog
        open={!!tirarDe}
        title={textoTirar?.titulo || ''}
        description={
          textoTirar && (
            <>
              {textoTirar.linhas.map((l) => (
                <span key={l} className="block">{l}</span>
              ))}
              <span className="mt-2 block text-textMuted">{textoTirar.pagamentos}</span>
            </>
          )
        }
        confirmLabel={ROTULOS.tirarDaTurma}
        cancelLabel={ROTULOS.voltar}
        variant="danger"
        loading={tirando}
        ignorarToquesMs={400}
        onConfirm={tirar}
        onCancel={() => setTirarDe(null)}
      />
    </>
  );
}

/**
 * O CONTADOR DO TOPO, num cartão de ~100 px (achado M6): quantas famílias
 * estão no app, a barra, e um botão que manda o convite da PRÓXIMA que falta
 * — com o nome dela no botão, um toque por família. Depois do toque o botão
 * já aponta a seguinte. A linha do valor do convite e o "Próxima:" saíram
 * daqui (o nome está no botão); quem está fora da rota mora no "A completar".
 */
function ContadorDeConvites({ convites, proxima, agora, onEnviado, onLinkNovo, onPedirValor }) {
  const pct = convites.total ? Math.round((convites.entraram / convites.total) * 100) : 0;
  const primeiro = String(proxima?.name || '').trim().split(/\s+/)[0];
  return (
    <section className="space-y-2 rounded-2xl bg-card px-3 py-2.5 shadow-rest" aria-label="Famílias no app">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-base font-bold leading-tight text-text">
          {contadorDeFamilias(convites.entraram, convites.total)}
        </p>
        <div className="h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-neutro" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {proxima ? (
        <ConviteEnxuto
          key={proxima.id}
          crianca={proxima}
          forma="barra"
          agora={agora}
          rotulo={primeiro ? ROTULOS.convidarAFamiliaDe(primeiro) : ROTULOS.mandarParaQuemFalta}
          onEnviado={onEnviado}
          onLinkNovo={onLinkNovo}
          onPedirValor={onPedirValor}
        />
      ) : (
        convites.faltam > 0 && <p className="text-sm text-textMuted">{TODAS_CONVIDADAS.texto}</p>
      )}
    </section>
  );
}
