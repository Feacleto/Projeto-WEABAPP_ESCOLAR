import RostoDaVaga from './RostoDaVaga';
import { vagasDesenhadas } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * A PERUA EM MINIATURA — uma grade de quadradinhos, o rosto de cada criança
 * ativa e as vagas livres tracejadas (05/10/2026). É a mesma perua no Início,
 * nos planos e na turma do mês.
 *
 * `acesa(crianca)` (opcional) destaca algumas e apaga as outras — na turma do
 * mês, quem entrou acende.
 *
 * Com mais crianças que vagas, as que sobram vêm depois de uma linha "Acima
 * das vagas", sem erro: o número de vagas é o que ele disse, não uma tranca.
 * É desenho: quem lê a tela ouve a frase de contagem ao lado.
 */
export default function MiniPerua({ vagas, criancas = [], acesa }) {
  const { vagas: celulas, acima } = vagasDesenhadas({ vagas, criancas });
  return (
    <div aria-hidden="true">
      <div className="grid grid-cols-8 gap-1">
        {celulas.map(({ indice, crianca }) => (
          <Quadradinho key={indice} crianca={crianca} acesa={acesa} />
        ))}
      </div>
      {acima.length > 0 && (
        <>
          <p className="mt-2 text-base font-bold text-textBody">Acima das vagas</p>
          <div className="mt-1 grid grid-cols-8 gap-1">
            {acima.map((c) => (
              <Quadradinho key={c.id} crianca={c} acesa={acesa} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Quadradinho({ crianca, acesa }) {
  if (!crianca) {
    return (
      <span className="aspect-square rounded-md border-[1.5px] border-dashed border-borderStrong bg-card" />
    );
  }
  const destaque = acesa ? acesa(crianca) : true;
  return (
    <span
      className={`flex aspect-square items-center justify-center rounded-md border-[1.5px] ${
        destaque ? 'border-primary bg-primarySoft' : 'border-border bg-card opacity-50'
      }`}
    >
      <RostoDaVaga crianca={crianca} className="h-[88%] w-[88%]" />
    </span>
  );
}
