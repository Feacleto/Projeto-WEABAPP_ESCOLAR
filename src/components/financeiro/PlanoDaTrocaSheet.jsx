import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import CampoDeValor from '../common/CampoDeValor';
import { useAuth } from '../../hooks/useAuth';
import { salvarPlanoDaTroca } from '../../services/configFinanceiroService';
import { porMesParaTroca } from '../../dominio/cobranca/reservaDaPerua.js';

/**
 * O PLANO DA TROCA DA PERUA — três perguntas, uma por vez (03/10/2026,
 * maquete aprovada, tela 6).
 *
 * O termo técnico da conta não aparece em lugar nenhum da folha, de
 * propósito: ninguém pensa na própria perua com a palavra do contador. Ele
 * pensa em três coisas que sabe responder — quanto ela vale hoje, quando quer
 * trocar e quanto ela vai valer nesse dia — e a folha pergunta exatamente
 * isso, uma pergunta por passo, com as respostas anteriores resumidas em cima
 * para ele não precisar lembrar.
 *
 * A CONTA APARECE ESCRITA embaixo do número ("(R$ 250.000 − R$ 130.000) ÷ 60
 * meses"): o número que ele vai separar todo mês precisa poder ser conferido
 * de cabeça, senão é o app mandando, e não o app mostrando.
 *
 * Quem calcula é `porMesParaTroca` (domínio); quem valida e grava é
 * `salvarPlanoDaTroca`. Salvar de novo recomeça o plano a partir de hoje.
 *
 * Props: open, onClose, planoAtual ({ valorHoje, anos, valorFinal } | null)
 */

const PASSOS = ['Vale hoje', 'Quando trocar', 'Vai valer'];
const ANOS_MIN = 1;
const ANOS_MAX = 20;

const reais = (v) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const textoDeAnos = (n) => `${n} ${n === 1 ? 'ano' : 'anos'}`;

export default function PlanoDaTrocaSheet({ open, onClose, planoAtual = null }) {
  const [passo, setPasso] = useState(0);
  // A folha reabre sempre no primeiro passo; o passo mora aqui só para o
  // subtítulo ("Passo 2 de 3") acompanhar.
  const fechar = () => {
    setPasso(0);
    onClose?.();
  };
  return (
    <Sheet
      open={open}
      onClose={fechar}
      title="Plano da troca da perua"
      subtitle={`Passo ${passo + 1} de ${PASSOS.length}`}
    >
      {open && (
        <Corpo planoAtual={planoAtual} onClose={fechar} passo={passo} setPasso={setPasso} />
      )}
    </Sheet>
  );
}

