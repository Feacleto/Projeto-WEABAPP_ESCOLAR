import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EditarCombinadoSheet from '../../components/contract/EditarCombinadoSheet';
import Avatar from '../../components/common/Avatar';
import { ChildDetailSheet } from '../ChildDetail';
import { nomeDoMes } from '../../components/payments/estadoDaMensalidade';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useContratos } from '../../hooks/useContratos';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import {
  INICIO_DAS_SAIDAS,
  criancasDoMovimento,
  frasesDoMovimento,
  movimentoDaTurma,
} from '../../dominio/identidade/movimentoDaTurma.js';
import { estadoDoContrato } from '../../dominio/cobranca/contratoDaFamilia.js';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';

/**
 * TURMA E CONTRATOS — /tio/finance/turma (03/10/2026, protótipo aprovado).
 *
 * A porta do caixa que responde duas perguntas de dinheiro sobre a turma:
 * "quem entrou e quem saiu" (é o que explica a mensalidade a mais ou a menos
 * no mês) e "quanto cada família paga, e se o contrato está assinado".
 *
 * O "Mudar" de cada contrato abre a MESMA folha da ficha da criança
 * ([EditarCombinadoSheet](../../components/contract/EditarCombinadoSheet.jsx)):
 * depois do aceite, mudar é um contrato novo que a família assina. Não há
 * segunda maneira de mudar o combinado, e é isso que a mantém verdadeira.
 *
 * ⚠️ SAÍDA SÓ TEM DATA DESDE OUTUBRO DE 2026 (`children.inativadoEm`). Antes
 * disso a tela mostra só as entradas e diz, numa linha, de quando em diante as
 * saídas são contadas — ver `movimentoDaTurma.js`.
 */

const SELO = {
  aceito: { texto: 'Assinado', classe: 'bg-primaryChip text-accentText' },
  mudanca: { texto: 'Mudança aguardando a família', classe: 'bg-warningChip text-warningText' },
  aguardando: { texto: 'Aguardando a família', classe: 'bg-warningChip text-warningText' },
  'sem-contrato': { texto: 'Sem contrato', classe: 'bg-neutro text-textBody' },
};

const comMaiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function TioTurma() {
  const navigate = useNavigate();
  const { criancas, loading } = useTurmaInteira();
  const { visiveis } = useValoresVisiveis();
  const [mudando, setMudando] = useState(null);
  // A FICHA abre por cima, no toque na foto ou no nome — e o contrato está
  // nela ("Ver contrato" no cartão do combinado).
  const [fichaDe, setFichaDe] = useState(null);

  const mesAtual = getCurrentMonthKey();
  const movimento = useMemo(
    () => movimentoDaTurma({ criancas, mesAtual, meses: 6 }),
    [criancas, mesAtual]
  );
  const semSaidaContada = movimento.some((m) => !m.saidasContadas);
  const ativas = useMemo(() => criancas.filter((c) => c.active === true), [criancas]);

  return (
    <div className="pb-28">
      <Header title="Turma e contratos" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        <Button icon={Plus} onClick={() => navigate('/tio/children/new')}>
          Cadastrar nova criança
        </Button>

        <h2 className="pt-1 font-display text-xl font-bold text-text">Entradas e saídas</h2>
        {loading ? (
          <Skeleton className="h-48 rounded-3xl" />
        ) : (
          <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
            {movimento.map((m, i) => {
              const frases = frasesDoMovimento({
                entraram: m.entraram.length,
                sairam: m.saidasContadas ? m.sairam.length : null,
              });
              const [ano] = m.mes.split('-');
              return (
                <div
                  key={m.mes}
                  className={`flex flex-col gap-1 px-4 py-3.5 ${i > 0 ? 'border-t border-neutro' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold text-text">
                      {comMaiuscula(nomeDoMes(m.mes))} {ano}
                    </span>
                    <span className="text-sm font-bold">
                      <span className="text-accentText">{frases.entraram}</span>
                      {frases.sairam && (
                        <>
                          <span className="text-textMuted"> · </span>
                          <span className="text-dangerText">{frases.sairam}</span>
                        </>
                      )}
                    </span>
                  </div>
                  {/* QUEM ENTROU E SAIU, COM FOTO (03/10/2026, pedido do dono):
                    * o nome sozinho não diz quem é; o rosto diz, e o toque abre
                    * a ficha. */}
                  <QuemMudou
                    rotulo="Entrou"
                    criancas={criancasDoMovimento({ criancas, mes: m.mes }).entraram}
                    onAbrir={setFichaDe}
                  />
                  {m.saidasContadas && (
                    <QuemMudou
                      rotulo="Saiu"
                      criancas={criancasDoMovimento({ criancas, mes: m.mes }).sairam}
                      onAbrir={setFichaDe}
                    />
                  )}
                </div>
              );
            })}
            {semSaidaContada && (
              <p className="border-t border-neutro bg-surface px-4 py-3 text-sm text-textMuted">
                Saídas contadas a partir de {nomeDoMes(INICIO_DAS_SAIDAS)} de{' '}
                {INICIO_DAS_SAIDAS.split('-')[0]}.
              </p>
            )}
          </section>
        )}

        <h2 className="pt-1 font-display text-xl font-bold text-text">Contratos</h2>
        {loading ? (
          <Skeleton className="h-48 rounded-3xl" />
        ) : ativas.length === 0 ? (
          <p className="rounded-3xl bg-card p-4 text-base text-textMuted shadow-rest">
            Nenhuma criança na turma ainda. Os contratos aparecem aqui quando você cadastrar.
          </p>
        ) : (
          <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
            {ativas.map((c, i) => {
              const selo = SELO[estadoDoContrato(c)] || SELO['sem-contrato'];
              return (
                <div
                  key={c.id}
                  className={`flex min-h-16 items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-neutro' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setFichaDe(c.id)}
                    aria-label={`Abrir a ficha de ${c.name}`}
                    className="tap shrink-0 rounded-full"
                  >
                    <Avatar photoURL={c.photoURL} gender={c.gender} seed={c.id} kind="child" size="md" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setFichaDe(c.id)}
                      className="tap block max-w-full truncate text-left text-base font-bold text-text"
                    >
                      {c.name}
                    </button>
                    <p className="mt-0.5 text-sm text-textBody">
                      {c.monthlyFee
                        ? `${visiveis ? formatCurrency(c.monthlyFee) : VALOR_ESCONDIDO}/mês`
                        : 'Sem mensalidade'}{' '}
                      · vence dia {c.dueDay || 10}
                    </p>
                    <p className="mt-1.5">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-sm font-bold ${selo.classe}`}>
                        {selo.texto}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMudando(c)}
                    className="tap h-12 shrink-0 rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-text"
                  >
                    Mudar
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <ChildDetailSheet
        open={!!fichaDe}
        childId={fichaDe}
        onClose={() => setFichaDe(null)}
      />

      {mudando && (
        <MudarCombinado
          key={mudando.id}
          child={ativas.find((c) => c.id === mudando.id) || mudando}
          onClose={() => setMudando(null)}
        />
      )}
    </div>
  );
}

/**
 * A folha de mudar o combinado precisa das versões do contrato DAQUELA
 * criança — a escuta só existe enquanto a folha está aberta.
 */
function MudarCombinado({ child, onClose }) {
  const { contratos } = useContratos(child);
  return <EditarCombinadoSheet open onClose={onClose} child={child} contratos={contratos} />;
}

/** "Entrou:" e as crianças daquele mês, cada uma com foto e nome tocáveis. */
function QuemMudou({ rotulo, criancas, onAbrir }) {
  if (!criancas.length) return null;
  return (
    <div className="mt-1 space-y-1.5">
      <p className="text-sm font-semibold text-textMuted">{rotulo}:</p>
      {criancas.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAbrir(c.id)}
          className="tap flex w-full items-center gap-3 rounded-xl py-1 text-left"
        >
          <Avatar photoURL={c.photoURL} gender={c.gender} seed={c.id} kind="child" size="md" />
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">
            {c.name || 'Sem nome'}
          </span>
          <span className="shrink-0 text-sm font-bold text-primary">Ver ficha</span>
        </button>
      ))}
    </div>
  );
}
