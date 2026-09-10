import { useCallback, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ArrowUpCircle, X } from 'lucide-react';
import Respiro from './Respiro';
import EstradaCarregando from './EstradaCarregando';

/**
 * "SAIU UMA VERSÃO NOVA" — o aviso, e o teatro de trocar.
 *
 * O QUE ACONTECIA ANTES
 * O `registerType` era `autoUpdate`: o service worker novo assumia sozinho e
 * calado, valendo só no próximo carregamento COMPLETO da página. Num app
 * instalado na tela de início isso quase nunca acontece — o motorista abre
 * pelo ícone de manhã e não fecha. Ele podia passar dias numa versão antiga
 * sem nunca ter sido avisado de que havia outra, e uma correção de conta de
 * mensalidade não chegava justamente em quem estava com o número errado.
 *
 * POR QUE ELE PODE ADIAR
 * O botão de fechar é de propósito, e não é preguiça de UX. Recarregar no meio
 * de uma rota — GPS ligado, criança embarcando, buzina disparada — é
 * interrupção de verdade. Um aviso que não deixa adiar vira um aviso que a
 * pessoa aprende a temer. Ele fecha, termina a parada, e o aviso volta no
 * próximo carregamento porque `needRefresh` continua verdadeiro enquanto o
 * worker novo estiver esperando.
 *
 * O TEATRO NÃO É ENFEITE
 * Entre o toque e a tela voltar existe um vão de silêncio de um a três
 * segundos, com a rede no meio. Sem cobrir esse vão, o toque parece não ter
 * funcionado e a pessoa toca de novo. A tela cheia também impede que ela
 * navegue pra outro lugar no exato instante em que o chão vai ser trocado.
 *
 * ⚠️ E ESSE PARÁGRAFO DESCREVIA O SINTOMA CERTO PELA CAUSA ERRADA.
 * Ele dizia que `updateServiceWorker(true)` "troca o worker e recarrega", e
 * concluía que tocar de novo era problema de PERCEPÇÃO — o vão sem cobertura.
 * Não era: a função nunca recarregou (o argumento dela é ignorado, ver o
 * comentário de `atualizar()` abaixo), e o toque de novo era necessário de
 * verdade. O teatro continua valendo pelo motivo dele; o que estava errado
 * era acreditar que ele resolvia sozinho.
 *
 * E ELE TEM PRAZO. Se em oito segundos o navegador não recarregou — worker que
 * não ativa, rede que caiu no meio do download —, a gente recarrega na mão. Um
 * teatro sem fim é pior que atualização nenhuma: o app fica refém de uma tela
 * de carregamento da qual não há saída.
 */

/** Quanto esperar pela troca antes de recarregar na marra. */
const PRAZO_DO_TEATRO_MS = 8000;

/**
 * De quanto em quanto tempo perguntar ao servidor se saiu versão nova.
 *
 * O navegador só checa sozinho na navegação, e num PWA instalado a navegação
 * pode não acontecer por dias. Uma hora é folgado o bastante pra não pesar em
 * dado móvel e curto o bastante pra um deploy da manhã chegar à tarde.
 */
const INTERVALO_DE_CHECAGEM_MS = 60 * 60 * 1000;

