import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Printer } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useBoletim, MESES_DO_BOLETIM, marcarBoletimVisto } from '../../hooks/useBoletim';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { addMonths, formatBRL } from '../../compartilhado/formatters';
import { boletimDoMes, mesDe, nomeDoMes } from '../../dominio/cobranca/boletim.js';

/**
 * O BOLETIM — o consolidado do mês que o Buzi oferece no fim de toda resposta
 * (04/10/2026). Os três assuntos da conversa num documento só: quanto
 * entrou, quem está atrasado e quem avisou que pagou.
 *
 *   Mês corrente → "parcial, até o dia 15": a foto de agora.
 *   Mês passado  → "fechado": a foto do último instante dele, que não muda
 *                  (a régua lê as datas gravadas, não o status de hoje).
 *
 * Do dia 1 ao 7 ele abre no mês que acabou de fechar — é o Boletim que o selo
 * da tela trancada anunciou —, e abrir aqui apaga o selo. O PDF é o
 * `window.print()` do relatório de 12 meses. Na tela vale o olho de esconder
 * valores; no papel os valores saem sempre, porque é o documento dele.
 *
 * A taxa da plataforma não entra: é o outro dinheiro.
 */
function mesPadrao(agora) {
  const d = new Date(agora);
  if (d.getDate() <= 7) return mesDe(new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime());
  return mesDe(agora);
}

export default function TioBoletim() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const { pagamentos, atualizadoEm } = useBoletim();
  const { visiveis, alternar } = useValoresVisiveis();
  const [agora] = useState(() => Date.now());
  const atual = mesDe(agora);
  const mes = params.get('mes') || mesPadrao(agora);
  const meses = useMemo(
    () => Array.from({ length: MESES_DO_BOLETIM }, (_, i) => addMonths(atual, -i)),
    [atual]
  );

  // Abriu o Boletim do mês que acabou de fechar: o selo da tela trancada sai.
  useEffect(() => {
    if (!user?.uid || mes === atual) return;
    marcarBoletimVisto(user.uid, mes);
  }, [user?.uid, mes, atual]);

  const naTela = useMemo(
    () => (pagamentos ? boletimDoMes(pagamentos, { mes, agora, mostrar: visiveis }) : null),
    [pagamentos, mes, agora, visiveis]
  );
  const noPapel = useMemo(
    () => (pagamentos ? boletimDoMes(pagamentos, { mes, agora, mostrar: true }) : null),
    [pagamentos, mes, agora]
  );

  return (
    <>
      <Header title="Boletim" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="p-4 space-y-4">
        <div className="print:hidden space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {meses.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setParams({ mes: m }, { replace: true })}
                className={`tap h-12 shrink-0 rounded-full px-4 text-base font-bold ${
                  m === mes ? 'bg-primary text-white' : 'bg-card border border-border text-text'
                }`}
              >
                {nomeDoMes(m)}
                {m === atual ? ' (parcial)' : ''}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Button variant="success" icon={Printer} onClick={() => window.print()} disabled={!noPapel}>
                Baixar o Boletim (PDF)
              </Button>
            </div>
            <button
              type="button"
              onClick={alternar}
              className="tap w-14 shrink-0 rounded-2xl bg-card border border-border flex items-center justify-center text-textBody"
              aria-label={visiveis ? 'Esconder valores' : 'Mostrar valores'}
            >
              {visiveis ? <Eye size={24} aria-hidden="true" /> : <EyeOff size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {!naTela ? (
          <div className="space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <>
            <div className="print:hidden">
              <Documento b={naTela} profile={profile} atualizadoEm={atualizadoEm} mostrar={visiveis} />
            </div>
            <div className="hidden print:block">
              <Documento b={noPapel} profile={profile} atualizadoEm={atualizadoEm} mostrar />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Documento({ b, profile, atualizadoEm, mostrar }) {
  const valor = (v) => (mostrar ? formatBRL(v) : `R$ ${VALOR_ESCONDIDO}`);
  const quando = atualizadoEm
    ? `${atualizadoEm.toLocaleDateString('pt-BR')} às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return (
    <article className="bg-card rounded-3xl shadow-rest p-5 space-y-6 print:p-0 print:shadow-none print:rounded-none">
      <header className="space-y-1 border-b border-border pb-4">
        <p className="rotulo">{b.fechado ? 'Boletim fechado' : `Boletim parcial · até o dia ${b.ate}`}</p>
        <h1 className="font-display text-2xl font-bold text-text">
          Boletim de {b.nomeDoMes}
        </h1>
        <p className="text-base text-textMuted">
          {profile?.marcaNome || profile?.companyName || profile?.name || ''}
        </p>
      </header>

      <Secao titulo="Quanto entrou" frases={b.entrou.frases} />
      <Secao titulo="Mensalidades atrasadas" frases={b.atrasados.frases} linhas={b.atrasados.linhas} valor={valor} />
      <Secao titulo="Avisaram que pagaram e esperam conferência" frases={b.avisaram.frases} linhas={b.avisaram.linhas} valor={valor} />

      <footer className="border-t border-border pt-4 text-sm text-textMuted space-y-1">
        <p>A taxa da plataforma não entra neste Boletim.</p>
        <p>Feito pelo Buzi, o assistente digital do Alô Buzinou{quando ? `, em ${quando}` : ''}.</p>
      </footer>
    </article>
  );
}

function Secao({ titulo, frases, linhas = [], valor }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-text">{titulo}</h2>
      <div className="text-[17px] leading-relaxed text-textBody space-y-0.5">
        {frases.map((f, i) => (
          <p key={i}>{f}</p>
        ))}
      </div>
      {linhas.length > 0 && (
        <table className="w-full text-base">
          <tbody className="divide-y divide-border">
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-2 font-semibold text-text">{l.nome}</td>
                <td className="py-2 pr-2 text-textMuted">{l.detalhe}</td>
                <td className="py-2 text-right font-bold text-text whitespace-nowrap">{valor(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
