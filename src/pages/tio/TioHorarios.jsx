import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  School,
  Home,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { updateChild } from '../../services/childrenService';
import {
  normalizaHora,
  horaCurta,
  horariosCombinados,
  blocosDaDirecao,
  avisosDeTempo,
  proporCascata,
  periodoDaHora,
  CAMPO_DA_DIRECAO,
  horaNaDirecao,
} from '../../services/horariosService';

/**
 * "Horários" — onde o motorista monta a rota padrão.
 *
 * POR QUE NÃO SE CHAMA MAIS "ROTA PADRÃO"
 * A rota padrão era uma ordem que ele arrastava à mão, turno por turno. Agora
 * ela CAI da informação que ele já negocia com cada família: a hora em que
 * pega e a hora em que entrega. Ele preenche o que combinou; a ordem se monta.
 *
 * O QUE ESTA TELA DELIBERADAMENTE NÃO MOSTRA
 * Horário de viagem. As versões anteriores agrupavam as crianças em "turnos"
 * e depois em "corridas" com janela (06:00–07:30) — e essa janela era um
 * compromisso que ninguém tinha feito. Aqui os grupos aparecem só como o
 * espaço em branco entre a última parada de uma viagem e a primeira da
 * seguinte. O único número na tela é um que ele acordou com um pai.
 */
