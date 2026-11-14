import { useEffect, useState } from 'react';
import { Wallet, CalendarCheck, Bell, ChevronDown } from 'lucide-react';
import {
  TITULO_DO_CARTAO,
  ROTULO_RECOLHIDO,
  LINHAS_DO_VALOR,
  LINHA_DO_PIX,
  O_QUE_FAZER,
  CHAVE_CONVITE_ENVIADO,
  EVENTO_CONVITE_ENVIADO,
} from '../../marca/valorDoConvite.js';
import { jaLembrou } from '../../compartilhado/lembreteDoAparelho';

const ICONES = { carteira: Wallet, calendario: CalendarCheck, sino: Bell };

/**
 * "PARA QUE SERVE O CONVITE" (docs/analise/12, momento 1) — o tio não descobre
 * sozinho, então a explicação aparece no instante em que ele vai agir.
 *
 * Em destaque ATÉ ele mandar o primeiro convite neste aparelho; depois vira uma
 * linha "Por que convidar?" que abre as três frases no lugar (acordeão — sem
 * modal e sem tela). Quem já entendeu não é interrompido, e repetir a mesma
 * explicação a cada abertura é o pedido empilhado que o passeio visual mediu.
 *
 * ⚠️ NEUTRO DE PROPÓSITO: âmbar é aviso, e aqui não há nada a atender. Os
 * textos vêm TODOS de `marca/valorDoConvite.js` — nenhuma frase se escreve aqui.
 *
 * `semNumero`: a segunda frase de "O que fazer" só serve a quem não tem o
 * WhatsApp da mãe. `enviado`: a tela que acabou de mandar o convite avisa
 * direto; as outras são avisadas pelo evento que o `InviteShare` dispara.
 */
export default function PorQueConvidar({ semNumero = false, enviado = false }) {
  const [mandou, setMandou] = useState(() => jaLembrou(CHAVE_CONVITE_ENVIADO));
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const ouvir = () => setMandou(true);
    window.addEventListener(EVENTO_CONVITE_ENVIADO, ouvir);
    return () => window.removeEventListener(EVENTO_CONVITE_ENVIADO, ouvir);
  }, []);

  const recolhido = mandou || enviado;

  const frases = (
    <>
      <ul className="space-y-2.5">
        {LINHAS_DO_VALOR.map(({ id, icone, texto }) => {
          const Icone = ICONES[icone];
          return (
            <li key={id} className="flex items-start gap-3">
              <Icone size={20} className="mt-0.5 shrink-0 text-textMuted" aria-hidden />
              <span className="text-base leading-snug text-text">{texto}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm leading-snug text-textMuted">{LINHA_DO_PIX.texto}</p>
    </>
  );

  if (recolhido) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="tap flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left text-base font-semibold text-text"
        >
          {ROTULO_RECOLHIDO}
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-textMuted transition-transform ${aberto ? 'rotate-180' : ''}`}
          />
        </button>
        {aberto && <div className="px-4 pb-4">{frases}</div>}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-left shadow-rest">
      <h4 className="mb-3 text-base font-bold text-text">{TITULO_DO_CARTAO}</h4>
      {frases}
      <div className="mt-3 space-y-1 border-t border-border pt-3">
        <p className="text-sm leading-snug text-textBody">{O_QUE_FAZER.mandarDeNovo.texto}</p>
        {semNumero && (
          <p className="text-sm leading-snug text-textBody">{O_QUE_FAZER.semNumero.texto}</p>
        )}
      </div>
    </section>
  );
}
