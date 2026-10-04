import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, CircleCheck, FileText, Flag, Folder, Shield, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Sheet from '../../components/common/Sheet';
import SeloDoNivel from '../../components/nivel/SeloDoNivel';
import { METAL_DO_NIVEL } from '../../config/paletaCategorica';
import { useAuth } from '../../hooks/useAuth';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { calcularNivel } from '../../dominio/identidade/nivel.js';
import { marcarMarcoDeclarado } from '../../services/trilhaService';

/**
 * MEU NEGÓCIO — /tio/finance/negocio (docs/niveis.md, seção 6). A trilha do
 * negócio, que só o motorista vê: mora embaixo de `/tio/finance`, e por isso
 * fica atrás da senha do Financeiro sozinha (quem decide a tranca é o
 * CAMINHO — ver GuardaDoFinanceiro).
 *
 * Duas espécies de linha, e a tela não pode confundi-las:
 *   - ITEM: o APP confere ("o app confirmou"). Quando falta, o botão leva à
 *     tela onde aquilo se faz — nunca há "marcar como feito" à mão.
 *   - MARCO PARTICULAR: ele DECLARA ("você marcou"), com "Já fiz"/"Desfazer".
 *     ⚠️ Não conta para o nível (regra 2), e a tela diz isso no próprio bloco.
 *
 * O DESENHO (04/10/2026, mistura dos modelos B e C escolhida pelo dono): o
 * placar "N de M passos", "Seu negócio hoje" com o selo do Diamante, quatro
 * quadrados (um por fase; tocar abre a folha com os passos dela) e três blocos
 * que dobram — A fazer, Já feitos e Seus marcos.
 *
 * ⚠️ TEM QUE FICAR CLARO EM QUE FASE ELE ESTÁ (modelo D, 04/10/2026): o
 * cartão diz por extenso "Você está na fase 2 · Planejado" e "Já completou",
 * o quadrado dessa fase ganha borda, o brilho do Diamante e "Você está aqui",
 * e cada passo das dobras diz de que fase é.
 *
 * ⚠️ TRILHA E NÍVEL SÃO TELAS SEPARADAS, COM UMA PONTE SÓ: o Diamante. O selo
 * daqui leva a "Meu nível", e o Diamante de lá traz para cá. Nenhuma missão
 * do nível aparece aqui, nenhum passo da trilha aparece lá.
 *
 * ⚠️ A FASE 4 APARECE SEM PROMESSA: "Em breve", sem data e sem nome de
 * produto. Prometer prazo a um autônomo e não cumprir custa a confiança.
 *
 * Nada se mexe sozinho: as linhas mudam porque o dado mudou, sem animação.
 */

/** Onde cada item da trilha se faz. Item sem destino não ganha botão. */
const DESTINO_DO_ITEM = {
  despesasEmDoisMeses: { para: '/tio/finance/expenses', rotulo: 'Lançar despesa' },
  tanqueCheioDuasVezes: { para: '/tio/abastecer', rotulo: 'Abastecer' },
  usoDaPerua: { para: '/tio/finance/expenses', rotulo: 'Responder' },
  planoDaTroca: { para: '/tio/finance/reserva', rotulo: 'Fazer o plano' },
  reservaCriada: { para: '/tio/finance/reserva', rotulo: 'Criar a reserva' },
  contratoEmTodas: { para: '/tio/finance/turma', rotulo: 'Ver a turma' },
};

/** O ícone de cada fase no quadrado. */
const ICONE_DA_FASE = { organizado: Folder, planejado: Target, formalizado: FileText, protegido: Shield };

/**
 * "Seu negócio hoje" é a última fase completa EM SEQUÊNCIA a partir da 1:
 * completar a 3 sem a 2 não faz ninguém "Formalizado" antes de "Planejado".
 */
function faseDeHoje(fases) {
  let atual = null;
  for (const f of fases) {
    if (!f.contaParaDiamante || !f.completa) break;
    atual = f;
  }
  return atual ? atual.titulo : null;
}

/** A fase em que ele está: a primeira que conta e ainda não fechou. */
function faseAtual(fases) {
  return fases.find((f) => f.contaParaDiamante && !f.completa) || null;
}

