import { Bus, Home, School } from 'lucide-react';
import Avatar from '../common/Avatar';
import { horaCurta } from '../../dominio/rota/horarios';
import { quantosNaEscola } from '../../dominio/rota/zonasDaRota.js';

/**
 * AS ZONAS DA ROTA AO VIVO (05/10/2026, protótipo "A auxiliar marca, o tio
 * vê" aprovado pelo dono): onde cada criança da viagem está AGORA.
 *
 *   ida    Ainda em casa (apagados, na ordem da hora) → Na perua → Na escola
 *   volta  Na escola → Na perua → Entregues em casa
 *
 * A ordem na tela é o caminho da viagem, e o que muda com uma marcação é a
 * ZONA da criança. Quem decide a zona é a régua (`zonasDaRota.js`); aqui só
 * se desenha. A mesma peça serve o tio e a auxiliar — os dois veem o mesmo
 * lugar para a mesma criança.
 *
 * Tocar numa criança abre a FICHA RÁPIDA (`onTocar`), em qualquer zona.
 *
 * ⚠️ NADA SE MEXE SOZINHO: sem animação de entrada nem de troca de zona. O
 * "ao vivo" é a criança mudar de lugar quando alguém marca, e só isso.
 *
 * ⚠️ A PERUA AQUI É UMA CAIXA SIMPLES, sem assentos. O desenho da perua em
 * vagas (o Início, os planos) é de outra frente; quando ele existir, esta
 * caixa pode passar a usá-lo.
 */
export default function ZonasDaRota({ zonas, onTocar, vez = null }) {
  if (!zonas) return null;
  const ida = zonas.direcao === 'ida';
  const naEscola = quantosNaEscola(zonas);

  const casa = (
    <Zona
      key="casa"
      icone={Home}
      titulo={ida ? 'Ainda em casa' : 'Entregues em casa'}
      quantos={ida ? zonas.emCasa.length : zonas.entregues.length}
    >
      <Pessoas
        itens={ida ? zonas.emCasa : zonas.entregues}
        apagado={ida}
        onTocar={onTocar}
        vez={vez}
        comHora={ida}
      />
      {zonas.fora.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {zonas.fora.map((item) => (
            <button
              key={item.child.id}
              type="button"
              onClick={() => onTocar?.(item)}
              className="tap inline-flex min-h-12 items-center gap-1.5 rounded-full bg-surface px-3 text-base font-medium text-textMuted line-through"
            >
              {primeiro(item.child.name)}
            </button>
          ))}
        </div>
      )}
    </Zona>
  );

  const perua = (
    <section key="perua" className="rounded-2xl border-2 border-perua bg-card p-3 shadow-rest">
      <h3 className="flex items-center gap-2 text-base font-bold text-text">
        <Bus size={20} className="text-warningText" aria-hidden="true" />
        Na perua
        <span className="ml-auto text-base font-semibold tabular-nums text-textMuted">{zonas.naPerua.length}</span>
      </h3>
      <Pessoas itens={zonas.naPerua} onTocar={onTocar} vez={vez} vazio="Ninguém na perua agora" />
    </section>
  );

  const escola = (
    <section key="escola" className="space-y-2">
      <h3 className="flex items-center gap-2 px-1 text-base font-bold text-text">
        <School size={20} className="text-escola" aria-hidden="true" />
        Na escola
        <span className="ml-auto text-base font-semibold tabular-nums text-textMuted">{naEscola}</span>
      </h3>
      {zonas.naEscola.length === 0 ? (
        <p className="rounded-xl bg-escolaSoft px-3 py-3 text-base text-textBody">Ninguém na escola agora</p>
      ) : (
        zonas.naEscola.map((g) => (
          <div key={g.chave} className="rounded-xl border border-escolaBorder bg-escolaSoft p-3">
            <p className="text-base font-bold text-escola">{g.nome}</p>
            <Pessoas itens={g.criancas} onTocar={onTocar} vez={vez} />
          </div>
        ))
      )}
    </section>
  );

  return <div className="space-y-3">{ida ? [casa, perua, escola] : [escola, perua, casa]}</div>;
}

function primeiro(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'Criança';
}

function Zona({ icone: Icone, titulo, quantos, children }) {
  return (
    <section className="rounded-2xl bg-card p-3 shadow-rest">
      <h3 className="flex items-center gap-2 text-base font-bold text-text">
        <Icone size={20} className="text-primary" aria-hidden="true" />
        {titulo}
        <span className="ml-auto text-base font-semibold tabular-nums text-textMuted">{quantos}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * As crianças de uma zona: rosto, primeiro nome e (na fila de casa) a hora.
 * `apagado` é a fila de casa da ida — quem ainda não entrou fica em cinza, e
 * acende quando sobe na perua. A criança da vez ganha o anel da perua.
 */
function Pessoas({ itens, onTocar, apagado = false, vez = null, comHora = false, vazio = 'Ninguém' }) {
  if (!itens?.length) return <p className="mt-2 text-base text-textMuted">{vazio}</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {itens.map((item) => {
        const ehVez = vez && vez === item.child.id;
        return (
          <button
            key={item.child.id}
            type="button"
            onClick={() => onTocar?.(item)}
            aria-label={`${item.child.name}: abrir a ficha`}
            className={`tap flex min-h-12 min-w-[72px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 ${
              ehVez ? 'bg-card ring-2 ring-perua' : 'bg-surface'
            }`}
          >
            <span className={apagado && !ehVez ? 'opacity-50 grayscale' : ''}>
              <Avatar photoURL={item.child.photoURL} gender={item.child.gender} seed={item.child.id} kind="child" size="sm" />
            </span>
            <span className={`max-w-[88px] truncate text-base font-semibold ${apagado && !ehVez ? 'text-textMuted' : 'text-text'}`}>
              {primeiro(item.child.name)}
            </span>
            {comHora && item.hora && (
              <span className="text-sm tabular-nums text-textMuted">{horaCurta(item.hora)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
