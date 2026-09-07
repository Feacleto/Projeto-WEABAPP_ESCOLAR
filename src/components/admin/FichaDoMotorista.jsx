import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  FileText,
  HandCoins,
  MessageSquare,
  Receipt,
  Route,
  Save,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ContratoDoc from './ContratoDoc';
import ConcederSheet from './ConcederSheet';
import Spinner from '../common/Spinner';
import { formatCurrency, formatMonthLabel } from '../../compartilhado/formatters';
import { degrauDo, mensalidadeDe } from '../../dominio/associacao/carteira.js';
import { condicoesVigentes } from '../../dominio/associacao/concessao.js';
import { diasSemRodar } from '../../dominio/associacao/risco.js';
import { diasRestantes } from '../../dominio/associacao/trial.js';
import { estadoDaConta } from '../../dominio/associacao/contaAtiva.js';
import { linkDaProposta, mensagemDeProposta } from '../../dominio/associacao/proposta.js';
import { planoPara, planoPorId } from '../../dominio/associacao/planos.js';
import {
  getParceiro,
  revogarConcessao,
  setNotaInterna,
  watchFaturasDoParceiro,
} from '../../services/taxaService';
import { contratoVigente } from '../../services/contratoAssociacaoService';
import { gmvDoParceiro } from '../../services/adminMetricsService';

/**
 * A FICHA DO MOTORISTA — tudo o que a plataforma sabe sobre um associado,
 * numa superfície só.
 *
 * ── POR QUE ELA PRECISOU EXISTIR
 * O painel media o negócio e não deixava fazer nada com ele. O motorista
 * aparecia em pedaços — agregado na Visão geral, linha de cobrança na Taxa — e
 * nenhuma das duas permitia agir. Não existia "abrir o motorista X".
 *
 * ── ELA NÃO CARREGA CRIANÇA, E ISSO É REGRA
 * `users.criancasAtivas` responde o tamanho da operação. Foi por precisar da
 * SOMA DAS MENSALIDADES que a tela antiga varria `children` inteira, trazendo
 * endereço, escola e telefone de família para o navegador do dono. O preço de
 * tabela depende do número, e o número já está materializado.
 *
 * ── O QUE ELA BUSCA SOB DEMANDA, E POR QUÊ
 * Contrato, faturas, nota interna e GMV são por parceiro. Carregá-los para
 * todos na abertura da aba seria ler a base inteira para mostrar um de cada
 * vez. Aqui é uma leitura por ficha aberta, e a lista responde ao toque na
 * hora.
 *
 * ── O TERMÔMETRO VEM DE FORA, PRONTO
 * `risco` desce por prop da lista, que já o calculou com as faturas de todo
 * mundo. Recalcular aqui, com outra fonte, faria o mesmo motorista aparecer
 * num nível na lista e noutro na ficha — e quem visse os dois pararia de
 * confiar nos dois.
 *
 * E ele aparece como LISTA DE MOTIVOS, nunca como número: score sem
 * explicação ninguém usa duas vezes.
 *
 * ── A PROPOSTA LÊ O DEGRAU
 * O botão não é um só com quatro textos escritos na tela: `proposta.js` decide
 * o que dizer a partir do degrau, com os números dele dentro. E abre o WhatsApp
 * com o texto pronto — que o dono LÊ e edita antes de enviar. É o que separa
 * proposta de disparo.
 */
