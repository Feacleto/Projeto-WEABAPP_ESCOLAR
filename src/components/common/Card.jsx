export default function Card({
  children,
  className = '',
  onClick,
  as,
  ...rest
}) {
  const Tag = as || (onClick ? 'button' : 'div');
  return (
    <Tag
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
      className={`
        bg-card rounded-2xl shadow-rest p-5
        ${onClick ? 'tap text-left w-full' : ''}
        ${className}
      `}
      {...rest}
    >
      {children}
    </Tag>
  );
}