export default function TioNegocio() {
  const navigate = useNavigate();
  const { fatos, carregando } = useFatosDoNivel();
  const [faseAberta, setFaseAberta] = useState(null);

  const trilha = useMemo(
    () => (carregando || !fatos ? null : calcularNivel(fatos).trilha),
    [fatos, carregando]
  );

  const contam = trilha ? trilha.fases.filter((f) => f.contaParaDiamante) : [];
  // Cada passo leva o nome da fase: nas dobras, ele precisa saber de onde é.
  const itens = contam.flatMap((f) => f.itens.map((i) => ({ ...i, fase: f })));
  const agora = trilha ? faseAtual(trilha.fases) : null;
  const completou = trilha ? faseDeHoje(trilha.fases) : null;
  const aFazer = itens.filter((i) => !i.feito);
  const feitos = itens.filter((i) => i.feito);
  const marcos = contam.flatMap((f) => f.marcos);
  const aberta = trilha && faseAberta ? trilha.fases.find((f) => f.id === faseAberta) : null;

  return (
    <div className="pb-28">
      <Header title="Meu negócio" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        {trilha === null ? (
          <>
            <Skeleton className="h-6 w-2/3 rounded-lg" />
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </>
        ) : (
          <>
            <p className="text-base leading-snug text-textBody">
              {feitos.length} de {itens.length} passos feitos. Só você vê.
            </p>

            {/* A ÚNICA PONTE COM O NÍVEL: o Diamante. O selo leva a "Meu
              * nível"; apagado enquanto a trilha não fecha. */}
            <section className="flex items-center justify-between gap-3 rounded-3xl bg-card p-4 shadow-rest">
              <div className="min-w-0">
                {agora ? (
                  <>
                    <p className="text-sm text-textMuted">Você está na fase {agora.numero}</p>
                    <p className="font-display text-2xl font-bold leading-tight text-text">{agora.titulo}</p>
                    <p className="text-sm text-textMuted">Já completou: {completou || 'nenhuma ainda'}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-textMuted">Seu negócio hoje</p>
                    <p className="font-display text-2xl font-bold leading-tight text-text">Trilha completa</p>
                    <p className="text-sm text-textMuted">As três fases estão feitas</p>
                  </>
                )}
              </div>
              <div className={`flex shrink-0 flex-col items-end ${trilha.completa ? '' : 'opacity-60'}`}>
                <SeloDoNivel nivel="diamante" onClick={() => navigate('/tio/nivel')} />
                {!trilha.completa && <span className="text-sm text-textMuted">Aonde a trilha leva</span>}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              {trilha.fases.map((fase) => (
                <QuadradoDaFase
                  key={fase.id}
                  fase={fase}
                  aqui={fase.id === agora?.id}
                  onAbrir={() => setFaseAberta(fase.id)}
                />
              ))}
            </div>
            <p className="px-1 text-sm leading-snug text-textMuted">
              As fases 1 a 3 completas, com a Platina, dão o Diamante.
            </p>

            <Dobravel titulo="A fazer" contagem={aFazer.length} destaque abertaDeInicio>
              {aFazer.length === 0 ? (
                <p className="py-3 text-base text-textMuted">Nada por fazer. Trilha completa.</p>
              ) : (
                <ul className="flex flex-col">
                  {aFazer.map((item, i) => <Item key={item.id} item={item} divisor={i > 0} comFase />)}
                </ul>
              )}
            </Dobravel>

            <Dobravel titulo="Já feitos" contagem={feitos.length}>
              {feitos.length === 0 ? (
                <p className="py-3 text-base text-textMuted">Nenhum ainda.</p>
              ) : (
                <ul className="flex flex-col">
                  {feitos.map((item, i) => <Item key={item.id} item={item} divisor={i > 0} comFase />)}
                </ul>
              )}
            </Dobravel>

            {marcos.length > 0 && (
              <Dobravel titulo="Seus marcos" contagem={marcos.length}>
                <p className="pt-1 text-sm leading-snug text-textBody">
                  Estes você mesmo marca, e eles não contam para o Diamante.
                </p>
                <ul className="flex flex-col">
                  {marcos.map((marco, i) => <Marco key={marco.id} marco={marco} divisor={i > 0} />)}
                </ul>
              </Dobravel>
            )}
          </>
        )}
      </div>

      <Sheet
        open={!!aberta}
        onClose={() => setFaseAberta(null)}
        title={aberta ? `${aberta.numero}. ${aberta.titulo}` : ''}
      >
        {aberta && (
          <div className="space-y-3 pb-1">
            <ul className="flex flex-col">
              {aberta.itens.map((item, i) => <Item key={item.id} item={item} divisor={i > 0} />)}
            </ul>
            {aberta.marcos.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl bg-neutro p-3">
                <p className="text-sm leading-snug text-textBody">
                  <b className="text-text">Seus marcos.</b> Você marca, e eles não contam para o Diamante.
                </p>
                <ul className="flex flex-col">
                  {aberta.marcos.map((marco, i) => <Marco key={marco.id} marco={marco} divisor={i > 0} />)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/**
 * Um quadrado por fase, com o número grande — o mesmo desenho do "Meu
 * transporte". A fase 4 aparece sem promessa: "Em breve", sem data.
 */
function QuadradoDaFase({ fase, aqui = false, onAbrir }) {
  const Icone = ICONE_DA_FASE[fase.id] || Folder;
  if (!fase.contaParaDiamante) {
    return (
      <div className="flex min-h-32 flex-col justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <Icone size={24} className="text-textMuted" aria-hidden />
        <div>
          <p className="text-base font-bold leading-tight text-textBody">{fase.numero}. {fase.titulo}</p>
          <p className="text-sm text-textMuted">Em breve</p>
        </div>
      </div>
    );
  }
  const feitos = fase.itens.filter((i) => i.feito).length;
  const total = fase.itens.length;
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`tap flex min-h-32 flex-col justify-between gap-3 rounded-2xl p-4 text-left ${
        aqui ? 'border-2 border-primary bg-card' : fase.completa ? 'border border-primary bg-primarySoft' : 'border border-border bg-card'
      }`}
      // A fase de agora brilha na cor do Diamante: é para lá que a trilha leva.
      style={aqui ? { boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${METAL_DO_NIVEL.diamante.brilho}, 0 0 18px 4px ${METAL_DO_NIVEL.diamante.brilho}80` } : undefined}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <Icone size={24} className="text-primary" aria-hidden />
        {fase.completa ? (
          <CircleCheck size={24} className="text-accentText" aria-label="Completa" />
        ) : (
          <span className="font-display text-xl font-bold tabular-nums text-text">{feitos}/{total}</span>
        )}
      </span>
      <span className="w-full">
        <span className="block text-base font-bold leading-tight text-text">{fase.numero}. {fase.titulo}</span>
        <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-neutro" aria-hidden>
          <span className="block h-full rounded-full bg-primary" style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} />
        </span>
        {aqui && (
          <span className="mt-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
            Você está aqui
          </span>
        )}
      </span>
    </button>
  );
}

/** Um bloco que dobra: o título é o botão, a seta diz se está aberto. */
function Dobravel({ titulo, contagem = null, destaque = false, abertaDeInicio = false, children }) {
  const [aberto, setAberto] = useState(abertaDeInicio);
  return (
    <section className="rounded-2xl bg-card shadow-rest">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="tap flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-base font-bold text-text"
      >
        <span className="flex items-center gap-2">
          {titulo}
          {contagem != null && (
            <span
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${
                destaque ? 'bg-primary text-white' : 'border border-border bg-surface text-textBody'
              }`}
            >
              {contagem}
            </span>
          )}
        </span>
        <ChevronDown size={22} className={`shrink-0 text-textMuted ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {aberto && <div className="px-4 pb-3">{children}</div>}
    </section>
  );
}

function Item({ item, divisor, comFase = false }) {
  const navigate = useNavigate();
  const destino = DESTINO_DO_ITEM[item.id];
  const classe = `flex min-h-16 items-center gap-3 py-3 ${divisor ? 'border-t border-neutro' : ''}`;

  if (item.feito) {
    return (
      <li className={classe}>
        <CircleCheck size={24} className="shrink-0 text-accentText" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">{item.titulo}</span>
          <span className="block text-sm text-accentText">
            {comFase && item.fase ? `Fase ${item.fase.numero} · o app confirmou` : 'O app confirmou'}
          </span>
        </span>
      </li>
    );
  }

  return (
    <li className={classe}>
      <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-base text-text">{item.titulo}</span>
        {comFase && item.fase && (
          <span className="block text-sm text-textMuted">Fase {item.fase.numero} · {item.fase.titulo}</span>
        )}
      </span>
      {destino && (
        <button
          type="button"
          onClick={() => navigate(destino.para)}
          className="tap flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold text-text"
        >
          {destino.rotulo}
          <ChevronRight size={18} aria-hidden />
        </button>
      )}
    </li>
  );
}

function Marco({ marco, divisor }) {
  const { user } = useAuth();
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await marcarMarcoDeclarado(user?.uid, marco.id, !marco.declarado);
    } catch (err) {
      console.error('[trilha] marco', err);
      toast.error('Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className={`flex min-h-16 items-center gap-3 py-2 ${divisor ? 'border-t border-border' : ''}`}>
      {marco.declarado ? (
        <Flag size={22} className="shrink-0 text-textBody" aria-hidden />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border bg-card" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base text-text">{marco.titulo}</span>
        {marco.declarado && <span className="block text-sm text-textMuted">Você marcou</span>}
      </span>
      <button
        type="button"
        onClick={alternar}
        disabled={salvando}
        className={`tap flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${
          marco.declarado ? 'text-textBody' : 'bg-primary text-white'
        }`}
      >
        {marco.declarado ? 'Desfazer' : 'Já fiz'}
      </button>
    </li>
  );
}
