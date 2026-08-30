import { useState } from 'react';
import { X, Send, CheckCircle2, LifeBuoy } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { SUPPORT_CATEGORIES, openSupportTicket } from '../../services/supportService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Sheet "Abrir chamado" — usuário escolhe uma categoria (chips) e
 * escreve uma descrição. Envia pro admin que recebe em supportTickets.
 *
 * Layout segue mesmo padrão do FeedbackSheet pra evitar bater na barra
 * do navegador: safe-area top + header sticky + conteúdo scrollável.
 */
export default function SupportSheet({ open, onClose, uid, role }) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const current = SUPPORT_CATEGORIES.find((c) => c.value === category);

  const resetAndClose = () => {
    setCategory(null);
    setDescription('');
    setSubmitted(false);
    onClose();
  };

  const onSubmit = async () => {
    if (!category) {
      toast.error('Escolhe um assunto primeiro.');
      return;
    }
    if (!description.trim()) {
      toast.error('Conta um pouco do que tá acontecendo.');
      return;
    }
    setSubmitting(true);
    try {
      await openSupportTicket({ uid, role, category, description });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra abrir o chamado. Tenta de novo.');
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
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="shrink-0 bg-card rounded-t-3xl border-b border-gray-100">
          <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}
        >
            <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
          </div>
          <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text leading-tight inline-flex items-center gap-2">
                <LifeBuoy size={18} className="text-primary" />
                {submitted ? 'Chamado aberto!' : 'Abrir chamado'}
              </h2>
              {!submitted && (
                <p className="text-xs text-textMuted mt-0.5">
                  A gente lê e te responde por aqui ou pelo seu email.
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
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {submitted ? (
            <Success onClose={resetAndClose} />
          ) : (
            <div className="space-y-5">
              {/* Categorias — chips clicáveis (single select) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-textMuted mb-2">
                  Qual o assunto?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORT_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setCategory(c.value);
                        setDescription('');
                      }}
                      className={`tap h-10 px-3.5 rounded-full text-sm font-semibold border transition-colors ${
                        category === c.value
                          ? 'bg-primary text-white border-primary'
                          : 'bg-card text-text border-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição — só aparece após escolher categoria */}
              {category && (
                <div>
                  <label className="block text-sm font-semibold text-text mb-2">
                    Me conta o que tá acontecendo
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder={current?.placeholder || ''}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted leading-relaxed"
                  />
                  <p className="text-[11px] text-textMuted mt-1.5">
                    Quanto mais detalhe, mais rápido a gente resolve.
                  </p>
                </div>
              )}

              <Button
                onClick={onSubmit}
                icon={Send}
                loading={submitting}
                disabled={!category || !description.trim()}
              >
                Enviar chamado
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Success({ onClose }) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-emerald-600" />
      </div>
      <div>
        <p className="text-sm text-textMuted leading-relaxed">
          Recebemos seu chamado! Vamos olhar com cuidado e te responder em
          breve. Se precisar adicionar mais alguma coisa, é só abrir um novo
          chamado.
        </p>
      </div>
      <Button onClick={onClose}>Fechar</Button>
    </div>
  );
}
