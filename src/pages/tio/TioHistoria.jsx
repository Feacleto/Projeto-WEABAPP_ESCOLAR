import { useState } from 'react';
import { Baby, BadgeCheck, Medal, PlayCircle, UserPlus, UserRound, Users } from 'lucide-react';
import Header from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useNivel } from '../../hooks/useNivel';
import { marcosDaHistoria, marcosPrincipais } from '../../dominio/associacao/autoatendimento.js';

/**
 * MINHA HISTÓRIA — a trajetória do motorista no app (04/10/2026, pedido do dono).
 *
 * Abre pelo botão "Minha história" do topo de "Meus planos" e pelo link nas
 * falas em que a história importa (fim do teste, rota parada, saída marcada).
 * Mostra os QUATRO marcos de virada; "Ver história completa" abre todos.
 *
 * Os marcos saem do que o app já guarda (`marcosDaHistoria`, testado em
 * `npm run testar:autoatendimento`). Nenhum número é inventado: sem dado, o
 * marco não aparece.
 */
const ICONES = {
  conta: UserRound,
  crianca: Baby,
  familia: Users,
  teste: PlayCircle,
  plano: BadgeCheck,
  indicacao: UserPlus,
  nivel: Medal,
};

const quando = (m) =>
  m.hoje
    ? 'Hoje'
    : new Date(m.ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function TioHistoria() {
  const { user, profile } = useAuth();
  const { children } = useChildren();
  const { nivel } = useNivel(user?.uid);
  const [completa, setCompleta] = useState(false);

  const marcos = marcosDaHistoria({ perfil: profile || {}, criancas: children, nivel });
  const mostrados = completa ? marcos : marcosPrincipais(marcos);
  const familias = children.filter((c) => c?.parentUid).length;
  const indicacoes = Number(profile?.indicacoesAtivas) || 0;

  return (
    <div className="min-h-screen bg-bg">
      <Header title="Minha história" showBack backLabel="Meus planos" backTo="/tio/planos" showGlobal={false} />

      <div className="mx-auto max-w-mobile space-y-4 px-4 pb-8 pt-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [children.length, children.length === 1 ? 'criança' : 'crianças'],
            [familias, familias === 1 ? 'família no app' : 'famílias no app'],
            [indicacoes, indicacoes === 1 ? 'colega indicado' : 'colegas indicados'],
          ].map(([n, rotulo]) => (
            <div key={rotulo} className="rounded-xl border border-border bg-card px-1 py-3">
              <p className="font-display text-2xl font-bold text-accentText">{n}</p>
              <p className="text-sm leading-tight text-textMuted">{rotulo}</p>
            </div>
          ))}
        </div>

        {mostrados.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-base text-textMuted">
            Sua história começa quando você cadastrar a primeira criança.
          </p>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-4">
            {!completa && (
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-textMuted">
                Os marcos mais importantes
              </p>
            )}
            <ol>
              {mostrados.map((m, i) => {
                const Icone = ICONES[m.icone] || BadgeCheck;
                const ultimo = i === mostrados.length - 1;
                return (
                  <li key={`${m.icone}-${m.ms}-${i}`} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-3 pb-4">
                    {!ultimo && (
                      <span aria-hidden="true" className="absolute bottom-0 left-[19px] top-11 w-0.5 bg-primaryBorder" />
                    )}
                    <span className="z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-primaryChip text-primary">
                      <Icone size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-accentText">{quando(m)}</p>
                      <p className="text-base text-text">{m.texto}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {marcos.length > marcosPrincipais(marcos).length && (
              <button
                type="button"
                onClick={() => setCompleta((v) => !v)}
                className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
              >
                {completa ? 'Ver só os principais' : 'Ver história completa'}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
