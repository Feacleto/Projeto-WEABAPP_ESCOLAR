import { useEffect, useMemo, useState } from 'react';
import Spinner from '../common/Spinner';
import { carregarTotaisDeContas } from '../../services/pessoasDoPainelService';
import { parceirosDoDono } from '../../services/userService';
import {
  matrizDeContas,
  motoristasSuspensos,
  DIAS_DE_ATIVO,
} from '../../dominio/identidade/retratoDasPessoas.js';
import { formatDate } from '../../compartilhado/formatters.js';

/**
 * AS CONTAS POR PAPEL, DO LADO DO DONO.
 *
 * Motorista tem sinal de uso (`ultimaRota`); família e auxiliar ainda não
 * gravam o último acesso, então Ativas e Inativas ficam "—" — nunca zero, que
 * diria "ninguém" onde a verdade é "não medimos".
 */
const traco = (v) => (v === null || v === undefined ? '—' : v);

export default function ContasTab() {
  const [motoristas, setMotoristas] = useState(undefined);
  const [agora] = useState(() => Date.now());
  const [totais, setTotais] = useState({ totalFamilias: null, totalAuxiliares: null });

  useEffect(() => {
    parceirosDoDono().then(setMotoristas).catch(() => setMotoristas(null));
    carregarTotaisDeContas().then(setTotais);
  }, []);

  const matriz = useMemo(
    () => (Array.isArray(motoristas) ? matrizDeContas({ motoristas, ...totais }, agora) : null),
    [motoristas, totais, agora]
  );
  const suspensos = useMemo(() => motoristasSuspensos(motoristas), [motoristas]);

  if (motoristas === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (!matriz) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar as contas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-textMuted">
            <tr>
              <th className="p-2 font-bold">Papel</th>
              <th className="p-2 font-bold">Total</th>
              <th className="p-2 font-bold">Ativas</th>
              <th className="p-2 font-bold">Inativas</th>
              <th className="p-2 font-bold">Suspensas</th>
            </tr>
          </thead>
          <tbody>
            {matriz.map((l) => (
              <tr key={l.papel} className="border-t border-border">
                <td className="p-2 font-bold text-text">{l.rotulo}</td>
                <td className="p-2 text-text">{traco(l.total)}</td>
                <td className="p-2 text-text">{traco(l.ativas)}</td>
                <td className="p-2 text-text">{traco(l.inativas)}</td>
                <td className="p-2 text-text">{traco(l.suspensas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-textMuted">
        Família e auxiliar ainda não gravam o último acesso.
      </p>

      <section className="rounded-2xl border border-border bg-card p-3 text-xs text-textMuted">
        <h3 className="text-sm font-bold text-text">Definições</h3>
        <ul className="mt-1 space-y-1">
          <li>
            <strong className="text-text">Ativo:</strong> motorista que iniciou uma rota nos últimos{' '}
            {DIAS_DE_ATIVO} dias.
          </li>
          <li>
            <strong className="text-text">Inativo:</strong> o resto, inclusive quem nunca rodou.
          </li>
          <li>
            <strong className="text-text">Suspenso:</strong> conta bloqueada pelo dono. Não conta
            como ativo nem como inativo.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-bold text-text">Motoristas suspensos</h3>
        {suspensos.length === 0 ? (
          <p className="mt-1 text-xs text-textMuted">Nenhum motorista suspenso.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {suspensos.map((s) => (
              <li
                key={s.uid || s.marca}
                className="flex min-h-[40px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-xs"
              >
                <span className="font-bold text-text">{s.marca}</span>
                <span className="text-textMuted">
                  {s.desdeMs ? `desde ${formatDate(s.desdeMs)}` : 'data não registrada'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-textMuted">
          O motivo e o prazo de cada suspensão estão na aba Registro.
        </p>
      </section>
    </div>
  );
}
