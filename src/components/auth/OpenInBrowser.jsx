import { useState } from 'react';
import { ExternalLink, Copy, Check, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import {
  openInExternalBrowser,
  externalBrowserLabel,
  inAppBrowserName,
  isIOS,
} from '../../utils/browserEnv';

/**
 * Ponte da webview pro navegador de verdade.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * O responsável toca no link dentro da conversa do WhatsApp, e o WhatsApp
 * abre num navegador embutido. Ali duas coisas quebram:
 *
 *   - Login com Google é recusado pelo Google (disallowed_useragent).
 *   - O armazenamento é separado do Chrome/Safari, então a sessão criada ali
 *     fica presa: ele abre o navegador de verdade depois e está deslogado.
 *
 * Por isso a ponte aparece ANTES do login, não depois. Logar dentro da
 * webview cria justamente a sessão órfã que a gente quer evitar.
 *
 * TRÊS SAÍDAS, NENHUM BECO
 *   1. Android: `intent://` abre o Chrome direto. Confiável.
 *   2. iOS: `googlechrome://` funciona se o Chrome estiver instalado. Se não
 *      acontecer nada em 1,2s, mostramos o passo a passo do menu do app.
 *   3. Sempre: copiar o link, que resolve em qualquer situação.
 */
export default function OpenInBrowser({ onContinueHere }) {
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [trying, setTrying] = useState(false);

  const browser = externalBrowserLabel();
  const appName = inAppBrowserName();

  const tryOpen = () => {
    setTrying(true);
    const result = openInExternalBrowser();

    if (result === 'launched') {
      // Android: se a navegação acontecer, esta tela nem fica visível.
      setTimeout(() => setTrying(false), 1500);
      return;
    }

    // iOS ou falha: se ainda estamos aqui, o esquema não pegou.
    setTimeout(() => {
      setTrying(false);
      setShowManual(true);
    }, 1200);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copiado! Cole na barra do navegador.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não deu pra copiar. Toque e segure na barra de endereço.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
        <p className="text-sm font-bold text-amber-900">
          Abra no {browser} pra continuar
        </p>
        <p className="text-xs text-amber-800 leading-relaxed">
          {appName
            ? `Você está no navegador do ${appName}. Aqui o acesso não fica salvo — você teria que entrar de novo a cada vez.`
            : 'Neste navegador o acesso não fica salvo — você teria que entrar de novo a cada vez.'}
        </p>
      </div>

      <Button icon={ExternalLink} loading={trying} onClick={tryOpen}>
        Abrir no {browser}
      </Button>

      {showManual && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-text flex items-center gap-1.5">
            <MoreHorizontal size={14} />
            {isIOS()
              ? `Toque nos três pontinhos aqui na tela e escolha "Abrir no ${browser}"`
              : `Toque no menu do ${appName || 'app'} e escolha "Abrir no navegador"`}
          </p>
          <p className="text-xs text-textMuted">Ou copie o link e cole no {browser}:</p>
          <Button
            size="sm"
            variant="secondary"
            icon={copied ? Check : Copy}
            onClick={copy}
          >
            {copied ? 'Link copiado!' : 'Copiar link'}
          </Button>
        </div>
      )}

      {/* Nunca prender: quem não quer trocar de app segue por aqui. O aviso
        * é honesto sobre o custo em vez de esconder a opção. */}
      <button
        type="button"
        onClick={onContinueHere}
        className="tap w-full text-xs text-textMuted underline py-2"
      >
        Continuar aqui mesmo (vou entrar de novo depois)
      </button>
    </div>
  );
}
