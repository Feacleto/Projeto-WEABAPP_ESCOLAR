import { useEffect, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import Spinner from '../common/Spinner';
import { listarTodasIndicacoes } from '../../services/indicacaoService';
import { carregarConsole } from '../../services/adminMetricsService';
import { ESTADO, situacaoDaIndicacao } from '../../dominio/identidade/indicacao.js';

/**
 * AS INDICAÇÕES, DO LADO DO DONO.
 *
 * ── ELA EXISTE PARA RESPONDER A UMA FRASE
 * *"Indiquei e não recebi."* Sem uma tela que mostre o estado de cada
 * indicação, essa conversa não tem como terminar: o motorista lembra que
 * indicou cinco, a conta dele desconta uma, e ninguém consegue mostrar onde as
 * outras quatro pararam.
 *
 * ── A ORDEM É A DÚVIDA, NÃO A DATA
 * As `cadastrado` vêm primeiro: são as que já viraram cliente e ainda não
 * viraram desconto — exatamente as que geram a pergunta. Depois as pendentes, e
 * por último as ativas, que já estão resolvidas.
 *
 * ── NÃO HÁ BOTÃO DE ATIVAR AQUI, E É DE PROPÓSITO
 * A ativação acontece sozinha na baixa da fatura do indicado
 * (`marcarFaturaPaga` → `casarEAtivar`). Um botão de "ativar" nesta tela seria
 * a carência virando opinião: bastaria clicar para pagar desconto sobre receita
 * que não entrou. Se uma indicação legítima não ativou, o conserto é dar baixa
 * na fatura que falta — não contornar a regra por aqui.
 */
export default function IndicacoesTab() {
  const [lista, setLista] = useState(null);
  const [pessoas, setPessoas] = useState({});

  useEffect(() => {
    listarTodasIndicacoes()
      .then(setLista)
      .catch(() => setLista(false));
    carregarConsole()
      .then(({ parceiros }) => {
        const m = {};
        parceiros.forEach((p) => {
          m[p.uid] = p;
        });
        setPessoas(m);
      })
      .catch(() => {});
  }, []);

  const PESO = { [ESTADO.CADASTRADO]: 0, [ESTADO.PENDENTE]: 1, [ESTADO.ATIVA]: 2 };
  const ordenada = useMemo(() => {
    if (!Array.isArray(lista)) return null;
    return [...lista].sort((a, b) => {
      const p = (PESO[a.estado] ?? 1) - (PESO[b.estado] ?? 1);
      if (p !== 0) return p;
      return String(a.indicadorNome || '').localeCompare(String(b.indicadorNome || ''));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  if (lista === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar as indicações.
      </p>
    );
  }
  if (ordenada === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!ordenada.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Share2 size={22} className="mx-auto text-textMuted" />
        <p className="mt-2 text-xs text-textMuted">
          Ninguém indicou ninguém ainda. Os motoristas indicam em{' '}
          <strong>Meu transporte → Indicar outro motorista</strong>.
        </p>
      </div>
    );
  }

  const ativas = ordenada.filter((i) => i.estado === ESTADO.ATIVA).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-textMuted">
        {ordenada.length} {ordenada.length === 1 ? 'indicação' : 'indicações'} ·{' '}
        <strong className="text-primary">{ativas}</strong> valendo desconto
      </p>

      <ul className="space-y-1.5">
        {ordenada.map((i) => (
          <li
            key={i.id}
            className="rounded-xl border border-border bg-card p-3 text-xs"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-bold text-text">
                {pessoas[i.indicadorUid]?.name || i.indicadorNome || i.indicadorUid}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  i.estado === ESTADO.ATIVA
                    ? 'bg-primarySoft text-primary'
                    : i.estado === ESTADO.CADASTRADO
                      ? 'bg-warningSoft text-warningText'
                      : 'bg-neutro text-textMuted'
                }`}
              >
                {i.estado}
              </span>
            </div>
            <p className="mt-0.5 text-textMuted">
              indicou {i.nome || 'alguém'} · {i.telefoneDigitado}
            </p>
            <p className="mt-0.5 text-[11px] text-textMuted">{situacaoDaIndicacao(i)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
