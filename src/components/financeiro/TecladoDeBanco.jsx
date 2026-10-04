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
const UM_MINUTO_EM_SEGUNDOS = 60;

export default function TecladoDeBanco({ titulo = null, dica = null, naFolha = false, aoCompletar, children }) {
  const [pares, setPares] = useState(() => embaralharPares());
  const [tocados, setTocados] = useState([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // O bloqueio é uma CONTAGEM em segundos, não só um "travado": sem ela na
  // tela, o teclado apagado por um minuto parecia app quebrado, e ele tocava
  // de novo e de novo sem saber se adiantava esperar. Quem manda de verdade
  // é o servidor (que recusa até o minuto passar); a contagem só mostra.
  const [restam, setRestam] = useState(0);
  const bloqueado = restam > 0;
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (restam <= 0) return undefined;
    const t = setTimeout(() => {
      setRestam((r) => r - 1);
      if (restam === 1) setErro('');
    }, 1000);
    return () => clearTimeout(t);
  }, [restam]);

  const contagem = `${Math.floor(restam / 60)}:${String(restam % 60).padStart(2, '0')}`;

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
    if (resposta?.bloquear) setRestam(UM_MINUTO_EM_SEGUNDOS);
  };

  const apagar = () => {
    if (ocupado) return;
    setTocados((t) => t.slice(0, -1));
    setErro('');
  };

  const travado = ocupado || bloqueado;

  // NA FOLHA (a tela "Digite sua senha", versão C de 04/10/2026) o teclado
  // desce para perto do polegar: o espaço que sobra fica ENTRE as bolinhas e
  // as teclas, não embaixo delas. E as teclas são cinza-claro, porque branco
  // sobre a folha branca não tem borda nenhuma.
  return (
    <div className={`flex flex-col gap-4 ${naFolha ? 'flex-1' : ''}`}>
      <section className="flex flex-col items-center gap-2 pt-2">
        {titulo && (
          <h2 className="font-display text-[26px] font-extrabold text-text text-center">{titulo}</h2>
        )}
        {/* Enquanto o servidor confere, as PRÓPRIAS bolinhas piscam uma
          * depois da outra (escolha do dono, 04/10/2026): a espera aparece
          * onde o olho já está, sem um giro novo por cima da senha. */}
        <div
          role="img"
          aria-label={
            ocupado
              ? 'Conferindo a senha'
              : `${tocados.length} de ${DIGITOS_DA_SENHA} números digitados`
          }
          className="flex gap-[18px] pt-3.5 pb-1.5"
        >
          {Array.from({ length: DIGITOS_DA_SENHA }, (_, i) => (
            <span
              key={i}
              style={ocupado ? { animationDelay: `${i * 150}ms` } : undefined}
              className={`w-5 h-5 rounded-full border-2 ${
                i < tocados.length ? 'bg-primary border-primary' : 'border-textMuted'
              } ${ocupado ? 'animate-ponto motion-reduce:animate-none' : ''}`}
            />
          ))}
        </div>
        {ocupado && (
          <p role="status" className="text-base font-semibold text-textMuted text-center">
            Conferindo a senha
          </p>
        )}
        {dica && !erro && !bloqueado && (
          <p className="text-base text-textBody text-center">{dica}</p>
        )}
        {erro && (
          <p
            role="alert"
            className="px-3.5 py-2.5 rounded-xl bg-dangerSoft text-dangerText text-base font-semibold text-center"
          >
            {erro}
          </p>
        )}
        {bloqueado && (
          <p
            aria-hidden="true"
            className="text-lg font-bold tabular-nums text-text text-center"
          >
            Tente de novo em {contagem}
          </p>
        )}
      </section>

      {naFolha && <div className="flex-1" aria-hidden="true" />}

      <div className="grid grid-cols-3 gap-2.5">
        {pares.map(([a, b]) => (
          <button
            key={`${a}-${b}`}
            type="button"
            aria-label={`${a} ou ${b}`}
            disabled={travado}
            onClick={() => tocar([a, b])}
            className={`tap h-[72px] rounded-xl ${naFolha ? 'bg-surface border border-border' : 'bg-card shadow-rest'} flex items-center justify-center gap-2 text-2xl font-bold text-text tabular-nums disabled:opacity-50`}
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
