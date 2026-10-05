import { useState } from 'react';
import { Undo2, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Header from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';
import { PLANO, precoDoMes } from '../../dominio/associacao/planos.js';
import { multaDeSaida, quedaNoProximoMes, FRACAO_DA_MULTA } from '../../dominio/associacao/multa.js';
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
 *
 * ── O CABEÇALHO É O `Header` DE TODA TELA INTERNA, mesmo fora do layout
 * O "Voltar" próprio, cinza e pequeno, era um dos quatro estilos de voltar do
 * app. O `Header` consome a história quando ela existe e cai em "Meu plano"
 * quando não existe (aviso, link ou recarga não jogam ninguém para fora). Sem
 * sino e sem rosto: a escuta do sino mora no `TioLayout`, e fora dele o sino
 * diria "nenhum aviso" a quem tem.
 *
 * ⚠️ O NOME É "ENCERRAR ASSOCIAÇÃO" nos três lugares que levam aqui (esta
 * tela, o link no fim de "Meu plano" e a linha do perfil). O perfil dizia
 * "Encerrar a associação" e a fatura "Encerrar minha associação": quem
 * procura a saída procura por um nome só.
 */
export default function TioEncerrar() {
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

  const confirmar = async (modo) => {
    setSalvando(true);
    try {
      await pedirEncerramento(user?.uid, modo);
      await refreshProfile();
      setConfirmando(null);
      toast.success('Sua assinatura foi encerrada. Você usa o app até a data combinada.');
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
      toast.success('Sua assinatura continua. Nada foi perdido.');
    } catch (err) {
      console.error('[encerrar] não deu pra religar:', err);
      toast.error('Não deu pra religar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <Header
        title={jaPediu ? 'Assinatura encerrando' : 'Encerrar assinatura'}
        showBack
        backLabel="Meu plano"
        backTo="/tio/taxa"
        showGlobal={false}
      />

      <div className="mx-auto max-w-mobile space-y-5 px-4 py-5">
        <p className="text-base leading-relaxed text-textMuted">
          {jaPediu
            ? 'Você já pediu para encerrar. Dá para voltar atrás até a data abaixo.'
            : 'Sem burocracia e sem ligar para ninguém. Leia o que muda antes de confirmar.'}
        </p>

        {/* ── quem nunca contratou não tem o que encerrar ──────────────── */}
        {!plano && !jaPediu && (
          <div className="rounded-2xl border border-border bg-card p-4 text-base leading-relaxed text-text">
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
              <p className="text-base leading-relaxed text-text">
                Sua conta funciona até{' '}
                <strong>{data(fimDaAssociacao(profile)) || 'o fim do período já pago'}</strong>.
                Não haverá nova cobrança depois disso.
              </p>
              {anual && modoDoPedido(profile) === MODO.FIM_DO_PERIODO && (
                <p className="mt-2 text-sm leading-relaxed text-textMuted">
                  Você escolheu cumprir o compromisso de 12 meses — as
                  mensalidades até lá continuam, e não há multa nenhuma.
                </p>
              )}
            </div>

            {podeReligar(profile) && (
              <div className="space-y-2">
                {/* ⚠️ A FRASE QUE A RÉGUA TORNA VERDADEIRA. Nada é apagado no
                  * caminho justamente para que isto não seja propaganda. */}
                <p className="text-base leading-relaxed text-text">
                  Mudou de ideia? <strong>Nada foi perdido.</strong> Religando
                  antes da data, seu plano
                  {porcentoTravado > 0 && ` e os seus ${porcentoTravado}% de desconto`}{' '}
                  continuam exatamente como estão.
                </p>
                <Button onClick={religar} loading={salvando} icon={Undo2}>
                  Manter minha assinatura
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── o pedido ─────────────────────────────────────────────────── */}
        {plano && !jaPediu && (
          <>
            {/* ⚠️ QUATRO ITENS CURTOS, E NENHUMA INFORMAÇÃO A MENOS.
              * Eram quatro parágrafos de 14px, e quem está decidindo sair lê o
              * começo de cada um e pula o resto — justamente onde estavam a
              * data e o valor. Agora cada item começa pelo que muda (em
              * negrito) e o detalhe vem logo atrás, em 16px. */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-lg font-bold text-text">
                O que acontece quando você encerra
              </h2>
              <ul className="mt-3 space-y-3 text-base leading-relaxed text-text">
                <li>
                  <strong>Você usa o app até o fim do período já pago</strong>
                  {fimDoPeriodoPago(profile) && (
                    <> — até {data(fimDoPeriodoPago(profile))}</>
                  )}
                  . Nada é desligado antes disso, e não nasce cobrança nova.
                </li>

                {/* ⚠️ O NÚMERO, NÃO A PALAVRA "DESCONTO". Ele é a informação que
                  * só a plataforma tem, e é a mais cara da decisão. */}
                {porcentoTravado > 0 && (
                  <li>
                    <strong>
                      Você perde os {porcentoTravado}% de desconto vitalício
                    </strong>{' '}
                    — hoje ele vale{' '}
                    {formatCurrency(Math.max(0, (preco.bruto || 0) - valorMensal))} por
                    mês. Ele vale enquanto o contrato estiver vigente; voltando
                    depois, você entra pela tabela do dia.
                  </li>
                )}

                <li>
                  <strong>Avise as suas famílias.</strong> Quem faz isso é você —
                  a plataforma não manda recado para os seus clientes. Depois da
                  data, o app delas deixa de acompanhar as rotas.
                </li>

                <li>
                  <strong>Seus dados continuam aqui.</strong> Encerrar não apaga
                  turma, histórico nem pagamento. Se voltar, está tudo onde estava.
                </li>
              </ul>
            </div>

            {/* ── o anual tem dois horizontes; o mensal tem um ──────────── */}
            {anual ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-text">Como você quer sair?</h2>
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
                        <strong>{formatCurrency(multa.valor)}</strong> — {Math.round(FRACAO_DA_MULTA * 100)}% do
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
                <p className="text-base text-textMuted">
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
                    Encerrar assinatura
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

/**
 * Uma das duas saídas do anual, com a confirmação embutida.
 *
 * ⚠️ O TÍTULO É O BOTÃO. O cartão tinha um título em negrito e, embaixo, um
 * botão com as MESMAS palavras — duas coisas iguais para ler, e a dúvida de
 * qual das duas se toca. Agora o cartão diz o que acontece e o botão diz o que
 * fazer, uma vez só.
 */
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
      <p className="text-base leading-relaxed text-text">{descricao}</p>
      <div className="mt-3">
        {confirmando ? (
          <Confirmacao
            onConfirmar={onConfirmar}
            onCancelar={onCancelar}
            salvando={salvando}
          />
        ) : (
          <Button variant="secondary" onClick={onEscolher}>
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
 *
 * A AÇÃO FICA À DIREITA, como no resto do app: "Não" à esquerda, "Sim,
 * encerrar" no canto onde a leitura termina.
 */
function Confirmacao({ quando, onConfirmar, onCancelar, salvando }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-bold text-text">
        Confirma o encerramento{quando ? ` a partir de ${quando}` : ''}?
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={onCancelar} disabled={salvando}>
          Não
        </Button>
        <Button variant="danger" size="md" onClick={onConfirmar} loading={salvando}>
          Sim, encerrar
        </Button>
      </div>
    </div>
  );
}
