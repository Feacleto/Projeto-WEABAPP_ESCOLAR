import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from './Logo';
import { MARK } from './logoPaths';
import {
  CENA_ABERTURA,
  duracaoDaTravessia,
  estadoSemTravessia,
  falaDaTravessia,
  lerTravessia,
} from '../../utils/travessia';

/**
 * A CORTINA — o teatro de entrar e de sair.
 *
 * Montada UMA vez, no topo das rotas. Ela lê a cena do `state` da navegação
 * (ver src/utils/travessia.js) e toca por cima da tela que acabou de chegar.
 *
 * POR QUE PELO `state` DA NAVEGAÇÃO, E NÃO POR CONTEXTO OU BARRAMENTO
 * A cortina e a tela de destino chegam na MESMA renderização, então a tela
 * nova nunca pisca antes de ser coberta. Qualquer outra abordagem — contexto,
 * emissor de eventos, estado no topo — montaria a cortina depois da rota, e o
 * primeiro quadro entregaria o destino. Além disso é o mesmo caminho que a
 * frente já usa em frentes.js: nada de mecanismo novo.
 *
 * É a mesma razão de o estado ser ajustado DURANTE a renderização, e não num
 * efeito: efeito roda depois da pintura, e um quadro do painel aparecendo
 * antes da cortina é exatamente o defeito que isto tudo existe pra cobrir.
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
 * o motorista por um segundo e pouco enquanto ele está no portão da escola
 * seria pior do que não ter teatro nenhum — e deixar `pointer-events: none`
 * seria pior ainda, porque ele acertaria um botão que não consegue ver.
 */
export default function Travessia() {
  const location = useLocation();
  const navigate = useNavigate();
  const idBase = useId();
  const maskId = `abtv${idBase.replace(/:/g, '')}`;

  const pedida = lerTravessia(location);
  // O selo vem do nosso lado (ver estadoDaTravessia). Chavear em `location.key`
  // parecia natural e quebrava a saída: entrada e saída usam `replace`, e o
  // replace reaproveita a chave — a guarda via a mesma e engolia a segunda cena.
  const chave = pedida ? pedida.selo : null;

  const [cenaAtiva, setCenaAtiva] = useState(null);
  const [chaveVista, setChaveVista] = useState(null);
  const prazo = useRef(null);

  if (chave && chave !== chaveVista) {
    setChaveVista(chave);
    setCenaAtiva(pedida);
  }

  const encerrar = useCallback(() => {
    clearTimeout(prazo.current);
    setCenaAtiva(null);
  }, []);

  useEffect(() => {
    if (!cenaAtiva) return undefined;

    // Tira a cena do histórico: sem isso, um F5 ou um gesto de voltar
    // repetiriam o teatro.
    navigate(location.pathname + location.search, {
      replace: true,
      state: estadoSemTravessia(location.state),
    });

    const reduzido =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    prazo.current = setTimeout(
      () => setCenaAtiva(null),
      duracaoDaTravessia(cenaAtiva.cena, reduzido)
    );
    return () => clearTimeout(prazo.current);
    // O `navigate` acima muda o location de propósito; reentrar por causa
    // dele derrubaria a cortina no quadro seguinte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cenaAtiva]);

  if (!cenaAtiva) return null;

  const { cena, role } = cenaAtiva;
  const fala = falaDaTravessia(cena, role);
  const classePapel = role === 'parent' ? ' travessia--familia' : '';

  if (cena === CENA_ABERTURA) {
    return (
      <div
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
    <div className={`travessia${classePapel}`} onPointerDown={encerrar} aria-hidden="true">
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
