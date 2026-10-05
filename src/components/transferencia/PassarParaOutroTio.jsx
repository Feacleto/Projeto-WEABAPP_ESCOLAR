import { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import Sheet, { SheetCTA, SheetGhost } from '../common/Sheet';
import { meusParceiros } from '../../services/comunidadeService';
import {
  cancelarTransferencia,
  pedirTransferencia,
  watchTransferenciasDaCrianca,
} from '../../services/transferenciasService';
import {
  O_QUE_NAO_VAI,
  O_QUE_VAI,
  estaAberta,
  fraseDoEstado,
  prazoDoPedido,
} from '../../dominio/identidade/transferencia.js';

/**
 * "PASSAR PARA OUTRO TIO" — na ficha da criança, do lado do tio de agora
 * (fase 2 da rede, 05/10/2026). Regras em `reguaDaTransferencia.js`.
 *
 * Só aparece com a cobrança LIGADA, com a criança ativa e com a família já no
 * app (é ela quem aceita, no celular dela). A lista é a dos tios PARCEIROS
 * dele — nunca uma busca de tios (declaração 5 da marca).
 *
 * O pedido aberto aparece no lugar do botão, com o estado e "Cancelar".
 */
export default function PassarParaOutroTio({ child }) {
  const { user } = useAuth();
  const cobranca = useCobrancaLigada();
  const [pedidos, setPedidos] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [parceiros, setParceiros] = useState(null);
  const [escolhido, setEscolhido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // O relógio da tela: o prazo de 7 dias não muda em segundos.
  const [agora] = useState(() => Date.now());

  useEffect(() => watchTransferenciasDaCrianca(user?.uid, child?.id, setPedidos), [user?.uid, child?.id]);

  useEffect(() => {
    if (!aberto || parceiros) return;
    let vivo = true;
    meusParceiros()
      .then((d) => vivo && setParceiros(d.parceiros))
      .catch(() => vivo && setParceiros([]));
    return () => {
      vivo = false;
    };
  }, [aberto, parceiros]);

  if (!cobranca || !child?.id || child.active === false || !child.parentUid) return null;

  const atual = pedidos
    .filter((t) => estaAberta(t, agora))
    .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))[0];
  const nome = String(child.name || '').trim().split(/\s+/)[0] || 'a criança';

  const pedir = async () => {
    setEnviando(true);
    try {
      await pedirTransferencia(child.id, escolhido.uid);
      toast.success(`Pedido enviado para ${escolhido.marca}.`);
      setAberto(false);
      setEscolhido(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async () => {
    if (!window.confirm('Cancelar o pedido? A criança continua na sua turma.')) return;
    try {
      await cancelarTransferencia(atual.id);
      toast.success('Pedido cancelado.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (atual) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-base font-bold text-text">
          <ArrowRightLeft size={20} className="text-primary" aria-hidden="true" />
          Passar para {atual.marcaPara || 'outro tio'}
        </p>
        <p className="mt-1 text-base text-textMuted">
          {fraseDoEstado(atual, agora)}
          {prazoDoPedido(atual) ? ` Vale até ${prazoDoPedido(atual)}.` : ''}
        </p>
        <button
          type="button"
          onClick={cancelar}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border text-base font-bold text-text"
        >
          Cancelar pedido
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
      >
        <ArrowRightLeft size={20} aria-hidden="true" />
        Passar para outro tio
      </button>

      <Sheet
        open={aberto}
        onClose={() => {
          setAberto(false);
          setEscolhido(null);
        }}
        onBack={escolhido ? () => setEscolhido(null) : undefined}
        title={escolhido ? `Passar ${nome} para ${escolhido.marca}` : 'Para qual tio parceiro?'}
      >
        {!escolhido ? (
          <ListaDeParceiros parceiros={parceiros} onEscolher={setEscolhido} />
        ) : (
          <div className="space-y-4">
            <p className="text-base text-text">
              {escolhido.marca} vê só o primeiro nome e a escola. Se ele aceitar, a família recebe o
              pedido no app dela e decide.
            </p>
            <Lista titulo="Se a família aceitar, vai" itens={O_QUE_VAI} icone={Check} />
            <Lista titulo="Fica com você" itens={O_QUE_NAO_VAI} icone={X} />
            <p className="text-base text-textMuted">
              As mensalidades em aberto continuam suas. {escolhido.marca} cobra a partir do mês seguinte.
            </p>
            <SheetCTA onClick={pedir} loading={enviando}>
              Enviar pedido
            </SheetCTA>
            <SheetGhost onClick={() => setEscolhido(null)}>Escolher outro tio</SheetGhost>
          </div>
        )}
      </Sheet>
    </>
  );
}

function ListaDeParceiros({ parceiros, onEscolher }) {
  if (!parceiros) return <p className="text-base text-textMuted">Carregando…</p>;
  if (!parceiros.length) {
    return (
      <p className="text-base text-text">
        Você ainda não tem tios parceiros. Eles aparecem quando um colega que você indicou cria a conta.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {parceiros.map((p) => (
        <li key={p.uid}>
          <button
            type="button"
            onClick={() => onEscolher(p)}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-border bg-card px-3 text-left"
          >
            {p.logoURL ? (
              <img src={p.logoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primarySoft text-base font-bold text-primary">
                {String(p.marca || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-text">{p.marca}</span>
              {p.escolas?.length > 0 && (
                <span className="block truncate text-sm text-textMuted">{p.escolas.join(' · ')}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Lista({ titulo, itens, icone: Icone }) {
  return (
    <div>
      <p className="text-base font-bold text-text">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {itens.map((t) => (
          <li key={t} className="flex items-start gap-2 text-base text-text">
            <Icone size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