export default function FichaDoMotorista({
  motorista,
  nota,
  risco,
  mes,
  onVoltar,
  onSuspender,
  onMudou,
}) {
  const [parceiro, setParceiro] = useState(null);
  const [contrato, setContrato] = useState(undefined);
  const [faturas, setFaturas] = useState(null);
  const [gmv, setGmv] = useState(undefined);
  const [verContrato, setVerContrato] = useState(false);
  const [concedendo, setConcedendo] = useState(false);

  const uid = motorista?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    let vivo = true;
    // NÃO HÁ RESET DE ESTADO AQUI, e é de propósito: quem monta esta ficha
    // passa `key={uid}` (ver `MotoristasTab`), então trocar de motorista
    // remonta o componente e o estado nasce limpo. Zerar por efeito faria a
    // ficha antiga aparecer por um render antes de sumir — e é assim que o
    // dono lê o contrato de um no cabeçalho do outro.
    getParceiro(uid).then((p) => vivo && setParceiro(p || {})).catch(() => vivo && setParceiro({}));
    contratoVigente(uid).then((c) => vivo && setContrato(c)).catch(() => vivo && setContrato(null));
    gmvDoParceiro(uid).then((v) => vivo && setGmv(v));

    const parar = watchFaturasDoParceiro(uid, (f) => vivo && setFaturas(f), () => vivo && setFaturas([]));
    return () => {
      vivo = false;
      parar?.();
    };
  }, [uid]);

  if (!motorista) return null;

  const agora = new Date();
  const degrau = degrauDo(motorista, agora);
  const conta = mensalidadeDe(motorista, mes);
  const plano = planoPorId(motorista.planoId);
  const ativas = Number(motorista.criancasAtivas) || 0;
  const faltam = motorista.trialInicio ? diasRestantes(motorista.trialInicio, agora) : null;
  const { motivo } = estadoDaConta({
    suspenso: motorista.suspenso === true,
    trialInicio: motorista.trialInicio || null,
    assinaturaAte: motorista.assinaturaAte || null,
    fatura: null,
    agora,
  });

  const parado = diasSemRodar(motorista, agora);
  const proposta = mensagemDeProposta({ motorista, degrau, conta, diasRestantes: faltam });
  const link = linkDaProposta(motorista.phone, proposta.texto);

  return (
    <div className="space-y-4">
      {/* O "voltar" só existe no celular: no desktop a lista continua ao lado,
        * e um botão de voltar ali seria um caminho para um lugar que não saiu
        * da tela. */}
      <button
        type="button"
        onClick={onVoltar}
        className="tap -ml-1 inline-flex items-center gap-1 p-1 text-xs text-textMuted lg:hidden"
      >
        <ArrowLeft size={14} /> Todos os motoristas
      </button>

      <header className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-text">
              {motorista.name || motorista.uid}
            </h2>
            <p className="mt-0.5 text-xs text-textMuted">
              {[motorista.email, motorista.city].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <Estado degrau={degrau} motivo={motivo} faltam={faltam} />
        </div>

        {/* AS AÇÕES FICAM NO TOPO porque a ficha é aberta para AGIR. Enterrar o
          * botão no fim da rolagem transforma a ficha em relatório de novo. */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tap inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white"
            >
              <MessageSquare size={13} />
              {proposta.assunto}
            </a>
          ) : (
            // Sem telefone, o botão some em vez de abrir uma conversa vazia —
            // que faz a pessoa achar que o app travou.
            <span className="inline-flex h-9 items-center rounded-xl bg-neutro px-3 text-xs text-textMuted">
              Sem telefone cadastrado
            </span>
          )}
          <button
            type="button"
            onClick={() => setConcedendo(true)}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-text"
          >
            <HandCoins size={13} />
            Conceder
          </button>
          <button
            type="button"
            onClick={() => onSuspender?.(motorista)}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-textMuted"
          >
            <Ban size={13} />
            {motorista.suspenso ? 'Reativar' : 'Suspender'}
          </button>
        </div>
      </header>

      {/* ⚠️ SÓ APARECE QUANDO ACENDE. Um bloco permanente de "tudo bem" vira
        * moldura, e moldura não é lida — e aí não é vista no dia em que tem
        * algo dentro. É a mesma regra do cabeçalho da caixa de chamados. */}
      {risco && risco.nivel !== 'nenhum' && (
        <section
          className={`rounded-2xl border p-4 ${
            risco.nivel === 'alto'
              ? 'border-dangerBorder bg-dangerSoft'
              : 'border-warningBorder bg-warningSoft'
          }`}
        >
          <h3
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
              risco.nivel === 'alto' ? 'text-dangerText' : 'text-warningText'
            }`}
          >
            <AlertTriangle size={11} />
            {risco.nivel === 'alto' ? 'Pode estar de saída' : 'Vale uma conversa'}
          </h3>
          <ul
            className={`mt-2 space-y-1 text-xs leading-relaxed ${
              risco.nivel === 'alto' ? 'text-dangerText' : 'text-warningText'
            }`}
          >
            {risco.sinais.map((s) => (
              <li key={s.id}>· {s.texto}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco icon={Route} titulo="Uso">
          {/* A DATA É O SINAL, O CONTADOR É O CONTEXTO. "Roda todo dia" e
            * "roda às terças" são operações diferentes, e a última rota
            * sozinha não distingue as duas. Ver `trialService.registrarRota`. */}
          <Linha
            rotulo="Última rota"
            valor={
              parado === null
                ? 'nunca rodou'
                : parado === 0
                  ? 'hoje'
                  : `há ${parado} ${parado === 1 ? 'dia' : 'dias'}`
            }
            forte
            alerta={parado !== null && parado >= 7}
          />
          <Linha
            rotulo="Rotas neste mês"
            valor={
              motorista.rotasNoMes?.mes === mes
                ? String(motorista.rotasNoMes.total || 0)
                : '0'
            }
          />
        </Bloco>

        <Bloco icon={Users} titulo="Plano e operação">
          <Linha rotulo="Faixa" valor={plano ? plano.rotulo : 'sem faixa'} forte />
          <Linha
            rotulo="Crianças"
            valor={
              plano
                ? `${ativas} de ${plano.ate}`
                : `${ativas} — pede ${planoPara(ativas)?.rotulo || 'conversa'}`
            }
            alerta={Boolean(plano && ativas > plano.ate)}
          />
          <Linha
            rotulo="Mensalidade"
            valor={conta && conta.liquido !== null ? formatCurrency(conta.liquido) : '—'}
          />
          {conta?.desconto > 0 && (
            <Linha
              rotulo="Desconto"
              valor={`${Math.round(conta.desconto * 100)}% sobre ${formatCurrency(conta.bruto)}`}
            />
          )}
          <Linha
            rotulo="GMV da operação"
            valor={gmv === undefined ? '…' : gmv === null ? '—' : formatCurrency(gmv)}
          />
        </Bloco>

        <Bloco icon={Star} titulo="O que as famílias dizem">
          {nota ? (
            <>
              <Linha rotulo="Nota" valor={`${nota.media.toFixed(1)} de 5`} forte />
              <Linha rotulo="Avaliações" valor={String(nota.n)} />
            </>
          ) : (
            // Zero e "ninguém avaliou" são coisas diferentes: uma é nota ruim,
            // a outra é ausência de opinião.
            <p className="text-xs text-textMuted">Nenhuma família avaliou ainda.</p>
          )}
        </Bloco>

        <Bloco icon={FileText} titulo="Contrato com a plataforma">
          {contrato === undefined ? (
            <Spinner />
          ) : !contrato ? (
            <p className="text-xs text-textMuted">
              Nenhum contrato emitido. Ele emite ao contratar a faixa, em Planos.
            </p>
          ) : (
            <>
              <Linha rotulo="Versão" valor={String(contrato.conteudo?.versao ?? '—')} />
              <Linha
                rotulo="Aceite"
                valor={
                  contrato.aceitoEm
                    ? `por ${contrato.aceitoPorNome || '—'} em ${new Date(
                        contrato.aceitoEm?.toDate?.() || contrato.aceitoEm
                      ).toLocaleDateString('pt-BR')}`
                    : 'aguardando'
                }
                alerta={!contrato.aceitoEm}
              />
              <button
                type="button"
                onClick={() => setVerContrato((v) => !v)}
                className="tap mt-2 text-xs font-bold text-primary underline"
              >
                {verContrato ? 'Fechar o documento' : 'Ver o documento'}
              </button>
              {verContrato && (
                <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                  <ContratoDoc dados={contrato.conteudo} aceite={contrato} />
                </div>
              )}
            </>
          )}
        </Bloco>

        <Bloco icon={Receipt} titulo="Faturas">
          {faturas === null ? (
            <Spinner />
          ) : !faturas.length ? (
            <p className="text-xs text-textMuted">Nenhuma fatura fechada ainda.</p>
          ) : (
            <ul className="space-y-1">
              {faturas.slice(0, 8).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-textMuted">{formatMonthLabel(f.mes)}</span>
                  <span className="tabular-nums">{formatCurrency(f.total)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      f.status === 'quitada'
                        ? 'bg-primarySoft text-primary'
                        : 'bg-warningSoft text-warningText'
                    }`}
                  >
                    {f.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Condicoes motorista={motorista} mes={mes} onMudou={onMudou} />

        <NotaInterna uid={uid} parceiro={parceiro} />
      </div>

      {concedendo && (
        <ConcederSheet
          motorista={motorista}
          onFechar={() => setConcedendo(false)}
          onPronto={onMudou}
        />
      )}
    </div>
  );
}

