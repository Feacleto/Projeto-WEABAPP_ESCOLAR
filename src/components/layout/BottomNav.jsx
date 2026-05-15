import { NavLink } from 'react-router-dom';

/**
 * Navegação inferior moderna (mobile-first).
 *
 * Visual: pill flutuante com sombra suave. Item ativo ganha círculo
 * preenchido (cor primary) sob o ícone — destaque visual forte sem
 * depender só de cor de texto.
 *
 * items: [{ to, label, icon: LucideIcon, end?: bool, badge?: number }]
 */
export default function BottomNav({ items }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-30 px-3 pb-3 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.75rem)' }}
    >
      <div
        className="pointer-events-auto bg-card rounded-3xl shadow-2xl shadow-black/15 border border-gray-100 grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `tap flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold ${
                isActive ? 'text-text' : 'text-textMuted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`relative inline-flex items-center justify-center transition-all ${
                    isActive
                      ? 'w-11 h-11 rounded-full bg-primary text-white shadow-md shadow-primary/30'
                      : 'w-11 h-11 rounded-full'
                  }`}
                >
                  <item.icon
                    size={isActive ? 22 : 22}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {item.badge > 0 && (
                    <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span className={isActive ? 'text-text' : 'text-textMuted'}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
