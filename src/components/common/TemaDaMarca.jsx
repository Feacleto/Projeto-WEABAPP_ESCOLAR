import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';
import { useTemaDaMarca } from '../../hooks/useTemaDaMarca';

/**
 * A COR DO MOTORISTA NO APP — montada ao lado do painel do motorista e do da
 * família (App.jsx). Não desenha nada.
 *
 * `useMarcaDoTio` já responde "de qual motorista": o próprio, para ele; o da
 * criança ATIVA, para a família — a mãe de perua dupla vê a cor do motorista
 * do filho que está na tela, a mesma regra que decide qual logo aparece.
 */
/**
 * A ZONA DA PLATAFORMA: o que está aqui dentro volta ao verde do Alô
 * Buzinou, por cima da cor do motorista. É a RELAÇÃO dele com a plataforma —
 * plano, taxa, contrato da associação, pausar, indicar, selo, suporte, sair
 * da conta — e ela fala com a voz da casa, não com a marca dele.
 *
 * Só para o MOTORISTA: no app da família tudo fica na cor do motorista (pedido
 * do dono), então quem monta a zona em tela compartilhada passa `ativa`.
 */
export function ZonaDaPlataforma({ ativa = true, className = '', children }) {
  if (!ativa) return children;
  return <div className={`tema-alo ${className}`}>{children}</div>;
}

export default function TemaDaMarca() {
  const { cor } = useMarcaDoTio();
  useTemaDaMarca(cor);
  return null;
}
