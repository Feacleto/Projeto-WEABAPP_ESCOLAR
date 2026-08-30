import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { watchAbsencesRange, ABSENCE_TYPES } from '../../services/absencesService';
import {
  getDateKey,
  diaCompleto,
  horaCurta,
} from '../../utils/horarios';

/**
 * A SEMANA — quem falta em qual dia, com antecedência.
 *
 * POR QUE ESTA TELA EXISTE
 * O app só sabia responder "quem falta HOJE". Mas o aviso que serve é o que
 * chega antes: o responsável avisa na segunda que na quinta tem consulta, e o
 * motorista só descobria na quinta de manhã, na porta, sem tempo de
 * reorganizar nada. A informação estava gravada desde segunda — só não tinha
 * onde aparecer.
 *
 * A ORDEM DAS LINHAS É A DA ROTA
 * As crianças aparecem na sequência em que ele passa, e não em ordem
 * alfabética. É assim que ele pensa a turma, e é o que deixa a leitura "quinta
 * eu pulo a terceira parada" possível sem procurar nome por nome.
 *
 * SEGUNDA A SEXTA, E SÓ
 * Sábado e domingo ficam de fora pelo mesmo motivo que ficam de fora do aviso
 * de "sem aula": a perua não roda. Coluna que nunca tem nada é coluna que
 * rouba largura das que têm.
 */

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

/** A segunda-feira da semana que contém `base`. */
function segundaDa(base) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 domingo … 6 sábado. Domingo pertence à semana que ACABOU de
  // passar pro calendário, mas pro motorista ele é véspera da segunda — então
  // domingo abre a semana que vem, que é a que ele vai rodar.
  const dow = d.getDay();
  const recuo = dow === 0 ? -1 : dow - 1;
  d.setDate(d.getDate() - recuo);
  return d;
}

