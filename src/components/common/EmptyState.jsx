export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && (
        <Icon
          size={64}
          strokeWidth={1.5}
          className="text-textMuted mb-4"
        />
      )}
      <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-textMuted mb-6 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}
