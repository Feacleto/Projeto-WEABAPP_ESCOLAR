import { useEffect, useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import Spinner from '../common/Spinner';
import { carregarAuxiliaresDoPainel } from '../../services/pessoasDoPainelService';
import { parceirosDoDono } from '../../services/userService';
import { retratoDeAuxiliares } from '../../dominio/identidade/retratoDasPessoas.js';
import { formatDate } from '../../compartilhado/formatters.js';

/**
 * AS AUXILIARES, DO LADO DO DONO.
 *
 * Lê `auxiliares/*`, o vínculo por par. O documento também guarda o que o tio
 * combinou pagar a ela — e isso NÃO aparece aqui: o pagamento é assunto dos
 * dois, não da plataforma. Quem desliga no dia a dia é o motorista.
 */
const traco = (v) => (v === null || v === undefined ? '—' : v);

export default function AuxiliaresTab() {
  const [vinculos, setVinculos] = useState(undefined);
  const [motoristas, setMotoristas] = useState([]);
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    carregarAuxiliaresDoPainel().then(setVinculos);
    parceirosDoDono().then(setMotoristas).catch(() => {});
  }, []);

  const retrato = useMemo(
    () => (Array.isArray(vinculos) ? retratoDeAuxiliares(vinculos, motoristas, agora) : null),
    [vinculos, motoristas, agora]
  );

  if (vinculos === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (!retrato) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar as auxiliares.
      </p>
    );
  }

  const fichas = [
    ['Ativas', retrato.ativas],
    ['Motoristas com auxiliar', retrato.motoristasComAuxiliar],
    ['Saíram em 30 dias', retrato.saiuEm30],
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-textMuted">
        Quem desliga no dia a dia é o motorista. A plataforma só bloqueia por violação (ver Política
        de bloqueio).
      </p>

      <div className="grid grid-cols-3 gap-2">
        {fichas.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-extrabold text-text">{traco(valor)}</p>
            <p className="text-xs text-textMuted">{rotulo}</p>
          </div>
        ))}
      </div>

      {retrato.linhas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <UserRound size={22} className="mx-auto text-textMuted" />
          <p className="mt-2 text-xs text-textMuted">Nenhum motorista convidou auxiliar ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="text-textMuted">
              <tr>
                <th className="p-2 font-bold">Nome</th>
                <th className="p-2 font-bold">Motorista</th>
                <th className="p-2 font-bold">Desde</th>
                <th className="p-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {retrato.linhas.map((l, i) => (
                <tr key={`${l.motoristaUid}-${i}`} className="border-t border-border">
                  <td className="p-2 font-bold text-text">{l.nome}</td>
                  <td className="p-2 text-text">{l.motorista || '—'}</td>
                  <td className="p-2 text-text">{l.desdeMs ? formatDate(l.desdeMs) : '—'}</td>
                  <td className="p-2">
                    <span
                      className={`rotulo rounded-lg px-1.5 py-0.5 ${
                        l.ativa ? 'bg-primarySoft text-primary' : 'bg-neutro text-textMuted'
                      }`}
                    >
                      {l.ativa ? 'Ativa' : l.encerradoMs ? `Saiu em ${formatDate(l.encerradoMs)}` : 'Saiu'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
