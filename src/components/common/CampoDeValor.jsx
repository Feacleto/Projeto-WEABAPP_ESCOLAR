import { useEffect, useId, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import {
  textoDoValor,
  valorDoDigitado,
  valorDoQueFoiDito,
  valorPorExtenso,
} from '../../compartilhado/dinheiro.js';

/**
 * O CAMPO DE DINHEIRO DO APP INTEIRO (03/10/2026, pedido do dono).
 *
 * Mensalidade, combinado e despesa eram `Input` soltos — um `type="number"`
 * que mostrava "1200" e aceitava "1200.5" com ponto americano. Para quem tem
 * quarenta anos e lê dinheiro no extrato do banco, isso é um número sem
 * forma, e um zero a mais passa batido. Três peças, todas em
 * compartilhado/dinheiro.js:
 *
 *   - a MÁSCARA de caixa eletrônico: "R$" fixo, ponto de milhar e vírgula, e
 *     os dígitos entram pelos centavos — ninguém caça a vírgula no teclado;
 *   - o MICROFONE: ele fala "trezentos e cinquenta" e o campo preenche. Só
 *     aparece onde o navegador reconhece voz; sem isso, some (não vira botão
 *     que falha);
 *   - o EXTENSO embaixo, sempre escrito, e FALADO pelo aparelho em dois
 *     momentos só: no toque do alto-falante e logo depois de ditar (é a
 *     confirmação do que foi entendido). Ao digitar ele NÃO fala — um robô
 *     falando a cada dígito seria ruído, e no portão da escola, vergonha.
 *
 * O valor entra e sai como TEXTO com ponto ("1200.50", ou '' vazio), o mesmo
 * formato que `parseFloat` já lia nas telas — por isso nenhuma conta mudou.
 */

function reconhecimentoDeVoz() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function falar(texto) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !texto) return;
  try {
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    window.speechSynthesis.speak(fala);
  } catch {
    // Sem voz no aparelho: o extenso continua escrito, que é o principal.
  }
}

export default function CampoDeValor({
  label,
  value,
  onChange,
  error,
  hint,
  id: idProp,
  autoFocus,
  className = '',
}) {
  const gerado = useId();
  const id = idProp || gerado;
  const [ouvindo, setOuvindo] = useState(false);
  const [naoEntendi, setNaoEntendi] = useState(false);
  const reconhecedor = useRef(null);

  const Reconhecimento = reconhecimentoDeVoz();
  const temVoz = typeof window !== 'undefined' && !!window.speechSynthesis;
  const extenso = valorPorExtenso(value);

  // Sair da tela no meio da escuta não pode deixar o microfone aberto.
  useEffect(() => () => reconhecedor.current?.abort?.(), []);

  function ditar() {
    if (!Reconhecimento) return;
    if (ouvindo) {
      reconhecedor.current?.stop();
      return;
    }
    setNaoEntendi(false);
    const r = new Reconhecimento();
    r.lang = 'pt-BR';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (ev) => {
      const alternativas = Array.from(ev.results[0] || []).map((a) => a.transcript);
      const valor = alternativas.map(valorDoQueFoiDito).find(Boolean);
      if (valor) {
        onChange(valor);
        falar(valorPorExtenso(valor));
      } else {
        setNaoEntendi(true);
      }
    };
    r.onerror = () => setNaoEntendi(true);
    r.onend = () => setOuvindo(false);
    reconhecedor.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  }

  return (
    <div className={`block ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-text">
          {label}
        </label>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-textMuted">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Digite aqui"
          value={textoDoValor(value)}
          onChange={(e) => {
            setNaoEntendi(false);
            onChange(valorDoDigitado(e.target.value));
          }}
          aria-invalid={!!error}
          aria-describedby={`${id}-extenso`}
          className={`
            h-16 w-full rounded-xl border-2 bg-card pl-14 text-2xl font-bold tabular-nums text-text
            ${Reconhecimento ? 'pr-16' : 'pr-4'}
            ${error ? 'border-danger' : ouvindo ? 'border-primary' : 'border-border'}
            placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-4 focus:ring-accent/25
            transition-[border-color,box-shadow] duration-estado
          `}
        />
        {Reconhecimento && (
          <button
            type="button"
            onClick={ditar}
            aria-label={ouvindo ? 'Parar de ouvir' : 'Falar o valor'}
            aria-pressed={ouvindo}
            className={`tap absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl ${
              ouvindo ? 'bg-primary text-white' : 'bg-primaryChip text-primary'
            }`}
          >
            <Mic size={22} />
          </button>
        )}
      </div>

      <div id={`${id}-extenso`} aria-live="polite" className="mt-2 min-h-[20px]">
        {ouvindo ? (
          <p className="text-sm font-semibold text-primary">Pode falar o valor…</p>
        ) : naoEntendi ? (
          <p className="text-sm text-dangerText">Não entendi o valor. Fale de novo ou digite.</p>
        ) : extenso ? (
          <div className="flex items-center gap-2">
            {/* O "OUVIR" VEM ANTES DO VALOR (03/10/2026, pedido do dono): o
              * olho chega no botão e logo em seguida no que ele vai falar. */}
            {temVoz && (
              <button
                type="button"
                onClick={() => falar(extenso)}
                aria-label="Ouvir o valor"
                className="tap -my-2 flex h-12 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary"
              >
                <Volume2 size={16} />
                Ouvir
              </button>
            )}
            <p className="min-w-0 flex-1 self-center text-sm leading-snug text-textBody first-letter:uppercase">{extenso}</p>
          </div>
        ) : null}
      </div>

      {error && <p className="mt-1 text-sm text-dangerText">{error}</p>}
      {hint && !error && <p className="mt-1 text-sm text-textMuted">{hint}</p>}
    </div>
  );
}
