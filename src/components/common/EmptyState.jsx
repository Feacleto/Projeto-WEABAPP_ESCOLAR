/* ⚠️ MAIS BAIXO (05/10/2026, densidade aprovada pelo dono): o ícone de
 * 64 px e 48 px de folga em cima e embaixo faziam a tela vazia parecer uma
 * página em branco. Ícone de 40 e folga de 32: o recado continua no meio, e
 * o que vem depois sobe. A descrição é texto de leitura (16 px). */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      {Icon && (
        <Icon size={40} className="text-textMuted mb-3" />
      )}
      <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-base text-textMuted mb-5 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