export default function TioHorarios() {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const { mapa: escolasPorId } = useEscolas();

  const [direcao, setDirecao] = useState('ida');
  const [editando, setEditando] = useState(null); // { child, valor }
  const [cascata, setCascata] = useState(null);   // proposta pendente
  const [salvando, setSalvando] = useState(false);

  const blocos = useMemo(
    () => blocosDaDirecao(children, direcao, { escolasPorId }),
    [children, direcao, escolasPorId]
  );
  const avisos = useMemo(() => avisosDeTempo(blocos), [blocos]);

  const pendentes = useMemo(
    () => (children || []).filter((c) => horariosCombinados(c).presumido),
    [children]
  );

  /** Grava a hora de uma criança (e mantém o rótulo de período coerente). */
  async function gravar(child, hora, dir) {
    const campo = CAMPO_DA_DIRECAO[dir];
    const campoPeriodo = dir === 'ida' ? 'pickupPeriod' : 'dropoffPeriod';
    const updates = { [campo]: hora, [campoPeriodo]: periodoDaHora(hora) };
    if (dir === 'ida') updates.period = periodoDaHora(hora);
    await updateChild(child.id, updates);
  }

  function abrirEdicao(child) {
    setEditando({ child, valor: horaNaDirecao(child, direcao) || '' });
  }

  function confirmarEdicao() {
    if (!editando) return;
    const hora = normalizaHora(editando.valor);
    if (!hora) {
      toast.error('Hora inválida. Ex: 06:20');
      return;
    }
    // A cascata PROPÕE. Cada uma destas horas foi combinada com uma família
    // diferente — mexer sozinho seria alterar acordos que ele fez um a um.
    const proposta = proporCascata(children, editando.child.id, hora, direcao);
    const outros = proposta.filter((p) => p.child.id !== editando.child.id);
    if (outros.length > 0) {
      setCascata({ proposta, hora, child: editando.child });
      return;
    }
    aplicar([{ child: editando.child, para: hora }]);
  }

  async function aplicar(lista) {
    setSalvando(true);
    try {
      for (const item of lista) {
        await gravar(item.child, item.para, direcao);
      }
      toast.success(
        lista.length === 1
          ? `${lista[0].child.name.split(' ')[0]}: ${horaCurta(lista[0].para)}`
          : `${lista.length} horários atualizados.`
      );
      setEditando(null);
      setCascata(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const totalNoDia = blocos.reduce((n, b) => n + b.paradas.length, 0);

  return (
    <div className="min-h-screen pb-28">
      <Header title="Horários" showBack backLabel="Rota" backTo="/tio/route/now" />

      <div className="px-5 pt-4 space-y-4">
        <p className="text-sm text-textMuted">
          O que você combinou com cada responsável. A ordem da rota sai daqui —
          e é isso que o pai vê pra saber a hora de descer.
        </p>

        {/* Ida / volta */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
          {[
            { v: 'ida', label: 'Pego em casa', icon: Home },
            { v: 'volta', label: 'Entrego em casa', icon: School },
          ].map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => setDirecao(d.v)}
              aria-pressed={direcao === d.v}
              className={`tap py-2 text-xs font-semibold rounded-lg transition-colors ${
                direcao === d.v ? 'bg-card text-text shadow-sm' : 'text-textMuted'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {loading && <Skeleton className="h-56 rounded-2xl" />}

        {/* Quem ainda opera com horário chutado */}
        {!loading && pendentes.length > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <b className="block text-sm">
                {pendentes.length}{' '}
                {pendentes.length === 1
                  ? 'criança está com horário presumido'
                  : 'crianças estão com horário presumido'}
              </b>
              O app chutou pelo período antigo pra ninguém sumir da rota. Toque
              no horário e confirme o que você combinou de verdade — o pai está
              vendo esse número.
            </div>
          </div>
        )}

        {/* Promessas que não cabem no relógio */}
        {!loading && avisos.length > 0 && (
          <div className="space-y-1.5">
            {avisos.map((a, i) => (
              <div
                key={`${a.de.id}-${a.para.id}-${i}`}
                className="bg-rust-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5"
                style={{ background: 'rgb(254 242 242)' }}
              >
                <AlertTriangle size={17} className="text-danger shrink-0 mt-0.5" />
                <p className="text-xs text-red-900 leading-relaxed">
                  <b>Não fecha:</b> de {a.de.name.split(' ')[0]} (
                  {horaCurta(a.horaDe)}) até {a.para.name.split(' ')[0]} (
                  {horaCurta(a.horaPara)}) são {a.km} km. Dá {a.minutosDisponiveis}{' '}
                  min e precisa de uns {a.minutosNecessarios}.
                </p>
              </div>
            ))}
          </div>
        )}

        {!loading && totalNoDia === 0 && (
          <EmptyState
            icon={Clock}
            title="Nenhuma criança na sua turma"
            description="Cadastre as crianças e combine com cada responsável a hora de pegar e entregar."
            action={
              <Button
                fullWidth={false}
                variant="secondary"
                icon={Users}
                onClick={() => navigate('/tio/children/new')}
              >
                Cadastrar criança
              </Button>
            }
          />
        )}

        {/* As viagens do dia — separadas só pelo espaço em branco */}
        {!loading &&
          blocos.map((bloco, i) => (
            <section key={`${bloco.inicio}-${i}`} className="space-y-2">
              {i > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-[10px] uppercase tracking-widest text-textMuted">
                    outra viagem
                  </span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}

              {/* Na volta, a escola vem antes das casas */}
              {direcao === 'volta' && bloco.escolas.length > 0 && (
                <ParadaEscola escolas={bloco.escolas} />
              )}

              {bloco.paradas.map((p) => (
                <button
                  key={p.child.id}
                  type="button"
                  onClick={() => abrirEdicao(p.child)}
                  className="tap w-full text-left bg-card border border-gray-200 rounded-2xl px-3 py-2.5 flex items-center gap-3"
                >
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums shrink-0 w-14 ${
                      p.presumido ? 'text-amber-600' : 'text-text'
                    }`}
                  >
                    {horaCurta(p.hora)}
                  </span>
                  <Avatar
                    photoURL={p.child.photoURL}
                    gender={p.child.gender}
                    seed={p.child.id}
                    kind="child"
                    size="sm"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-text truncate">
                      {p.child.name}
                    </span>
                    <span className="block text-[11px] text-textMuted truncate">
                      {p.presumido
                        ? 'horário presumido — confirme'
                        : p.child.address?.split(',')[0] || 'Sem endereço'}
                    </span>
                  </span>
                  <Clock size={15} className="text-textMuted shrink-0" />
                </button>
              ))}

              {/* Na ida, a escola fecha a viagem */}
              {direcao === 'ida' && bloco.escolas.length > 0 && (
                <ParadaEscola escolas={bloco.escolas} />
              )}
            </section>
          ))}
      </div>

      {/* Edição de uma hora */}
      {editando && !cascata && (
        <Folha onClose={() => !salvando && setEditando(null)}>
          <h2 className="text-xl font-bold text-text">
            {editando.child.name.split(' ')[0]}
          </h2>
          <p className="text-sm text-textMuted -mt-2">
            {direcao === 'ida'
              ? 'Que horas você pega em casa?'
              : 'Que horas você entrega em casa?'}
          </p>

          <input
            type="time"
            value={editando.valor}
            onChange={(e) =>
              setEditando((s) => ({ ...s, valor: e.target.value }))
            }
            className="w-full h-14 rounded-2xl border-2 border-gray-200 bg-card px-4 text-text text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />

          <p className="text-xs text-textMuted">
            O responsável vê este horário na tela dele.
          </p>

          <Button loading={salvando} onClick={confirmarEdicao}>
            Salvar
          </Button>
        </Folha>
      )}

      {/* Proposta de cascata */}
      {cascata && (
        <Folha onClose={() => !salvando && setCascata(null)}>
          <h2 className="text-xl font-bold text-text">
            Empurrar quem vem depois?
          </h2>
          <p className="text-sm text-textMuted -mt-2">
            {cascata.child.name.split(' ')[0]} passou pra{' '}
            {horaCurta(cascata.hora)}. Quem vem em seguida na mesma viagem
            atrasa junto.
          </p>

          <div className="space-y-1.5">
            {cascata.proposta.map((p) => (
              <div
                key={p.child.id}
                className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-sm"
              >
                <span className="flex-1 min-w-0 truncate font-medium text-text">
                  {p.child.name.split(' ')[0]}
                </span>
                <span className="font-mono text-xs text-textMuted tabular-nums">
                  {horaCurta(p.de)}
                </span>
                <ArrowRight size={13} className="text-textMuted" />
                <span className="font-mono text-xs font-bold text-text tabular-nums">
                  {horaCurta(p.para)}
                </span>
              </div>
            ))}
          </div>

          <Button
            icon={Check}
            loading={salvando}
            onClick={() => aplicar(cascata.proposta)}
          >
            Empurrar todos
          </Button>
          <Button
            variant="secondary"
            loading={salvando}
            onClick={() =>
              aplicar([{ child: cascata.child, para: cascata.hora }])
            }
          >
            Mudar só {cascata.child.name.split(' ')[0]}
          </Button>
        </Folha>
      )}
    </div>
  );
}

/* ─────────────── auxiliares ─────────────── */

/**
 * A parada de escola não tem hora — de propósito. Estimar "~6h52" traria de
 * volta exatamente o número que ninguém combinou e que fazia a tela parecer
 * uma cobrança.
 */
function ParadaEscola({ escolas }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-violet-50 border border-violet-200">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-violet-700 font-semibold">
        depois
      </span>
      <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
        <School size={15} />
      </div>
      <span className="flex-1 min-w-0 text-sm font-semibold text-violet-900 truncate">
        {escolas.map((e) => e.nome).join(' · ')}
      </span>
    </div>
  );
}

function Folha({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pt-2 pb-5 space-y-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap absolute right-4 top-4 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted"
          >
            <X size={18} />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
