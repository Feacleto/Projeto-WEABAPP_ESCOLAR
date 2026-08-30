import { useEffect, useState } from 'react';
import { Share, Plus, X, Smartphone } from 'lucide-react';
import Button from './Button';
import { isIOS, isStandalone, isInAppBrowser } from '../../utils/browserEnv';

const DISMISS_KEY = 'ab_install_prompt_v1';

// Não pede na primeira visita: quem acabou de entrar ainda não sabe se vai
// usar. Na segunda vez ele já tem motivo.
const MIN_VISITS = 2;
const VISITS_KEY = 'ab_visits_v1';

function readInt(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // modo privado / quota — o convite simplesmente não aparece
  }
}

/**
 * Convite pra instalar o app na tela de início.
 *
 * POR QUE ISTO IMPORTA MAIS DO QUE PARECE
 * O responsável chega pelo link que o tio mandou no WhatsApp. Se nada mudar,
 * aquele link continua sendo o ÚNICO caminho dele pro app — pra sempre. Ele
 * não guarda o endereço do site, não pede link novo, e cada volta depende de
 * achar a conversa certa e rolar até a mensagem.
 *
 * Um ícone na tela de início resolve isso de uma vez: vira o caminho curto e
 * independente. É a diferença entre um app que ele abre e um app que ele
 * reencontra.
 *
 * Dois ambientes, dois caminhos:
 *   - Android/Chrome dispara `beforeinstallprompt` e a instalação é um toque.
 *   - iOS não tem esse evento. Só resta instruir: Compartilhar → Adicionar à
 *     Tela de Início. Instrução ruim é melhor que nenhuma.
 */
export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    // Já instalado, ou dentro da webview do WhatsApp (onde instalar não é nem
    // possível): não há o que oferecer.
    if (isStandalone() || isInAppBrowser()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }

    const visits = readInt(VISITS_KEY) + 1;
    write(VISITS_KEY, visits);
    if (visits < MIN_VISITS) return;

    if (isIOS()) {
      // Ler localStorage e decidir se aparece é sincronização com sistema
      // externo — o caso legítimo de setState em effect. No iOS não há
      // `beforeinstallprompt` pra usar como callback, então é aqui mesmo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    const onPrompt = (e) => {
      // Impede o banner nativo do Chrome pra oferecer no nosso tempo, junto
      // do contexto ("veja a mensalidade sem procurar o link").
      e.preventDefault();
      setDeferredEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    write(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferredEvent) {
      setShowIOSHelp(true);
      return;
    }
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    write(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 z-40 px-4 max-w-mobile mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/15 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Smartphone size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text leading-tight">
              Coloque na tela do celular
            </p>
            <p className="text-xs text-textMuted mt-0.5 leading-snug">
              Fica um ícone junto dos seus apps. Você não precisa mais procurar
              o link no WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Agora não"
            className="tap w-8 h-8 rounded-lg text-textMuted flex items-center justify-center shrink-0"
          >
            <X size={17} />
          </button>
        </div>

        {showIOSHelp ? (
          <ol className="text-xs text-text bg-sunken border border-border rounded-xl p-3 space-y-1.5">
            <li className="flex items-center gap-1.5">
              <Share size={13} className="text-primary shrink-0" />
              Toque no botão de compartilhar, aqui embaixo
            </li>
            <li className="flex items-center gap-1.5">
              <Plus size={13} className="text-primary shrink-0" />
              Escolha “Adicionar à Tela de Início”
            </li>
          </ol>
        ) : (
          <Button size="md" onClick={install}>
            {isIOS() ? 'Como faço?' : 'Adicionar agora'}
          </Button>
        )}
      </div>
    </div>
  );
}
