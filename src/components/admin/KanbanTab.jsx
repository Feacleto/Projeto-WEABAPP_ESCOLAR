import { useEffect, useState } from 'react';
import { Check, Plus, Undo2 } from 'lucide-react';
import Spinner from '../common/Spinner';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../compartilhado/formatters.js';
import {
  ESTADO,
  LIMITES,
  acrescentarAtividade,
  agruparPorEstado,
  alternarAtividade,
  criarTema,
  frasesDoResumo,
  moverTema,
} from '../../dominio/associacao/kanbanDoDono.js';
import {
  apagarTemaNoBanco,
  atualizarTemaNoBanco,
  criarTemaNoBanco,
  hojeEmBrasilia,
  observarTemas,
} from '../../services/kanbanDoDonoService';

/**
 * A ABA "KANBAN" — os temas do dono, com atividades dentro (05/10/2026).
 *
 * O QUADRO É DE TODOS OS DONOS, não de quem criou: a regra é `isOwner()`, o
 * papel. `criadoPor` fica gravado, mas não dá exclusividade — dois donos
 * mexem nos mesmos temas, e por isso a tela não mostra "meu" e "dele".
 *
 * Cada gesto grava o tema INTEIRO já calculado pela régua
 * (dominio/associacao/kanbanDoDono.js); a escuta ao vivo devolve o resultado.
 * Em celular as colunas empilham; em tela larga ficam lado a lado.
 */
const COLUNAS = [
  [ESTADO.A_FAZER, 'A fazer'],
  [ESTADO.FAZENDO, 'Fazendo'],
  [ESTADO.CONCLUIDO, 'Concluído'],
];

const data = (d) => (d ? formatDate(`${d}T12:00:00`) : '—');

const BOTAO =
  'tap inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-bold';

