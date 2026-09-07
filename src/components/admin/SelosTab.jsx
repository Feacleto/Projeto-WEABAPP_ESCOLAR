import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, ExternalLink, Sticker } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { carregarConsole } from '../../services/adminMetricsService';
import {
  moverPedido,
  recusarAlvara,
  urlDoAlvara,
  verificarAlvara,
  watchPedidosAdesivo,
} from '../../services/seloService';
import {
  ESTADO as ADESIVO,
  podeTransitar as podeTransitarAdesivo,
} from '../../dominio/associacao/adesivo.js';
import { ESTADO as VERIF } from '../../dominio/identidade/verificacao.js';

/**
 * OS DOIS SELOS, DO LADO DO DONO.
 *
 * ── ELA É A ÚNICA ABA QUE PÕE VOCÊ NO CAMINHO CRÍTICO
 * Desde que o consultor saiu do modelo, nada mais dependia de uma pessoa para
 * acontecer: o motorista se cadastra, contrata e paga sozinho. A conferência do
 * alvará devolve isso — e devolve de propósito.
 *
 * Valor não vem de preço, vem de exigência: pago, o selo pareceria abusivo;
 * automático, não valeria nada. Conquistado resolve os dois, e o custo é que
 * alguém confere. **Esta aba não escala sozinha, e isso está decidido.**
 *
 * ── DOIS BLOCOS PORQUE SÃO DUAS ECONOMIAS
 * Adesivo é logística (imprimir, postar); certificado é conferência
 * (documento, data, recusa com motivo). Misturá-los numa fila só faria o
 * trabalho de dez minutos esconder o de dois.
 *
 * ── A URL DO ALVARÁ É BUSCADA NA HORA
 * Decisão 8: url do Storage nunca é persistida. Aqui isso tem um segundo
 * motivo — o documento é do motorista, e um link gravado sobreviveria à
 * revogação do acesso dele.
 */
export default function SelosTab() {
  const { user } = useAuth();
  const [dados, setDados] = useState(null);
  const [pedidos, setPedidos] = useState(null);

  const carregar = () =>
    carregarConsole()
      .then(setDados)
      .catch(() => setDados(false));
  useEffect(() => {
    carregar();
  }, []);
  useEffect(() => watchPedidosAdesivo(setPedidos, () => setPedidos([])), []);

  const paraConferir = useMemo(
    () => (dados?.parceiros || []).filter((p) => p.verificacao === VERIF.ENVIADA),
    [dados]
  );
  const verificados = useMemo(
    () => (dados?.parceiros || []).filter((p) => p.verificacao === VERIF.VERIFICADA),
    [dados]
  );
  const aPostar = useMemo(
    () => (pedidos || []).filter((p) => p.estado !== ADESIVO.ENTREGUE),
    [pedidos]
  );

  if (dados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar os selos.
      </p>
    );
  }
  if (dados === null || pedidos === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="space-y-2">
        <h2 className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
          <BadgeCheck size={11} />
          Alvarás para conferir
        </h2>
        {!paraConferir.length ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-textMuted">
            Nada esperando conferência.
          </p>
        ) : (
          paraConferir.map((m) => (
            <Conferir key={m.uid} motorista={m} ownerUid={user?.uid} onPronto={carregar} />
          ))
        )}

        {verificados.length > 0 && (
          <p className="pt-1 text-[11px] text-textMuted">
            {verificados.length}{' '}
            {verificados.length === 1 ? 'motorista já tem o selo' : 'motoristas já têm o selo'}.
            A validade de cada um aparece na ficha dele.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
          <Sticker size={11} />
          Adesivos para postar
        </h2>
        {!aPostar.length ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-textMuted">
            Nenhum adesivo na fila.
          </p>
        ) : (
          aPostar.map((p) => <Pedido key={p.id} pedido={p} />)
        )}
      </section>
    </div>
  );
}

/* ─────────────── conferir um alvará ─────────────── */

