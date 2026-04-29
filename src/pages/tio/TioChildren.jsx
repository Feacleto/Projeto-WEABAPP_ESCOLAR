import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import ChildCard from '../../components/children/ChildCard';
import { useChildren } from '../../hooks/useChildren';
import {
  updateChildStatus,
  getNextStatus,
  STATUS_LABELS,
} from '../../services/childrenService';
import { PERIOD_LABELS } from '../../utils/formatters';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'morning', label: PERIOD_LABELS.morning },
  { value: 'afternoon', label: PERIOD_LABELS.afternoon },
  { value: 'evening', label: PERIOD_LABELS.evening },
];

export default function TioChildren() {
  const navigate = useNavigate();
  const { children, loading } = useChildren();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return children;
    return children.filter((c) => c.period === filter);
  }, [children, filter]);

  const onCycleStatus = async (child) => {
    const next = getNextStatus(child.status);
    try {
      await updateChildStatus(child.id, next);
      toast.success(`${child.name}: ${STATUS_LABELS[next]}`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível atualizar o status.');
    }
  };

  return (
    <>
      <Header
        title="Crianças"
        action={
          <button
            onClick={() => navigate('/tio/children/new')}
            aria-label="Cadastrar criança"
            className="text-primary tap p-1"
          >
            <Plus size={24} />
          </button>
        }
      />

      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold tap border ${
                filter === f.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhuma criança"
            description={
              filter === 'all'
                ? 'Cadastre a primeira criança para começar.'
                : 'Nenhuma criança neste período.'
            }
            action={
              filter === 'all' ? (
                <Button
                  onClick={() => navigate('/tio/children/new')}
                  icon={Plus}
                  fullWidth={false}
                >
                  Cadastrar criança
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                onCycleStatus={onCycleStatus}
                onClick={() => navigate(`/tio/children/${child.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
