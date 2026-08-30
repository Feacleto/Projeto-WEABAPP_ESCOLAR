import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import { MARK } from './logoPaths';
import {
  CENA_ABERTURA,
  assinarTravessia,
  duracaoDaTravessia,
  falaDaTravessia,
} from '../../utils/travessia';

/**
 * A CORTINA — o teatro de entrar e de sair.
 *
 * Montada UMA vez, no topo das rotas, e ela NÃO desmonta em troca de tela.
 * É isso que faz a peça atravessar a navegação inteira: quem sai levanta a
 * cortina, o logout e a mudança de rota acontecem por baixo dela, e ela só
 * sai no fim, já sobre a porta pública.
 *
 * Ela não lê a rota. A cena chega por `assinarTravessia` — o porquê está no
 * cabeçalho de utils/travessia.js, e resume-se a isto: mandar a cena no
 * `state` da navegação fazia a saída perder a corrida contra o `<Navigate>`
 * que o PrivateRoute dispara quando a sessão morre.
 *
 * AS TRÊS CENAS
 *   abertura — só no PRIMEIRO acesso. O balão de fala cresce até virar a tela
 *              e o app é revelado por dentro dele. Sem fala: o gesto já diz.
 *   entrada  — login → painel. A marca se monta, nomeia a sala e sai.
 *   saida    — sair → porta pública. Mesma peça, e a frase muda pra dizer que
 *              a sala não se desfez.
 *
 * UM TOQUE PULA O TEATRO
 * A cortina não trava ninguém: qualquer toque nela a encerra na hora. Prender
 * o motorista por quase dois segundos enquanto ele está no portão da escola
 * seria pior do que não ter teatro nenhum — e deixar `pointer-events: none`
 * seria pior ainda, porque ele acertaria um botão que não consegue ver.
 */
export default function Travessia() {
  const idBase = useId();
  const maskId = `abtv${idBase.replace(/:/g, '')}`;
  const [cenaAtiva, setCenaAtiva] = useState(null);
  const prazo = useRef(null);

  const encerrar = useCallback(() => {
    clearTimeout(prazo.current);
    setCenaAtiva(null);
  }, []);

  useEffect(() => {
    const desligar = assinarTravessia((pedido) => {
      clearTimeout(prazo.current);
      setCenaAtiva(pedido);

      const reduzido =
        typeof window !== 'undefined' &&
        Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

      prazo.current = setTimeout(
        () => setCenaAtiva(null),
        duracaoDaTravessia(pedido.cena, reduzido)
      );
    });
    return () => {
      desligar();
      clearTimeout(prazo.current);
    };
  }, []);

  if (!cenaAtiva) return null;

  const { cena, role, selo } = cenaAtiva;
  const fala = falaDaTravessia(cena, role);
  const classePapel = role === 'parent' ? ' travessia--familia' : '';

  if (cena === CENA_ABERTURA) {
    return (
      <div
        key={selo}
        className={`travessia travessia--abertura${classePapel}`}
        onPointerDown={encerrar}
        aria-hidden="true"
      >
        {/*
          O buraco é o próprio caminho do balão, escalado 13×. O viewBox é
          quadrado com `slice` porque a tela varia de proporção: assim o balão
          fica centrado em qualquer aparelho, e o retângulo da máscara é grande
          o bastante pra cobrir a sobra em qualquer recorte.
        */}
        <svg
          className="travessia-recorte"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x="-1000"
              y="-1000"
              width="3000"
              height="3000"
            >
              <rect x="-1000" y="-1000" width="3000" height="3000" fill="#fff" />
              <g className="travessia-buraco">
                <g transform="translate(500 500) scale(0.859) translate(-180 -232)">
                  <path d={MARK.window} fill="#000" />
                </g>
              </g>
            </mask>
          </defs>
          <rect
            className="travessia-fundo"
            x="-1000"
            y="-1000"
            width="3000"
            height="3000"
            mask={`url(#${maskId})`}
          />
        </svg>
        <LogoMark className="travessia-marca" tone="onDark" height={84} />
      </div>
    );
  }

  return (
    // `key` no selo: sair e entrar de novo na mesma sessão remonta o bloco, e
    // sem remontar as animações CSS não reiniciam — a segunda cena apareceria
    // já no último quadro da primeira.
    <div
      key={selo}
      className={`travessia${classePapel}`}
      onPointerDown={encerrar}
      aria-hidden="true"
    >
      <div className="travessia-corpo">
        <LogoMark className="travessia-marca" tone="onDark" height={78} />
        {fala && (
          <>
            <p className="travessia-plaqueta">{fala.plaqueta}</p>
            <p className="travessia-linha">{fala.linha}</p>
          </>
        )}
        {/*
          O fio SEMPRE completa antes de a cortina sair. Barra que para no meio
          esperando é a mesma família de mentira que a tarja de aviso existe
          pra evitar; barra que fecha e some não promete progresso nenhum — ela
          só marca que tem coisa sustentando isto do outro lado.
        */}
        <span className="travessia-fio">
          <i />
        </span>
      </div>
    </div>
  );
}
