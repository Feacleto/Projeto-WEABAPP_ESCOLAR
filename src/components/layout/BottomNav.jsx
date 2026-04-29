import { NavLink } from 'react-router-dom';

/**
 * Navegação inferior fixa (mobile-first). Recebe lista de itens dinâmica
 * pra reaproveitar entre Tio e Pai.
 *
 * items: [{ to, label, icon: LucideIcon, end?: bool, badge?: number }]
 *   - badge: número exibido como "bolinha" sobre o ícone (oculta se 0/undef)
 */
export default function BottomNav({ items }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto bg-card border-t border-gray-100 grid z-30"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        // safe-area pra iOS
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium tap ${
              isActive ? 'text-primary' : 'text-textMuted'
            }`
          }
        >
          <span className="relative inline-flex">
            <item.icon size={22} strokeWidth={2} />
            {item.badge > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
