import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Undo2, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';
import { PLANO, precoDoMes } from '../../dominio/associacao/planos.js';
import { multaDeSaida, quedaNoProximoMes } from '../../dominio/associacao/multa.js';
import {
  MODO,
  pediuEncerramento,
  modoDoPedido,
  fimDaAssociacao,
  fimDoCompromisso,
  fimDoPeriodoPago,
  podeReligar,
} from '../../dominio/associacao/encerramento.js';
import {
  pedirEncerramento,
  religarRenovacao,
} from '../../services/associadoService';

/**
 * ENCERRAR A ASSOCIAÇÃO — a cláusula 6 finalmente tendo um caminho no produto.
 *
 * ── ⚠️ ESTA TELA EXISTE PORQUE O CONTRATO A PROMETE
 * *"O ASSOCIADO pode encerrar a qualquer momento, sem aviso prévio e sem
 * multa, **pelo próprio aplicativo**."* Estava assinado e não existia. A régua
 * e os porquês estão em `dominio/associacao/encerramento.js`.
 *
 * ── ⚠️ ELA FICA FORA DO `GuardaDaConta`, como `/tio/planos` e `/tio/taxa`
 * Quem está bloqueado por atraso precisa conseguir sair. Tranca que prende
 * quem está tentando sair é o defeito que aquele guarda já teve uma vez, e o
 * comentário das três rotas no `App.jsx` conta a história inteira.
 *
 * ── ⚠️ O QUE ELE PERDE VEM ANTES DO BOTÃO, E COM O NÚMERO
 * O desconto vitalício é a coisa mais cara que ele deixa na mesa, e é a que
 * ele NÃO tem como saber sozinho — o app é o único lugar onde aquele número
 * existe. Esconder para reduzir cancelamento seria usar a assimetria de
 * informação contra o cliente; é a mesma decisão que faz `quedaNoProximoMes`
 * existir em `multa.js`, e ela está escrita lá.
 *
 * ── ⚠️ A PLATAFORMA NÃO AVISA AS FAMÍLIAS DELE — decisão do dono, 11/09/2026
 * O contrato com as famílias é DELE. A plataforma anunciar aos clientes dele
 * que ele cancelou seria se meter no negócio que ela hospeda. Então quem tem
 * que avisar é ele, e a tela diz isso antes de confirmar — senão a mãe
 * descobre pelo app apagado.
 *
 * ── ⚠️ NENHUM CONVITE A INDICAR AQUI, e isso é teste
 * `testar:indicacao` tem a lista fechada de onde `ConviteParaIndicar` pode
 * aparecer, e esta tela está entre as proibidas com o motivo escrito:
 * *"desconto que só aparece quando ele ameaça sair prova que o preço era
 * teatro"*. A cerca foi escrita antes desta tela nascer.
 */