function Conferir({ motorista, ownerUid, onPronto }) {
  const [url, setUrl] = useState(undefined);
  const [validade, setValidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    urlDoAlvara(motorista.uid).then(setUrl);
  }, [motorista.uid]);

  const agir = async (fn, msg) => {
    setOcupado(true);
    try {
      await fn();
      toast.success(msg);
      onPronto?.();
    } catch (err) {
      toast.error(err.message || 'Não deu pra concluir.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-xs">
      <p className="font-bold text-text">{motorista.name || motorista.uid}</p>
      <p className="mt-0.5 text-textMuted">
        {[motorista.email, motorista.city].filter(Boolean).join(' · ') || '—'}
      </p>

      {url === undefined ? (
        <p className="mt-2 text-textMuted">Buscando o documento…</p>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="tap mt-2 inline-flex items-center gap-1.5 font-bold text-primary underline"
        >
          <ExternalLink size={12} />
          Abrir o alvará
        </a>
      ) : (
        // Estado marcado como enviado e arquivo ausente: acontece se o upload
        // caiu no meio. Dizer isso é melhor que mostrar um link quebrado.
        <p className="mt-2 text-dangerText">
          O arquivo não está no Storage. Peça a ele para enviar de novo.
        </p>
      )}

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-textMuted">
            Validade que está no alvará
          </span>
          <input
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            className="h-9 rounded-xl border border-border bg-surface px-3 text-xs text-text"
          />
        </label>
        {/* ⚠️ A VALIDADE É OBRIGATÓRIA, e é o que impede o selo de mentir
          * sozinho: sem ela ele diria "conferido" três anos depois. */}
        <button
          type="button"
          onClick={() => agir(() => verificarAlvara(motorista.uid, validade, ownerUid), 'Selo concedido.')}
          disabled={ocupado || !validade}
          className="tap h-9 w-full rounded-xl bg-primary font-bold text-white disabled:opacity-40"
        >
          Conferi — conceder o selo
        </button>

        <label className="block pt-1">
          <span className="mb-1 block text-[11px] text-textMuted">
            Ou recuse, dizendo o que está errado
          </span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="O alvará venceu em março. Envie o renovado."
            className="w-full rounded-xl border border-border bg-surface p-2 text-xs text-text"
          />
        </label>
        <button
          type="button"
          onClick={() => agir(() => recusarAlvara(motorista.uid, motivo), 'Recusado, com o motivo.')}
          disabled={ocupado || motivo.trim().length < 10}
          className="tap h-9 w-full rounded-xl border border-border font-bold text-dangerText disabled:opacity-40"
        >
          Recusar
        </button>
      </div>
    </div>
  );
}

/* ─────────────── um pedido de adesivo ─────────────── */

function Pedido({ pedido }) {
  const [ocupado, setOcupado] = useState(false);
  const e = pedido.endereco || {};

  const mover = async (para) => {
    setOcupado(true);
    try {
      await moverPedido(pedido.id, para);
      toast.success('Atualizado.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra atualizar.');
    } finally {
      setOcupado(false);
    }
  };

  const proximo =
    podeTransitarAdesivo(pedido.estado, ADESIVO.POSTADO, 'dono')
      ? [ADESIVO.POSTADO, 'Marcar como postado']
      : podeTransitarAdesivo(pedido.estado, ADESIVO.ENTREGUE, 'dono')
        ? [ADESIVO.ENTREGUE, 'Marcar como entregue']
        : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold text-text">{pedido.nome || pedido.id}</p>
        <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-textMuted">
          {pedido.estado}
        </span>
      </div>
      {/* O ENDEREÇO INTEIRO, PRONTO PARA COPIAR na etiqueta. Um endereço em
        * pedaços obriga a montar a linha à mão, e é onde o número some. */}
      <p className="mt-2 select-all leading-relaxed text-textMuted">
        {e.logradouro}, {e.numero}
        {e.complemento ? ` — ${e.complemento}` : ''}
        <br />
        {e.bairro} · {e.cidade}/{e.uf} · {e.cep}
      </p>
      {proximo && (
        <button
          type="button"
          onClick={() => mover(proximo[0])}
          disabled={ocupado}
          className="tap mt-3 h-9 w-full rounded-xl border border-border font-bold text-text disabled:opacity-40"
        >
          {proximo[1]}
        </button>
      )}
    </div>
  );
}