function somaDias(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export default function TioSemana() {
  const { user } = useAuth();
  const { children, loading } = useChildren();
  const { mapa: escolasPorId } = useEscolas();

  const [semanaBase, setSemanaBase] = useState(() => segundaDa(new Date()));
  const [declaracoes, setDeclaracoes] = useState([]);

  const dias = useMemo(
    () => Array.from({ length: 5 }, (_, i) => somaDias(semanaBase, i)),
    [semanaBase]
  );
  const chaves = useMemo(() => dias.map((d) => getDateKey(d)), [dias]);

  useEffect(() => {
    if (!user?.uid || !chaves.length) return undefined;
    return watchAbsencesRange(
      user.uid,
      chaves[0],
      chaves[chaves.length - 1],
      setDeclaracoes,
      () => setDeclaracoes([])
    );
  }, [user?.uid, chaves]);

  /** { childId: { dateKey: tipo } } */
  const porCrianca = useMemo(() => {
    const m = {};
    for (const d of declaracoes) {
      if (!m[d.childId]) m[d.childId] = {};
      m[d.childId][d.dateKey] = d.type;
    }
    return m;
  }, [declaracoes]);

  /**
   * As crianças na ordem da rota.
   *
   * Sai do mesmo `diaCompleto` que monta o dia do motorista, sem declarações:
   * aqui a pergunta é "qual é a sequência normal", e a falta é o que a grade
   * mostra por cima dela.
   */
  const linhas = useMemo(() => {
    const blocos = diaCompleto(children, { escolasPorId });
    const vistos = new Set();
    const out = [];
    for (const b of blocos) {
      if (b.direcao !== 'ida') continue;
      for (const p of b.paradas) {
        if (vistos.has(p.child.id)) continue;
        vistos.add(p.child.id);
        out.push({ child: p.child, hora: p.hora });
      }
    }
    // Quem só tem volta (raro, mas existe) entra no fim pra não sumir.
    for (const c of children || []) {
      if (c.active === false || vistos.has(c.id)) continue;
      out.push({ child: c, hora: null });
    }
    return out;
  }, [children, escolasPorId]);

  const hojeKey = getDateKey();
  const totalNaSemana = declaracoes.length;

  return (
    <div className="min-h-screen pb-28">
      <Header
        title="Faltas da semana"
        showBack
        backLabel="Início"
        backTo="/tio"
      />

      <div className="px-4 pt-4 space-y-4">
        {/* A SEMANA FICA GRUDADA NO TOPO.
          *
          * Ela rolava junto com a lista, e numa turma de dez crianças some na
          * primeira rolagem — restando cinco colunas de quadradinhos sem
          * nenhuma pista de que dias são. A pergunta "que semana eu estou
          * vendo?" é a que a tela existe pra responder; deixá-la sumir é a
          * tela perdendo o próprio assunto.
          *
          * `top-14` é a altura do cabeçalho do app, que também é sticky —
          * sem o deslocamento, uma barra cobriria a outra. */}
        <div className="sticky top-14 z-10 -mx-4 flex items-center gap-2 border-b border-neutro bg-bg px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setSemanaBase((b) => somaDias(b, -7))}
            aria-label="Semana anterior"
            className="tap w-9 h-9 rounded-xl border border-border text-textMuted flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={17} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-bold capitalize text-text leading-tight">
              {rotuloSemana(dias)}
            </p>
            <p className="text-[11px] text-textMuted">
              {totalNaSemana === 0
                ? 'ninguém avisou falta'
                : `${totalNaSemana} ${totalNaSemana === 1 ? 'aviso' : 'avisos'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSemanaBase((b) => somaDias(b, 7))}
            aria-label="Próxima semana"
            className="tap w-9 h-9 rounded-xl border border-border text-textMuted flex items-center justify-center shrink-0"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {loading && <Skeleton className="h-64 rounded-2xl" />}

        {!loading && linhas.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma criança na turma"
            description="Cadastre as crianças e os horários — a semana se monta a partir da rota."
          />
        )}

        {!loading && linhas.length > 0 && (
          <>
            {/* A grade rola na horizontal por dentro, e nunca a página:
              * com cinco colunas e nome, num aparelho estreito, é a única
              * forma de não espremer o nome até virar reticências. */}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse" style={{ minWidth: 340 }}>
                {/* E o cabeçalho das COLUNAS gruda junto, logo abaixo da
                  * barra da semana. Sem ele, rolar transforma a grade em
                  * quadradinhos anônimos: dá pra ver que alguém faltou, não
                  * em que dia. `top-[6.5rem]` empilha na ordem cabeçalho do
                  * app → semana → dias. */}
                <thead className="sticky top-[6.5rem] z-10 bg-bg">
                  <tr>
                    <th className="text-left text-[10px] uppercase tracking-widest text-textMuted font-normal pb-2 pr-2">
                      criança
                    </th>
                    {dias.map((d, i) => {
                      const ehHoje = getDateKey(d) === hojeKey;
                      return (
                        <th
                          key={chaves[i]}
                          className={`pb-2 px-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            ehHoje ? 'text-primary' : 'text-textMuted'
                          }`}
                          style={{ width: 42 }}
                        >
                          <span className="block">{DIAS[i]}</span>
                          <span className="block font-mono text-[9px] font-normal">
                            {String(d.getDate()).padStart(2, '0')}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ child, hora }) => (
                    <tr key={child.id} className="border-t border-neutro">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            photoURL={child.photoURL}
                            gender={child.gender}
                            seed={child.id}
                            kind="child"
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-text truncate leading-tight">
                              {child.name?.split(' ')[0]}
                            </p>
                            {hora && (
                              <p className="font-mono text-[10px] text-textMuted">
                                {horaCurta(hora)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {chaves.map((k) => (
                        <td key={k} className="py-2 px-0.5 text-center">
                          <Marca tipo={porCrianca[child.id]?.[k]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* A legenda não é enfeite: são quatro estados que só se
              * distinguem por cor e letra, e ninguém adivinha "L" de "levo". */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-textMuted pt-1">
              <Legenda tipo={ABSENCE_TYPES.FULL} texto="não vai" />
              <Legenda tipo={ABSENCE_TYPES.NO_PICKUP} texto="o pai leva" />
              <Legenda tipo={ABSENCE_TYPES.NO_DROPOFF} texto="o pai busca" />
              <Legenda tipo={ABSENCE_TYPES.ALREADY_PICKED} texto="o pai pegou" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ESTILO = {
  [ABSENCE_TYPES.FULL]: { letra: 'F', classe: 'bg-dangerChip text-dangerText border-dangerBorder' },
  [ABSENCE_TYPES.NO_PICKUP]: { letra: 'L', classe: 'bg-warningChip text-warningText border-warningBorder' },
  [ABSENCE_TYPES.NO_DROPOFF]: { letra: 'B', classe: 'bg-escolaChip text-escola border-escolaBorder' },
  [ABSENCE_TYPES.ALREADY_PICKED]: { letra: 'P', classe: 'bg-primaryChip text-primary border-primaryBorder' },
};

function Marca({ tipo }) {
  const e = ESTILO[tipo];
  if (!e) {
    // Célula vazia continua desenhada: sem ela a grade vira um campo de
    // buracos e o olho perde a linha da criança ao atravessar a semana.
    return <span className="inline-block w-7 h-7 rounded-lg bg-sunken" />;
  }
  return (
    <span
      className={`inline-flex w-7 h-7 rounded-lg border items-center justify-center text-[11px] font-bold ${e.classe}`}
    >
      {e.letra}
    </span>
  );
}

function Legenda({ tipo, texto }) {
  const e = ESTILO[tipo];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex w-5 h-5 rounded-md border items-center justify-center text-[10px] font-bold ${e.classe}`}
      >
        {e.letra}
      </span>
      {texto}
    </span>
  );
}

/**
 * "25 a 29 de agosto" — e o mês por extenso não é enfeite.
 *
 * Era "25/08 a 29/08". Duas datas numéricas coladas viram um borrão que se
 * lê como código, não como período: pra saber de que mês era, o motorista
 * tinha que decodificar duas vezes e comparar. Ele está navegando semanas
 * pra trás e pra frente — o mês é justamente o que se perde nesse vaivém.
 *
 * SEMANA QUE ATRAVESSA O MÊS ganha os dois nomes ("29 de setembro a 3 de
 * outubro"). É o caso em que a pergunta "que semana é essa?" mais aparece, e
 * era exatamente o que a versão curta escondia.
 */
function rotuloSemana(dias) {
  if (!dias.length) return '';
  const ini = dias[0];
  const fim = dias[dias.length - 1];
  const mes = (d) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(d);

  if (ini.getMonth() === fim.getMonth()) {
    return `${ini.getDate()} a ${fim.getDate()} de ${mes(fim)}`;
  }
  return `${ini.getDate()} de ${mes(ini)} a ${fim.getDate()} de ${mes(fim)}`;
}
