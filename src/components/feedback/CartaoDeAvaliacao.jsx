import { useState } from 'react';
import { Angry, Frown, Laugh, Meh, Smile, CheckCircle2 } from 'lucide-react';
import {
  COMENTARIO_MAX,
  ROSTOS,
  comentarioLimpo,
} from '../../dominio/suporte/avaliacaoRapida.js';
import BotaoDeFalar from '../common/BotaoDeFalar';

const ICONES = { Angry, Frown, Meh, Smile, Laugh };

/**
 * O CARTÃO DE CINCO ROSTOS — a avaliação rápida, sem abrir nada (03/10/2026).
 *
 * Só apresentação: QUEM grava e QUANDO aparecer é de quem o monta
 * (`AvaliacaoNoInicio` para quem tem conta, a página do link para quem não
 * tem). A régua é `dominio/suporte/avaliacaoRapida.js`.
 *
 * O botão só acende depois de escolher um rosto; o comentário é opcional.
 * Enviado, o cartão vira o agradecimento no mesmo lugar — sumir de repente
 * deixaria a pessoa sem saber se foi.
 */
export default function CartaoDeAvaliacao({ pergunta, onEnviar, onDispensar, semMoldura = false }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(null);

  const moldura = semMoldura ? '' : 'rounded-2xl bg-card p-4 shadow-rest';

  const enviar = async () => {
    if (!nota || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onEnviar({ nota, comentario: comentarioLimpo(comentario) });
      setEnviado(true);
    } catch (e) {
      console.error('[avaliacao] envio falhou:', e);
      setErro('Não deu para enviar agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className={`${moldura} flex items-center gap-3`} role="status">
        <CheckCircle2 size={24} className="shrink-0 text-primary" />
        <p className="text-base font-semibold text-text">
          Obrigado! Isso ajuda a gente a melhorar o app.
        </p>
      </div>
    );
  }

  return (
    <section className={moldura} aria-label="Avaliação do app">
      <p className="text-sm font-bold text-text">Queremos saber sua opinião (opcional)</p>
      <p className="mt-1 text-base text-text">{pergunta}</p>

      <div className="mt-3 grid grid-cols-5 gap-1" role="radiogroup" aria-label="Sua nota">
        {ROSTOS.map((r) => {
          const Icone = ICONES[r.icone];
          const escolhido = nota === r.nota;
          return (
            <button
              key={r.nota}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => setNota(r.nota)}
              className={`tap flex min-h-[72px] flex-col items-center justify-start gap-1 rounded-xl px-1 py-2 ${
                escolhido ? 'bg-primaryChip text-primary' : 'text-textMuted'
              }`}
            >
              <Icone size={30} strokeWidth={escolhido ? 2.25 : 1.75} />
              <span
                className={`text-center text-xs leading-tight ${
                  escolhido ? 'font-bold text-primary' : 'text-textMuted'
                }`}
              >
                {r.rotulo}
              </span>
            </button>
          );
        })}
      </div>

      {/* Falar o comentário (04/10/2026): se soma ao texto, com o teto de 140. */}
      <div className="mt-3">
        <BotaoDeFalar valor={comentario} onChange={(v) => setComentario(v.slice(0, COMENTARIO_MAX))} />
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Comentário</span>
        <input
          type="text"
          value={comentario}
          maxLength={COMENTARIO_MAX}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Digite aqui"
          className="h-12 w-full border-b border-border bg-transparent text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none"
        />
      </label>
      <p className="mt-1 text-right text-xs text-textMuted tabular-nums">
        {comentario.length}/{COMENTARIO_MAX}
      </p>

      {erro && <p className="mt-2 text-sm text-dangerText">{erro}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={!nota || enviando}
        className="tap mt-3 h-12 w-full rounded-xl bg-primary text-base font-bold text-white disabled:bg-sunken disabled:text-textMuted"
      >
        {enviando ? 'Enviando...' : 'Enviar avaliação'}
      </button>

      {onDispensar && (
        <button
          type="button"
          onClick={onDispensar}
          className="tap mt-1 h-12 w-full text-sm font-semibold text-textMuted"
        >
          Agora não
        </button>
      )}
    </section>
  );
}
