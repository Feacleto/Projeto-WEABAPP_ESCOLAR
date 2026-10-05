import SeletorDeVagas from './SeletorDeVagas';
import DesenhoDaPerua from './DesenhoDaPerua';
import { useChildren } from '../../hooks/useChildren';

/**
 * O PASSO "QUANTAS VAGAS TEM A SUA PERUA?" do card do primeiro acesso
 * (05/10/2026, decisão do dono) — depois da marca.
 *
 * A perua se desenha a cada toque no − e +. Aqui ela SÓ MOSTRA: o card cobre
 * o app, e sair dele para cadastrar uma criança perderia o passo. Tocar na
 * vaga livre mora na perua aberta pelo Início (`LinhaDaPerua`), que leva ao
 * mesmo "Cadastrar criança" de sempre.
 *
 * Quem já usa o app vê a turma dele dentro da perua, na ordem do cadastro.
 */
export default function PassoDasVagas({ valor, onChange }) {
  const { children: turma } = useChildren();
  return (
    <>
      <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
        Quantas vagas tem a sua perua?
      </h2>
      <p className="mt-1.5 text-base text-textMuted">Você e a auxiliar não contam.</p>
      <div className="mt-4">
        <SeletorDeVagas valor={valor} onChange={onChange} />
      </div>
      <div className="mt-4">
        <DesenhoDaPerua vagas={valor} criancas={turma} />
      </div>
    </>
  );
}
