import { useMemo, useState } from 'react';
import { CheckCircle2, Fuel, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Skeleton from '../../components/common/Skeleton';
import AbasteciSheet from '../../components/financeiro/AbasteciSheet';
import EscolherPostoSheet from '../../components/financeiro/EscolherPostoSheet';
import { useAuth } from '../../hooks/useAuth';
import { useConfigDoFinanceiro, useDespesasRecentes } from '../../hooks/useDespesas';
import {
  definirCombustivelDaPerua,
  guardarPrecoNoPosto,
} from '../../services/configFinanceiroService';
import { posicaoNoPosto } from '../../services/locationService';
import { formatCurrency } from '../../compartilhado/formatters';
import { leituraDeKm, paraData } from '../../dominio/cobranca/historicoDeDespesas.js';
import {
  TIPOS_DE_COMBUSTIVEL,
  abastecimentosDe,
  enderecoDoPosto,
  litrosParaEncher,
  litrosPorValor,
  mesmoPosto,
  nomeDoPosto,
  postosEmOrdem,
  postosPerto,
  precoEm12Meses,
  rotuloDoTipo,
  ultimoNoPosto,
  valorPorLitros,
} from '../../dominio/cobranca/combustivel.js';

/**
 * ABASTECER — /tio/abastecer (03/10/2026, maquete aprovada pelo dono).
 *
 * FORA DA SENHA DO FINANCEIRO, de propósito: é a tela do posto, com a bomba
 * ligada e às vezes com a auxiliar no volante. A conta do litro não é segredo
 * do negócio; o que é segredo (o caixa, as mensalidades) continua atrás da
 * senha.
 *
 * DE CIMA PARA BAIXO, NA ORDEM EM QUE ELE PENSA NA BOMBA: onde estou, quanto
 * está o litro, quanto quero pôr, quanto dá. Uma coluna, a resposta logo
 * abaixo da pergunta, e a ação ("Abasteci") colada na resposta. O histórico
 * fica no fim — é consulta, não decisão.
 *
 * O TIPO DE COMBUSTÍVEL É DA PERUA, perguntado UMA vez. Perguntar a cada
 * abastecimento seria uma decisão a mais na hora em que ele tem menos
 * atenção sobrando. Desde 04/10/2026 ele fica num cartão acima dos
 * abastecimentos, com "Colocar outro combustível dessa vez" (vale só para
 * este abastecimento); mudar o da perua de vez mora dentro desse cartão.
 *
 * ⚠️ "VOCÊ ESTÁ NO POSTO AGORA?" (04/10/2026, pedido do dono). Com "Sim", a
 * posição é lida UMA vez (`posicaoNoPosto`): posto que ele já usou a menos de
 * 200 m é PERGUNTADO ("Você está no Posto Shell?"); posto novo ganha o
 * endereço, e ao lançar o ponto e o endereço vão para a lista de postos dele
 * (só ele lê). Com "Não", ou sem permissão, é o jeito de antes.
 *
 * ⚠️ O PREÇO NUNCA VEM PREENCHIDO: ele muda todo dia, e um número velho no
 * campo seria o errado na hora de pagar. Depois que ele digita o de hoje,
 * aparece A ÚLTIMA VEZ AQUI (data, preço, litros, combustível) — histórico,
 * não sugestão. Nenhum posto é recomendado.
 *
 * "ENCHER" SÓ APARECE QUANDO O APP SABE QUANTO CABE — a mediana de pelo
 * menos dois tanques cheios (`litrosParaEncher`). Sem isso, o atalho seria
 * um número inventado.
 *
 * Números aceitam vírgula e ponto: "6,33" e "6.33" são o mesmo litro.
 */

const ATALHOS = {
  reais: [100, 200, 300],
  litros: [20, 40, 50],
};

/** Quantos abastecimentos a tela lê — o bastante para 12 meses semanais. */
const QUANTOS = 50;
/** Quantos aparecem na lista. */
const NA_LISTA = 5;

/** "47,4", "47.4" e "1.000,50" viram número. Vazio ou zero, null. */
function numeroDoTexto(texto) {
  let t = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const soNumero = (v) => v.replace(/[^\d.,]/g, '');

const textoDe = (n, casas) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: false });

