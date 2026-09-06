import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, MessageCircle, Users } from 'lucide-react';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../compartilhado/formatters';
import { salesWhatsAppLink } from '../../config/developer';
import {
  PLANOS,
  planoPara,
  excedentes,
  precoDoMes,
} from '../../dominio/associacao/planos.js';

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
 * O QUE AINDA NÃO ESTÁ AQUI, e está marcado no lugar: aceitar o plano ainda
 * abre o WhatsApp do consultor. A emissão de contrato pelo próprio motorista
 * mexe em `contratosAssociacao` e em `limiteCriancas` — que hoje só o dono
 * escreve —, e essas duas rules são a parte de dinheiro do sistema. Botão que
 * promete autoatendimento e cai numa tela quebrada é pior que botão honesto.
 */
export default function TioPlanos() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const ativas = Number(profile?.criancasAtivas) || 0;
  const recomendado = planoPara(ativas);
  const fundador = profile?.condicaoFundador || null;
  const indicacoes = Number(profile?.indicacoesAtivas) || 0;

  const [escolhido, setEscolhido] = useState(recomendado?.id || null);

  return (
    <div className="min-h-screen bg-bg px-4 py-5">
      <div className="mx-auto max-w-mobile space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
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
            const preco = precoDoMes({ plano, fundador, indicacoesAtivas: indicacoes });
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

        {/* A FASE 6B TROCA ISTO POR "ASSINAR AGORA".
          * Emitir o contrato sem o dono mexe em `contratosAssociacao` e em
          * `limiteCriancas`, que são as rules de dinheiro. Até lá, o caminho
          * que termina em alguma coisa é o consultor. */}
        <a
          href={salesWhatsAppLink(
            recomendado
              ? `Oi! Quero contratar o plano "${
                  PLANOS.find((p) => p.id === escolhido)?.rotulo || recomendado.rotulo
                }" do Alô Buzinou. Tenho ${ativas} crianças ativas.`
              : `Oi! Tenho ${ativas} crianças ativas no Alô Buzinou e quero conversar sobre o plano.`
          )}
          target="_blank"
          rel="noopener"
          className="block"
        >
          <Button>
            <MessageCircle size={18} />
            {recomendado ? 'Quero este plano' : 'Falar sobre meu plano'}
          </Button>
        </a>

        <p className="pb-4 text-center text-xs text-textMuted">
          A mensalidade que você cobra das famílias continua sendo sua. A
          plataforma não entra no caminho dela.
        </p>
      </div>
    </div>
  );
}
