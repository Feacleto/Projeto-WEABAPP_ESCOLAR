import { Check, House, RefreshCw } from 'lucide-react';
import { LogoMark } from './Logo';
import Button from './Button';
import { APP_VERSION, VERSAO_PARA_SUPORTE } from '../../version';
import { dataPorExtenso, textoParaSuporte } from '../../compartilhado/versaoDoApp.js';
import { ETAPAS_DA_TROCA } from '../../services/versaoService';

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
 * ⚠️ ELA DIZ QUAL VERSÃO ESTÁ CHEGANDO E EM QUE PASSO ESTÁ (pedido do dono,
 * 03/10/2026). Antes era só "Atualizando o app" e uma barra correndo — quem
 * olha não sabia se aquilo andava, nem o que estava recebendo. O número vem
 * de `/versao.json` (o app antigo não o conhece); as etapas são os passos de
 * verdade da troca (`ETAPAS_DA_TROCA`, em versaoService), não um relógio.
 * Sem o número (sem rede, ou no `npm run dev`), a tela diz "versão nova".
 *
 * O TOM É DE SISTEMA, NÃO DE FESTA: a marca parada, frases curtas, e uma
 * barra. A barra é a única coisa que se mexe sozinha aqui, e é exceção
 * nomeada no design system — uma espera REAL, que acaba sozinha em segundos.
 *
 * ESTA TELA NÃO PODE DEPENDER DE NADA além de si: ela aparece quando o resto
 * do app pode estar quebrado (sem auth, sem router confiável). Por isso as
 * ações e os dados chegam prontos por prop.
 *
 * Props:
 *   - estado:     'pronta' | 'atualizando'
 *   - nova:       a versão que está chegando ({ versao, data, commit, hash }), ou null
 *   - etapa:      id da etapa em curso (ETAPAS_DA_TROCA), no 'atualizando'
 *   - onAtualizar, onInicio: só no estado 'pronta'
 *   - detalhe:    texto técnico para o suporte (fica recolhido)
 */
export default function TelaDeVersao({
  estado = 'pronta',
  nova = null,
  etapa = null,
  onAtualizar,
  onInicio,
  detalhe,
}) {
  const atualizando = estado === 'atualizando';
  const indice = Math.max(0, ETAPAS_DA_TROCA.findIndex((e) => e.id === etapa));
  // A barra anda por etapa: começa em 10% para nunca parecer parada.
  const porcento = atualizando
    ? Math.max(10, Math.round(((indice + 0.5) / ETAPAS_DA_TROCA.length) * 100))
    : 0;
  const versaoNova = nova?.versao || null;
  const quando = dataPorExtenso(nova?.data);
  const nomeDaNova = versaoNova ? `versão ${versaoNova}` : 'versão nova';

  return (
    <div
      role={atualizando ? 'status' : 'alertdialog'}
      aria-live="polite"
      aria-label={atualizando ? `Instalando a ${nomeDaNova}` : 'Saiu uma versão nova do app'}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-bg px-6 py-12"
    >
      <div className="w-full max-w-xs rounded-2xl bg-card p-6 shadow-rest">
        <LogoMark height={40} />

        <p className="rotulo mt-5 text-primary">Atualização do app</p>
        <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-text">
          {atualizando
            ? versaoNova
              ? `Atualizando para a versão ${versaoNova}`
              : 'Atualizando para a versão nova'
            : 'Saiu uma versão nova do app'}
        </h1>

        {/* O número que está chegando, em destaque, e o de agora embaixo. */}
        <div className="mt-4 rounded-xl bg-primarySoft px-4 py-3">
          <p className="text-[13px] font-semibold text-accentText">
            {atualizando ? 'Instalando' : 'Disponível'}
          </p>
          <p className="font-display text-2xl font-extrabold text-text">
            {versaoNova ? `Versão ${versaoNova}` : 'Versão nova'}
          </p>
          {quando && <p className="text-[13px] text-textBody">Publicada em {quando}</p>}
          <p className="mt-0.5 text-[13px] text-textMuted">Você está na versão {APP_VERSION}</p>
        </div>

        {atualizando ? (
          <>
            <div className="mt-5 flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-text">
                {ETAPAS_DA_TROCA[indice]?.rotulo}
              </span>
              <span className="text-[15px] font-bold tabular-nums text-primary">{porcento}%</span>
            </div>
            <div
              className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-neutro"
              role="progressbar"
              aria-label="Progresso da atualização"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={porcento}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${porcento}%` }}
              />
              {/* O brilho correndo por cima diz "está andando" entre uma
                * etapa e outra — o download pode levar alguns segundos. */}
              <span className="barra-de-espera absolute inset-y-0 left-0 block w-1/4 rounded-full bg-white/40" />
            </div>

            <ol className="mt-5 space-y-2.5">
              {ETAPAS_DA_TROCA.map((e, i) => {
                const feita = i < indice;
                const agora = i === indice;
                return (
                  <li key={e.id} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        feita
                          ? 'bg-primary text-white'
                          : agora
                            ? 'border-2 border-primary bg-primarySoft'
                            : 'border-2 border-border'
                      }`}
                      aria-hidden="true"
                    >
                      {feita && <Check size={14} strokeWidth={3} />}
                      {agora && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span
                      className={`text-[15px] ${
                        feita ? 'text-textBody' : agora ? 'font-bold text-text' : 'text-textMuted'
                      }`}
                    >
                      {e.rotulo}
                      {feita && <span className="sr-only"> (feito)</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-textBody">
              Atualize para continuar de onde parou. Leva poucos segundos.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Button icon={RefreshCw} onClick={onAtualizar}>
                Atualizar agora
              </Button>
              <Button variant="secondary" icon={House} onClick={onInicio}>
                Ir para o início
              </Button>
            </div>
          </>
        )}

        {/* ⚠️ A PRIMEIRA TENTATIVA PODE NÃO ENTRAR (pedido do dono,
          * 04/10/2026): às vezes o celular ainda serve a versão antiga no
          * primeiro recarregamento. Prometer "a tela volta sozinha" fazia
          * esse caso parecer defeito; dito antes, abrir de novo é o passo. */}
        <div className="mt-5 space-y-1 border-t border-neutro pt-4 text-sm leading-snug">
          <p className="text-textBody">Nada do que você fez se perde.</p>
          <p className="text-textMuted">
            Se o app não abrir na primeira tentativa, feche e abra de novo.
          </p>
        </div>
      </div>

      {/* Pro suporte, e RECOLHIDO: a mensagem técnica ("Failed to fetch
        * dynamically imported module…") assustava quem lia, e só serve a
        * quem vai ler para a gente pelo WhatsApp — junto da versão do build. */}
      <details className="mt-4 w-full max-w-xs text-center text-xs text-textMuted">
        <summary className="cursor-pointer list-none py-2">Detalhes para o suporte</summary>
        <p className="break-words leading-relaxed">
          {detalhe ? `${detalhe} · ` : ''}{VERSAO_PARA_SUPORTE}
          {nova ? ` → ${textoParaSuporte(nova)}` : ''}
        </p>
      </details>
    </div>
  );
}
