import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { avancarDoCampo } from '../../compartilhado/avancarCampo';

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon,
    className = '',
    // Classes para o <input> em si. O `className` acima vai no INVÓLUCRO
    // (rótulo, campo, dica), e usá-lo para estilizar o campo deixava o
    // rótulo e a dica em mono espaçado — ilegíveis. São dois alvos
    // diferentes, e agora têm dois nomes.
    inputClassName = '',
    id: idProp,
    type = 'text',
    revealable = false,
    // O "Salvar" ao lado do campo (03/10/2026). `avancar={false}` o tira —
    // campo de busca, por exemplo, em que o Enter já faz a busca.
    avancar = true,
    ...rest
  },
  ref
) {
  const generated = useId();
  const id = idProp || generated;
  const [revealed, setRevealed] = useState(false);

  // Senha revelável substitui o campo "confirme a senha": o usuário confere
  // o que digitou olhando, em vez de digitar duas vezes. Menos atrito e
  // menos erro pra quem tem pouca familiaridade com teclado de celular.
  const isPassword = type === 'password';
  const showReveal = revealable && isPassword;
  const effectiveType = showReveal && revealed ? 'text' : type;

  /* ⚠️ NENHUM EXEMPLO DENTRO DO CAMPO (03/10/2026, pedido do dono). "Ex:
   * Pedro Silva", "00000-000", "450,00" — o motorista lia o exemplo cinza
   * como resposta já dada e passava adiante com o campo vazio. Todo campo
   * diz a mesma coisa: "Digite aqui". O formato, quando importa, vai na
   * `hint` embaixo, onde não se confunde com o que foi digitado. O que o
   * chamador passar em `placeholder` é ignorado de propósito, e
   * `testar:formularios` reprova exemplo novo no código. */
  const textoGuia = rest.disabled || rest.readOnly ? undefined : 'Digite aqui';
  const comSalvar = avancar && !rest.disabled && !rest.readOnly;

  const aoTeclar = (e) => {
    rest.onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== 'Enter' || !avancar) return;
    e.preventDefault();
    avancarDoCampo(e.currentTarget);
  };

  return (
    <div className={`block ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-text mb-2"
        >
          {label}
        </label>
      )}
      <div className="flex items-start gap-2">
      <div className="relative min-w-0 flex-1">
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={id}
          type={effectiveType}
          className={`
            w-full h-14 rounded-xl border-2 bg-card text-text
            ${Icon ? 'pl-11' : 'pl-4'} ${showReveal ? 'pr-12' : 'pr-4'}
            ${error ? 'border-danger' : 'border-border'}
            focus:outline-none focus:ring-4 focus:ring-accent/25 focus:border-primary
            transition-[border-color,box-shadow] duration-estado
            placeholder:text-textMuted disabled:bg-sunken disabled:text-textMuted
            ${inputClassName}
          `}
          {...rest}
          placeholder={textoGuia}
          onKeyDown={aoTeclar}
          enterKeyHint={rest.enterKeyHint || 'next'}
        />
        {showReveal && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Esconder senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center text-textMuted hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {revealed ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
      {comSalvar && (
        <button
          type="button"
          // Não rouba o foco antes do clique: o campo de onde ele saiu é a
          // referência para achar o próximo.
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => avancarDoCampo(document.getElementById(id) || e.currentTarget)}
          className="tap h-14 shrink-0 rounded-xl bg-primary px-4 text-base font-bold text-white"
        >
          Salvar
        </button>
      )}
      </div>
      {error && <p className="text-xs text-dangerText mt-1.5">{error}</p>}
      {hint && !error && (
        <p className="text-xs text-textMuted mt-1.5">{hint}</p>
      )}
    </div>
  );
});

export default Input;
