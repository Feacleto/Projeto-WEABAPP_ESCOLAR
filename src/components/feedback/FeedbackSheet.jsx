import { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  Star,
  Map,
  UserX,
  DollarSign,
  Users,
  Phone,
  MapPin,
  UserCheck,
  Bell,
  Target,
  ZoomIn,
  Lightbulb,
  Minimize2,
  HelpCircle,
  ThumbsUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { submitFeedback } from '../../services/feedbackService';

/**
 * Sheet de avaliação curta, coloquial, pensada pra idosos.
 *
 * 4 perguntas:
 *   1. Estrelas (1–5) — nota geral
 *   2. O que usa mais (multi-select, ícones)
 *   3. O que ajudaria mais (single, ícones)
 *   4. Escrita livre (opcional)
 *
 * Decisões UX:
 *   - Estrelas em vez de emojis (linguagem universal de avaliação)
 *   - Ícones nas opções (emojis ficaram em excesso, poluíam a leitura)
 *   - Sheet com max-h moderado (88vh) e título sticky pra não escorregar
 *     pra trás da barra do navegador
 */

const STAR_LABELS = {
  1: 'Tá ruim',
  2: 'Podia melhorar',
  3: 'Tá ok',
  4: 'Tá bom',
  5: 'Tá ótimo!',
};

const USE_OPTIONS_TIO = [
  { value: 'route', icon: Map, label: 'Fazer a rota' },
  { value: 'absences', icon: UserX, label: 'Marcar faltas' },
  { value: 'payments', icon: DollarSign, label: 'Cobrar mensalidade' },
  { value: 'children', icon: Users, label: 'Ver as crianças' },
  { value: 'call', icon: Phone, label: 'Ligar pro pai' },
  { value: 'map', icon: MapPin, label: 'Ver o mapa' },
];

const USE_OPTIONS_PAI = [
  { value: 'map', icon: MapPin, label: 'Ver onde tá a perua' },
  { value: 'absences', icon: UserX, label: 'Avisar quando vai faltar' },
  { value: 'payments', icon: DollarSign, label: 'Ver pagamento' },
  { value: 'altPickup', icon: UserCheck, label: 'Dizer quem vai buscar' },
  { value: 'notifications', icon: Bell, label: 'Receber avisos' },
];

const WISH_OPTIONS = [
  { value: 'fewer_steps', icon: Target, label: 'Menos toques pra fazer as coisas' },
  { value: 'bigger_text', icon: ZoomIn, label: 'Letras maiores' },
  { value: 'more_clear', icon: Lightbulb, label: 'Mais claro o que cada coisa faz' },
  { value: 'less_buttons', icon: Minimize2, label: 'Menos botões na tela' },
  { value: 'more_help', icon: HelpCircle, label: 'Mais ajuda dentro do app' },
  { value: 'all_good', icon: ThumbsUp, label: 'Tá bom assim' },
];

export default function FeedbackSheet({ open, onClose, uid, role, profile }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [uses, setUses] = useState([]);
  const [wish, setWish] = useState(null);
  const [comment, setComment] = useState('');
  const [allowTestimonial, setAllowTestimonial] = useState(false);
  const [allowPhoto, setAllowPhoto] = useState(false);
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
    setRating(0);
    setHovered(0);
    setUses([]);
    setWish(null);
    setComment('');
    setAllowTestimonial(false);
    setAllowPhoto(false);
    setSubmitted(false);
    onClose();
  };

  const onSubmit = async () => {
    if (rating < 1) {
      toast.error('Dá uma nota em estrelas primeiro!');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        uid,
        role,
        answers: { rating, uses, wish },
        comment,
        // Permissão pra exibir o comentário na landing como depoimento.
        // Foto só vai junto se a 2a permissão também estiver marcada.
        allowTestimonial,
        allowPhoto: allowTestimonial && allowPhoto,
        // Snapshot do nome/foto do perfil pra montar o card sem precisar
        // re-buscar o user doc depois (e sem expor uid no client público).
        authorName: profile?.name || null,
        authorPhotoURL:
          allowTestimonial && allowPhoto ? profile?.photoURL || null : null,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra enviar. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={resetAndClose}
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky — fica sempre visível mesmo com scroll */}
        <div className="shrink-0 bg-card rounded-t-3xl border-b border-gray-100">
          <div className="pt-3 pb-1 flex justify-center">
            <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
          </div>
          <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text leading-tight">
                {submitted ? 'Recebemos!' : 'Avaliar o app'}
              </h2>
              {!submitted && (
                <p className="text-xs text-textMuted mt-0.5">
                  4 perguntas rápidas — leva 1 minuto.
                </p>
              )}
            </div>
            <button
              onClick={resetAndClose}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {submitted ? (
            <ThankYou onClose={resetAndClose} />
          ) : (
            <div className="space-y-7">
              {/* P1 — Estrelas */}
              <Question
                index={1}
                title="Quantas estrelas o app merece?"
              >
                <StarRating
                  value={rating}
                  hovered={hovered}
                  onHover={setHovered}
                  onPick={setRating}
                />
              </Question>

              {/* P2 — Uso */}
              <Question
                index={2}
                title="Quais coisas você usa mais?"
                hint="Pode marcar mais de uma."
              >
                <div className="grid grid-cols-2 gap-2">
                  {useOptions.map((opt) => (
                    <ChoiceTile
                      key={opt.value}
                      icon={opt.icon}
                      label={opt.label}
                      active={uses.includes(opt.value)}
                      onClick={() => toggleUse(opt.value)}
                    />
                  ))}
                </div>
              </Question>

              {/* P3 — Wish */}
              <Question
                index={3}
                title="O que mais ajudaria você?"
                hint="Marca uma só."
              >
                <div className="grid grid-cols-2 gap-2">
                  {WISH_OPTIONS.map((opt) => (
                    <ChoiceTile
                      key={opt.value}
                      icon={opt.icon}
                      label={opt.label}
                      active={wish === opt.value}
                      onClick={() => setWish(opt.value)}
                    />
                  ))}
                </div>
              </Question>

              {/* P4 — Texto livre. Convida a pessoa a deixar um comentário
                * positivo que pode virar depoimento na nossa landing. */}
              <Question
                index={4}
                title="Quer escrever algo de bom sobre o app?"
                hint="Opcional — pode pular. Comentários positivos podem virar depoimento na nossa página."
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="O que você mais gostou? Conta com suas palavras…"
                  className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
                />
              </Question>

              {/* Permissões pra usar como depoimento na landing — só aparecem
                * se o usuário escreveu algum comentário (faz sentido). */}
              {comment.trim().length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Posso compartilhar?
                  </p>
                  <PermissionCheck
                    checked={allowTestimonial}
                    onChange={setAllowTestimonial}
                    label="Pode usar meu comentário na página do app"
                    hint="Vai aparecer com seu primeiro nome."
                  />
                  {allowTestimonial && (
                    <PermissionCheck
                      checked={allowPhoto}
                      onChange={setAllowPhoto}
                      label="Pode usar minha foto também"
                      hint="A foto que você tem no perfil aparece ao lado."
                    />
                  )}
                </div>
              )}

              <Button
                onClick={onSubmit}
                icon={Send}
                loading={submitting}
                disabled={rating < 1}
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

function Question({ index, title, hint, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-textMuted mb-1">
        Pergunta {index}
      </p>
      <h3 className="text-base font-bold text-text leading-snug">
        {title}
      </h3>
      {hint && <p className="text-xs text-textMuted mt-0.5 mb-3">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  );
}

/**
 * Estrelas 1–5 com hover preview e label ao lado. Pra mobile, sem hover, o
 * label mostra o valor selecionado. Cor preenchida = amber-400 (mais quente
 * que o primary verde — combina com o tom "avaliar"). Tap em estrela já
 * selecionada não deseleciona pra reduzir confusão.
 */
function StarRating({ value, hovered, onHover, onPick }) {
  const display = hovered || value;
  const label = display > 0 ? STAR_LABELS[display] : 'Toque numa estrela';
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= display;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
              onMouseEnter={() => onHover(n)}
              onMouseLeave={() => onHover(0)}
              onClick={() => onPick(n)}
              className="tap p-1.5"
            >
              <Star
                size={36}
                strokeWidth={1.8}
                className={
                  active
                    ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                    : 'text-gray-300'
                }
              />
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm font-semibold text-text mt-2 h-5">
        {label}
      </p>
    </div>
  );
}

function ChoiceTile({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap min-h-16 rounded-2xl border-2 px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors ${
        active
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-card border-gray-200 text-text'
      }`}
    >
      <span
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
          active ? 'bg-primary text-white' : 'bg-gray-100 text-textMuted'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}

/**
 * Checkbox grande estilo "toggle" pra permissões. Linha clicável inteira.
 */
function PermissionCheck({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full text-left tap flex items-start gap-3"
    >
      <span
        className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-primary border-primary text-white'
            : 'bg-card border-gray-300 text-transparent'
        }`}
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text leading-tight">
          {label}
        </span>
        {hint && (
          <span className="block text-xs text-textMuted mt-0.5">{hint}</span>
        )}
      </span>
    </button>
  );
}

function ThankYou({ onClose }) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-emerald-600" />
      </div>
      <div>
        <p className="text-sm text-textMuted leading-relaxed">
          Obrigado por avaliar! Suas respostas ajudam a gente a deixar o app
          cada vez melhor.
        </p>
      </div>
      <Button onClick={onClose}>Fechar</Button>
    </div>
  );
}
