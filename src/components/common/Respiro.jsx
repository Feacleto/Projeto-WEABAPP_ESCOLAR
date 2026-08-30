import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

/**
 * O RESPIRO — a marca esperando, no lugar do spinner.
 *
 * Substitui o `<Spinner />` nu (o Loader2 do lucide girando) nos dois lugares
 * onde a espera é DE VERDADE e pode durar: a tela cheia de atualização do app
 * e o carregamento de uma rota preguiçosa.
 *
 * POR QUE A BUZINA E NÃO UM GIRO
 * Girar é a linguagem genérica de "não sei quanto falta". As ondas emitindo
 * dizem outra coisa, e é a coisa que este produto faz: o app está chamando e
 * esperando resposta. Sai de graça — as duas ondas já são dois `<path>` do
 * `<LogoMark />`, e o que anima é o CSS.
 *
 * POR QUE O ATRASO DE 300 ms É O PONTO INTEIRO
 * Se o pedaço da rota chegar antes, NINGUÉM VÊ NADA — e é isso que se quer.
 * Animação que aparece em toda navegação não é lembrada como capricho, é
 * lembrada como lentidão: ninguém atribui meio segundo a uma decisão de
 * design, atribui ao celular ruim. Aparecendo só quando havia espera, ela
 * nunca é cobrada como atraso.
 *
 * O motorista usa isto em pé, na rua, com uma mão, num Android barato e com
 * sol na tela — ele é a razão do atraso existir.
 */
export default function Respiro({
  atraso = 300,
  altura = 60,
  tone = 'color',
  className = 'min-h-screen flex items-center justify-center',
  label = 'Carregando',
}) {
  const [visivel, setVisivel] = useState(atraso <= 0);

  useEffect(() => {
    if (atraso <= 0) return undefined;
    const t = setTimeout(() => setVisivel(true), atraso);
    return () => clearTimeout(t);
  }, [atraso]);

  if (!visivel) return null;

  return (
    <div className={className} role="status" aria-label={label}>
      <LogoMark className="ab-respiro" tone={tone} height={altura} />
    </div>
  );
}
