import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon,
    className = '',
    id: idProp,
    type = 'text',
    revealable = false,
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
      <div className="relative">
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
            w-full h-14 rounded-2xl border-2 bg-card text-text
            ${Icon ? 'pl-11' : 'pl-4'} ${showReveal ? 'pr-12' : 'pr-4'}
            ${error ? 'border-danger' : 'border-border'}
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            placeholder:text-textMuted disabled:bg-sunken disabled:text-textMuted
          `}
          {...rest}
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
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
      {hint && !error && (
        <p className="text-xs text-textMuted mt-1.5">{hint}</p>
      )}
    </div>
  );
});

export default Input;
