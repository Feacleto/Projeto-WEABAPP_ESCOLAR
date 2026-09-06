/**
 * A ESTRADA — a van parada e a rua correndo embaixo dela.
 *
 * POR QUE A RUA SE MOVE E A VAN NÃO
 * A alternativa era a van atravessar a tela com a linha enchendo atrás, que é
 * mais bonita e é uma MENTIRA: barra de progresso afirma que alguém sabe
 * quanto falta. Aqui ninguém sabe. Esta tela cobre a troca do service worker,
 * que não reporta percentual nem etapa — tanto que o `AtualizacaoDisponivel`
 * recarrega na marra depois de 8s justamente porque não dá pra saber quando o
 * worker assume.
 *
 * Com a van chegando no fim da linha e a tela não voltando, a pessoa vê uma
 * promessa ser quebrada na frente dela. Rua correndo não promete chegada: diz
 * "estou andando", que é exatamente o que o app sabe. É o mesmo critério de
 * `dominio/rota/avisoDoMomento.js` — o app só fala quando tem o que dizer.
 *
 * A ANIMAÇÃO MORA NO CSS (`index.css`), não aqui, pelo mesmo motivo que a do
 * `Respiro`: é onde o `prefers-reduced-motion` desliga tudo de uma vez, sem
 * este componente precisar saber que essa preferência existe.
 *
 * `aria-hidden` porque é enfeite: quem lê a tela por leitor já recebeu
 * "Atualizando o app" do texto ao lado, e uma van não acrescenta informação.
 */
export default function EstradaCarregando({ className = '' }) {
  return (
    <div
      aria-hidden
      className={`ab-estrada relative h-11 w-full max-w-[220px] ${className}`}
    >
      {/* O asfalto: tracejado em movimento. É um gradiente repetido e não
        * elementos — um `background-position` anima na GPU, e uma fila de
        * divs animados não. */}
      <span className="ab-estrada-asfalto absolute inset-x-0 bottom-0 block h-[3px] rounded-full" />

      <svg
        viewBox="0 0 64 40"
        className="ab-estrada-van absolute bottom-[5px] left-1/2 block h-[26px] w-auto -translate-x-1/2"
      >
        <rect x="2" y="6" width="46" height="24" rx="7" fill="#1F5F3F" />
        <rect x="7" y="11" width="30" height="12" rx="3.5" fill="#EEF1EF" />
        <rect x="9" y="28" width="9" height="6" rx="3" fill="#1F5F3F" />
        <rect x="32" y="28" width="9" height="6" rx="3" fill="#1F5F3F" />
        {/* As ondas em `accent`, as mesmas duas do logotipo. */}
        <path
          d="M53 14a8 8 0 0 1 0 9"
          stroke="#52C41A"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 9a14 14 0 0 1 0 19"
          stroke="#52C41A"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