function Corpo({ planoAtual, onClose, passo, setPasso }) {
  const { user } = useAuth();
  const [valorHoje, setValorHoje] = useState(
    Number.isFinite(planoAtual?.valorHoje) ? String(planoAtual.valorHoje) : ''
  );
  const [anos, setAnos] = useState(
    Number.isInteger(planoAtual?.anos) ? planoAtual.anos : 5
  );
  const [valorFinal, setValorFinal] = useState(
    Number.isFinite(planoAtual?.valorFinal) ? String(planoAtual.valorFinal) : ''
  );
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const hoje = Number(valorHoje);
  const final = Number(valorFinal);
  const plano = { valorHoje: hoje, anos, valorFinal: final };
  const porMes = valorFinal === '' ? null : porMesParaTroca(plano);

  function avancar() {
    setErro('');
    if (passo === 0) {
      if (!(hoje > 0)) {
        setErro('Digite quanto a perua vale hoje.');
        return;
      }
      setPasso(1);
    } else if (passo === 1) {
      setPasso(2);
    }
  }

  function voltar() {
    setErro('');
    setPasso(Math.max(0, passo - 1));
  }

  async function salvar() {
    if (valorFinal === '') {
      setErro('Digite quanto acha que ela vai valer. Um chute serve.');
      return;
    }
    if (!(final < hoje)) {
      setErro('O valor na troca precisa ser menor que o de hoje.');
      return;
    }
    setSalvando(true);
    try {
      await salvarPlanoDaTroca(user?.uid, plano);
      toast.success('Plano da troca salvo.');
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <BarraDePassos atual={passo} />

      {/* As respostas que ele já deu, resumidas — para não precisar lembrar. */}
      {passo > 0 && (
        <div className="divide-y divide-neutro rounded-2xl bg-surface">
          <Resumo rotulo="Sua perua vale hoje" valor={reais(hoje)} />
          {passo > 1 && <Resumo rotulo="Quer trocar em" valor={textoDeAnos(anos)} />}
        </div>
      )}

      {passo === 0 && (
        <CampoDeValor
          label="Quanto vale a sua perua hoje?"
          value={valorHoje}
          onChange={(v) => {
            setErro('');
            setValorHoje(v);
          }}
          error={erro}
          hint="Um chute serve. Dá para mudar quando quiser."
          autoFocus
        />
      )}

      {passo === 1 && (
        <div>
          <p className="mb-3 text-base font-semibold text-text">Daqui a quantos anos quer trocar?</p>
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card p-2">
            <button
              type="button"
              onClick={() => setAnos((n) => Math.max(ANOS_MIN, n - 1))}
              disabled={anos <= ANOS_MIN}
              aria-label="Um ano a menos"
              className="tap flex h-14 w-14 items-center justify-center rounded-xl bg-primaryChip text-primary disabled:opacity-40"
            >
              <Minus size={24} />
            </button>
            <span className="font-display text-3xl font-bold tabular-nums text-text" aria-live="polite">
              {textoDeAnos(anos)}
            </span>
            <button
              type="button"
              onClick={() => setAnos((n) => Math.min(ANOS_MAX, n + 1))}
              disabled={anos >= ANOS_MAX}
              aria-label="Um ano a mais"
              className="tap flex h-14 w-14 items-center justify-center rounded-xl bg-primaryChip text-primary disabled:opacity-40"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <>
          <CampoDeValor
            label="Quanto acha que ela vai valer quando trocar?"
            value={valorFinal}
            onChange={(v) => {
              setErro('');
              setValorFinal(v);
            }}
            error={erro}
            hint="Um chute serve. Dá para mudar quando quiser."
            autoFocus
          />
          {/* Zero não se digita no CampoDeValor (zero à esquerda some), e
              "vou rodar com ela até acabar" é resposta válida (valorFinal 0). */}
          <button
            type="button"
            onClick={() => {
              setErro('');
              setValorFinal('0.00');
            }}
            className="tap -mt-2 flex min-h-12 items-center px-1 text-base font-bold text-primary underline"
          >
            Não vai valer nada
          </button>
          {porMes !== null && (
            <div aria-live="polite" className="flex flex-col gap-1 rounded-2xl bg-primarySoft p-4">
              <span className="text-base text-textBody">Para trocar a perua em {textoDeAnos(anos)}</span>
              <b className="font-display text-2xl font-extrabold leading-tight text-text">
                separe {reais(porMes)} por mês
              </b>
              <span className="text-sm tabular-nums text-textMuted">
                ({reais(hoje)} − {reais(final)}) ÷ {anos * 12} meses
              </span>
            </div>
          )}
        </>
      )}

      {erro && passo === 1 && <p className="text-sm text-dangerText">{erro}</p>}

      {passo < 2 ? (
        <SheetCTA onClick={avancar}>Próximo</SheetCTA>
      ) : (
        <SheetCTA onClick={salvar} loading={salvando}>
          Salvar o plano
        </SheetCTA>
      )}

      {passo > 0 && (
        <button
          type="button"
          onClick={voltar}
          className="tap mx-auto flex min-h-12 items-center px-4 text-base font-bold text-primary"
        >
          Voltar um passo
        </button>
      )}
    </div>
  );
}

function BarraDePassos({ atual }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Passos">
      {PASSOS.map((nome, i) => {
        const feito = i < atual;
        const agora = i === atual;
        return (
          <li key={nome} className="flex flex-col gap-1.5" aria-current={agora ? 'step' : undefined}>
            <span
              aria-hidden
              className={`h-1.5 rounded-full ${feito || agora ? 'bg-primary' : 'bg-neutro'}`}
            />
            <span className={`text-sm ${agora ? 'font-bold text-text' : 'text-textMuted'}`}>{nome}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Resumo({ rotulo, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className="text-base text-textBody">{rotulo}</span>
      <span className="text-base font-bold tabular-nums text-text">{valor}</span>
    </div>
  );
}
