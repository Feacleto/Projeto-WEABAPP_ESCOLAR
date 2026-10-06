import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import Spinner from '../common/Spinner';
import { carregarFamiliasDoPainel } from '../../services/pessoasDoPainelService';
import { parceirosDoDono } from '../../services/userService';
import {
  fichasDeFamilias,
  funilDaFamilia,
  linhasDeResponsaveis,
} from '../../dominio/identidade/retratoDasPessoas.js';
import { formatDate } from '../../compartilhado/formatters.js';

/**
 * AS FAMÍLIAS, DO LADO DO DONO.
 *
 * Quem não paga, mas é quem faz o motorista ver valor. Os dados da turma são
 * do motorista: aqui só contagem e conta de acesso — nunca endereço, telefone,
 * e-mail, pagamento ou o nível da família (que só ela vê; nada dele é gravado).
 * Número que não deu para medir aparece "—", nunca zero.
 */
const FICHAS = [
  ['responsaveis', 'Responsáveis com conta'],
  ['criancasComFamilia', 'Crianças com família'],
  ['convitesSemResposta', 'Convites sem resposta'],
  ['pedidosEsperando', 'Pedidos esperando o motorista'],
];

const traco = (v) => (v === null || v === undefined ? '—' : v);

export default function FamiliasTab() {
  const [dados, setDados] = useState(undefined);
  const [motoristas, setMotoristas] = useState([]);

  useEffect(() => {
    carregarFamiliasDoPainel().then(setDados);
    // Só para trocar o uid do motorista pela marca; falhar não derruba a aba.
    parceirosDoDono().then(setMotoristas).catch(() => {});
  }, []);

  const fichas = useMemo(() => (dados ? fichasDeFamilias(dados.contagens) : null), [dados]);
  const funil = useMemo(
    () =>
      dados
        ? funilDaFamilia({
            cadastradas: dados.contagens.cadastradas,
            comConta: dados.contagens.criancasComFamilia,
            aceitaram: dados.contagens.aceitaram,
            // Não há count() de "tem token de push" sem índice próprio.
            comAvisos: null,
          })
        : [],
    [dados]
  );
  const linhas = useMemo(
    () => (dados ? linhasDeResponsaveis(dados.responsaveis, motoristas) : []),
    [dados, motoristas]
  );

  if (dados === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (dados === null) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar as famílias.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-textMuted">
        Quem não paga, mas é quem faz o motorista ver valor. Os dados da turma são do motorista:
        aqui só contagem e conta de acesso.
      </p>
      <p className="inline-flex min-h-[40px] items-center rounded-xl bg-neutro px-3 text-xs font-bold text-textMuted">
        Nível da família não aparece aqui: só ela vê.
      </p>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {FICHAS.map(([chave, rotulo]) => (
          <div key={chave} className="rounded-xl border border-border bg-card p-3">
            <p className="text-2xl font-extrabold text-text">{traco(fichas[chave])}</p>
            <p className="text-xs text-textMuted">{rotulo}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-3">
        <h3 className="text-sm font-bold text-text">Onde a família trava</h3>
        <ol className="mt-2 space-y-1.5">
          {funil.map((e) => (
            <li key={e.chave} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-text">{e.rotulo}</span>
              <span className="font-bold text-text">
                {traco(e.valor)}
                <span className="ml-2 font-normal text-textMuted">
                  {e.taxa === null ? '' : `${e.taxa}% do degrau anterior`}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-textMuted">
          "Ligou os avisos" não dá para contar no servidor: aparece "—" aqui e, linha a linha, na lista.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-bold text-text">Responsáveis</h3>
        {linhas.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-8 text-center">
            <Users size={22} className="mx-auto text-textMuted" />
            <p className="mt-2 text-xs text-textMuted">Nenhuma família com conta ainda.</p>
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="text-textMuted">
                <tr>
                  <th className="p-2 font-bold">Nome</th>
                  <th className="p-2 font-bold">Motorista</th>
                  <th className="p-2 font-bold">Filhos</th>
                  <th className="p-2 font-bold">Entrou em</th>
                  <th className="p-2 font-bold">Avisos</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.uid} className="border-t border-border">
                    <td className="p-2 font-bold text-text">{l.nome}</td>
                    <td className="p-2 text-text">{l.motorista || '—'}</td>
                    <td className="p-2 text-text">{l.filhos}</td>
                    <td className="p-2 text-text">{l.entrouMs ? formatDate(l.entrouMs) : '—'}</td>
                    <td className="p-2 text-text">{l.avisos ? 'Ligados' : 'Desligados'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-textMuted">Os 300 primeiros cadastros, do mais novo ao mais antigo.</p>
      </section>
    </div>
  );
}
