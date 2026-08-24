import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarAguardando, aprovarAssociado } from '../../services/associadoService';
import { useAuth } from '../../hooks/useAuth';

/**
 * CONTAS QUE JÁ EXISTEM E ESPERAM A APROVAÇÃO DO DONO.
 *
 * Isto é diferente da lista de interessados logo abaixo, e a diferença
 * importa: ali embaixo são LEADS — gente que deixou o contato. Aqui são
 * CONTAS — pessoas que já se cadastraram, já entraram, e estão vendo a sala
 * de espera agora. Aprovar aqui não manda um email: abre o app pra alguém que
 * está do outro lado esperando.
 *
 * A APROVAÇÃO É IRREVERSÍVEL POR ESTE CAMINHO, e é de propósito. Desfazer um
 * aceite é SUSPENDER — que deixa rastro e é reversível. Apagar o fato de que
 * a conta foi aprovada um dia seria reescrever história numa relação
 * comercial, e a plataforma não deveria conseguir fazer isso.
 *
 * Por isso o botão pede confirmação: um toque errado numa lista não pode
 * mudar o estado de um contrato.
 */
export default function AguardandoAprovacao() {
  const { user } = useAuth();
  const [lista, setLista] = useState(null); // null = carregando
  const [aprovando, setAprovando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const carregar = () =>
    listarAguardando()
      .then(setLista)
      .catch(() => setLista([]));

  useEffect(() => {
    carregar();
  }, []);

  const aprovar = async (inscrito) => {
    setAprovando(inscrito.id);
    setConfirmando(null);
    try {
      await aprovarAssociado(inscrito.id, user?.uid);
      toast.success(`${primeiroNome(inscrito.name)} agora tem acesso.`);
      // Recarrega em vez de tirar da lista na mão: se a escrita foi recusada
      // por regra, a pessoa continua aparecendo — e é isso que a gente quer
      // ver. Sumir da tela sem ter mudado nada é a pior mentira possível aqui.
      await carregar();
    } catch (err) {
      console.error('Falha ao aprovar associado:', err);
      toast.error('Não deu pra aprovar agora. Tente de novo.');
    } finally {
      setAprovando(null);
    }
  };

  if (lista === null || lista.length === 0) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-text">
        <UserCheck size={16} className="text-primary" />
        Esperando sua aprovação
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
          {lista.length}
        </span>
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-textMuted">
        Já têm conta e estão vendo a tela de espera agora. Aprovar abre o app
        na hora, sem precisar avisar.
      </p>

      <ul className="mt-3 space-y-2">
        {lista.map((i) => (
          <li key={i.id} className="rounded-xl border border-gray-200 bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text">
                  {i.name || 'Sem nome'}
                  {i.posicaoNaFila ? (
                    <span className="ml-1.5 text-[11px] font-semibold text-textMuted">
                      {i.posicaoNaFila}º da fila
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-[12px] text-textMuted">{i.email}</p>
                {(i.city || i.fleet) && (
                  <p className="mt-0.5 text-[11px] text-textMuted">
                    {[i.city, i.fleet && `${i.fleet} perua(s)`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>

              {confirmando === i.id ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => aprovar(i)}
                    className="tap rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="tap rounded-lg px-2 py-2 text-[12px] font-semibold text-textMuted"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(i.id)}
                  disabled={aprovando === i.id}
                  className="tap inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-[12px] font-bold text-primary disabled:opacity-50"
                >
                  {aprovando === i.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <BadgeCheck size={14} />
                  )}
                  Aprovar
                </button>
              )}
            </div>

            {confirmando === i.id && (
              <p className="mt-2 text-[11px] leading-relaxed text-textMuted">
                Isso dá acesso completo ao app. Para desfazer depois, o caminho
                é suspender — que fica registrado.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || 'O associado';
}
