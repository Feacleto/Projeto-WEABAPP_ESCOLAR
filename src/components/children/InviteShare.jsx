import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Link2, RefreshCw, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { inviteUrl } from '../../dominio/identidade/inviteUrl';
import { doDa } from '../../compartilhado/formatters';
import { FileSignature } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { dadosDaContratadaFaltando } from '../../services/contractService';
import DadosDoContratoForm from '../contract/DadosDoContratoForm';
import { marcarConviteEnviado } from '../../services/fatosDoNivelService';
import { useChild } from '../../hooks/useChild';
import { useContratos } from '../../hooks/useContratos';
import { useGarantirContrato } from '../../hooks/useGarantirContrato';
import { gerarLinkNovo } from '../../services/inviteCodeService';
import { conviteValidoAteMs, conviteVencido } from '../../dominio/identidade/validadeDoConvite';

function diaMes(ms) {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * O PRAZO DO LINK E O "GERAR LINK NOVO" (03/10/2026, decisão do dono).
 *
 * O convite ainda não usado vale 15 dias (`validadeDoConvite.js`). Sem dizer
 * isso na tela, o motorista descobriria pela mãe ligando — "o link não abre".
 * Gerar link novo troca o CÓDIGO: o link antigo para de abrir na hora, e é
 * isso que se quer quando ele foi parar no WhatsApp de quem não devia.
 */
function ValidadeDoLink({ crianca, onNovo }) {
  const [gerando, setGerando] = useState(false);
  // A hora de quando a tela abriu basta: o prazo é em dias.
  const [agora] = useState(() => Date.now());
  const ate = conviteValidoAteMs(crianca);
  const vencido = conviteVencido(crianca, agora);

  const gerar = async () => {
    setGerando(true);
    try {
      const codigo = await gerarLinkNovo(crianca.id);
      onNovo(codigo);
      toast.success('Link novo pronto. O anterior não abre mais.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra gerar o link novo.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div
      className={`space-y-3 rounded-xl border p-3 ${
        vencido ? 'border-warningBorder bg-warningSoft' : 'border-border bg-card'
      }`}
    >
      {ate != null && (
        <p className="flex items-center gap-2 text-base font-semibold text-text">
          <CalendarClock size={18} className="shrink-0 text-textMuted" />
          {vencido ? `Este link venceu em ${diaMes(ate)}` : `Este link vale até ${diaMes(ate)}`}
        </p>
      )}
      {vencido && (
        <p className="text-sm text-textBody">
          Gere um link novo antes de mandar. O antigo não abre mais.
        </p>
      )}
      <Button
        variant={vencido ? 'primary' : 'secondary'}
        icon={RefreshCw}
        loading={gerando}
        onClick={gerar}
      >
        Gerar link novo
      </Button>
    </div>
  );
}

/**
 * O CONTRATO NASCE ANTES DE O CONVITE SAIR (02/10/2026). Quem abre o convite
 * cai no aceite do contrato — então ele precisa estar emitido e gravado.
 * Componente à parte porque os hooks só rodam quando há criança e dados.
 */
function GarantirContrato({ childId }) {
  const { child } = useChild(childId);
  const { contratos } = useContratos(child);
  useGarantirContrato(child, contratos);
  return null;
}

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
 *
 * `crianca` (a ficha passa o documento ao vivo) liga o prazo do link e o
 * "Gerar link novo"; sem ela, o componente lê a criança por `childId`.
 */
export default function InviteShare({
  code,
  childId = null,
  childName,
  gender = null,
  parentPhone,
  jaEntrou = false,
  recolhido = false,
  rotulo,
  crianca = null,
  onEnviado,
  children,
}) {
  // "ENVIADO ✓" (04/10/2026, aprovado pelo dono) — só no fim do cadastro
  // (`recolhido`). Depois do toque o botão vira contorno e diz que foi: o
  // destaque passa para o próximo gesto da tela. É ESTADO, sem animação, e
  // continua sendo o mesmo link — tocar de novo reenvia.
  const [enviado, setEnviado] = useState(false);
  const mostrarEnviado = recolhido && enviado;
  const [copied, setCopied] = useState(null); // 'link' | null
  const [maisOpcoes, setMaisOpcoes] = useState(!recolhido);
  // O QR guarda o link de que foi feito: depois de "Gerar link novo", o
  // desenho antigo apontaria para o link que morreu.
  const [qr, setQr] = useState({ url: null, data: null });
  const [showQr, setShowQr] = useState(false);
  // O código que acabou de ser gerado aqui. A ficha (`crianca`, ao vivo)
  // recebe o novo sozinha; o fim do cadastro guarda o código em estado local,
  // e sem isto continuaria mostrando o link que acabou de morrer.
  const [codigoNovo, setCodigoNovo] = useState(null);

  // O prazo precisa da criança: a ficha a passa pronta (`crianca`); o fim do
  // cadastro só tem o id, e aí ela é lida aqui.
  const { child: lida } = useChild(crianca || jaEntrou ? null : childId);
  const criancaDoConvite = crianca || lida;

  const { profile } = useAuth();
  const faltaContrato = dadosDaContratadaFaltando(profile).length > 0;
  // A criança ao vivo é a verdade; o código gerado aqui cobre o instante
  // antes de a escuta trazê-lo.
  const codigoAtual = criancaDoConvite?.inviteCode || codigoNovo || code;
  const url = inviteUrl(codigoAtual);
  const firstName = String(childName || '').trim().split(/\s+/)[0] || '';

  const qrDataUrl = qr.url === url ? qr.data : null;

  useEffect(() => {
    if (!showQr || qrDataUrl) return;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      // O QR não lê classe do Tailwind: a lib pede hex literal. É o valor do
      // token `text` (#0B1210) — se ele mudar no tailwind.config.js, muda aqui.
      color: { dark: '#0B1210', light: '#FFFFFF' },
    })
      .then((data) => setQr({ url, data }))
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
      ? `Oi! Aqui é do transporte escolar${firstName ? ` ${doDa(firstName, gender)}` : ''}. ` +
          `Este é o link de volta pro app: ${url}` +
          `\n\nEle abre direto na página ${firstName ? doDa(firstName, gender) : 'da criança'}. ` +
          `Sua conta continua a mesma — é só entrar.`
      : `Oi! Aqui é do transporte escolar${firstName ? ` ${doDa(firstName, gender)}` : ''}. ` +
          `Abra este link pra acompanhar a rota e as mensalidades pelo app: ${url}`
  );
  const waHref = parentPhone
    ? `https://wa.me/${parentPhone.startsWith('55') ? parentPhone : `55${parentPhone}`}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  // ⚠️ O CONVITE SÓ SAI COM OS DADOS DO CONTRATO (02/10/2026, decisão do
  // dono). Sem nome, CPF/CNPJ e endereço do motorista o contrato não é gerado,
  // e a família entraria sem nada para assinar. A trava mora AQUI porque todo
  // caminho de mandar convite passa por este componente (fim do cadastro e
  // ficha da criança). Reenviar a quem já entrou (`jaEntrou`) não trava: ali o
  // assunto é o link de volta, não o contrato.
  if (!jaEntrou && faltaContrato) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-left">
        <p className="flex items-center gap-2 text-base font-bold text-text">
          <FileSignature size={18} className="shrink-0 text-primary" />
          Antes do convite: seus dados para o contrato
        </p>
        <p className="text-sm leading-relaxed text-textMuted">
          A família recebe o contrato para assinar junto com o convite. Ele
          precisa do seu nome, CPF ou CNPJ e endereço — é uma vez só.
        </p>
        <DadosDoContratoForm textoDoBotao="Salvar e liberar o convite" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {childId && !jaEntrou && <GarantirContrato childId={childId} />}
      {/* Caminho principal: mandar o link */}
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        // O "Mandar" da lista do fim do cadastro toca neste mesmo link.
        data-convite-whatsapp
        // O GESTO DELE conta para o nível (docs/niveis.md): mandou o convite.
        // Sem `await` — o link abre na hora, e a marca não pode segurá-lo.
        onClick={() => {
          const id = childId || crianca?.id;
          if (id && !jaEntrou) marcarConviteEnviado(id).catch(() => {});
          setEnviado(true);
          onEnviado?.();
        }}
        // TEXTO ESCURO SOBRE O VERDE DO WHATSAPP: o branco dava 1,98:1
        // (o mínimo é 4,5). `min-h` em vez de `h` e ícone que não encolhe —
        // com rótulo longo o texto quebrava e cortava o balão na borda.
        className={`tap w-full min-h-14 rounded-xl px-4 py-3 font-bold leading-tight text-center inline-flex items-center justify-center gap-2 ${
          mostrarEnviado
            ? 'border-2 border-border bg-card text-text'
            : 'bg-whatsapp text-onAccent shadow-focus'
        }`}
      >
        {mostrarEnviado ? (
          'Enviado ✓'
        ) : (
          <>
            <span className="inline-flex shrink-0"><WhatsAppIcon size={20} colored={false} /></span>
            {rotulo || (jaEntrou ? 'Mandar o link no WhatsApp' : 'Mandar convite no WhatsApp')}
          </>
        )}
      </a>

      {/* Só no convite ainda não usado: para quem já entrou, o link é a
        * porta de volta ao app e trocá-lo a deixaria do lado de fora. */}
      {!jaEntrou && maisOpcoes && criancaDoConvite?.id && (
        <ValidadeDoLink crianca={criancaDoConvite} onNovo={setCodigoNovo} />
      )}

      {!maisOpcoes && (
        <button
          type="button"
          onClick={() => setMaisOpcoes(true)}
          className="tap w-full min-h-12 py-2 text-base font-semibold text-primary"
        >
          Mais opções: copiar o link, QR{children ? ', contrato antigo' : ''}
        </button>
      )}

      {maisOpcoes && (
      <>

      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <p className="rotulo flex items-center gap-1.5">
          <Link2 size={12} />
          {jaEntrou ? 'link de acesso' : 'link do convite'}
        </p>
        <p className="text-sm text-text break-all font-mono leading-relaxed">
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
              alt="QR do convite"
              className="w-44 h-44 rounded-lg"
            />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-neutro animate-pulse" />
          )}
          <p className="text-sm text-textMuted text-center">
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
