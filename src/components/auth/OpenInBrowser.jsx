import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  MoreHorizontal,
  Share,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import {
  openInExternalBrowser,
  externalBrowserLabel,
  inAppBrowserName,
  isIOS,
} from '../../compartilhado/browserEnv';

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
/**
 * O RODAPÉ DO APP DE MENSAGEM, DESENHADO.
 *
 * POR QUE UMA FRASE NÃO BASTAVA
 * A instrução era "toque nos três pontinhos aqui na tela". Três pontinhos não
 * têm nome, dividem a barra com outros ícones parecidos, e mudam de canto
 * entre versões do WhatsApp. Quem não é íntimo do celular não acha — e este é
 * o único ponto do fluxo do iPhone onde não há plano B automático.
 *
 * ⚠️ O DESENHO NÃO COPIA A INTERFACE DO WHATSAPP, de propósito. Ela muda a
 * cada versão, e uma cópia desatualizada é PIOR que nenhuma: manda procurar
 * uma coisa que não está lá, e quem não acha conclui que errou. Então ele
 * mostra a FORMA da barra e destaca os DOIS botões que levam ao navegador —
 * compartilhar e "mais". Um dos dois existe em toda versão.
 */
function RodapeDoApp() {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="flex items-center gap-3 rounded-lg bg-sunken px-3 py-2">
        <ChevronLeft size={16} className="text-textMuted shrink-0" />
        <ChevronRight size={16} className="text-textMuted shrink-0" />
        <span className="flex-1" />
        {/* O anel é o destaque — cor sozinha não bastaria, e aqui a leitura
          * precisa sobreviver a um print mandado no WhatsApp. */}
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primaryChip px-2 py-1 ring-2 ring-primary">
          <Share size={15} className="text-primary" />
          <span className="text-[11px] font-bold text-primary">ou</span>
          <MoreHorizontal size={15} className="text-primary" />
        </span>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-textMuted">
        um destes dois, no rodapé desta tela
      </p>
    </div>
  );
}

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
      <div className="bg-warningSoft border border-warningBorder rounded-xl p-3 space-y-1">
        <p className="text-sm font-bold text-warningText">
          Abra no {browser} pra continuar
        </p>
        <p className="text-xs text-warningText leading-relaxed">
          {appName
            ? `Você está no navegador do ${appName}. Aqui o acesso não fica salvo — você teria que entrar de novo a cada vez.`
            : 'Neste navegador o acesso não fica salvo — você teria que entrar de novo a cada vez.'}
        </p>
      </div>

      <Button icon={ExternalLink} loading={trying} onClick={tryOpen}>
        Abrir no {browser}
      </Button>

      {showManual && (
        <div className="bg-sunken border border-border rounded-xl p-3 space-y-2.5">
          <p className="text-xs font-semibold text-text">
            {isIOS()
              ? `Toque no botão de compartilhar ou no "..." e escolha "Abrir no ${browser}"`
              : `Toque no menu do ${appName || 'app'} e escolha "Abrir no navegador"`}
          </p>

          {/* O DESENHO SÓ NO IPHONE, e não por capricho: é lá que a instrução
            * escrita é a ÚNICA saída, porque não existe `intent://` pra abrir
            * o navegador sozinho. No Android a frase é rede de segurança de um
            * caminho que quase sempre funciona; aqui ela é o caminho. */}
          {isIOS() && <RodapeDoApp />}

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
