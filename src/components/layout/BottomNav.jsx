import { NavLink } from 'react-router-dom';

/**
 * Navegação inferior em pílula flutuante.
 *
 * O INDICADOR DE ABA ATIVA
 * Antes o item ativo virava um círculo cheio de 44 px com gradiente atrás do
 * ícone. Funcionava, mas pesava: com quatro abas, o bloco de cor competia com
 * o conteúdo da tela e a barra parecia um segundo cabeçalho.
 *
 * Agora o ativo é uma BOLINHA acima do ícone, mais o ícone e o rótulo em cor.
 * Três sinais redundantes (posição, cor e peso do traço) pra a leitura não
 * depender só de cor — quem não distingue verde de cinza ainda vê a bolinha.
 *
 * items: [{ to, label, icon: LucideIcon, end?: bool, badge?: number,
 *           tour?: string }]
 *
 * `tour` vira data-tour no link: é a âncora que o tutorial guiado ilumina e
 * escuta pra saber que a pessoa tocou na aba certa.
 */
export default function BottomNav({ items }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-30 px-3 pb-3 pointer-events-none print:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.75rem)' }}
    >
      {/* rounded-full em vez de rounded-3xl: pílula de verdade, e o formato
        * já sugere que ela flutua acima do conteúdo. */}
      <div
        className="pointer-events-auto bg-card/95 backdrop-blur-md rounded-full shadow-float border border-neutro grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tour}
            className="tap flex flex-col items-center justify-center gap-1 pt-2 pb-2.5 text-[12px] font-semibold"
          >
            {({ isActive }) => (
              <>
                {/* A MARCA DE SELECIONADO ABRAÇA O ÍCONE, não fica acima dele.
                  *
                  * Antes era um ponto de 6 px flutuando sobre o ícone: pequeno
                  * demais pra ser visto de relance e, com duas abas largas,
                  * solto no meio do vazio. Agora é uma pílula atrás do ícone —
                  * o mesmo elemento diz "é aqui" pela forma, pela cor de fundo
                  * e pela cor do traço, em vez de depender de um detalhe de
                  * seis pixels.
                  *
                  * A pílula tem tamanho fixo e existe sempre (transparente
                  * quando inativa): assim o ícone não pula de posição ao
                  * trocar de aba, que era o motivo do ponto invisível de antes. */}
                <span
                  className={`relative inline-flex items-center justify-center h-8 w-14 rounded-full transition-colors duration-200 ${
                    isActive ? 'bg-primary/12' : 'bg-transparent'
                  }`}
                >
                  <item.icon
                    size={23}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-primary' : 'text-textMuted'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>

                <span className={isActive ? 'text-primary' : 'text-textMuted'}>
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
