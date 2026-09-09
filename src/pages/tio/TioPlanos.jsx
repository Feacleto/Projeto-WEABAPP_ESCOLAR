import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, MessageCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';
import { salesWhatsAppLink } from '../../config/developer';
import { contratarPlano } from '../../services/contratacaoService';
import { montarContrato } from '../../dominio/associacao/contratoAssociacao.js';
import { emitirContrato } from '../../services/contratoAssociacaoService';
import {
  PLANOS,
  planoPara,
  planoPorId,
  excedentes,
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
 * documento bata com a faixa que o servidor gravou.
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
  const recomendado = planoPara(ativas);
  const fundador = profile?.condicaoFundador || null;
  const indicacoes = Number(profile?.indicacoesAtivas) || 0;

  const [escolhido, setEscolhido] = useState(recomendado?.id || null);
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

  // JÁ CONTRATOU? A tela então não é mais de escolha, é de troca de faixa.
  const jaContratou = Boolean(profile?.planoId);

  /**
   * CONTRATAR — dois passos, e a ordem é a garantia.
   *
   * 1. A callable `contratarPlano` grava a CLÁUSULA (`planoId`,
   *    `limiteCriancas`, o desconto de antecipação). O cliente não escreve
   *    nenhum desses campos: as rules recusam, porque cláusula que o devedor
   *    edita não é cláusula.
   * 2. Só então o contrato é emitido, e a rule exige que a faixa DENTRO dele
   *    seja igual à que o servidor acabou de gravar.
   *
   * Invertida, a ordem não funciona: emitir antes seria emitir um documento
   * cuja faixa ainda não existe em `users`, e a rule negaria.
   */
  const contratar = async () => {
    const plano = planoPorId(escolhido);
    if (!plano) return;
    setAssinando(true);
    try {
      const clausula = await contratarPlano(plano.id);

      const conteudo = montarContrato({
        motorista: { uid: user?.uid, ...profile },
        plano,
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
      // anunciar 50% e gravar 30%.
      if (clausula.fechamento) {
        toast.success(
          `Faixa contratada com ${Math.round((clausula.fracao || 0) * 100)}% de desconto pelos 12 meses.`,
          { duration: 7000 }
        );
      } else {
        toast.success('Faixa contratada. Falta só aceitar o contrato.');
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
            O app é completo em qualquer plano. O que muda é quantas crianças
            você pode ter ativas ao mesmo tempo.
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
          </div>
        </div>

        <div className="space-y-3">
          {PLANOS.map((plano) => {
            const sobram = excedentes(plano, ativas);
            // `descontos` E `mes` SAO OBRIGATORIOS AQUI, e faltavam.
            //
            // Esta era a unica das cinco chamadas a `precoDoMes` sem os dois —
            // e sao eles que carregam o desconto de FECHAMENTO, o unico que
            // `users.descontos` guarda por regua. O cabecalho deste arquivo
            // afirma "O PRECO MOSTRADO JA E O DELE", e era falso: a tela
            // mostrava R$ 149 e a fatura cobrava R$ 74,50.
            //
            // Decidir contra um numero que o sistema nao vai cobrar e a forma
            // mais rapida de perder a confianca de quem esta pagando.
            const preco = precoDoMes({
              plano,
              fundador,
              indicacoesAtivas: indicacoes,
              descontos: profile?.descontos,
              mes: mesAtual,
            });
            const temDesconto = preco.desconto > 0;
            const selecionado = escolhido === plano.id;
            const cabe = sobram === 0;

            return (
              <button
                key={plano.id}
                type="button"
                onClick={() => setEscolhido(plano.id)}
                className={`tap w-full rounded-xl border-2 p-4 text-left transition ${
                  selecionado
                    ? 'border-primary bg-primarySoft shadow-focus'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">{plano.rotulo}</p>
                    {cabe && recomendado?.id === plano.id && (
                      <p className="mt-0.5 text-xs font-semibold text-accentText">
                        O seu tamanho hoje
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {temDesconto && (
                      <p className="text-xs text-textMuted line-through">
                        {formatCurrency(preco.bruto)}
                      </p>
                    )}
                    <p className="text-xl font-bold text-text">
                      {formatCurrency(preco.liquido)}
                    </p>
                    <p className="text-[11px] text-textMuted">por mês</p>
                  </div>
                </div>

                {/* O aviso do plano apertado. Ele não bloqueia a escolha — só
                  * diz o preço real dela, em crianças, antes de ele pagar. */}
                {!cabe && (
                  <p className="mt-3 rounded-lg bg-warningSoft px-3 py-2 text-xs text-warningText">
                    <strong className="font-semibold">
                      {sobram} {sobram === 1 ? 'criança ficaria' : 'crianças ficariam'} de
                      fora.
                    </strong>{' '}
                    Você escolhe quais desativar — o app não escolhe por você.
                  </p>
                )}

                {selecionado && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Check size={14} /> Plano escolhido
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Fora da tabela não tem preço, e mostrar um seria cobrar menos do que
          * qualquer conversa produziria. */}
        {!recomendado && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-text">
              Sua operação passou da tabela
            </p>
            <p className="mt-1 text-sm text-textMuted">
              Acima de 40 crianças o valor é conversado — a régua de faixas
              deixa de fazer sentido nesse tamanho.
            </p>
          </div>
        )}

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

        {/* CONTRATAR ACONTECE AQUI DENTRO desde 06/09/2026.
          *
          * Este botão abria o WhatsApp do consultor, e o comentário anterior
          * explicava por quê: emitir contrato mexia em `contratosAssociacao` e
          * em `limiteCriancas`, que são as rules de dinheiro.
          *
          * A saída não foi abrir essas rules — foi mover a escrita para o
          * servidor. A callable grava a cláusula, e a rule do contrato exige
          * que o documento bata com ela. O cliente ganhou o botão sem ganhar a
          * caneta.
          *
          * ACIMA DA TABELA CONTINUA SENDO CONVERSA, e é o único caso em que o
          * WhatsApp sobra: mostrar um preço ali seria cobrar menos do que
          * qualquer conversa produziria. */}
        {recomendado || escolhido ? (
          <>
            <Button onClick={contratar} disabled={assinando || !escolhido}>
              {assinando
                ? 'Contratando…'
                : jaContratou
                  ? 'Trocar para esta faixa'
                  : 'Contratar esta faixa'}
            </Button>

            {/* A OFERTA APARECE ONDE A DECISÃO ACONTECE, e some sozinha quando
              * deixa de valer — quem já contratou não vê promessa que já
              * recebeu, e quem passou do teste não vê uma que não vai receber. */}
            {/* ⚠️ A OFERTA VEM COM A DATA EM QUE ELA MUDA, e sem a data ela
              * não é urgência, é pressão: "decida logo" não é um prazo. É o
              * degrau que dá o número, e o degrau é o mês do teste em que ele
              * está — quanto antes decidir, menor a conta pelos 12 meses.
              *
              * ⚠️ E O PREÇO NUNCA SOBE SE ELE RECUSAR. Não há segunda oferta
              * nesta tela, e é decisão de negócio: desconto que sobe a cada
              * "não" ensina a recusar, e prova que o preço era teatro. Ver
              * docs/descontos.md, peça 3 — as respostas ao "não" cedem
              * informação, risco e prazo, nunca preço. */}
            {!jaContratou && fracaoDoDegrau > 0 && (
              <p className="text-center text-xs leading-relaxed text-textMuted">
                Contratando {viraEm ? <>até <strong>{dataCurta(viraEm)}</strong></> : 'agora'}, você
                fica com{' '}
                <strong className="text-accentText">
                  {Math.round(fracaoDoDegrau * 100)}% de desconto
                </strong>{' '}
                pelos 12 meses de contrato.
                {fracaoSeguinte > 0 && (
                  <> Depois dessa data, o desconto passa a ser de{' '}
                  {Math.round(fracaoSeguinte * 100)}%.</>
                )}
              </p>
            )}
          </>
        ) : (
          <a
            href={salesWhatsAppLink(
              `Oi! Tenho ${ativas} crianças ativas no Alô Buzinou e quero conversar sobre o plano.`
            )}
            target="_blank"
            rel="noopener"
            className="block"
          >
            <Button>
              <MessageCircle size={18} />
              Falar sobre meu plano
            </Button>
          </a>
        )}

        <p className="pb-4 text-center text-xs text-textMuted">
          A mensalidade que você cobra das famílias continua sendo sua. A
          plataforma não entra no caminho dela.
        </p>
      </div>
    </div>
  );
}
