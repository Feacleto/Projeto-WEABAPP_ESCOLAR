import { useState } from 'react';
import {
  X,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  BellOff,
  Wallet,
  PencilLine,
  MessageCircle,
} from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import {
  SUPPORT_CATEGORIES,
  openSupportTicket,
  aparelhoEmPalavras,
} from '../../services/supportService';
import { mensagemDoChamado } from '../../dominio/suporte/chamados.js';
import { devWhatsAppLink } from '../../config/developer';
import { APP_VERSION } from '../../version';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * "Falar com o Alô Buzinou" — dois passos, e a pessoa não precisa digitar.
 *
 * Era um formulário (chips de assunto + texto obrigatório + "Enviar chamado")
 * que respondia "por aqui ou pelo seu email" sem dizer onde. Para o público
 * de ~40 anos isso era duas decisões e uma redação antes de qualquer ajuda.
 * Agora: toca no problema → lê a mensagem pronta → abre o WhatsApp.
 *
 * ⚠️ A MENSAGEM APARECE INTEIRA ANTES DE ENVIAR — ninguém manda texto que não
 * leu (mesma regra do pedido ao motorista).
 *
 * ⚠️ O CHAMADO CONTINUA SENDO GRAVADO em `supportTickets`, no mesmo toque,
 * para a aba Chamados do dono. Mas o WhatsApp abre PRIMEIRO e a gravação não
 * é esperada: o navegador só deixa abrir outra aba dentro do gesto, e um
 * `await` antes disso faria o link ser bloqueado — a pessoa tocaria e nada
 * aconteceria.
 */
const ICONES = {
  cant_login: Lock,
  map_issue: MapPin,
  notification_issue: BellOff,
  payment_issue: Wallet,
  wrong_data: PencilLine,
  other: MessageCircle,
};

export default function SupportSheet({ open, onClose, uid, role, profile, email }) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const [category, setCategory] = useState(null);
  const [detalhe, setDetalhe] = useState('');

  if (!open) return null;

  const assunto = SUPPORT_CATEGORIES.find((c) => c.value === category);
  const assuntos = SUPPORT_CATEGORIES.filter((c) => c.naTela !== false);

  const mensagem = assunto
    ? mensagemDoChamado({
        frase: assunto.frase,
        nome: profile?.name,
        papel: role,
        marca: profile?.marcaNome,
        email: email || profile?.email,
        aparelho: aparelhoEmPalavras(),
        versao: APP_VERSION,
        detalhe,
      })
    : '';

  const fechar = () => {
    setCategory(null);
    setDetalhe('');
    onClose();
  };

  const aoMandar = () => {
    // Não espera: o link já está abrindo pelo `href`. Falhar aqui só tira o
    // chamado da aba do dono — a conversa no WhatsApp acontece igual.
    if (uid) {
      openSupportTicket({ uid, role, category, description: mensagem }).catch((err) =>
        console.error('[suporte] chamado não gravou:', err)
      );
    }
    fechar();
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={fechar}
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-card rounded-t-3xl border-b border-neutro">
          <div {...alcaProps} className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}>
            <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
          </div>
          <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {assunto ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategory(null);
                    setDetalhe('');
                  }}
                  className="tap -ml-1 inline-flex items-center gap-1 text-base font-semibold text-primary"
                >
                  <ChevronLeft size={20} />
                  Voltar
                </button>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-text leading-tight inline-flex items-center gap-2">
                    <LifeBuoy size={20} className="text-primary" />
                    Falar com o Alô Buzinou
                  </h2>
                  <p className="text-base text-textMuted mt-1">
                    Toque no que está acontecendo.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={fechar}
              className="tap w-10 h-10 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!assunto ? (
            <ul className="space-y-2.5">
              {assuntos.map((c) => {
                const Icone = ICONES[c.value] || MessageCircle;
                return (
                  <li key={c.value}>
                    <button
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className="tap w-full min-h-[60px] px-4 rounded-2xl border border-border bg-card flex items-center gap-3 text-left"
                    >
                      <span className="w-10 h-10 rounded-full bg-primaryChip flex items-center justify-center shrink-0">
                        <Icone size={20} className="text-primary" />
                      </span>
                      <span className="flex-1 text-base font-semibold text-text">{c.label}</span>
                      <ChevronRight size={20} className="text-textMuted shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-base text-text mb-2">
                  Esta mensagem vai para o WhatsApp do Alô Buzinou:
                </p>
                <div className="rounded-2xl bg-neutro p-4 text-base text-text whitespace-pre-line leading-relaxed">
                  {mensagem}
                </div>
              </div>

              <div>
                <label htmlFor="suporte-detalhe" className="block text-base font-semibold text-text mb-2">
                  {assunto.value === 'other' ? 'Conte o que aconteceu' : 'Quer contar mais? (opcional)'}
                </label>
                <textarea
                  id="suporte-detalhe"
                  value={detalhe}
                  onChange={(e) => setDetalhe(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-2xl border-2 border-border bg-card text-text text-base p-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed"
                />
              </div>

              <a
                href={devWhatsAppLink(mensagem)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={aoMandar}
                className="tap w-full h-14 rounded-2xl bg-primary text-white text-lg font-bold flex items-center justify-center gap-2"
              >
                <WhatsAppIcon size={22} />
                Mandar no WhatsApp
              </a>
              <p className="text-sm text-textMuted text-center">
                A conversa continua no WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