const umaCasa = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ateUmaCasa = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const diaCurto = (d) => {
  const data = paraData(d);
  return data
    ? `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
    : '';
};

export default function TioAbastecer() {
  const config = useConfigDoFinanceiro();
  return (
    <div className="pb-28">
      <Header title="Abastecer" showBack backTo="/tio/finance" />
      {config === null ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <Miolo config={config} />
      )}
    </div>
  );
}

function Miolo({ config }) {
  const { user } = useAuth();
  const recentes = useDespesasRecentes('fuel', QUANTOS);
  const hoje = useMemo(() => new Date(), []);
  const abastecimentos = useMemo(() => abastecimentosDe(recentes || []), [recentes]);

  // ── combustível: o da perua, ou outro SÓ DESTA VEZ ──
  const tipoDaPerua = config.combustivelDaPerua || null;
  const [tipoDessaVez, setTipoDessaVez] = useState(null);
  const tipo = tipoDessaVez || tipoDaPerua;
  const unidade = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === tipo)?.unidade || 'litros';
  const ehM3 = unidade === 'm³';
  const [mudandoTipo, setMudandoTipo] = useState(false);
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  // ── "Você está no posto agora?" ──
  // fase: pergunta → buscando → confirmar (achou posto dele perto) | novo
  // (posto que ele nunca usou) → confirmado; ou `nao` (o jeito de antes).
  const [noPosto, setNoPosto] = useState({ fase: 'pergunta' });
  const [enderecoEditado, setEnderecoEditado] = useState(null);

  // ── posto ──
  const postos = useMemo(() => postosEmOrdem(config.postos), [config.postos]);
  const postoPadrao = nomeDoPosto(postos[0]?.nome || '') || abastecimentos[0]?.posto || '';
  const [postoEscolhido, setPostoEscolhido] = useState(null);
  const [postoDigitado, setPostoDigitado] = useState('');
  const [escolhendoPosto, setEscolhendoPosto] = useState(false);
  const semPosto = !postoEscolhido && !postoPadrao;
  const posto =
    noPosto.fase === 'confirmado'
      ? noPosto.nome
      : noPosto.fase === 'novo'
        ? nomeDoPosto(postoDigitado)
        : postoEscolhido || postoPadrao || nomeDoPosto(postoDigitado);
  // O lugar só vai junto quando é posto NOVO: o de um posto conhecido já está
  // guardado, e reescrevê-lo com a leitura de hoje não acrescenta nada.
  const local =
    noPosto.fase === 'novo'
      ? { lat: noPosto.lat, lng: noPosto.lng, endereco: enderecoEditado ?? noPosto.endereco }
      : null;
  const esperandoConfirmar = noPosto.fase === 'confirmar' || noPosto.fase === 'buscando';

  // ── preço: SEMPRE digitado. O preço muda todo dia, e um número velho no
  // campo seria o número errado na hora de pagar. ──
  const [precoDigitado, setPrecoDigitado] = useState({ posto: null, texto: '' });
  const precoNaTela = precoDigitado.posto === posto ? precoDigitado.texto : '';
  const preco = numeroDoTexto(precoNaTela);
  const ultimaVez = ultimaVezNoPosto(postos, abastecimentos, posto);

  // ── quantidade ──
  const [modo, setModo] = useState('reais');
  const [qtdTexto, setQtdTexto] = useState('');
  const [encheu, setEncheu] = useState(false);
  const qtd = numeroDoTexto(qtdTexto);
  const paraEncher = litrosParaEncher(abastecimentos);

  let litros = null;
  let valor = null;
  if (preco && qtd) {
    if (modo === 'reais') {
      valor = qtd;
      litros = litrosPorValor(qtd, preco);
    } else {
      litros = qtd;
      valor = valorPorLitros(qtd, preco);
    }
  }

  const [abrindoFolha, setAbrindoFolha] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const responderTipo = async (chave) => {
    setSalvandoTipo(true);
    try {
      await definirCombustivelDaPerua(user?.uid, chave);
      setMudandoTipo(false);
      setTipoDessaVez(null);
    } catch (err) {
      toast.error(err?.message || 'Não deu pra guardar. Tente de novo.');
    } finally {
      setSalvandoTipo(false);
    }
  };

  const estouNoPosto = async () => {
    setNoPosto({ fase: 'buscando' });
    try {
      const lido = await posicaoNoPosto();
      const perto = postosPerto(config.postos, lido);
      setEnderecoEditado(null);
      setNoPosto(perto.length ? { fase: 'confirmar', candidatos: perto.slice(0, 3), ...lido } : { fase: 'novo', ...lido });
    } catch (err) {
      toast.error(
        err?.code === 'negado'
          ? 'O celular não deixou ver onde você está. Siga sem isso.'
          : 'Não deu pra achar onde você está. Siga sem isso.'
      );
      setNoPosto({ fase: 'nao' });
    }
  };

  const trocarModo = (novo) => {
    if (novo === modo) return;
    // O número que ele já tem na tela atravessa a troca: 300 reais viram os
    // 47,4 litros que eles compram, e não um campo vazio.
    if (novo === 'litros') setQtdTexto(litros ? textoDe(litros, 1) : '');
    else setQtdTexto(valor ? String(Math.round(valor)) : '');
    setModo(novo);
  };

  const atalho = (n) => {
    setQtdTexto(String(n));
    setEncheu(false);
  };

  const encher = () => {
    if (modo === 'reais' && preco) {
      setQtdTexto(String(Math.round(paraEncher * preco)));
    } else {
      setModo('litros');
      setQtdTexto(String(paraEncher));
    }
    setEncheu(true);
  };

  const guardarPreco = async () => {
    if (!posto) {
      toast.error('Escreva o nome do posto.');
      return;
    }
    if (!preco) {
      toast.error('Escreva o preço do litro.');
      return;
    }
    setGuardando(true);
    try {
      await guardarPrecoNoPosto(user?.uid, { nome: posto, preco, tipo, local });
      toast.success('Preço guardado');
    } catch (err) {
      toast.error(err?.message || 'Não deu pra guardar o preço.');
    } finally {
      setGuardando(false);
    }
  };

  const perguntar = !tipoDaPerua || mudandoTipo;

  return (
    <div className="space-y-4 p-4">
      {perguntar ? (
        <PerguntaDoCombustivel
          atual={tipoDaPerua}
          salvando={salvandoTipo}
          onEscolher={responderTipo}
          onCancelar={tipoDaPerua ? () => setMudandoTipo(false) : null}
        />
      ) : (
        <>
          {/* Onde estou */}
          {noPosto.fase === 'pergunta' || noPosto.fase === 'buscando' ? (
            <CartaoDaPergunta
              titulo="Você está no posto agora?"
              linha={noPosto.fase === 'buscando' ? 'Vendo onde você está…' : 'O app anota o endereço do posto.'}
            >
              <BotaoDeContorno onClick={estouNoPosto} disabled={noPosto.fase === 'buscando'} verde>
                Sim, estou
              </BotaoDeContorno>
              <BotaoDeContorno onClick={() => setNoPosto({ fase: 'nao' })} disabled={noPosto.fase === 'buscando'}>
                Não
              </BotaoDeContorno>
            </CartaoDaPergunta>
          ) : noPosto.fase === 'confirmar' ? (
            noPosto.candidatos.length === 1 ? (
              <CartaoDaPergunta
                titulo={`Você está no ${noPosto.candidatos[0].nome}?`}
                linha={noPosto.candidatos[0].endereco || ''}
              >
                <BotaoDeContorno verde onClick={() => setNoPosto({ fase: 'confirmado', nome: noPosto.candidatos[0].nome })}>
                  Sim, é esse
                </BotaoDeContorno>
                <BotaoDeContorno onClick={() => setNoPosto({ ...noPosto, fase: 'novo' })}>
                  Não é esse
                </BotaoDeContorno>
              </CartaoDaPergunta>
            ) : (
              <CartaoDaPergunta titulo="Em qual posto você está?" linha="Estes são os seus postos aqui perto." umaColuna>
                {noPosto.candidatos.map((c) => (
                  <BotaoDeContorno key={c.nome} verde onClick={() => setNoPosto({ fase: 'confirmado', nome: c.nome })}>
                    {c.nome}
                  </BotaoDeContorno>
                ))}
                <BotaoDeContorno onClick={() => setNoPosto({ ...noPosto, fase: 'novo' })}>Nenhum desses</BotaoDeContorno>
              </CartaoDaPergunta>
            )
          ) : noPosto.fase === 'confirmado' ? (
            <CartaoDoPosto
              nome={posto}
              linha={enderecoDoPosto(config.postos, posto) || rotuloDoTipo(tipo)}
              onTrocar={() => {
                setNoPosto({ fase: 'nao' });
                setEscolhendoPosto(true);
              }}
            />
          ) : noPosto.fase === 'novo' ? (
            <>
              <Input falar="nome" semSalvar
                label="Nome do posto"
                value={postoDigitado}
                onChange={(e) => setPostoDigitado(e.target.value)}
                maxLength={60}
                className="[&_label]:text-[17px] [&_label]:font-bold"
              />
              {enderecoEditado !== null ? (
                <Input semSalvar
                  label="Endereço do posto"
                  value={enderecoEditado}
                  onChange={(e) => setEnderecoEditado(e.target.value)}
                  maxLength={120}
                />
              ) : noPosto.endereco ? (
                <div className="flex items-center gap-3 rounded-2xl border border-primaryBorder bg-primarySoft px-3.5 py-3">
                  <CheckCircle2 size={22} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-textMuted">Endereço do posto</span>
                    <span className="block text-base font-bold text-text">{noPosto.endereco}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnderecoEditado(noPosto.endereco)}
                    className="tap min-h-12 shrink-0 px-2 text-base font-bold text-primary underline"
                  >
                    Corrigir
                  </button>
                </div>
              ) : null}
            </>
          ) : semPosto ? (
            <Input falar="nome" semSalvar
              label="Nome do posto"
              value={postoDigitado}
              onChange={(e) => setPostoDigitado(e.target.value)}
              maxLength={60}
              className="[&_label]:text-[17px] [&_label]:font-bold"
            />
          ) : (
            <CartaoDoPosto
              nome={posto}
              linha={`${rotuloDoTipo(tipo)}${!postoEscolhido ? ' · o da última vez' : ''}`}
              onTrocar={() => setEscolhendoPosto(true)}
            />
          )}

          {/* ENQUANTO ELE NÃO CONFIRMA O POSTO, O RESTO ESPERA: o preço e a
            * última vez dependem de qual posto é. `inert` tira o toque e o
            * leitor de tela; a opacidade diz que é o próximo passo. */}
          <div className={`space-y-4 ${esperandoConfirmar ? 'pointer-events-none opacity-40' : ''}`} inert={esperandoConfirmar || undefined}>
            {/* Quanto está o litro HOJE */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="abastecer-preco" className="text-[17px] font-bold text-text">
                Preço do {ehM3 ? 'm³' : 'litro'} na bomba hoje
              </label>
              <CampoGrande
                id="abastecer-preco"
                prefixo="R$"
                value={precoNaTela}
                onChange={(v) => setPrecoDigitado({ posto, texto: v })}
              />
              {/* A ÚLTIMA VEZ AQUI aparece DEPOIS que ele digita o preço de
                * hoje (pedido do dono): é histórico, nunca sugestão. */}
              {preco && ultimaVez && <UltimaVezNoPosto ultima={ultimaVez} />}
            </div>

            {/* Quanto quer pôr */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <label htmlFor="abastecer-qtd" className="text-[17px] font-bold text-text">
                  {modo === 'reais' ? 'Quanto quer pôr?' : ehM3 ? 'Quantos m³?' : 'Quantos litros?'}
                </label>
                <div
                  role="group"
                  aria-label="Em reais ou em litros"
                  className="inline-grid grid-cols-2 rounded-full border border-border bg-card p-[3px]"
                >
                  {[
                    ['reais', 'Reais'],
                    ['litros', ehM3 ? 'm³' : 'Litros'],
                  ].map(([chave, rotulo]) => (
                    <button
                      key={chave}
                      type="button"
                      aria-pressed={modo === chave}
                      onClick={() => trocarModo(chave)}
                      className={`tap h-12 min-w-[76px] rounded-full px-3.5 text-base font-bold ${
                        modo === chave ? 'bg-primary text-white' : 'bg-card text-textBody'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <CampoGrande
                id="abastecer-qtd"
                prefixo={modo === 'reais' ? 'R$' : unidade}
                value={qtdTexto}
                onChange={(v) => {
                  setQtdTexto(v);
                  setEncheu(false);
                }}
              />
              <div className={`grid gap-2 ${paraEncher ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {ATALHOS[modo].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => atalho(n)}
                    className="tap h-[52px] rounded-xl border-2 border-border bg-card px-1 text-base font-bold text-text"
                  >
                    {modo === 'reais' ? `R$ ${n}` : `${n} ${ehM3 ? 'm³' : 'l'}`}
                  </button>
                ))}
                {paraEncher && (
                  <button
                    type="button"
                    onClick={encher}
                    className="tap h-[52px] rounded-xl border-2 border-border bg-card px-1 text-base font-bold text-text"
                  >
                    Encher
                  </button>
                )}
              </div>
            </div>

            {/* Quanto dá. ⚠️ FUNDO SUAVE, NÃO VERDE CHEIO (04/10/2026, item
              * 17): o resultado é para LER, e o verde forte é do botão
              * "Abasteci" logo abaixo — dois blocos verdes empatavam, e quem
              * está com a bomba na mão tocava no número achando que era botão. */}
            <div className="flex flex-col gap-0.5 rounded-[20px] border border-primaryBorder bg-primarySoft p-[18px] text-text" aria-live="polite">
              <span className="text-base text-textBody">{modo === 'reais' ? 'Dá' : 'Vai dar'}</span>
              <span className="font-display text-[40px] font-extrabold leading-tight tabular-nums text-text">
                {litros && valor
                  ? modo === 'reais'
                    ? `${umaCasa(litros)} ${unidade}`
                    : formatCurrency(valor)
                  : '—'}
              </span>
              <span className="text-[15px] tabular-nums text-textBody">
                {litros && valor
                  ? (modo === 'reais'
                      ? `${formatCurrency(valor)} a ${formatCurrency(preco)} o ${ehM3 ? 'm³' : 'litro'}`
                      : `${umaCasa(litros)} ${unidade} a ${formatCurrency(preco)} o ${ehM3 ? 'm³' : 'litro'}`) +
                    (encheu && paraEncher
                      ? ` · encher é cerca de ${paraEncher} ${unidade}, pelo seu histórico`
                      : '')
                  : 'Preencha o preço e quanto quer pôr'}
              </span>
            </div>

            <Button onClick={() => setAbrindoFolha(true)} className="h-14 text-lg shadow-focus">
              Abasteci
            </Button>
            <button
              type="button"
              onClick={guardarPreco}
              disabled={guardando}
              className="tap min-h-12 w-full text-base font-bold text-primary underline disabled:opacity-60"
            >
              Guardar só o preço
            </button>
          </div>
        </>
      )}

      {/* O COMBUSTÍVEL À VISTA, ACIMA DOS ABASTECIMENTOS (04/10/2026, pedido
        * do dono). Era um link cinza no fim da tela, que ninguém via. Trocar
        * "dessa vez" vale só para este abastecimento; o da perua continua. */}
      {!perguntar && (
        <CartaoDoCombustivel
          tipoDaPerua={tipoDaPerua}
          tipoDessaVez={tipoDessaVez}
          onDessaVez={(chave) => setTipoDessaVez(chave === tipoDaPerua ? null : chave)}
          onMudarDeVez={() => setMudandoTipo(true)}
        />
      )}

      <Historico abastecimentos={abastecimentos} postos={config.postos} carregando={recentes === null} hoje={hoje} />

      <EscolherPostoSheet
        open={escolhendoPosto}
        onClose={() => setEscolhendoPosto(false)}
        postos={config.postos}
        escolhido={posto}
        onEscolher={(nome) => nome && setPostoEscolhido(nome)}
      />
      <AbasteciSheet
        open={abrindoFolha}
        onClose={() => setAbrindoFolha(false)}
        posto={posto}
        tipo={tipo}
        litros={litros}
        valor={valor}
        kmDasRotas={leituraDeKm(config.kmDasRotas)}
        local={local}
        onLancado={() => {
          setQtdTexto('');
          setEncheu(false);
        }}
      />
    </div>
  );
}

/**
 * A última vez naquele posto: o último abastecimento lançado lá (com litros e
 * combustível) ou, sem nenhum, o último preço anotado na lista de postos.
 */
function ultimaVezNoPosto(postos, abastecimentos, posto) {
  if (!posto) return null;
  const lancado = ultimoNoPosto(abastecimentos, posto);
  if (lancado?.precoLitro) {
    return { data: lancado.data, preco: lancado.precoLitro, litros: lancado.litros, valor: lancado.valor, tipo: lancado.tipo };
  }
  const guardado = postos.find((p) => mesmoPosto(p?.nome, posto));
  if (guardado && typeof guardado.preco === 'number') {
    return { data: paraData(guardado.vistoEm), preco: guardado.preco, tipo: guardado.tipo || null };
  }
  return null;
}

function UltimaVezNoPosto({ ultima }) {
  const un = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === ultima.tipo)?.unidade || 'litros';
  const detalhe = [
    ultima.litros ? `${ateUmaCasa(ultima.litros)} ${un}` : null,
    ultima.tipo ? rotuloDoTipo(ultima.tipo) : null,
    ultima.valor ? formatCurrency(ultima.valor) : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <span className="block text-sm text-textMuted">A última vez aqui{ultima.data ? ` · ${diaCurto(ultima.data)}` : ''}</span>
      <span className="block text-[17px] font-bold tabular-nums text-text">
        {formatCurrency(ultima.preco)} o {un === 'm³' ? 'm³' : 'litro'}
      </span>
      {detalhe && <span className="block text-[15px] tabular-nums text-textBody">{detalhe}</span>}
    </div>
  );
}

function CartaoDaPergunta({ titulo, linha, umaColuna = false, children }) {
  return (
    <section className="space-y-3 rounded-[20px] bg-card p-4 shadow-rest">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <MapPin size={22} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[19px] font-bold leading-tight text-text">{titulo}</span>
          {linha && <span className="block text-[15px] text-textMuted">{linha}</span>}
        </span>
      </div>
      <div className={`grid gap-2 ${umaColuna ? 'grid-cols-1' : 'grid-cols-2'}`}>{children}</div>
    </section>
  );
}

/** Contorno, nunca cheio: o único verde cheio da tela é o "Abasteci". */
function BotaoDeContorno({ verde = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap min-h-[52px] rounded-xl border-2 bg-card px-3 text-base font-bold disabled:opacity-60 ${
        verde ? 'border-primary text-primary' : 'border-border text-text'
      }`}
    >
      {children}
    </button>
  );
}

