import { ChevronRight, School } from 'lucide-react';
import Avatar from '../common/Avatar';
import { horaCurta, precisaDaPerua, ROTULO_ESTADO } from '../../dominio/rota/horarios';

/**
 * QUEM ELE PEGA, NA ORDEM, com quem faltou já em cinza — e a escola como marco.
 *
 * Morava no Início. Desde 04/10/2026 (decisão do dono) o Início ficou com o
 * dia dele em quatro blocos, e a lista foi para "Minha rota" (`/tio/rota`),
 * onde ele vê a rota padrão, edita e inicia.
 *
 * CADA CRIANÇA ABRE A FICHA DELA, como FOLHA por cima: ele está olhando a
 * viagem, e perder essa tela para ver um telefone é o pedágio que a folha
 * existe para não cobrar.
 */
export default function ListaDaViagem({ bloco, onAbrirFicha }) {
  if (!bloco?.paradas?.length) return null;
  return (
    <section className="space-y-2">
      {bloco.direcao === 'volta' && bloco.escolas.length > 0 && (
        <ParadaEscola escolas={bloco.escolas} />
      )}

      {bloco.paradas.map((p) => {
        const fora = !precisaDaPerua(p.estado);
        return (
          <button
            type="button"
            key={p.child.id}
            onClick={() => onAbrirFicha?.(p.child.id)}
            className={`tap w-full min-h-14 text-left rounded-xl px-3 py-2 flex items-center gap-2.5 border ${
              fora ? 'bg-sunken border-border opacity-70' : 'bg-card border-border'
            }`}
          >
            <span
              className={`font-mono text-base tabular-nums w-14 shrink-0 ${
                fora ? 'text-textMuted' : 'text-text font-semibold'
              }`}
            >
              {horaCurta(p.hora)}
            </span>
            <Avatar
              photoURL={p.child.photoURL}
              gender={p.child.gender}
              seed={p.child.id}
              kind="child"
              size="sm"
            />
            <span className="flex-1 min-w-0">
              <span
                className={`block text-base font-semibold truncate ${
                  fora ? 'text-textMuted line-through' : 'text-text'
                }`}
              >
                {p.child.name}
              </span>
              {fora && (
                <span className="block text-sm text-warningText font-medium">
                  {ROTULO_ESTADO[p.estado] || 'Fora hoje'}
                </span>
              )}
            </span>
            <ChevronRight size={16} className="shrink-0 text-textMuted" />
          </button>
        );
      })}

      {bloco.direcao === 'ida' && bloco.escolas.length > 0 && (
        <ParadaEscola escolas={bloco.escolas} />
      )}
    </section>
  );
}

function ParadaEscola({ escolas }) {
  return (
    <div className="flex min-h-12 items-center gap-2.5 px-3 py-2 rounded-xl bg-escolaSoft border border-escolaBorder">
      <School size={18} className="text-escola shrink-0" />
      <span className="flex-1 min-w-0 text-base font-semibold text-escola truncate">
        {escolas.map((e) => e.nome).join(' · ')}
      </span>
    </div>
  );
}
