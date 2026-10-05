import { useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../common/ConfirmDialog';
import EscolherSubstituta from './EscolherSubstituta';
import { registrarFaltaDaAuxiliar, desfazerFaltaDaAuxiliar } from '../../services/substitutasService';
import { faltaDoDia } from '../../dominio/identidade/faltaDaAuxiliar.js';
import { formatBRL } from '../../compartilhado/formatters';

/**
 * "HOJE", NO CARTÃO DE CADA AUXILIAR ATIVA (fase 5, desenho aprovado pelo
 * dono). "O auxiliar cuida da rota, o tio também cuida caso a auxiliar
 * falte, e ele precisa registrar falta da auxiliar."
 *
 * Sem falta, uma frase e um botão de contorno. Com falta, a etiqueta âmbar
 * (é aviso: algo mudou no dia) e o caminho para registrar quem cobriu. O
 * "Desfazer a falta" está sempre lá — toque errado no portão não pode virar
 * falta registrada sem volta.
 *
 * ⚠️ A falta não desconta nada sozinha: o app anota, os dois combinam.
 */
export default function HojeDaAuxiliar({ auxiliar, dateKey, faltas, substitutas }) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const primeiro = String(auxiliar?.nome || 'auxiliar').trim().split(' ')[0];
  const falta = faltaDoDia(faltas || [], auxiliar?.uid, dateKey);

  async function faltou() {
    setOcupado(true);
    try {
      await registrarFaltaDaAuxiliar({ auxiliar, dateKey });
    } catch (err) {
      toast.error(err?.message || 'Não deu para registrar a falta. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  const contorno = 'tap min-h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-text disabled:opacity-60';

  return (
    <div className="space-y-2 rounded-2xl bg-surface p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-textMuted">Hoje</p>
      {faltas === null ? null : !falta ? (
        <>
          <p className="text-base text-textBody">A {primeiro} está na rota com você.</p>
          <button type="button" onClick={faltou} disabled={ocupado} className={contorno}>
            A {primeiro} faltou hoje
          </button>
        </>
      ) : (
        <>
          <span className="inline-block rounded-full border border-warningBorder bg-warningSoft px-3 py-1 text-sm font-bold text-warningText">
            Falta registrada
          </span>
          {falta.substituta ? (
            <p className="text-base text-textBody">
              Substituída por {falta.substituta.nome} · {formatBRL(falta.substituta.valor)}.
            </p>
          ) : (
            <>
              <p className="text-base text-textBody">Você faz a rota sozinho, ou registra quem substituiu.</p>
              <button type="button" onClick={() => setEscolhendo(true)} className={contorno}>
                Quem substituiu hoje?
              </button>
            </>
          )}
          <button type="button" onClick={() => setDesfazendo(true)} className={contorno}>
            Desfazer a falta
          </button>
        </>
      )}

      <EscolherSubstituta
        open={escolhendo}
        onClose={() => setEscolhendo(false)}
        falta={falta}
        substitutas={substitutas}
        faltas={faltas}
      />

      <ConfirmDialog
        open={desfazendo}
        title="Desfazer a falta de hoje?"
        description={falta?.substituta ? 'A substituta e o valor do dia saem das despesas.' : 'A falta de hoje sai do controle.'}
        confirmLabel="Desfazer"
        loading={ocupado}
        onConfirm={async () => {
          setOcupado(true);
          try {
            await desfazerFaltaDaAuxiliar({ falta, faltas: faltas || [], substitutas: substitutas || [] });
          } catch (err) {
            toast.error(err?.message || 'Não deu para desfazer. Tente de novo.');
          } finally {
            setOcupado(false);
            setDesfazendo(false);
          }
        }}
        onCancel={() => setDesfazendo(false)}
      />
    </div>
  );
}
