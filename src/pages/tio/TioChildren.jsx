import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  X,
  School,
  MoreHorizontal,
  NotebookPen,
  FileText,
  CircleSlash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import BarraDaAcao from '../../components/layout/BarraDaAcao';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import AppSheet from '../../components/common/AppSheet';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import RecadoDaRota from '../../components/route/RecadoDaRota';
import PassarParaOutroTio from '../../components/transferencia/PassarParaOutroTio';
import { ChildDetailSheet } from '../../pages/ChildDetail';
import { useChildren } from '../../hooks/useChildren';
import { useAuth } from '../../hooks/useAuth';
import { deactivateChildAndParent } from '../../services/accountService';
import { PERIOD_LABELS } from '../../compartilhado/formatters';

/**
 * MINHA TURMA — a tela de GERENCIAR a turma (05/10/2026, densidade aprovada
 * pelo dono).
 *
 * Aqui o tio não acompanha a rota: quem está em casa ou na perua ele vê na
 * tela da rota. Ele entra aqui para cuidar da turma — cadastrar criança,
 * mandar um recado a uma família, passar uma família para um tio parceiro ou
 * desativar quem saiu. Por isso cada criança é uma LINHA (nome, escola,
 * período) com um "···" que abre a folha dela com essas ações, e não mais um
 * cartão de 180 px com o status e o botão da rota ("Em casa", "EMBARQUEI").
 * Medido a 360×740: a primeira criança aparecia a 465 px do topo, cortada
 * atrás do "Cadastrar criança"; agora a turma de cinco cabe na primeira tela.
 *
 * ⚠️ "Passar para outro tio" só aparece quando a passagem é possível (a
 * cobrança ligada, a criança ativa, a família no app, e tio parceiro): quem
 * decide é o próprio `PassarParaOutroTio`, a mesma peça da ficha.
 */
const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'morning', label: PERIOD_LABELS.morning },
  { value: 'afternoon', label: PERIOD_LABELS.afternoon },
  { value: 'evening', label: PERIOD_LABELS.evening },
];

