import { useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import { useRecomendacoesQueRecebi } from '../../hooks/useAvaliacoesDaAuxiliar';
import { responderRecomendacao } from '../../services/avaliacoesDaAuxiliarService';
import { pontosEmOrdem } from '../../dominio/identidade/avaliacaoDaAuxiliar.js';

/**
 * AS RECOMENDAÇÕES QUE ELA RECEBEU — no Perfil da auxiliar (05/10/2026).
 *
 * Ela lê ANTES de qualquer um e decide: "Mostrar" (fica aprovada), "Não
 * mostrar" (fica guardada só para os dois) ou "Apagar". O tio editar volta
 * para pendente, e ela decide de novo.
 *
 * ⚠️ A frase da aprovada é verdade HOJE: ninguém além dos dois e da equipe
 * lê nada. A leitura por outros tios só existirá quando ela se puser
 * disponível (etapa futura da Comunidade) — e a frase diz exatamente isso.
 *
 * "Mostrar" é o único botão cheio da tela, e só na pendente.
 */
export default function RecomendacoesRecebidas() {
  const lista = useRecomendacoesQueRecebi();
  const [apagando, setApagando] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  if (!lista || lista.length === 0) return null;
  const ordenadas = [...lista].sort((a, b) => (a.estado === 'pendente' ? -1 : 0) - (b.estado === 'pendente' ? -1 : 0));

  async function responder(r, acao) {
    setOcupado(`${r.id}:${acao}`);
    try {
      await responderRecomendacao(r.motoristaUid, acao);
      toast.success(acao === 'aprovar' ? 'Pronto. Recomendação aprovada.' : acao === 'ocultar' ? 'Guardada só para vocês dois.' : 'Apagada.');
    } catch (err) {
      toast.error(err?.message || 'Não deu. Tente de novo.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="px-1 font-display text-lg font-bold text-text">Recomendações</h2>
      {ordenadas.map((r, i) => (
        <div key={r.id} className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
          <p className="text-base font-bold text-text">{r.assinatura}</p>
          <ul className="space-y-1">
            {pontosEmOrdem(r.pontos).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-base text-textBody">
                <Check size={18} className="text-accentText" aria-hidden="true" />
                {p.rotulo}
              </li>
            ))}
          </ul>
          {r.frase && <p className="text-base italic text-textBody">“{r.frase}”</p>}

          {r.estado === 'pendente' ? (
            <>
              <p className="text-base font-semibold text-warningText">Leia e escolha se ela aparece.</p>
              {/* Um botão cheio por tela: só a PRIMEIRA pendente (elas vêm
                * primeiro na lista) leva o "Mostrar" cheio; as outras, contorno. */}
              {i === 0 ? (
                <Button onClick={() => responder(r, 'aprovar')} loading={ocupado === `${r.id}:aprovar`}>Mostrar</Button>
              ) : (
                <Botao onClick={() => responder(r, 'aprovar')} disabled={!!ocupado}>
                  {ocupado === `${r.id}:aprovar` ? 'Mostrando…' : 'Mostrar'}
                </Botao>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Botao onClick={() => responder(r, 'ocultar')} disabled={!!ocupado}>Não mostrar</Botao>
                <Botao onClick={() => setApagando(r)} disabled={!!ocupado}>Apagar</Botao>
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-textBody">
                {r.estado === 'aprovada'
                  ? 'Aparece para outros tios quando você se colocar disponível.'
                  : 'Guardada só para você e quem escreveu.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {r.estado === 'aprovada' ? (
                  <Botao onClick={() => responder(r, 'ocultar')} disabled={!!ocupado}>Não mostrar</Botao>
                ) : (
                  <Botao onClick={() => responder(r, 'aprovar')} disabled={!!ocupado}>Mostrar</Botao>
                )}
                <Botao onClick={() => setApagando(r)} disabled={!!ocupado}>Apagar</Botao>
              </div>
            </>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!apagando}
        title="Apagar esta recomendação?"
        description="Ela some para você e para quem escreveu."
        confirmLabel="Apagar"
        variant="danger"
        loading={!!ocupado}
        onConfirm={async () => {
          await responder(apagando, 'apagar');
          setApagando(null);
        }}
        onCancel={() => setApagando(null)}
      />
    </section>
  );
}

function Botao({ children, ...rest }) {
  return (
    <button
      type="button"
      className="tap min-h-12 rounded-xl border-2 border-border bg-card px-3 text-base font-bold text-text disabled:opacity-60"
      {...rest}
    >
      {children}
    </button>
  );
}