/* ─────────────── as condições especiais ─────────────── */

/**
 * TUDO O QUE ESTE ASSOCIADO TEM DE CONDIÇÃO ESPECIAL, com a espécie de cada.
 *
 * ⚠️ A COLUNA "RÉGUA / EXCEÇÃO" É O PONTO DA TABELA. Sem ela, "50%" de fundador
 * e "50%" de concessão parecem a mesma coisa — e são opostas: uma é política
 * que vale para todo mundo que se qualificar, a outra é dinheiro que o dono
 * abriu mão para uma pessoa.
 *
 * É essa distinção que impede o modelo negociado de voltar por dentro: sem ela,
 * seis meses depois metade da carteira tem "desconto" e ninguém sabe dizer qual
 * parte é tabela.
 */
function Condicoes({ motorista, mes, onMudou }) {
  const [revogando, setRevogando] = useState(false);
  const linhas = condicoesVigentes(motorista, mes);
  const temExcecao = linhas.some((l) => l.especie === 'excecao');

  const revogar = async () => {
    setRevogando(true);
    try {
      await revogarConcessao(motorista.uid);
      toast.success('Concessão revogada.');
      onMudou?.();
    } catch (err) {
      toast.error(err.message || 'Não deu pra revogar.');
    } finally {
      setRevogando(false);
    }
  };

  return (
    <Bloco icon={HandCoins} titulo="Condições vigentes">
      {!linhas.length ? (
        // Paga a tabela cheia — e isso é uma informação, não um vazio.
        <p className="text-xs text-textMuted">
          Nenhuma. Ele paga o preço de tabela da faixa dele.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {linhas.map((l) => (
            <li key={l.id} className="border-b border-border pb-1.5 last:border-0 last:pb-0">
              <p className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                      l.especie === 'excecao'
                        ? 'bg-warningSoft text-warningText'
                        : 'bg-neutro text-textMuted'
                    }`}
                  >
                    {l.especie === 'excecao' ? 'exceção' : 'régua'}
                  </span>
                  <span className="truncate text-textMuted">{l.rotulo}</span>
                </span>
                <span className="shrink-0 text-right font-bold text-text">{l.valor}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-textMuted">
                {/* ⚠️ "não expira" É UM AVISO, não um detalhe: o vitalício não
                  * se conserta no mês seguinte. */}
                {l.ate ? `até ${l.ate}` : 'não expira'}
                {l.motivo ? ` · ${l.motivo}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {temExcecao && (
        <button
          type="button"
          onClick={revogar}
          disabled={revogando}
          className="tap mt-3 text-xs font-bold text-dangerText underline disabled:opacity-40"
        >
          {revogando ? 'Revogando…' : 'Revogar a concessão'}
        </button>
      )}
    </Bloco>
  );
}

/* ─────────────── a nota interna ─────────────── */

/**
 * A NOTA INTERNA — o que o dono anota sobre o parceiro, e ele nunca lê.
 *
 * Mora em `taxaParceiros/{uid}`, que é `read: isOwner()` — nem o próprio
 * motorista alcança. É o mesmo lugar do CPF e do id no gateway, pelo mesmo
 * motivo.
 *
 * Ela existia e sumiu da tela quando a `TaxaTab` foi reescrita para o preço de
 * tabela. Campo que existe no modelo e não aparece em lugar nenhum vira dado
 * morto — e, pior, vira dado que alguém escreveu confiando que seria lido.
 */
function NotaInterna({ uid, parceiro }) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(null);

  // Ajuste durante o render em vez de efeito: sincronizar por efeito faz o
  // campo apagar o que a pessoa está digitando no render seguinte.
  if (parceiro && carregado !== uid) {
    setCarregado(uid);
    setTexto(parceiro.notaInterna || '');
  }

  const salvar = async () => {
    setSalvando(true);
    try {
      await setNotaInterna(uid, texto);
      toast.success('Nota salva.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Bloco icon={TrendingUp} titulo="Nota interna">
      <p className="mb-2 text-[11px] leading-relaxed text-textMuted">
        Só você lê. O motorista não alcança este campo.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        disabled={parceiro === null}
        className="w-full rounded-xl border border-border bg-surface p-2 text-xs text-text"
        placeholder="Conversou em agosto, prefere ser chamado à tarde…"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={salvando || parceiro === null}
        className="tap mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-text disabled:opacity-40"
      >
        <Save size={13} />
        {salvando ? 'Salvando…' : 'Salvar nota'}
      </button>
    </Bloco>
  );
}

/* ─────────────── peças ─────────────── */

function Estado({ degrau, motivo, faltam }) {
  const mapa = {
    contratado: ['bg-primarySoft text-primary', 'Ativo'],
    em_teste: ['bg-warningSoft text-warningText', faltam !== null ? `Em teste · ${faltam}d` : 'Em teste'],
    nao_comecou: ['bg-neutro text-textMuted', 'Não rodou ainda'],
    bloqueado: [
      'bg-dangerSoft text-dangerText',
      motivo === 'suspenso' ? 'Suspenso' : motivo === 'atraso' ? 'Em atraso' : 'Teste vencido',
    ],
  };
  const [skin, rotulo] = mapa[degrau] || mapa.nao_comecou;
  return (
    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${skin}`}>{rotulo}</span>
  );
}

function Bloco({ icon: Icon, titulo, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-xs">
      <h3 className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
        <Icon size={11} />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor, forte, alerta }) {
  return (
    <p className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-textMuted">{rotulo}</span>
      <span
        className={`text-right ${forte ? 'font-bold' : ''} ${
          alerta ? 'text-warningText' : 'text-text'
        }`}
      >
        {valor}
      </span>
    </p>
  );
}
