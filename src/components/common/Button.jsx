import Spinner from './Spinner';

const variants = {
  primary:
    'bg-primary text-white hover:bg-primaryDark active:bg-primaryDark disabled:bg-primary/50',
  secondary:
    'bg-card border border-border text-text hover:bg-sunken disabled:opacity-60',
  danger:
    'bg-danger text-white hover:bg-danger disabled:bg-danger/50',
  success:
    'bg-success text-white hover:bg-accentDark disabled:bg-success/50',
  ghost: 'bg-transparent text-text hover:bg-neutro disabled:opacity-60',
};

// Tamanhos ampliados pra público com baixa familiaridade com toque preciso.
// Mínimo 40 px (sm), 48 px (md), 56 px (lg). Os ícones acompanham.
const sizes = {
  lg: 'h-14 px-6 text-base',
  md: 'h-12 px-4 text-sm',
  sm: 'h-10 px-3 text-xs',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = true,
  icon: Icon,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      // type=button por padrão evita submit acidental dentro de <form>
      type={type}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-xl font-semibold tap inline-flex items-center justify-center gap-2
        disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-primary/40
        ${className}
      `}
      {...rest}
    >
      {loading ? <Spinner size={18} /> : Icon && <Icon size={18} />}
      {children}
    </button>
  );
}
