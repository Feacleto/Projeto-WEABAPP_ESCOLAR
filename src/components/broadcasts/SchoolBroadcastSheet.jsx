import { useMemo, useState } from 'react';
import { X, Megaphone, School, Calendar, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChildren } from '../../hooks/useChildren';
import { useAuth } from '../../hooks/useAuth';
import { createSchoolBroadcast } from '../../services/broadcastService';
import { getDateKey } from '../../services/horariosService';

/**
 * Sheet pra disparar aviso "sem aula" pra todos os pais de uma escola.
 * Marca ausência automática + cria notificações no mesmo batch.
 */
export default function SchoolBroadcastSheet({ open, onClose }) {
  const { user } = useAuth();
  const { children: allChildren } = useChildren();

  const [school, setSchool] = useState('');
  const [whenChoice, setWhenChoice] = useState('today'); // 'today' | 'tomorrow' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Lista única de escolas + contagem de crianças
  const schools = useMemo(() => {
    const map = new Map();
    for (const c of allChildren) {
      if (!c.school) continue;
      map.set(c.school, (map.get(c.school) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allChildren]);

  const selectedCount = schools.find((s) => s.name === school)?.count || 0;

  if (!open) return null;

  function resolveDateKey() {
    if (whenChoice === 'today') return getDateKey();
    if (whenChoice === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return getDateKey(d);
    }
    return customDate || null;
  }

  async function handleSend() {
    if (!school) {
      toast.error('Escolha uma escola.');
      return;
    }
    const dateKey = resolveDateKey();
    if (!dateKey) {
      toast.error('Escolha uma data.');
      return;
    }
    setSending(true);
    try {
      const { affectedCount } = await createSchoolBroadcast({
        schoolName: school,
        dateKey,
        message,
        adminUid: user?.uid,
        children: allChildren,
      });
      toast.success(
        `Aviso enviado pra ${affectedCount} ${
          affectedCount === 1 ? 'pai' : 'pais'
        }.`
      );
      onClose?.();
      // Reset
      setSchool('');
      setWhenChoice('today');
      setCustomDate('');
      setMessage('');
    } catch (err) {
      console.error('Erro ao disparar aviso:', err);
      toast.error('Não foi possível enviar o aviso.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text leading-tight">
              Avisar pais &quot;sem aula&quot;
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Marca ausência automática e notifica
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* Escola */}
          <Section icon={School} label="Qual escola?">
            {schools.length === 0 ? (
              <div className="bg-card rounded-2xl border border-dashed border-gray-200 p-4 text-center text-xs text-textMuted">
                Cadastre crianças com escola pra liberar essa opção.
              </div>
            ) : (
              <div className="space-y-2">
                {schools.map((s) => {
                  const active = school === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => setSchool(s.name)}
                      className={`tap w-full text-left rounded-2xl p-3 flex items-center gap-3 border ${
                        active
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-gray-200'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-textMuted'
                        }`}
                      >
                        <School size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-textMuted">
                          {s.count} {s.count === 1 ? 'criança' : 'crianças'}
                        </p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border-2 ${
                          active
                            ? 'bg-primary border-primary'
                            : 'border-gray-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Data */}
          <Section icon={Calendar} label="Que dia?">
            <div className="grid grid-cols-2 gap-2">
              <DateChip
                label="Hoje"
                active={whenChoice === 'today'}
                onClick={() => setWhenChoice('today')}
              />
              <DateChip
                label="Amanhã"
                active={whenChoice === 'tomorrow'}
                onClick={() => setWhenChoice('tomorrow')}
              />
            </div>
            <button
              onClick={() => setWhenChoice('custom')}
              className={`tap w-full mt-2 rounded-xl p-3 border text-sm font-semibold text-left ${
                whenChoice === 'custom'
                  ? 'bg-primary/10 border-primary text-text'
                  : 'bg-card border-gray-200 text-textMuted'
              }`}
            >
              Escolher data...
            </button>
            {whenChoice === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={getDateKey()}
                className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm"
              />
            )}
          </Section>

          {/* Mensagem opcional */}
          <Section icon={Megaphone} label="Mensagem (opcional)">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: recesso, treinamento, paralisação..."
              rows={2}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none"
              maxLength={140}
            />
            <p className="text-[10px] text-textMuted text-right mt-1">
              {message.length}/140
            </p>
          </Section>
        </div>

        <div className="px-5 pt-2 pb-3 border-t border-gray-100">
          <button
            onClick={handleSend}
            disabled={sending || !school || (whenChoice === 'custom' && !customDate)}
            className="tap w-full rounded-2xl py-3.5 bg-amber-500 text-white font-bold shadow-lg shadow-amber-500/30 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={18} />
            {sending
              ? 'Enviando...'
              : selectedCount > 0
              ? `Enviar pra ${selectedCount} ${selectedCount === 1 ? 'pai' : 'pais'}`
              : 'Enviar aviso'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1 mb-2 inline-flex items-center gap-1.5">
        <Icon size={12} />
        {label}
      </h3>
      {children}
    </section>
  );
}

function DateChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`tap rounded-xl p-3 text-sm font-semibold border ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-card text-text border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
