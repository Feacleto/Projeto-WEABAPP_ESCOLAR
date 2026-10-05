import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageCircle, UserPlus, History } from 'lucide-react';
import Avatar from '../common/Avatar';
import Skeleton from '../common/Skeleton';
import { useAuxiliaresDoMotorista } from '../../hooks/useAuxiliares';
import { historicoDeAuxiliares, rotatividade, linkDoZap } from '../../dominio/identidade/auxiliar.js';

/**
 * A AUXILIAR NA CENTRAL (05/10/2026, desenho aprovado pelo dono) — um ESPAÇO
 * na rolagem da Central, não uma aba: o lugar onde o motorista vê as questões
 * da auxiliar de agora sem sair da visão do mês.
 *
 * Mora entre Turma e Sua perua porque a auxiliar é parte da OPERAÇÃO, não das
 * contas — e por isso saiu de dentro de Contas, onde era só uma porta.
 *
 * Nenhum valor em dinheiro aqui. O pagamento do mês (fase 4) e a falta de
 * hoje com a substituta (fase 5) entram por `linhasDaAuxiliar`, uma função
 * que recebe a auxiliar e devolve as linhas dela — este bloco não inventa
 * dado que ainda não existe.
 *
 * O detalhe mora em `/tio/finance/auxiliar`, atrás da senha pelo caminho:
 * o pagamento vai pôr valores lá.
 *
 * Convite pendente NÃO aparece aqui: o `auxiliarService` não escuta os
 * convites (eles moram em `convitesDeAuxiliar`, que só o servidor lê), e abrir
 * uma consulta nova só para isso não se paga — o convite chega como auxiliar
 * ativa assim que ela aceita.
 */
const DETALHE = '/tio/finance/auxiliar';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function mesAno(ms) {
  if (ms == null) return '…';
  const d = new Date(ms);
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

export default function AuxiliarNaCentral({ linhasDaAuxiliar }) {
  const navigate = useNavigate();
  const vinculos = useAuxiliaresDoMotorista();

  const historico = historicoDeAuxiliares(vinculos || []);
  const ativas = historico.filter((h) => h.ativa);
  const rot = rotatividade(vinculos || []);

  const detalheDoHistorico = [
    `${rot.total} ${rot.total === 1 ? 'auxiliar' : 'auxiliares'}`,
    rot.mediaDeMeses != null
      ? `ficam em média ${rot.mediaDeMeses} ${rot.mediaDeMeses === 1 ? 'mês' : 'meses'}`
      : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <h2 className="px-1 pt-4 font-display text-xl font-bold text-text">Auxiliar</h2>
      {vinculos === null ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : (
        <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
          {ativas.length === 0 ? (
            <>
              <p className="px-4 pt-4 text-base font-bold text-text">Você está sem auxiliar.</p>
              <Linha icon={UserPlus} titulo="Convidar auxiliar" onClick={() => navigate(DETALHE)} />
            </>
          ) : (
            ativas.map((a, i) => {
              const extra = typeof linhasDaAuxiliar === 'function' ? linhasDaAuxiliar(a) : null;
              return (
                <div key={a.uid} className={i > 0 ? 'border-t border-neutro' : ''}>
                  <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(DETALHE)}
                      className="tap flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar kind="adult" seed={a.uid} name={a.nome} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold text-text">{a.nome}</span>
                        <span className="block text-sm text-textMuted">Desde {mesAno(a.desdeMs)}</span>
                      </span>
                    </button>
                    <a
                      href={linkDoZap(a.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="tap flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border-2 border-primaryBorder bg-primarySoft px-3 text-base font-bold text-primary"
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      Falar
                    </a>
                  </div>
                  {/* AQUI ENTRAM as linhas das próximas fases: o pagamento do
                    * mês (fase 4) e a falta de hoje com a substituta (fase 5). */}
                  {extra ? <div className="px-4 pb-3">{extra}</div> : null}
                </div>
              );
            })
          )}
          {historico.length > 0 && (
            <Linha
              divisor
              icon={History}
              titulo="Quem já trabalhou comigo"
              detalhe={detalheDoHistorico}
              onClick={() => navigate(DETALHE)}
            />
          )}
        </section>
      )}
    </>
  );
}

/** A mesma forma da `Porta` da Central: ícone, título, detalhe e a seta. */
function Linha({ icon: Icon, titulo, detalhe, onClick, divisor = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-16 w-full items-center gap-3.5 px-4 py-4 text-left ${
        divisor ? 'border-t border-neutro' : ''
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text">{titulo}</span>
        {detalhe ? <span className="block truncate text-sm text-textMuted">{detalhe}</span> : null}
      </span>
      <ChevronRight size={20} className="shrink-0 text-textBody" />
    </button>
  );
}
