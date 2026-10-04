import Spinner from './Spinner';

const variants = {
  primary:
    'bg-primary text-white hover:bg-primaryDark active:bg-primaryDark disabled:bg-primary/50',
  secondary:
    'bg-card border border-border text-text hover:bg-sunken disabled:opacity-60',
  // ⚠️ O FUNDO É O `dangerText`, não o `danger`: branco sobre #EF4444 dá
  // 3,8:1 e reprovava justamente no botão de apagar. 6,5:1 assim.
  danger:
    'bg-dangerText text-white hover:bg-dangerText disabled:bg-dangerText/50',
  success:
    'bg-accentText text-white hover:bg-primaryDark disabled:bg-accentText/50',
  ghost: 'bg-transparent text-text hover:bg-neutro disabled:opacity-60',
};

// Tamanhos ampliados pra público de 40+, em pé, na rua, com uma mão.
// ⚠️ O MENOR É 48 px (03/10/2026): o `sm` tinha 40 px e letra de 12 px, e era
// justamente o tamanho de "Dar baixa" e de "Faltou" — os botões que mexem em
// dinheiro e na família. O piso de toque do app é 48, e nenhum tamanho fica
// abaixo dele. O `sm` continua existindo para quem precisa de menos LARGURA
// (padding menor), não de menos altura.
const sizes = {
  lg: 'h-14 px-6 text-base',
  md: 'h-12 px-4 text-base',
  sm: 'h-12 px-3 text-sm',
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
        rounded-xl font-bold tap inline-flex items-center justify-center gap-2
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