export default function AtualizacaoDisponivel() {
  const [atualizando, setAtualizando] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const prazo = useRef(null);

  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      setInterval(() => {
        // Aba escondida ou sem rede: pular. Checar em segundo plano gasta
        // dado do usuário pra descobrir algo que ele não pode agir agora —
        // e a checagem volta na próxima batida.
        if (document.visibilityState !== 'visible') return;
        if (navigator.onLine === false) return;
        registro.update().catch(() => {
          // Falha de checagem não vira erro na tela: quem está sem rede não
          // precisa saber que o app tentou perguntar por uma versão nova.
        });
      }, INTERVALO_DE_CHECAGEM_MS);
    },
  });

  /**
   * ⚠️ `updateServiceWorker(true)` NÃO RECARREGA — E O COMENTÁRIO AQUI DIZIA
   * QUE SIM. Era isso que fazia o botão precisar de mais de um toque.
   *
   * O que o plugin faz de verdade está em
   * `node_modules/vite-plugin-pwa/dist/client/build/register.js`:
   *
   *     const updateServiceWorker = async (_reloadPage = true) => {
   *       await registerPromise;
   *       if (!auto) sendSkipWaitingMessage?.();
   *     };
   *
   * O argumento chama `_reloadPage` e é **ignorado**: a função só posta
   * `SKIP_WAITING` no worker em espera. E a promessa **resolve** no caminho
   * feliz — ao contrário do que o comentário antigo afirmava —, então o
   * `catch` nunca pegava nada.
   *
   * Quem recarregava era um listener que o plugin registra por dentro, e ele
   * só dispara `if (event.isUpdate)`. Depender disso é depender de uma
   * condição que o plugin calcula no registro, num arquivo que não é nosso e
   * que muda de versão para versão.
   *
   * AGORA O SINAL É NOSSO E É O ÚNICO QUE IMPORTA: `controllerchange` do
   * `navigator.serviceWorker`, que o navegador dispara quando o worker novo
   * assume a página. Se ele assumiu, recarregar mostra a versão nova — não
   * há terceiro estado. O prazo continua como rede de segurança para o caso
   * de não haver worker em espera (aí a troca nunca acontece e nada avisaria).
   *
   * `umaVezSo` existe porque os dois caminhos podem chegar juntos, e dois
   * `reload()` na mesma tela é uma piscada a mais na cara de quem já esperou.
   */
  const atualizar = useCallback(() => {
    setAtualizando(true);

    let jaFoi = false;
    const recarregar = () => {
      if (jaFoi) return;
      jaFoi = true;
      clearTimeout(prazo.current);
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener('controllerchange', recarregar, {
      once: true,
    });
    prazo.current = setTimeout(recarregar, PRAZO_DO_TEATRO_MS);

    // Sem argumento: ele é ignorado, e passá-lo sugeria um comportamento que
    // não existe. O que esta chamada faz é UMA coisa — mandar o worker em
    // espera assumir.
    Promise.resolve(updateServiceWorker()).catch(recarregar);
  }, [updateServiceWorker]);

  if (atualizando) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Atualizando o app"
        className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center"
      >
        {/* Sem atraso aqui: esta tela SÓ existe porque a espera já começou,
          * então esconder a marca por 300 ms deixaria um vazio de propósito
          * nenhum. É o oposto do fallback de rota. */}
        <Respiro atraso={0} altura={54} className="" label="Atualizando" />
        <div>
          <p className="text-base font-bold text-text">Atualizando o app</p>
          <p className="mt-1 text-sm leading-relaxed text-textMuted">
            Só um instante — a tela volta sozinha.
          </p>
        </div>
        {/* A estrada vem DEPOIS do texto, e é a única parte que se move
          * junto do respiro da marca. Antes do texto ela roubaria a leitura:
          * quem chega nesta tela precisa saber o que está acontecendo antes
          * de ver algo andando. */}
        <EstradaCarregando className="mt-1" />
      </div>
    );
  }

  if (!precisaAtualizar || dispensado) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-[60] mx-auto max-w-mobile px-4">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-float">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ArrowUpCircle size={19} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-text">
            Tem uma versão nova
          </p>
          <p className="mt-0.5 text-xs leading-snug text-textMuted">
            Toque pra atualizar. Leva um segundo e nada do seu se perde.
          </p>
          <button
            type="button"
            onClick={atualizar}
            className="tap mt-2.5 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-[14px] font-bold text-white"
          >
            Atualizar agora
          </button>
        </div>

        {/* DISPENSAR VALE SÓ PRA ESTA SESSÃO — não grava nada.
          * Guardar em localStorage seria transformar "agora não" em "nunca
          * mais", e ele não escolheu isso. Fechou porque estava no meio de
          * alguma coisa; no próximo carregamento o aviso volta, porque o
          * worker novo continua esperando. */}
        <button
          type="button"
          onClick={() => setDispensado(true)}
          aria-label="Agora não"
          className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-textMuted"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
