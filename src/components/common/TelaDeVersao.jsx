import { House, RefreshCw } from 'lucide-react';
import { LogoMark } from './Logo';
import Button from './Button';
import { APP_VERSION } from '../../version';

/**
 * A TROCA DE VERSÃO, NUMA TELA SÓ (03/10/2026).
 *
 * Eram duas telas para o MESMO momento, cada uma com a sua cara: o aviso de
 * "Saiu uma versão nova" (ErrorScreen, quando um pedaço da versão antiga
 * sumiu do servidor) e o "Atualizando o app" (AtualizacaoDisponivel, depois
 * do toque em Atualizar), com uma van andando numa estradinha. Para a pessoa
 * é uma conversa só — "tem versão nova" e "estou trocando" —, então agora é
 * a mesma tela em dois estados, e o toque em Atualizar passa de um para o
 * outro sem pular de desenho.
 *
 * O TOM É DE SISTEMA, NÃO DE FESTA: a marca parada, uma frase, e uma barra
 * fina. É a única coisa que se mexe sozinha aqui, e é exceção nomeada no
 * design system — uma espera REAL, que acaba sozinha em segundos.
 *
 * ESTA TELA NÃO PODE DEPENDER DE NADA além de si: ela aparece quando o resto
 * do app pode estar quebrado (sem auth, sem router confiável). Por isso as
 * ações chegam prontas por prop.
 *
 * Props:
 *   - estado:     'pronta' | 'atualizando'
 *   - onAtualizar, onInicio: só no estado 'pronta'
 *   - detalhe:    texto técnico para o suporte (fica recolhido)
 */
export default function TelaDeVersao({ estado = 'pronta', onAtualizar, onInicio, detalhe }) {
  const atualizando = estado === 'atualizando';

  return (
    <div
      role={atualizando ? 'status' : 'alertdialog'}
      aria-live="polite"
      aria-label={atualizando ? 'Atualizando o app' : 'Saiu uma versão nova do app'}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg px-6 py-12"
    >
      <div className="w-full max-w-xs rounded-2xl bg-card p-6 shadow-rest">
        <LogoMark height={40} />

        <p className="rotulo mt-5 text-primary">Versão nova</p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-text">
          {atualizando ? 'Atualizando o app' : 'Saiu uma versão nova do app'}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-textBody">
          {atualizando
            ? 'Leva poucos segundos. A tela volta sozinha.'
            : 'Atualize para continuar de onde parou.'}
        </p>

        {atualizando ? (
          <div
            className="mt-6 h-1.5 overflow-hidden rounded-full bg-neutro"
            role="progressbar"
            aria-label="Atualizando"
          >
            <span className="barra-de-espera block h-full w-2/5 rounded-full bg-primary" />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2.5">
            <Button icon={RefreshCw} onClick={onAtualizar}>
              Atualizar agora
            </Button>
            <Button variant="secondary" icon={House} onClick={onInicio}>
              Ir para o início
            </Button>
          </div>
        )}

        <p className="mt-5 border-t border-neutro pt-4 text-[13px] text-textMuted">
          Nada do que você fez se perde.
        </p>
      </div>

      {/* Pro suporte, e RECOLHIDO: a mensagem técnica ("Failed to fetch
        * dynamically imported module…") assustava quem lia, e só serve a
        * quem vai ler para a gente pelo WhatsApp — junto da versão do build. */}
      <details className="mt-4 w-full max-w-xs text-center text-xs text-textMuted">
        <summary className="cursor-pointer list-none py-2">Detalhes para o suporte</summary>
        <p className="break-words leading-relaxed">
          {detalhe ? `${detalhe} · ` : ''}v{APP_VERSION}
        </p>
      </details>
    </div>
  );
}
