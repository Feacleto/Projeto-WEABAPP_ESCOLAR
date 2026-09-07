import { useState } from 'react';
import { HandCoins, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { conceder } from '../../services/taxaService';
import {
  PRAZO_MAXIMO,
  TIPO,
  mesDaqui,
  validarConcessao,
} from '../../dominio/associacao/concessao.js';

/**
 * A FOLHA DE CONCEDER — a exceção, aberta com prazo e motivo.
 *
 * ── ELA É A PORTA PELA QUAL O ORÇAMENTO PODE VOLTAR
 * O preço virou de tabela em 06/09/2026 justamente para caber numa pessoa: sem
 * negociação caso a caso, sem seis eixos para cruzar. Só que retenção real
 * precisa de exceção — um associado bom, num mês ruim, pede desconto, e "não" é
 * a resposta que o faz cancelar.
 *
 * A exceção precisa existir. O que não pode é virar a regra sem ninguém ter
 * decidido isso, e a tranca são as duas perguntas que esta folha obriga a
 * responder: **por quanto tempo** e **por quê**.
 *
 * ── A VALIDAÇÃO NÃO É DAQUI
 * `dominio/associacao/concessao.js` decide o que é válido, e o service valida
 * de novo antes de gravar. Esta folha só dá a mensagem no lugar certo — a
 * próxima tela que conceder não vai passar por ela.
 *
 * ── A DATA DE FIM APARECE ANTES DE CONFIRMAR
 * "6 meses" é abstrato; "até 02/2027" é uma data que a pessoa reconhece como
 * longe ou perto. É a mesma diferença entre `dueDay` e o vencimento congelado
 * na fatura.
 *
 * ── ISENÇÃO NÃO É DESCONTO DE 100%
 * Uma diz que o mês não tem fatura, a outra produz uma fatura de R$ 0. Os dois
 * chegam a zero e contam histórias diferentes na hora de conferir o que foi
 * concedido — por isso são dois botões, e não um campo com 100 digitado.
 */
export default function ConcederSheet({ motorista, onFechar, onPronto }) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState(TIPO.DESCONTO);
  const [porcento, setPorcento] = useState(20);
  const [meses, setMeses] = useState(3);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fracao = Math.max(0, Number(porcento) || 0) / 100;
  const { ok, erro } = validarConcessao({ tipo, fracao, meses, motivo });
  const ate = mesDaqui(meses, new Date());

  const salvar = async () => {
    setSalvando(true);
    try {
      await conceder(motorista.uid, { tipo, fracao, meses, motivo }, user?.uid);
      toast.success('Concessão registrada.');
      onPronto?.();
      onFechar?.();
    } catch (err) {
      toast.error(err.message || 'Não deu pra conceder.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
              <HandCoins size={15} />
              Abrir uma exceção
            </h3>
            <p className="mt-0.5 text-xs text-textMuted">
              para {motorista?.name || motorista?.uid}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="tap -mr-1 -mt-1 p-1 text-textMuted"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* O AVISO VEM ANTES DOS CAMPOS, e não depois: depois do botão ele é
          * uma justificativa; antes, ele é a pergunta que a pessoa responde. */}
        <p className="mt-3 rounded-xl border border-warningBorder bg-warningSoft p-3 text-[11px] leading-relaxed text-warningText">
          Isto não é a tabela — é dinheiro que você abre mão para{' '}
          <strong>uma</strong> pessoa. Se daqui a três meses metade da carteira
          tiver concessão ativa, quem está errada é a tabela.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
              O que você concede
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                [TIPO.DESCONTO, 'Desconto', 'a fatura sai menor'],
                [TIPO.ISENCAO, 'Sem fatura', 'não há cobrança no mês'],
              ].map(([id, rotulo, ajuda]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTipo(id)}
                  className={`tap rounded-xl border p-3 text-left transition-colors ${
                    tipo === id ? 'border-primary bg-primarySoft' : 'border-border bg-surface'
                  }`}
                >
                  <span className="block text-xs font-bold text-text">{rotulo}</span>
                  <span className="mt-0.5 block text-[11px] text-textMuted">{ajuda}</span>
                </button>
              ))}
            </div>
          </div>

          {tipo === TIPO.DESCONTO && (
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
                Quanto
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={95}
                  value={porcento}
                  onChange={(e) => setPorcento(e.target.value)}
                  className="h-10 w-24 rounded-xl border border-border bg-surface px-3 text-sm tabular-nums text-text"
                />
                <span className="text-xs text-textMuted">% de desconto na taxa</span>
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
              Por quanto tempo
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={PRAZO_MAXIMO}
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                className="h-10 w-24 rounded-xl border border-border bg-surface px-3 text-sm tabular-nums text-text"
              />
              <span className="text-xs text-textMuted">
                {/* A DATA, e não só o número de meses: "6 meses" é abstrato,
                  * "até 02/2027" é uma data que a pessoa reconhece. */}
                {Number(meses) === 1 ? 'mês' : 'meses'} — vale até{' '}
                <strong className="text-text">{ate}</strong>
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
              Por quê
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Perdeu duas escolas em agosto e volta em fevereiro."
              className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-text"
            />
            <span className="mt-1 block text-[11px] leading-relaxed text-textMuted">
              Daqui a seis meses, esta frase é a única coisa que explica a
              exceção — inclusive para você.
            </span>
          </label>
        </div>

        {/* O ERRO SÓ APARECE DEPOIS DE ALGUMA DIGITAÇÃO. Mostrar "escreva o
          * motivo" num campo em branco que a pessoa ainda nem tocou é a tela
          * repreendendo antes de a pessoa fazer nada. */}
        {erro && motivo.length > 0 && (
          <p className="mt-3 text-xs text-dangerText">{erro}</p>
        )}

        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={salvar}
            disabled={!ok || salvando}
            className="tap h-10 flex-1 rounded-xl bg-primary text-xs font-bold text-white disabled:opacity-40"
          >
            {salvando ? 'Registrando…' : 'Conceder'}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="tap h-10 rounded-xl border border-border px-4 text-xs font-bold text-textMuted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
