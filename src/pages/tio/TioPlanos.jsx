import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import ConviteParaIndicar from '../../components/tio/ConviteParaIndicar';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';
import { contratarPlano } from '../../services/contratacaoService';
import { montarContrato } from '../../dominio/associacao/contratoAssociacao.js';
import { emitirContrato } from '../../services/contratoAssociacaoService';
import {
  PLANO,
  PLANOS_DISPONIVEIS,
  TAXA,
  MINIMO,
  precoDoMes,
  descontoDoFechamento,
} from '../../dominio/associacao/planos.js';
import { degrauDaDecisao, fimDoDegrau } from '../../dominio/associacao/trial.js';

/**
 * A TELA DE PLANOS — o motorista vê o próprio tamanho e escolhe o teto.
 *
 * ELA INFORMA ANTES DE OFERECER. O primeiro bloco não é uma vitrine de planos,
 * é o número de crianças ativas dele. Sem isso a tela pediria uma decisão sobre
 * um dado que só ele tem na cabeça — e o dado está no sistema.
 *
 * O PLANO CAPA QUANTIDADE, NUNCA FUNCIONALIDADE. Nenhum cartão aqui lista
 * "recursos incluídos", porque não existe recurso excluído: mapa ao vivo,
 * cobrança, agenda e relatório valem igual nas três faixas. O que muda é o
 * teto de crianças, que é `users.limiteCriancas` — campo que já existe e que
 * as rules já cobram no cadastro de criança.
 *
 * ELE PODE ESCOLHER MENOS DO QUE USA, e isso foi decisão de produto tomada com
 * o custo na mesa. O que a tela NÃO faz é escolher por ele quais crianças
 * saem: cada uma tem uma família pagando mensalidade, e um corte automático
 * ("as quatro últimas cadastradas") apagaria quatro clientes que ele não
 * escolheu perder. O cartão diz quantas ficariam de fora e manda ele apontar
 * quais, na tela de turma.
 *
 * O PREÇO MOSTRADO JÁ É O DELE. Fundador e indicações entram no número grande,
 * com o valor de tabela riscado ao lado — desconto que só aparece na fatura,
 * um mês depois, não ajuda ninguém a decidir hoje.
 *
 * ELE CONTRATA AQUI DENTRO desde 06/09/2026. Este parágrafo dizia o contrário
 * — "aceitar o plano ainda abre o WhatsApp do consultor" — e continuou dizendo
 * depois de o botão existir, vinte linhas abaixo.
 *
 * A objeção que ele levantava era real: emitir contrato mexe em
 * `contratosAssociacao` e em `limiteCriancas`, que são a parte de dinheiro do
 * sistema. A saída não foi abrir essas rules ao cliente — foi mover a escrita
 * para o servidor (`contratarPlano`) e fazer a rule do contrato exigir que o
 * documento bata com o plano que o servidor gravou.
 */