export default function TioEncerrar() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  const plano = profile?.plano || null;
  const anual = plano === PLANO.ANUAL;
  const jaPediu = pediuEncerramento(profile);

  // ── o dinheiro de hoje, que é a base da multa e do que ele perde ────────
  const preco = precoDoMes({
    criancas: Number(profile?.criancasAtivas) || 0,
    plano: plano || PLANO.MENSAL,
    fundador: profile?.condicaoFundador || null,
    indicacoesAtivas: Number(profile?.indicacoesAtivas) || 0,
    descontos: profile?.descontos,
    mes: getCurrentMonthKey(),
  });
  const valorMensal = preco.liquido || 0;

  const fechamento = (profile?.descontos || []).find(
    (d) => d?.origem === 'fechamento' || d?.origem === 'antecipacao'
  );
  const porcentoTravado = fechamento ? Math.round((fechamento.fracao || 0) * 100) : 0;

  const multa = multaDeSaida({
    plano: plano || PLANO.MENSAL,
    valorMensal,
    inicio: profile?.contratadoEm,
  });
  const queda = quedaNoProximoMes({
    plano: plano || PLANO.MENSAL,
    valorMensal,
    inicio: profile?.contratadoEm,
  });

  const data = (d) =>
    d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  const voltar = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/tio/taxa', { replace: true });
  };

  const confirmar = async (modo) => {
    setSalvando(true);
    try {
      await pedirEncerramento(user?.uid, modo);
      await refreshProfile();
      setConfirmando(null);
      toast.success('Sua associação foi encerrada. Você opera até a data combinada.');
    } catch (err) {
      console.error('[encerrar] não deu pra registrar:', err);
      toast.error('Não deu pra registrar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const religar = async () => {
    setSalvando(true);
    try {
      await religarRenovacao(user?.uid);
      await refreshProfile();
      toast.success('Sua associação continua. Nada foi perdido.');
    } catch (err) {
      console.error('[encerrar] não deu pra religar:', err);
      toast.error('Não deu pra religar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-4 py-5">
      <div className="mx-auto max-w-mobile space-y-5">
        {/* Destino nomeado na falta de história — esta tela fica fora do
          * `TioLayout`, então não passa pelo `Header`, que é quem sabe checar
          * histórico. Ver o comentário das três rotas no `App.jsx`. */}
        <button
          type="button"
          onClick={voltar}
          className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-textMuted"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <header>
          <h1 className="text-2xl font-bold text-text">
            {jaPediu ? 'Sua associação está encerrando' : 'Encerrar minha associação'}
          </h1>
          <p className="mt-1 text-sm text-textMuted">
            {jaPediu
              ? 'Você já pediu para encerrar. Dá para voltar atrás até a data abaixo.'
              : 'Sem burocracia e sem ligar para ninguém. Leia o que muda antes de confirmar.'}
          </p>
        </header>

        {/* ── quem nunca contratou não tem o que encerrar ──────────────── */}
        {!plano && !jaPediu && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-text">
            <p>
              <strong>Você ainda não contratou um plano.</strong> Está no período
              de teste, e não existe cobrança nem compromisso para encerrar.
            </p>
            <p className="mt-2 text-textMuted">
              É só parar de usar quando quiser. Seus dados continuam aqui, e a
              conta volta a funcionar se você escolher um plano depois.
            </p>
          </div>
        )}

        {/* ── ele já pediu: a data, e o caminho de volta ───────────────── */}
        {jaPediu && (
          <>
            <div className="rounded-2xl border border-warning bg-warningChip p-4">
              <p className="text-sm leading-relaxed text-text">
                Sua conta funciona até{' '}
                <strong>{data(fimDaAssociacao(profile)) || 'o fim do período já pago'}</strong>.
                Não haverá nova cobrança depois disso.
              </p>
              {anual && modoDoPedido(profile) === MODO.FIM_DO_PERIODO && (
                <p className="mt-2 text-xs text-textMuted">
                  Você escolheu cumprir o compromisso de 12 meses — as
                  mensalidades até lá continuam, e não há multa nenhuma.
                </p>
              )}
            </div>

            {podeReligar(profile) && (
              <div className="space-y-2">
                {/* ⚠️ A FRASE QUE A RÉGUA TORNA VERDADEIRA. Nada é apagado no
                  * caminho justamente para que isto não seja propaganda. */}
                <p className="text-sm text-text">
                  Mudou de ideia? <strong>Nada foi perdido.</strong> Religando
                  antes da data, seu plano
                  {porcentoTravado > 0 && ` e os seus ${porcentoTravado}% de desconto`}{' '}
                  continuam exatamente como estão.
                </p>
                <Button onClick={religar} loading={salvando} icon={Undo2}>
                  Manter minha associação
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── o pedido ─────────────────────────────────────────────────── */}
        {plano && !jaPediu && (
          <>
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-text">
              <p className="font-bold">O que acontece quando você encerra</p>

              <p>
                <strong>Você opera até o fim do período já pago</strong>
                {fimDoPeriodoPago(profile) && (
                  <> — até {data(fimDoPeriodoPago(profile))}</>
                )}
                . Nada é desligado antes disso, e não nasce cobrança nova.
              </p>

              {/* ⚠️ O NÚMERO, NÃO A PALAVRA "DESCONTO". Ele é a informação que
                * só a plataforma tem, e é a mais cara da decisão. */}
              {porcentoTravado > 0 && (
                <p>
                  <strong>
                    Você perde os {porcentoTravado}% de desconto vitalício.
                  </strong>{' '}
                  Ele vale enquanto o contrato estiver vigente. Voltando depois,
                  você entra pela tabela do dia — e hoje ele vale{' '}
                  {formatCurrency(Math.max(0, (preco.bruto || 0) - valorMensal))} por
                  mês.
                </p>
              )}

              <p>
                <strong>Avise as suas famílias.</strong> Quem faz isso é você — a
                plataforma não manda recado para os seus clientes. Depois da
                data, o app delas deixa de acompanhar as rotas.
              </p>

              <p className="text-textMuted">
                <strong className="text-text">Seus dados continuam aqui.</strong>{' '}
                Encerrar não apaga turma, histórico nem pagamento. Se voltar, está
                tudo onde estava.
              </p>
            </div>

            {/* ── o anual tem dois horizontes; o mensal tem um ──────────── */}
            {anual ? (
              <div className="space-y-3">
                <SaidaDoAnual
                  titulo="Não renovar"
                  descricao={
                    <>
                      Você cumpre o compromisso até{' '}
                      <strong>{data(fimDoCompromisso(profile)) || 'o fim dos 12 meses'}</strong>{' '}
                      e o contrato não se renova. <strong>Sem multa.</strong>
                    </>
                  }
                  confirmando={confirmando === MODO.FIM_DO_PERIODO}
                  onEscolher={() => setConfirmando(MODO.FIM_DO_PERIODO)}
                  onConfirmar={() => confirmar(MODO.FIM_DO_PERIODO)}
                  onCancelar={() => setConfirmando(null)}
                  salvando={salvando}
                />
                <SaidaDoAnual
                  titulo="Encerrar agora"
                  descricao={
                    multa.devida ? (
                      <>
                        Você sai antes do fim dos 12 meses, e a multa é de{' '}
                        <strong>{formatCurrency(multa.valor)}</strong> — 20% do
                        saldo restante
                        {multa.tetoAplicado && ', já no teto de dois meses do seu plano'}
                        .{' '}
                        {/* ⚠️ UM NÚMERO QUE JOGA A FAVOR DELE, e por isso ele
                          * aparece. O cabeçalho de `multa.js` diz o porquê:
                          * esconder o que só a plataforma sabe é usar a
                          * assimetria de informação contra o cliente. */}
                        {queda > 0 && (
                          <>Esperando até o mês que vem, ela cai {formatCurrency(queda)}.</>
                        )}
                      </>
                    ) : (
                      <>
                        Você sai no fim do período já pago, <strong>sem multa</strong>
                        {multa.motivo === 'arrependimento' &&
                          ' — você ainda está nos primeiros 30 dias'}
                        {multa.motivo === 'compromisso-cumprido' &&
                          ' — o compromisso de 12 meses já foi cumprido'}
                        .
                      </>
                    )
                  }
                  confirmando={confirmando === MODO.AGORA}
                  onEscolher={() => setConfirmando(MODO.AGORA)}
                  onConfirmar={() => confirmar(MODO.AGORA)}
                  onCancelar={() => setConfirmando(null)}
                  salvando={salvando}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {/* O mensal: "cancelou, cancelou" — a promessa do plano, e ela
                  * não tem asterisco em lugar nenhum. */}
                <p className="text-sm text-textMuted">
                  No plano mensal não há multa nem aviso prévio.
                </p>
                {confirmando === MODO.AGORA ? (
                  <Confirmacao
                    quando={data(fimDoPeriodoPago(profile))}
                    onConfirmar={() => confirmar(MODO.AGORA)}
                    onCancelar={() => setConfirmando(null)}
                    salvando={salvando}
                  />
                ) : (
                  <Button
                    variant="secondary"
                    icon={DoorOpen}
                    onClick={() => setConfirmando(MODO.AGORA)}
                  >
                    Encerrar minha associação
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Uma das duas saídas do anual, com a confirmação embutida. */
function SaidaDoAnual({
  titulo,
  descricao,
  confirmando,
  onEscolher,
  onConfirmar,
  onCancelar,
  salvando,
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-text">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-textMuted">{descricao}</p>
      <div className="mt-3">
        {confirmando ? (
          <Confirmacao
            onConfirmar={onConfirmar}
            onCancelar={onCancelar}
            salvando={salvando}
          />
        ) : (
          <Button variant="secondary" size="md" onClick={onEscolher}>
            {titulo}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * O SEGUNDO TOQUE.
 *
 * ⚠️ ELE EXISTE, MAS NÃO É UM MURO. Um passo de confirmação evita o toque sem
 * querer numa decisão que muda a conta de alguém; três passos, uma pesquisa de
 * motivo e uma contraoferta seriam retenção por atrito — que é exatamente o
 * que o roteiro comercial deste projeto usa CONTRA o concorrente.
 */
function Confirmacao({ quando, onConfirmar, onCancelar, salvando }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-text">
        Confirma o encerramento{quando ? ` a partir de ${quando}` : ''}?
      </p>
      <div className="flex gap-2">
        <Button variant="danger" size="md" onClick={onConfirmar} loading={salvando}>
          Sim, encerrar
        </Button>
        <Button variant="ghost" size="md" onClick={onCancelar} disabled={salvando}>
          Não
        </Button>
      </div>
    </div>
  );
}