function CartaoDoTema({ tema, ocupado, onGravar, onApagar }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const hoje = () => hojeEmBrasilia();

  const acrescentar = (e) => {
    e.preventDefault();
    const r = acrescentarAtividade(tema, texto, hoje());
    if (!r.ok) return setErro(r.erro);
    setErro('');
    setTexto('');
    onGravar(r.tema);
  };

  return (
    <li className="space-y-3 rounded-2xl border border-border bg-card p-3">
      <div>
        <p className="text-sm font-bold text-text">{tema.nome}</p>
        <p className="text-xs text-textMuted">
          Aberto em {data(tema.abertoEm)}
          {tema.concluidoEm && ` · concluído em ${data(tema.concluidoEm)}`}
        </p>
      </div>

      {tema.atividades.length > 0 && (
        <ul className="space-y-1.5">
          {tema.atividades.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onGravar(alternarAtividade(tema, a.id, hoje()))}
                aria-pressed={!!a.concluidaEm}
                aria-label={`${a.concluidaEm ? 'Desmarcar' : 'Marcar'}: ${a.texto}`}
                className={`tap flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                  a.concluidaEm ? 'border-primary bg-primary text-white' : 'border-border bg-card text-transparent'
                }`}
              >
                <Check size={18} aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1 pt-2">
                <p className={`break-words text-xs ${a.concluidaEm ? 'text-textMuted line-through' : 'text-text'}`}>
                  {a.texto}
                </p>
                <p className="text-xs text-textMuted">
                  {data(a.abertaEm)}
                  {a.concluidaEm && ` → ${data(a.concluidaEm)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={acrescentar} className="space-y-1">
        <label htmlFor={`ativ-${tema.id}`} className="block text-xs font-semibold text-textMuted">
          Nova atividade
        </label>
        <div className="flex gap-2">
          <input
            id={`ativ-${tema.id}`}
            value={texto}
            maxLength={LIMITES.TEXTO}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-base text-text"
          />
          <button
            type="submit"
            disabled={ocupado}
            aria-label="Acrescentar atividade"
            className={`${BOTAO} w-10 border-border bg-card px-0 text-text`}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        {erro && <p className="text-xs text-dangerText">{erro}</p>}
      </form>

      <div className="flex flex-wrap gap-2">
        {tema.estado === ESTADO.A_FAZER && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onGravar(moverTema(tema, ESTADO.FAZENDO, hoje()))}
            className={`${BOTAO} border-primary bg-primary text-white`}
          >
            Começar
          </button>
        )}
        {tema.estado === ESTADO.FAZENDO && (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onGravar(moverTema(tema, ESTADO.CONCLUIDO, hoje()))}
              className={`${BOTAO} border-primary bg-primary text-white`}
            >
              Concluir tema
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onGravar(moverTema(tema, ESTADO.A_FAZER, hoje()))}
              className={`${BOTAO} border-border bg-card text-text`}
            >
              <Undo2 size={14} aria-hidden="true" /> Voltar
            </button>
          </>
        )}
        {tema.estado === ESTADO.CONCLUIDO && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onGravar(moverTema(tema, ESTADO.FAZENDO, hoje()))}
            className={`${BOTAO} border-border bg-card text-text`}
          >
            <Undo2 size={14} aria-hidden="true" /> Voltar
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => onApagar(tema)}
          className={`${BOTAO} ml-auto border-dangerBorder bg-card text-dangerText`}
        >
          Apagar tema
        </button>
      </div>
    </li>
  );
}

export default function KanbanTab() {
  const { user } = useAuth();
  const [temas, setTemas] = useState(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aApagar, setAApagar] = useState(null);

  useEffect(() => observarTemas(setTemas, () => setTemas(false)), []);

  const gravar = async (fn) => {
    setOcupado(true);
    setErro('');
    try {
      await fn();
    } catch (err) {
      console.error('[admin] kanban não gravou:', err);
      setErro('Não deu pra gravar. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  };

  const novoTema = (e) => {
    e.preventDefault();
    const r = criarTema({ nome, hoje: hojeEmBrasilia(), uid: user?.uid });
    if (!r.ok) return setErro(r.erro);
    gravar(async () => {
      await criarTemaNoBanco(r.tema);
      setNome('');
    });
  };

  if (temas === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar o kanban.
      </p>
    );
  }
  if (temas === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const grupos = agruparPorEstado(temas);

  return (
    <section aria-labelledby="kanban" className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="kanban" className="rotulo">
          Kanban
        </h2>
        <p className="text-xs text-textMuted">{frasesDoResumo(temas)} · o quadro é de todos os donos</p>
      </header>

      <form onSubmit={novoTema} className="space-y-1">
        <label htmlFor="kanban-tema" className="block text-xs font-semibold text-textMuted">
          Novo tema
        </label>
        <div className="flex gap-2">
          <input
            id="kanban-tema"
            value={nome}
            maxLength={LIMITES.NOME}
            onChange={(e) => setNome(e.target.value)}
            className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-base text-text"
          />
          <button
            type="submit"
            disabled={ocupado}
            className={`${BOTAO} border-primary bg-primary text-white`}
          >
            Criar tema
          </button>
        </div>
        {erro && <p className="text-xs text-dangerText">{erro}</p>}
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUNAS.map(([estado, rotulo]) => (
          <div key={estado} className="space-y-2">
            <h3 className="text-xs font-bold text-text">
              {rotulo} · {grupos[estado].length}
            </h3>
            {grupos[estado].length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-textMuted">
                Nenhum tema.
              </p>
            ) : (
              <ul className="space-y-2">
                {grupos[estado].map((t) => (
                  <CartaoDoTema
                    key={t.id}
                    tema={t}
                    ocupado={ocupado}
                    onGravar={(novo) => gravar(() => atualizarTemaNoBanco(novo))}
                    onApagar={setAApagar}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!aApagar}
        title={`Apagar o tema "${aApagar?.nome || ''}"?`}
        description="O tema e as atividades dele somem para todos os donos."
        confirmLabel="Apagar tema"
        variant="danger"
        loading={ocupado}
        onCancel={() => setAApagar(null)}
        onConfirm={() =>
          gravar(async () => {
            await apagarTemaNoBanco(aApagar.id);
            setAApagar(null);
          })
        }
      />
    </section>
  );
}