export default function TioPlanos() {
  const navigate = useNavigate();
  // ⚠️ O `uid` VEM DO `user`, NUNCA DO `profile`.
  //
  // `profile` é o `snap.data()` de `users/{uid}` (ver `getUserDoc`), e o
  // documento não guarda o próprio id — `uid` não está na whitelist do
  // `allow create` nem no payload do `redeemInvite`. `profile.uid` é
  // `undefined`, e `emitirContrato` começa com `if (!tioUid) throw`.
  //
  // O estrago era invisível porque a ORDEM é a pior possível: `contratarPlano`
  // já gravou faixa, limite, degrau e `assinaturaAte` quando a emissão
  // estoura. O motorista ficava cobrado, sem contrato, e a tela dele dizia
  // "Nenhum contrato emitido ainda" — sem botão. `TioContratoAssociacao` já
  // lia o `user.uid`; esta tela era a única que não.
  const { user, profile, refreshProfile } = useAuth();

  const ativas = Number(profile?.criancasAtivas) || 0;
  const fundador = profile?.condicaoFundador || null;
  const indicacoes = Number(profile?.indicacoesAtivas) || 0;

  // ⚠️ O MENSAL NASCE SELECIONADO, E NÃO O MAIS BARATO.
  //
  // O anual custa metade, então a tentação é abri-lo marcado. Mas ele pede
  // doze meses e tem multa de saída — pré-selecionar o compromisso é escolher
  // pela pessoa na única dimensão em que ela precisa escolher. O mensal é o
  // que não pede nada dela.
  const [escolhido, setEscolhido] = useState(PLANO.MENSAL);
  const mesAtual = getCurrentMonthKey();
  const [assinando, setAssinando] = useState(false);

  // ── O DEGRAU DA ESCADA, para a oferta do rodapé ─────────────────────────
  //
  // ⚠️ ESTA CONTA É SÓ PARA MOSTRAR. Quem grava o desconto é `contratarPlano`,
  // com o relógio do SERVIDOR, e é de lá que sai o número do toast — aqui o
  // "agora" é o relógio do aparelho. As duas usam a mesma régua e
  // `npm run testar:gateway` prova a igualdade; se divergirem, vale a do
  // servidor, e a tela é a que fica errada.
  const degrauAtual = degrauDaDecisao({
    inicio: profile?.trialInicio,
    agora: new Date(),
  });
  const fracaoDoDegrau = descontoDoFechamento(degrauAtual);
  const viraEm = fimDoDegrau(profile?.trialInicio, degrauAtual);
  // O degrau SEGUINTE, para a frase dizer para o que o desconto cai. Sem isso
  // a data é uma ameaça sem conteúdo: ele sabe que piora, não sabe quanto.
  const fracaoSeguinte =
    typeof degrauAtual === 'number' ? descontoDoFechamento(degrauAtual + 1) : 0;
  const dataCurta = (d) =>
    d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

  // JÁ CONTRATOU? A tela então não é de escolha, é de troca de plano.
  const jaContratou = Boolean(profile?.plano);

  /**
   * CONTRATAR — dois passos, e a ordem é a garantia.
   *
   * 1. A callable `contratarPlano` grava a CLÁUSULA (`users.plano` e o
   *    desconto do degrau). O cliente não escreve nenhum desses campos: as
   *    rules recusam, porque cláusula que o devedor edita não é cláusula.
   * 2. Só então o contrato é emitido, e a rule exige que o plano DENTRO dele
   *    seja igual ao que o servidor acabou de gravar.
   *
   * Invertida, a ordem não funciona: emitir antes seria emitir um documento
   * cujo plano ainda não existe em `users`, e a rule negaria.
   */
  const contratar = async () => {
    if (!escolhido) return;
    setAssinando(true);
    try {
      const clausula = await contratarPlano(escolhido);

      const conteudo = montarContrato({
        motorista: { uid: user?.uid, ...profile },
        plano: escolhido,
        criancas: ativas,
        fundador: profile?.condicaoFundador || null,
        indicacoesAtivas: indicacoes,
        descontos: clausula.descontos,
        diaVencimento: profile?.diaVencimento,
        isencaoAte: profile?.isencaoAte || null,
      });
      await emitirContrato({ tioUid: user?.uid, conteudo, emitidoPor: user?.uid });

      await refreshProfile();
      // ⚠️ O NÚMERO DO TOAST VEM DO SERVIDOR, não da régua local. `clausula` é
      // a resposta de `contratarPlano`, e é o servidor que decidiu o degrau
      // pelo relógio DELE. Recalcular aqui pelo relógio do aparelho poderia
      // anunciar 30% e gravar 10%.
      if (clausula.fechamento) {
        toast.success(
          `Plano contratado com ${Math.round((clausula.fracao || 0) * 100)}% de desconto travado — ele não expira.`,
          { duration: 7000 }
        );
      } else {
        toast.success('Plano contratado. Falta só aceitar o contrato.');
      }
      navigate('/tio/contrato-plataforma');
    } catch (err) {
      toast.error(err?.message || 'Não deu pra contratar agora.');
    } finally {
      setAssinando(false);
    }
  };

  // Ver o aviso no botão de Voltar, abaixo.
  const voltar = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/tio', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg px-4 py-5">
      <div className="mx-auto max-w-mobile space-y-5">
        {/* ⚠️ DESTINO NOMEADO NA FALTA DE HISTÓRIA, NUNCA `navigate(-1)` SOLTO.
          *
          * Estas três telas ficam FORA do `TioLayout` (têm que ficar: dentro do
          * `GuardaDaConta` o botão "Ver planos" navegava e a tela não mudava),
          * então não passam pelo `Header`, que é quem sabe checar histórico.
          *
          * Com `navigate(-1)` puro, quem chega aqui pelo aviso de cobrança, por
          * um link, ou recarregando a página sai DO APLICATIVO ao tocar em
          * Voltar — e sai justamente de uma tela de pagamento, que é a última
          * de onde alguém deveria ser expulso.
          *
          * `history.state.idx > 0` é o mesmo teste que o `Header` usa: consome
          * história quando ela existe (não empilha uma entrada nova, que faria
          * o botão físico do Android voltar para cá) e cai no destino quando
          * não existe. */}
        <button
          type="button"
          onClick={voltar}
          className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-textMuted"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <header>
          <h1 className="text-2xl font-bold text-text">Escolha seu plano</h1>
          <p className="mt-1 text-sm text-textMuted">
            O app é completo nos dois. O que muda é o prazo e a forma de sair.
            Sua mensalidade acompanha o número de crianças ativas.
          </p>
        </header>

        {/* O tamanho dele, antes de qualquer oferta. */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip">
            <Users size={19} className="text-primary" />
          </span>
          <div>
            <p className="text-sm text-textMuted">Sua operação hoje</p>
            <p className="text-lg font-bold text-text">
              {ativas} {ativas === 1 ? 'criança ativa' : 'crianças ativas'}
            </p>
            {/* ⚠️ CRESCER NÃO CUSTA O DESCONTO DELE, e o medo natural é o
              * oposto. O degrau travado é uma FRAÇÃO, então 30% de uma
              * operação maior é um desconto maior — dizer isso aqui é o que
              * impede a tela de parecer uma punição por crescer. */}
            <p className="mt-0.5 text-xs text-textMuted">
              Cadastrou mais uma criança? A conta ajusta sozinha, e seu desconto
              continua valendo.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {PLANOS_DISPONIVEIS.map((plano) => {
            // `descontos` E `mes` SAO OBRIGATORIOS AQUI, e ja faltaram uma vez.
            //
            // Sao eles que carregam o desconto de FECHAMENTO, o unico que
            // `users.descontos` guarda por regua. O cabecalho deste arquivo
            // afirma "O PRECO MOSTRADO JA E O DELE", e ja foi falso: a tela
            // mostrava a tabela e a fatura cobrava com desconto.
            //
            // Decidir contra um numero que o sistema nao vai cobrar e a forma
            // mais rapida de perder a confianca de quem esta pagando.
            const preco = precoDoMes({
              criancas: ativas,
              plano,
              fundador,
              indicacoesAtivas: indicacoes,
              descontos: profile?.descontos,
              mes: mesAtual,
            });
            const temDesconto = preco.desconto > 0;
            const selecionado = escolhido === plano;
            const anual = plano === PLANO.ANUAL;

            // ⚠️ O PREÇO COM O DESCONTO PRECISA SER UM NÚMERO NA TELA.
            //
            // O cartão mostrava R$ 118 e a linha abaixo prometia "30%" — e a
            // conta ficava com o motorista. É exatamente o que o preço linear
            // existe para eliminar: ele não deveria precisar multiplicar nada
            // para comparar os dois planos. Sem esta linha, o anual parece
            // metade do mensal quando na verdade é 30% mais barato que ele.
            const travando =
              !anual && !jaContratou && fracaoDoDegrau > 0
                ? precoDoMes({
                    criancas: ativas,
                    plano,
                    fundador,
                    indicacoesAtivas: indicacoes,
                    descontos: [
                      { origem: 'fechamento', fracao: fracaoDoDegrau, ate: null },
                    ],
                    mes: mesAtual,
                  })
                : null;
            // ⚠️ O MÍNIMO PRECISA APARECER QUANDO ELE MORDE, e só quando morde.
            // Quem tem 5 crianças paga o mínimo, e sem esta linha a conta
            // "5 × R$ 5,90" não fecha com o número grande ao lado.
            const noMinimo = ativas * TAXA[plano] < MINIMO[plano];

            return (
              <button
                key={plano}
                type="button"
                onClick={() => setEscolhido(plano)}
                className={`tap w-full rounded-xl border-2 p-4 text-left transition ${
                  selecionado
                    ? 'border-primary bg-primarySoft shadow-focus'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {anual ? 'Anual' : 'Mensal'}
                    </p>
                    <p className="mt-0.5 text-xs text-textMuted">
                      {noMinimo ? (
                        <>mínimo de {formatCurrency(MINIMO[plano])} por mês</>
                      ) : (
                        <>
                          {ativas} × {formatCurrency(TAXA[plano])} por criança
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {temDesconto && (
                      <p className="text-xs text-textMuted line-through">
                        {formatCurrency(preco.bruto)}
                      </p>
                    )}
                    <p className="text-xl font-bold text-text">
                      {formatCurrency(travando ? travando.liquido : preco.liquido)}
                    </p>
                    <p className="text-[11px] text-textMuted">por mês</p>
                    {/* O de tabela fica visível ao lado do travado — sem ele o
                      * desconto é uma afirmação sem referência. */}
                    {travando && (
                      <p className="text-[11px] text-textMuted line-through">
                        {formatCurrency(preco.liquido)}
                      </p>
                    )}
                  </div>
                </div>

                {/* ⚠️ O QUE CADA PLANO TROCA, e não o que ele inclui.
                  * Nenhum cartão lista "recursos", porque não existe recurso
                  * excluído: o app é completo nos dois. O que muda é prazo e
                  * saída, e é só isso que estas linhas dizem. */}
                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-textMuted">
                  {anual ? (
                    <>
                      <li>· Compromisso de 12 meses.</li>
                      <li>· Saída antes do prazo: multa de 20% do valor restante.</li>
                      <li>· Nos primeiros 30 dias, sem multa.</li>
                    </>
                  ) : (
                    <>
                      <li>· Sem prazo. Cancele quando quiser.</li>
                      <li>· Sem multa e sem aviso prévio.</li>
                      {travando && (
                        <li className="font-semibold text-accentText">
                          · Contratando hoje:{' '}
                          {Math.round(fracaoDoDegrau * 100)}% de desconto
                          permanente.
                        </li>
                      )}
                    </>
                  )}
                </ul>

                {selecionado && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Check size={14} /> Plano escolhido
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {(fundador || indicacoes > 0) && (
          <div className="rounded-xl border border-primaryBorder bg-primarySoft p-4 text-sm">
            <p className="font-semibold text-text">Seus descontos já estão no preço</p>
            <ul className="mt-1.5 space-y-1 text-textMuted">
              {fundador && <li>· Condição de fundador</li>}
              {indicacoes > 0 && (
                <li>
                  · {indicacoes} {indicacoes === 1 ? 'indicação ativa' : 'indicações ativas'}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* ⚠️ ESTA TELA SÓ FALAVA DA INDICAÇÃO PARA QUEM JÁ TINHA UMA.
          *
          * O bloco acima existe desde sempre e mostra o desconto que ele JÁ
          * ganhou. Quem tem zero — que é todo mundo no começo — nunca via a
          * palavra "indicação" aqui, na única tela do produto em que ele está
          * comparando dois preços e pensando em quanto paga.
          *
          * E é a única alavanca que ELE controla: o degrau depende de quando
          * decidir, o plano é uma escolha de uma vez só, e o tamanho da
          * operação não é escolha nenhuma. Indicar é a coisa que ele pode
          * fazer amanhã e ver na conta. */}
        <ConviteParaIndicar
          className="mt-4"
          titulo="Dá para baixar isso ainda mais"
        />

        {/* CONTRATAR ACONTECE AQUI DENTRO desde 06/09/2026.
          *
          * Este botão abria o WhatsApp do consultor, e o motivo era real:
          * emitir contrato mexe em `contratosAssociacao`, que é rule de
          * dinheiro. A saída não foi abrir essa rule — foi mover a escrita
          * para o servidor. A callable grava a cláusula, e a rule do contrato
          * exige que o documento bata com ela. O cliente ganhou o botão sem
          * ganhar a caneta.
          *
          * ⚠️ NÃO HÁ MAIS RAMO DE WHATSAPP. Ele existia para quem estava ACIMA
          * DA TABELA, e "acima da tabela" deixou de existir em 10/09/2026: com
          * preço linear, a operação de 60 crianças tem preço tanto quanto a de
          * 6. Mandar o maior associado da base conversar era o único caso em
          * que esta tela não sabia responder. */}
        <Button onClick={contratar} disabled={assinando || !escolhido}>
          {assinando
            ? 'Contratando…'
            : jaContratou
              ? 'Trocar para este plano'
              : escolhido === PLANO.ANUAL
                ? 'Contratar o anual'
                : 'Contratar o mensal'}
        </Button>

        {/* A OFERTA APARECE ONDE A DECISÃO ACONTECE, e some sozinha quando
          * deixa de valer — quem já contratou não vê promessa que já recebeu,
          * e quem passou do teste não vê uma que não vai receber.
          *
          * ⚠️ ELA VEM COM A DATA EM QUE MUDA, e sem a data não é urgência, é
          * pressão: "decida logo" não é um prazo.
          *
          * ⚠️ E O PREÇO NUNCA SOBE SE ELE RECUSAR. Não há segunda oferta nesta
          * tela, e é decisão de negócio: desconto que sobe a cada "não" ensina
          * a recusar, e prova que o preço era teatro. Ver docs/descontos.md,
          * peça 3 — as respostas ao "não" cedem informação, risco e prazo,
          * nunca preço.
          *
          * ⚠️ E A OFERTA É DO MENSAL, SÓ DELE. A escada não existe no anual,
          * cujo desconto já está no preço. Mostrar a frase com o anual
          * selecionado prometeria um desconto que o servidor não vai gravar. */}
        {!jaContratou && escolhido === PLANO.MENSAL && fracaoDoDegrau > 0 && (
          <p className="text-center text-xs leading-relaxed text-textMuted">
            Contratando {viraEm ? <>até <strong>{dataCurta(viraEm)}</strong></> : 'agora'}, você
            garante{' '}
            <strong className="text-accentText">
              {Math.round(fracaoDoDegrau * 100)}% de desconto permanente
            </strong>.
            {fracaoSeguinte > 0 && (
              <> Depois dessa data, a melhor condição passa a ser{' '}
              {Math.round(fracaoSeguinte * 100)}%.</>
            )}
          </p>
        )}

        <p className="pb-4 text-center text-xs text-textMuted">
          A mensalidade que você cobra das famílias é sua. A plataforma não
          entra no caminho dela.
        </p>
      </div>
    </div>
  );
}
