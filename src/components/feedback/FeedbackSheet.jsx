import { useState } from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { submitFeedback } from '../../services/feedbackService';

/**
 * Sheet de avaliação curta, coloquial, pensada pra idosos.
 * 3 perguntas obrigatórias rápidas (toques visuais, sem digitar) + 1
 * pergunta opcional escrita no fim — ordem proposital pra reduzir abandono.
 *
 * Perguntas mudam um pouco entre Tio e Pai porque o uso deles é diferente.
 */

const MOOD_OPTIONS = [
  { value: 1, emoji: '😟', label: 'Ruim' },
  { value: 2, emoji: '😐', label: 'Mais ou menos' },
  { value: 3, emoji: '🙂', label: 'Bom' },
  { value: 4, emoji: '😍', label: 'Ótimo' },
];

const USE_OPTIONS_TIO = [
  { value: 'route', emoji: '🚐', label: 'Fazer a rota' },
  { value: 'absences', emoji: '🙋', label: 'Marcar faltas' },
  { value: 'payments', emoji: '💵', label: 'Cobrar mensalidade' },
  { value: 'children', emoji: '👶', label: 'Ver crianças' },
  { value: 'call', emoji: '📞', label: 'Avisar o pai (ligar)' },
  { value: 'map', emoji: '🗺️', label: 'Ver o mapa' },
];

const USE_OPTIONS_PAI = [
  { value: 'map', emoji: '🗺️', label: 'Ver onde tá a perua' },
  { value: 'absences', emoji: '🙋', label: 'Avisar quando vai faltar' },
  { value: 'payments', emoji: '💵', label: 'Ver pagamento' },
  { value: 'altPickup', emoji: '👥', label: 'Dizer quem vai buscar' },
  { value: 'notifications', emoji: '🔔', label: 'Receber avisos' },
];

const WISH_OPTIONS = [
  { value: 'fewer_steps', emoji: '🎯', label: 'Tudo em menos toques' },
  { value: 'bigger_text', emoji: '🔍', label: 'Letras maiores' },
  { value: 'more_clear', emoji: '💡', label: 'Mais claro o que cada coisa faz' },
  { value: 'less_buttons', emoji: '✂️', label: 'Menos botões na tela' },
  { value: 'more_help', emoji: '🙋', label: 'Mais ajuda quando preciso' },
  { value: 'all_good', emoji: '👌', label: 'Tá bom do jeito que tá' },
];

export default function FeedbackSheet({ open, onClose, uid, role }) {
  const [mood, setMood] = useState(null);
  const [uses, setUses] = useState([]);
  const [wish, setWish] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const useOptions = role === 'admin' ? USE_OPTIONS_TIO : USE_OPTIONS_PAI;

  const toggleUse = (value) => {
    setUses((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const resetAndClose = () => {
    setMood(null);
    setUses([]);
    setWish(null);
    setComment('');
    setSubmitted(false);
    onClose();
  };

  const onSubmit = async () => {
    if (mood == null) {
      toast.error('Diz o que você acha do app primeiro!');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        uid,
        role,
        answers: { mood, uses, wish },
        comment,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível enviar. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={resetAndClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-text leading-tight flex-1">
              {submitted ? 'Recebemos!' : 'O que você acha do app?'}
            </h2>
            <button
              onClick={resetAndClose}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {submitted ? (
            <ThankYou onClose={resetAndClose} />
          ) : (
            <div className="space-y-6">
              {/* Pergunta 1 — humor / nota geral */}
              <Question
                index={1}
                title="No geral, o app tá te ajudando?"
              >
                <div className="grid grid-cols-4 gap-2">
                  {MOOD_OPTIONS.map((opt) => (
                    <ChoiceBig
                      key={opt.value}
                      emoji={opt.emoji}
                      label={opt.label}
                      active={mood === opt.value}
                      onClick={() => setMood(opt.value)}
                    />
                  ))}
                </div>
              </Question>

              {/* Pergunta 2 — o que mais usa */}
              <Question
                index={2}
                title="O que você usa mais? (pode marcar várias)"
              >
                <div className="grid grid-cols-2 gap-2">
                  {useOptions.map((opt) => (
                    <ChoiceWide
                      key={opt.value}
                      emoji={opt.emoji}
                      label={opt.label}
                      active={uses.includes(opt.value)}
                      onClick={() => toggleUse(opt.value)}
                    />
                  ))}
                </div>
              </Question>

              {/* Pergunta 3 — o que melhoraria */}
              <Question
                index={3}
                title="Se pudesse melhorar uma coisa, o que seria?"
              >
                <div className="grid grid-cols-2 gap-2">
                  {WISH_OPTIONS.map((opt) => (
                    <ChoiceWide
                      key={opt.value}
                      emoji={opt.emoji}
                      label={opt.label}
                      active={wish === opt.value}
                      onClick={() => setWish(opt.value)}
                    />
                  ))}
                </div>
              </Question>

              {/* Pergunta 4 — escrita opcional */}
              <Question
                index={4}
                title="Quer falar mais alguma coisa? (opcional)"
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Conta o que tiver vontade — sugestão, problema, elogio…"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
                />
              </Question>

              <Button
                onClick={onSubmit}
                icon={Send}
                loading={submitting}
                disabled={mood == null}
              >
                Enviar avaliação
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Question({ index, title, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-textMuted mb-2">
        Pergunta {index}
      </p>
      <h3 className="text-base font-bold text-text leading-snug mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ChoiceBig({ emoji, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-colors ${
        active
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-card border-gray-200 text-text'
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="text-[11px] font-semibold leading-tight text-center px-1">
        {label}
      </span>
    </button>
  );
}

function ChoiceWide({ emoji, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap min-h-14 rounded-2xl border-2 px-3 py-2 flex items-center gap-2 text-left transition-colors ${
        active
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-card border-gray-200 text-text'
      }`}
    >
      <span className="text-xl shrink-0" aria-hidden>
        {emoji}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}

function ThankYou({ onClose }) {
  return (
    <div className="text-center space-y-4 py-2">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-emerald-600" />
      </div>
      <div>
        <p className="text-sm text-textMuted leading-relaxed">
          Obrigado por avaliar! Suas respostas ajudam a gente a melhorar o app
          pras próximas versões.
        </p>
      </div>
      <Button onClick={onClose}>Fechar</Button>
    </div>
  );
}
