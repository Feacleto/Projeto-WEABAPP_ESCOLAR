import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, icon: Icon, className = '', id: idProp, ...rest },
  ref
) {
  const generated = useId();
  const id = idProp || generated;

  return (
    <div className={`block ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={id}
          className={`
            w-full h-12 rounded-xl border bg-card text-text
            ${Icon ? 'pl-10' : 'pl-4'} pr-4
            ${error ? 'border-danger' : 'border-gray-200'}
            focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
            placeholder:text-textMuted disabled:bg-gray-50 disabled:text-textMuted
          `}
          {...rest}
        />
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-textMuted mt-1">{hint}</p>}
    </div>
  );
});

export default Input;
