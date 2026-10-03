import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { inviteUrl } from '../../dominio/identidade/inviteUrl';

/**
 * Compartilhamento do convite pelo tio.
 *
 * O caminho é o LINK, e só ele: o responsável abre e a conta se cria na hora.
 * O código saiu da tela em 02/10/2026 (decisão do dono: o acesso do
 * responsável é por link) — ele vive dentro da URL e só ali. O QR serve pro
 * presencial — o tio mostra a tela e o pai aponta a câmera, e é o mesmo link.
 *
 * Props:
 *   - code: string (ex: 'TN4582')
 *   - childName: string — usado na mensagem do WhatsApp
 *   - parentPhone: string opcional (só dígitos) — abre a conversa certa
 */
/**
 * `jaEntrou` MUDA A CONVERSA, NÃO O LINK.
 *
 * O mesmo endereço serve para as duas coisas, e é isso que o torna simples: se
 * a conta ainda não existe, `/convite/CÓDIGO` a cria; se já existe e é dela,
 * `Invite.jsx` reconhece (`preview.status === 'yours'`) e ABRE O APP DIRETO NA
 * CRIANÇA CERTA. Um link, dois destinos, decididos pelo servidor.
 *
 * O que não pode ser o mesmo é o TEXTO. Mandar "crie sua conta" para quem já
 * tem conta faz a pessoa achar que perdeu o acesso e ligar para perguntar.
 */
/**
 * `recolhido`: só o botão do WhatsApp fica à vista, e o link, o QR e o
 * que vier em `children` (o anexo do contrato antigo, no fim do cadastro)
 * ficam atrás de "Mais opções". É a tela de criança cadastrada: o motorista
 * quer mandar o convite e seguir para a próxima, e quatro caixas empilhadas
 * escondiam o único botão que importa ali.
 *
 * `rotulo` troca o texto do botão principal.
 */
export default function InviteShare({
  code,
  childName,
  parentPhone,
  jaEntrou = false,
  recolhido = false,
  rotulo,
  children,
}) {
  const [copied, setCopied] = useState(null); // 'link' | null
  const [maisOpcoes, setMaisOpcoes] = useState(!recolhido);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const url = inviteUrl(code);
  const firstName = String(childName || '').trim().split(/\s+/)[0] || '';

  useEffect(() => {
    if (!showQr || qrDataUrl) return;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => toast.error('Não foi possível gerar o QR.'));
  }, [showQr, qrDataUrl, url]);

  const copy = async (value, kind) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard falha em contexto não-seguro (http) e em alguns webviews
      toast.error('Não deu pra copiar. Toque e segure pra selecionar.');
    }
  };

  /**
   * ⚠️ A MENSAGEM LEVA SÓ O LINK (02/10/2026). O acesso do responsável é
   * pelo link e por nada mais — decisão do dono. Ela levava também o código
   * escrito, com a instrução "dá pra digitar ele no app, em Criar conta ›
   * Sou família": esse campo saiu do app em 09/09/2026, então a frase
   * mandava a pessoa procurar onde não há. Perdeu o link? Pede outro ao
   * motorista, que reenvia daqui mesmo (a ficha da criança tem o botão).
   * O código continua existindo DENTRO do link (`/convite/CÓDIGO`).
   */
  const waText = encodeURIComponent(
    jaEntrou
      ? `Oi! Aqui é do transporte escolar${firstName ? ` do/da ${firstName}` : ''}. ` +
          `Este é o link de volta pro app: ${url}` +
          `\n\nEle abre direto na página ${firstName ? `do/da ${firstName}` : 'da criança'}. ` +
          `Sua conta continua a mesma — é só entrar.`
      : `Oi! Aqui é do transporte escolar${firstName ? ` do/da ${firstName}` : ''}. ` +
          `Abra este link pra acompanhar a rota e as mensalidades pelo app: ${url}`
  );
  const waHref = parentPhone
    ? `https://wa.me/${parentPhone.startsWith('55') ? parentPhone : `55${parentPhone}`}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  return (
    <div className="space-y-3">
      {/* Caminho principal: mandar o link */}
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="tap w-full h-14 rounded-xl bg-[#25D366] text-white font-semibold inline-flex items-center justify-center gap-2 shadow-focus"
      >
        <WhatsAppIcon size={20} colored={false} />
        {rotulo || (jaEntrou ? 'Mandar o link no WhatsApp' : 'Mandar convite no WhatsApp')}
      </a>

      {!maisOpcoes && (
        <button
          type="button"
          onClick={() => setMaisOpcoes(true)}
          className="tap w-full py-1.5 text-xs font-semibold text-textMuted hover:text-text"
        >
          Mais opções: copiar o link, QR{children ? ', contrato antigo' : ''}
        </button>
      )}

      {maisOpcoes && (
      <>

      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted flex items-center gap-1.5">
          <Link2 size={12} />
          {jaEntrou ? 'link de acesso' : 'link do convite'}
        </p>
        <p className="text-xs text-text break-all font-mono leading-relaxed">
          {url}
        </p>
        <Button
          size="sm"
          variant="secondary"
          icon={copied === 'link' ? Check : Copy}
          onClick={() => copy(url, 'link')}
        >
          {copied === 'link' ? 'Link copiado!' : 'Copiar link'}
        </Button>
      </div>

      {/* Presencial */}
      {!showQr ? (
        <Button variant="ghost" size="md" icon={QrCode} onClick={() => setShowQr(true)}>
          Mostrar QR pra ele apontar a câmera
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR do convite ${code}`}
              className="w-44 h-44 rounded-lg"
            />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-neutro animate-pulse" />
          )}
          <p className="text-xs text-textMuted text-center">
            Peça pro responsável abrir a câmera do celular e apontar aqui.
          </p>
        </div>
      )}
      {children}
      </>
      )}
    </div>
  );
}