export default function TioChildren() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { children, loading } = useChildren();

  // A ficha abre POR CIMA da lista. O filtro, a busca e a rolagem continuam
  // exatamente onde estavam — que é a diferença entre consultar um telefone
  // e perder o lugar numa lista de vinte crianças.
  const [fichaDe, setFichaDe] = useState(null);
  // A folha das ações de uma criança (o "···").
  const [acoesDe, setAcoesDe] = useState(null);

  const initialFilter = searchParams.get('period') || 'all';
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');

  // Quando navega vindo de outra tela com query param, atualiza o filtro
  useEffect(() => {
    const p = searchParams.get('period');
    if (p && p !== filter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilter(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = children;
    if (filter !== 'all') list = list.filter((c) => c.period === filter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(term));
    }
    return list;
  }, [children, filter, search]);

  const criancaDaFolha = acoesDe ? children.find((c) => c.id === acoesDe) || null : null;

  return (
    <>
      {/* O título conta a turma, e "Escolas" mora ao lado dele: era um
        * cartão de 70 px e uma explicação de duas linhas antes da lista. */}
      <Header
        title={children.length ? `Minha turma · ${children.length}` : 'Minha turma'}
        showBack
        backLabel="Início"
        backTo="/tio"
        action={
          <button
            type="button"
            onClick={() => navigate('/tio/children/escolas')}
            className="tap inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-base font-bold text-primary"
          >
            <School size={18} aria-hidden="true" />
            Escolas
          </button>
        }
      />

      <div className="space-y-3 px-4 pt-3">
        {/* Busca por nome. O RÓTULO É VISÍVEL: placeholder some no primeiro
          * toque, e quem volta à tela com a busca preenchida não sabe mais o
          * que aquele campo filtra (o exemplo dentro do campo é sempre
          * "Digite aqui" — `testar:formularios`). */}
        <label htmlFor="busca-da-turma" className="-mb-2 block text-sm font-semibold text-text">
          Buscar pelo nome
        </label>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
          <input
            id="busca-da-turma"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite aqui"
            className="w-full h-12 pl-10 pr-14 rounded-2xl bg-card border border-border text-base text-text placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-0 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center text-textMuted tap"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Filtros por período */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-12 px-5 rounded-full text-base font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search
                ? 'Nada encontrado'
                : filter === 'all'
                ? 'Nenhuma criança ainda'
                : 'Sem crianças nesse período'
            }
            description={
              search
                ? `Não achei ninguém com "${search}".`
                : filter === 'all'
                ? 'Cadastre a primeira criança pra começar.'
                : 'Tente outro filtro ou cadastre uma nova.'
            }
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {filtered.map((child) => (
              <LinhaDaCrianca
                key={child.id}
                child={child}
                onAbrir={() => setFichaDe(child.id)}
                onAcoes={() => setAcoesDe(child.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* CADASTRAR CRIANÇA NA FAIXA COLADA NO MENU (05/10/2026). Era um botão
        * redondo flutuando no canto, e ele cobria o botão do primeiro cartão
        * da lista. Continua o único verde cheio da tela, perto do polegar. */}
      <BarraDaAcao>
        <Button onClick={() => navigate('/tio/children/new')} icon={Plus} data-tour="add-child">
          Cadastrar criança
        </Button>
      </BarraDaAcao>

      <ChildDetailSheet
        open={!!fichaDe}
        childId={fichaDe}
        onClose={() => setFichaDe(null)}
      />

      <FolhaDaCrianca
        child={criancaDaFolha}
        onClose={() => setAcoesDe(null)}
        onAbrirFicha={(id) => {
          setAcoesDe(null);
          setFichaDe(id);
        }}
      />
    </>
  );
}

/** Uma criança da turma: tocar no nome abre a ficha; o "···" abre as ações. */
function LinhaDaCrianca({ child, onAbrir, onAcoes }) {
  const primeiro = String(child.name || '').split(' ')[0];
  return (
    <li className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
      <button
        type="button"
        onClick={onAbrir}
        className="tap flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar photoURL={child.photoURL} gender={child.gender} seed={child.id} kind="child" size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold text-text">{child.name}</span>
          <span className={`block truncate text-base ${child.cadastroRapido ? 'font-semibold text-warningText' : 'text-textMuted'}`}>
            {child.cadastroRapido ? 'Falta completar o cadastro' : [child.school || 'Escola não informada', child.period && PERIOD_LABELS[child.period]]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onAcoes}
        aria-label={`O que fazer com ${primeiro}`}
        className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border text-textBody"
      >
        <MoreHorizontal size={22} />
      </button>
    </li>
  );
}

/** Uma linha da folha: ícone, o verbo e, se precisar, uma linha de explicação. */
function Opcao({ icone: Icone, titulo, detalhe, onClick, perigo = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-14 w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 ${
        perigo ? 'text-dangerText' : 'text-text'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          perigo ? 'bg-dangerSoft text-dangerText' : 'bg-primarySoft text-primary'
        }`}
      >
        <Icone size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{titulo}</span>
        {detalhe && <span className="block text-base text-textMuted">{detalhe}</span>}
      </span>
    </button>
  );
}

/**
 * A FOLHA DA CRIANÇA — o que o tio faz com ela, numa lista curta:
 * mandar recado, abrir a ficha, desativar e, quando der, passar para outro
 * tio. Desativar é o mesmo caminho do "Remover" da ficha, com a mesma
 * confirmação e as mesmas palavras.
 */
function FolhaDaCrianca({ child, onClose, onAbrirFicha }) {
  const { user } = useAuth();
  const [recado, setRecado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const primeiro = String(child?.name || '').split(' ')[0];

  const desativar = async () => {
    if (!child) return;
    setDesativando(true);
    try {
      const { parentRemoved } = await deactivateChildAndParent({ childId: child.id });
      toast.success(
        parentRemoved
          ? `${child.name} e o responsável foram removidos.`
          : `${child.name} foi removido(a) da lista ativa.`
      );
      setConfirmando(false);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover. Tente novamente.');
    } finally {
      setDesativando(false);
    }
  };

  return (
    <>
      <AppSheet open={!!child && !recado && !confirmando} onClose={onClose} title={child?.name || ''} icon={Users}>
        {child && (
          <div className="space-y-3">
            <div>
              <Opcao
                icone={NotebookPen}
                titulo="Mandar recado"
                detalhe={`Só para a família de ${primeiro}`}
                onClick={() => setRecado(true)}
              />
              <Opcao icone={FileText} titulo="Abrir a ficha" onClick={() => onAbrirFicha(child.id)} />
              <Opcao
                icone={CircleSlash}
                titulo="Desativar criança"
                detalhe="Pede confirmação"
                perigo
                onClick={() => setConfirmando(true)}
              />
            </div>
            {/* Só aparece quando a passagem é possível — a peça decide. */}
            <PassarParaOutroTio child={child} />
          </div>
        )}
      </AppSheet>

      {child && recado && (
        <RecadoDaRota
          open={recado}
          onClose={() => {
            setRecado(false);
            onClose();
          }}
          child={child}
          adminUid={user?.uid}
          tipoInicial="other"
        />
      )}

      <ConfirmDialog
        open={confirmando}
        title={`Remover ${child?.name || ''}?`}
        description={
          child?.parentUid
            ? `A criança sai da lista ativa e o responsável (${child.parentName || 'pai/mãe'}) é desvinculado do app. O histórico de pagamentos é preservado.`
            : 'A criança vai sair da lista ativa. O histórico de pagamentos é preservado.'
        }
        confirmLabel="Sim, remover"
        variant="danger"
        loading={desativando}
        onConfirm={desativar}
        onCancel={() => setConfirmando(false)}
      />
    </>
  );
}