function CartaoDoPosto({ nome, linha, onTrocar }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-rest">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <MapPin size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-bold text-text">{nome}</span>
        <span className="block text-[15px] text-textMuted">{linha}</span>
      </span>
      <button
        type="button"
        onClick={onTrocar}
        className="tap min-h-12 shrink-0 px-2 text-base font-bold text-primary underline"
      >
        Trocar
      </button>
    </div>
  );
}

function CartaoDoCombustivel({ tipoDaPerua, tipoDessaVez, onDessaVez, onMudarDeVez }) {
  const [abrindo, setAbrindo] = useState(false);
  const atual = tipoDessaVez || tipoDaPerua;
  return (
    <section className="space-y-3 rounded-[20px] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
            <Fuel size={22} aria-hidden="true" />
          </span>
          <span className="text-[17px] font-bold text-text">{rotuloDoTipo(atual)}</span>
        </span>
        {tipoDessaVez && (
          <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-sm font-bold text-textBody">
            só dessa vez
          </span>
        )}
      </div>
      {abrindo ? (
        <>
          <p className="text-[15px] text-textMuted">Qual você colocou dessa vez?</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Combustível dessa vez">
            {TIPOS_DE_COMBUSTIVEL.map((t) => (
              <button
                key={t.chave}
                type="button"
                aria-pressed={atual === t.chave}
                onClick={() => {
                  onDessaVez(t.chave);
                  setAbrindo(false);
                }}
                className={`tap min-h-12 rounded-xl border-2 px-1 text-[15px] font-bold ${
                  atual === t.chave ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-textBody'
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onMudarDeVez}
            className="tap min-h-12 text-base font-bold text-primary underline"
          >
            Mudar o combustível da perua de vez
          </button>
        </>
      ) : (
        <BotaoDeContorno onClick={() => setAbrindo(true)}>Colocar outro combustível dessa vez</BotaoDeContorno>
      )}
    </section>
  );
}

function CampoGrande({ id, prefixo, value, onChange, descricao }) {
  return (
    <div className="flex h-16 items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 focus-within:border-primary">
      <span className="shrink-0 font-display text-[22px] font-bold text-textMuted" aria-hidden="true">
        {prefixo}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Digite aqui"
        aria-describedby={descricao}
        value={value}
        onChange={(e) => onChange(soNumero(e.target.value))}
        className="w-full min-w-0 flex-1 self-stretch bg-transparent font-display text-3xl font-extrabold tabular-nums text-text placeholder:font-sans placeholder:text-lg placeholder:font-normal placeholder:text-textMuted focus:outline-none"
      />
    </div>
  );
}

function PerguntaDoCombustivel({ atual, salvando, onEscolher, onCancelar }) {
  return (
    <section className="space-y-4 rounded-2xl bg-card p-5 shadow-rest">
      <h2 className="font-display text-xl font-bold text-text">Qual combustível sua perua usa?</h2>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Combustível da perua">
        {TIPOS_DE_COMBUSTIVEL.map((t) => (
          <button
            key={t.chave}
            type="button"
            disabled={salvando}
            aria-pressed={atual === t.chave}
            onClick={() => onEscolher(t.chave)}
            className={`tap h-14 rounded-full border-2 px-5 text-lg font-bold disabled:opacity-60 ${
              atual === t.chave
                ? 'border-primary bg-primarySoft text-primary'
                : 'border-border bg-card text-textBody'
            }`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="tap min-h-12 text-base font-bold text-primary underline"
        >
          Manter {atual ? rotuloDoTipo(atual) : 'como está'}
        </button>
      )}
    </section>
  );
}

function Historico({ abastecimentos, postos, carregando, hoje }) {
  const lista = abastecimentos.slice(0, NA_LISTA);
  const alta = precoEm12Meses(abastecimentos, hoje);
  return (
    <section className="overflow-hidden rounded-[20px] bg-card shadow-rest">
      <h2 className="px-4 pb-1 pt-3 font-display text-[17px] font-bold text-text">Seus abastecimentos</h2>
      {carregando ? (
        <p className="px-4 pb-3.5 text-base text-textMuted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="px-4 pb-3.5 text-base text-textMuted">
          Nenhum abastecimento com litros lançado ainda.
        </p>
      ) : (
        <ul>
          {lista.map((a, i) => {
            const un = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === a.tipo)?.unidade || 'litros';
            const detalhe = [a.posto, a.precoLitro ? `${formatCurrency(a.precoLitro)} o ${un === 'm³' ? 'm³' : 'litro'}` : null]
              .filter(Boolean)
              .join(' · ');
            // O endereço do posto, quando ele respondeu "estou no posto" lá.
            const endereco = enderecoDoPosto(postos, a.posto);
            return (
              <li
                key={a.id || i}
                className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2.5 ${i > 0 ? 'border-t border-neutro' : ''}`}
              >
                <span className="text-base font-bold tabular-nums text-text">
                  {diaCurto(a.data)} · {ateUmaCasa(a.litros)} {un}
                </span>
                <span className="text-right text-base font-bold tabular-nums text-text">
                  {formatCurrency(a.valor)}
                </span>
                <span className="text-sm tabular-nums text-textMuted">{detalhe}</span>
                <span className="text-right text-sm text-textMuted">{a.tanqueCheio ? 'tanque cheio' : ''}</span>
                {endereco && <span className="col-span-2 text-sm text-textMuted">{endereco}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {alta && (
        <div className="flex items-baseline justify-between gap-3 border-t border-neutro px-4 pb-3.5 pt-2.5">
          <span className="min-w-0 text-base text-textBody">Seu litro em 12 meses</span>
          <span className="whitespace-nowrap text-right text-base font-bold tabular-nums text-text">
            {formatCurrency(alta.antes)} → {formatCurrency(alta.agora)}
          </span>
        </div>
      )}
    </section>
  );
}
