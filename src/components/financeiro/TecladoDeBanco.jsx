import { useEffect, useRef, useState } from 'react';
import { DIGITOS_DA_SENHA, embaralharPares } from '../../dominio/identidade/tecladoDeBanco.js';

/**
 * O TECLADO DE BANCO (03/10/2026) — cinco botões "a ou b" e o Apagar.
 *
 * Quem olha por cima do ombro vê o botão tocado, não o número: cada botão
 * vale dois. Os pares são sorteados de novo ao abrir e depois de cada erro,
 * então nem a posição do dedo se repete. A régua é
 * `dominio/identidade/tecladoDeBanco.js`.
 *
 * Este componente não sabe conferir nada: quando os quatro botões foram
 * tocados, ele entrega os PARES a `aoCompletar` e espera a resposta —
 *   { ok: true }                       deu certo (quem chamou segue)
 *   { erro: 'texto' }                  mostra o erro e sorteia de novo
 *   { erro: 'texto', bloquear: true }  idem, e trava o teclado 1 minuto
 * É assim que o mesmo teclado serve à senha (conferida no servidor) e à
 * confirmação da senha nova (conferida aqui, contra a que só vive na memória).
 */
const UM_MINUTO = 60 * 1000;

export default function TecladoDeBanco({ titulo, aoCompletar, children }) {
  const [pares, setPares] = useState(() => embaralharPares());
  const [tocados, setTocados] = useState([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!bloqueado) return undefined;
    const t = setTimeout(() => {
      setBloqueado(false);
      setErro('');
    }, UM_MINUTO);
    return () => clearTimeout(t);
  }, [bloqueado]);

  const tocar = async (par) => {
    if (ocupado || bloqueado) return;
    const lista = [...tocados, par];
    setErro('');
    if (lista.length < DIGITOS_DA_SENHA) {
      setTocados(lista);
      return;
    }
    setTocados(lista);
    setOcupado(true);
    let resposta;
    try {
      resposta = await aoCompletar(lista);
    } catch (err) {
      resposta = { erro: err?.message || 'Algo deu errado. Tente de novo.' };
    }
    if (!montado.current) return;
    setOcupado(false);
    if (resposta?.ok) return;
    setTocados([]);
    setPares(embaralharPares());
    setErro(resposta?.erro || 'Senha incorreta.');
    if (resposta?.bloquear) setBloqueado(true);
  };

  const apagar = () => {
    if (ocupado) return;
    setTocados((t) => t.slice(0, -1));
    setErro('');
  };

  const travado = ocupado || bloqueado;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-2 pt-2">
        <h2 className="font-display text-[26px] font-extrabold text-text text-center">{titulo}</h2>
        <div
          role="img"
          aria-label={`${tocados.length} de ${DIGITOS_DA_SENHA} números digitados`}
          className="flex gap-[18px] pt-3.5 pb-1.5"
        >
          {Array.from({ length: DIGITOS_DA_SENHA }, (_, i) => (
            <span
              key={i}
              className={`w-5 h-5 rounded-full border-2 ${
                i < tocados.length ? 'bg-primary border-primary' : 'border-textMuted'
              }`}
            />
          ))}
        </div>
        {erro && (
          <p
            role="alert"
            className="px-3.5 py-2.5 rounded-xl bg-dangerSoft text-dangerText text-base font-semibold text-center"
          >
            {erro}
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        {pares.map(([a, b]) => (
          <button
            key={`${a}-${b}`}
            type="button"
            aria-label={`${a} ou ${b}`}
            disabled={travado}
            onClick={() => tocar([a, b])}
            className="tap h-[72px] rounded-xl bg-card shadow-rest flex items-center justify-center gap-2 text-2xl font-bold text-text tabular-nums disabled:opacity-50"
          >
            {a}
            <span className="text-sm font-semibold text-textMuted">ou</span>
            {b}
          </button>
        ))}
        <button
          type="button"
          onClick={apagar}
          disabled={ocupado || tocados.length === 0}
          className="tap h-[72px] rounded-xl border-2 border-border bg-transparent text-base font-bold text-textBody disabled:opacity-50"
        >
          Apagar
        </button>
      </div>

      {children}
    </div>
  );
}
