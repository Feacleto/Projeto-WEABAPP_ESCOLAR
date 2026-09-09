import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { indiceDaAba } from '../../compartilhado/abaAtiva';

/**
 * Navegação inferior em pílula flutuante.
 *
 * ── QUEM USA ISTO, E O QUE ISSO DECIDE
 * O motorista tem cerca de 40 anos e usa o app EM PÉ, NA RUA, SOB SOL, COM UMA
 * MÃO. A partir dessa idade a primeira coisa que a vista perde não é nitidez,
 * é sensibilidade a CONTRASTE BAIXO — diferenças pequenas de claro e escuro.
 *
 * O que ela NÃO perde é a percepção de MOVIMENTO, inclusive na visão
 * periférica, que é onde este rodapé vive enquanto ele olha o meio da tela.
 * As três mudanças de 09/09/2026 saem daí.
 *
 * ── 1. A PASTILHA É SÓLIDA
 * Era `bg-primary/12`: um verde a 12%, exatamente o tipo de diferença que essa
 * vista deixa de ver — e que sob sol, num Android barato, vira branco sobre
 * branco. Sobravam dois dos três sinais que este arquivo já projetou.
 *
 * ── 2. ELA É UMA SÓ, E DESLIZA
 * Cada link tinha a sua. Agora existe UMA, absoluta, posicionada pelo índice
 * da aba ativa: o olho segue o movimento de graça, e procurar de novo onde
 * ficou o verde custa atenção que está no trânsito.
 *
 * A curva `cubic-bezier(.22,.9,.24,1)` sai rápido e freia macio. A saída
 * rápida é o que faz parecer instantâneo; a freada é o que diz "chegou".
 * ⚠️ SEM OVERSHOOT — repique seria simpático numa rede social e é ruído para
 * quem está de olho no trânsito.
 *
 * ── 3. O APERTO ACONTECE NO `pointerdown`, NÃO NO CLIQUE
 * É a mais importante das três. Ele toca com o celular numa mão e o pé no
 * freio: se nada acontece em ~200 ms ele toca de novo, e dois toques na aba é
 * uma navegação jogada fora. O reconhecimento tem que sair ANTES da decisão de
 * navegar — e com a perua ligada o tato chega antes da vista, daí os 10 ms de
 * vibração no mesmo evento.
 *
 * ── OS TRÊS SINAIS REDUNDANTES CONTINUAM
 * Forma (a pastilha), cor (do ícone e do rótulo) e peso do traço. A leitura
 * nunca depende só de cor. E a caixa de 32×56 existe SEMPRE, inclusive na aba
 * inativa: sem ela o ícone pula de posição ao trocar de aba.
 *
 * ── ⚠️ SE O DESENHO DEPENDER DA ANIMAÇÃO PARA SER ENTENDIDO, ELE ESTÁ ERRADO
 * Em `prefers-reduced-motion` a pastilha PULA para o lugar novo e a tela não
 * desliza (ver os layouts) — mas o aperto no dedo CONTINUA, porque é resposta
 * tátil e não animação de enfeite. Quem liga essa opção no Android pede por um
 * motivo: enjoo, vertigem, epilepsia fotossensível.
 *
 * items: [{ to, label, icon: LucideIcon, end?: bool, badge?: number,
 *           tour?: string }]
 *
 * `tour` vira data-tour no link: é a âncora que o tutorial guiado ilumina e
 * escuta pra saber que a pessoa tocou na aba certa.
 *
 * ⚠️ O BADGE CONTINUA SEM USO nas duas abas. Ele existe aqui, mas âmbar e
 * vermelho são sinais de ATENDER: num rodapé permanente eles piscariam todo
 * dia e ensinariam a ignorar.
 */

export default function BottomNav({ items }) {
  const { pathname } = useLocation();
  const ativo = indiceDaAba(pathname, items);
  const [apertada, setApertada] = useState(null);

  /* O centro da coluna, menos metade da pastilha (56 / 2 = 28px).
     Para N abas: ((índice * 2 + 1) / (N * 2)) * 100%. */
  const esquerda = `calc(${
    ((Math.max(ativo, 0) * 2 + 1) / (items.length * 2)) * 100
  }% - 28px)`;

  const soltar = () => setApertada(null);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-30 px-3 pb-3 pointer-events-none print:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.75rem)' }}
    >
      {/* rounded-full em vez de rounded-3xl: pílula de verdade, e o formato
        * já sugere que ela flutua acima do conteúdo.
        *
        * `relative` e `overflow-hidden` são novos, e existem por causa da
        * pastilha: ela é absoluta aqui dentro e não pode escapar da borda
        * arredondada enquanto desliza. */}
      <div
        className="pointer-events-auto relative overflow-hidden bg-card/95 backdrop-blur-md rounded-full shadow-float border border-neutro grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {/* A PASTILHA ÚNICA. Vem antes dos links no DOM e eles levam `z-10`,
          * então o ícone fica por cima dela sem precisar de sobreposição
          * manual.
          *
          * Some (sem sair do lugar) nas telas que não são aba: parada numa
          * das duas colunas ela diria que a pessoa está numa aba em que ela
          * não está. */}
        <span
          aria-hidden
          className="absolute top-2 h-8 w-14 rounded-full bg-primary transition-[left,opacity] duration-[260ms] ease-[cubic-bezier(.22,.9,.24,1)] motion-reduce:transition-none"
          style={{ left: esquerda, opacity: ativo >= 0 ? 1 : 0 }}
        />

        {items.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tour}
            /* ⚠️ O RECONHECIMENTO SAI AQUI, antes de o roteador saber de
             * qualquer coisa. `pointerdown` e não `click`. */
            onPointerDown={() => {
              setApertada(i);
              if (navigator.vibrate) navigator.vibrate(10);
            }}
            onPointerUp={soltar}
            /* Arrastar o dedo para fora desfaz: a aba desencolhe e o
             * navegador não dispara o clique. É o desfazer que todo botão de
             * celular precisa ter. */
            onPointerLeave={soltar}
            onPointerCancel={soltar}
            className={`tap relative z-10 flex flex-col items-center justify-center gap-1 pt-2 pb-2.5 text-[12px] transition-transform duration-[90ms] ease-out ${
              apertada === i ? 'scale-[0.96]' : 'scale-100'
            }`}
          >
            {({ isActive }) => (
              <>
                {/* A caixa existe sempre e não tem mais fundo próprio: quem
                  * pinta é a pastilha que desliza por trás. O tamanho fica
                  * porque é ele que impede o ícone de pular. */}
                <span className="relative inline-flex items-center justify-center h-8 w-14">
                  <item.icon
                    size={23}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    /* A transição no traço é nova: o engrossar já existia e
                     * acontecia num quadro só, então ninguém via. */
                    className={`transition-[stroke-width,color] duration-200 ${
                      isActive ? 'text-primaryBorder' : 'text-textMuted'
                    }`}
                  />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-card">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>

                {/* O peso separa os dois estados sem gastar cor — e peso é o
                  * único sinal que não depende de luz. Antes os dois eram
                  * `semibold`, e por isso as duas abas pareciam meio ligadas. */}
                <span
                  className={`transition-colors duration-200 ${
                    isActive
                      ? 'font-bold text-primary'
                      : 'font-medium text-textMuted'
                  }`}
                >
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
