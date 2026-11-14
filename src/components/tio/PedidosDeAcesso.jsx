import { useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { responderPedidoDeAcesso } from '../../services/pedidosDeAcessoService';
import { gerarLinkNovo } from '../../services/inviteCodeService';
import { useAuth } from '../../hooks/useAuth';
import { formatPhone } from '../../compartilhado/formatters';
import { inviteUrl } from '../../dominio/identidade/inviteUrl';
import { linkDoZap } from '../../dominio/identidade/auxiliar';
import { conviteVencido } from '../../dominio/identidade/validadeDoConvite';
import { mensagemDoConvite } from '../../marca/mensagensDoLink.js';

/**
 * PEDIDOS DE ACESSO — um responsável sem o link pediu para entrar
 * (02/10/2026).
 *
 * Alguém informou um WhatsApp, e ele bate com o de uma criança DELE ainda sem
 * responsável.
 *
 * ⚠️ O MOTORISTA NÃO APROVA MAIS — ELE MANDA O LINK (14/11/2026, decisão 28).
 * O cartão mostrava "{nome} quer acompanhar {filho}", o número e "Aprovar".
 * O nome é o que a conta ESCOLHEU e o número é o que ELE digitou: quem
 * conhecia o WhatsApp da mãe (um ex-companheiro) pedia com o nome dela, o
 * motorista via tudo batendo e aprovava — e a conta passava a ver endereço e
 * a perua ao vivo. Agora o botão abre o WhatsApp no número que o MOTORISTA
 * cadastrou, com o link do convite: entra quem tem aquele WhatsApp na mão,
 * pelo link, como toda família. A conta que pediu nunca é vinculada por
 * este cartão (o servidor só fecha o pedido — `reguaDoPedidoDeAcesso.js`).
 *
 * Por isso o cartão não mostra o nome de quem pediu: ele não decide mais
 * nada, e só serviria para convencer.
 *
 * Desde 03/10/2026 ele mora DENTRO do "Para resolver" do Início, e recebe a
 * lista pronta por prop: assinar os pedidos duas vezes seria leitura
 * duplicada do mesmo dado.
 *
 * "Descartar" fecha o pedido e avisa a pessoa; não liga nada.
 *
 * Props: `pedidos` (os em aberto) e `criancas` (a turma: nome, WhatsApp
 * cadastrado e o convite).
 */
export default function PedidosDeAcesso({ pedidos = [], criancas = [] }) {
  const { profile } = useAuth();
  const [respondendo, setRespondendo] = useState(null);
  const [gerando, setGerando] = useState(null);
  // A hora da montagem basta: o prazo do convite é de dias, e quem gera um
  // link novo faz a criança chegar de novo pela escuta.
  const [agora] = useState(() => Date.now());
  if (!pedidos.length) return null;

  const criancaDe = (p) => criancas.find((c) => c.id === p.childId) || null;
  const primeiro = (n) => String(n || '').trim().split(/\s+/)[0];

  const fechar = async (pedido, acao) => {
    setRespondendo(pedido.id);
    try {
      await responderPedidoDeAcesso(pedido.id, acao);
      if (acao === 'descartar') toast.success('Pedido descartado.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra responder agora.');
    } finally {
      setRespondendo(null);
    }
  };

  const linkNovo = async (crianca) => {
    setGerando(crianca.id);
    try {
      await gerarLinkNovo(crianca.id);
    } catch (err) {
      toast.error(err.message || 'Não deu pra gerar o link agora.');
    } finally {
      setGerando(null);
    }
  };

  return (
    <>
      {pedidos.map((p) => {
        const crianca = criancaDe(p);
        const filho = primeiro(crianca?.name) || 'uma criança';
        // O número que ELE cadastrou na ficha — nunca o do pedido, que pode
        // ter vindo do que a conta digitou.
        // A MESMA conta do `linkDoZap`: "55" na frente (12 ou 13 dígitos) é
        // o número com o país, e vale.
        const cadastrado = String(crianca?.parentPhone || '')
          .replace(/\D/g, '')
          .replace(/^55(?=\d{10,11}$)/, '');
        const numeroValido = cadastrado.length === 10 || cadastrado.length === 11;
        const vencido = crianca ? conviteVencido(crianca, agora) : false;
        // O `redeemInvite` só aceita convite `pending`: com outro estado, o
        // link sairia e seria recusado na mão da família.
        const familiaJaEntrou = Boolean(crianca?.parentUid);
        const conviteUsado = Boolean(crianca) && !familiaJaEntrou && crianca.inviteStatus !== 'pending';
        const semResponsavel = Boolean(crianca) && !familiaJaEntrou && !conviteUsado;
        const podeMandar = semResponsavel && Boolean(crianca.inviteCode) && numeroValido && !vencido;
        const waHref = podeMandar
          ? linkDoZap(
              cadastrado,
              mensagemDoConvite({
                marca: profile?.marcaNome,
                nomeCrianca: filho,
                generoCrianca: crianca.gender,
                url: inviteUrl(crianca.inviteCode),
              })
            )
          : null;
        const podeGerar = semResponsavel && numeroValido && vencido;
        return (
          <div key={p.id} className="rounded-2xl bg-card p-4 shadow-rest">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                <KeyRound size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text">Pedido de acesso a {filho}</p>
                <p className="mt-0.5 text-base leading-snug text-textBody">
                  O link vai para o WhatsApp que você cadastrou. Só entra quem
                  abrir por ele.
                </p>
                {familiaJaEntrou && (
                  <p className="mt-0.5 text-sm text-textMuted">
                    A família de {filho} já entrou no app. Pode descartar este pedido.
                  </p>
                )}
                {conviteUsado && (
                  <p className="mt-0.5 text-sm text-textMuted">
                    O convite de {filho} já foi usado. Fale com a família antes de mandar outro.
                  </p>
                )}
                {!familiaJaEntrou && !conviteUsado && (numeroValido ? (
                  <p className="mt-0.5 text-sm text-textMuted">{formatPhone(cadastrado)}</p>
                ) : (
                  <p className="mt-0.5 text-sm text-textMuted">
                    O WhatsApp da ficha está incompleto. Corrija na ficha de {filho}.
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={respondendo === p.id}
                onClick={() => fechar(p, 'descartar')}
                className="tap h-12 flex-1 rounded-xl border-2 border-border bg-card text-base font-bold text-text disabled:opacity-60"
              >
                Descartar
              </button>
              {waHref && (
                // Link, não botão: o WhatsApp abre no mesmo toque (o navegador
                // bloqueia janela aberta depois de um `await`). O pedido fecha
                // em seguida, sem esperar.
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fechar(p, 'enviar_link')}
                  className="tap flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-marca px-2 text-center text-base font-bold leading-tight text-naMarca"
                >
                  <WhatsAppIcon size={18} />
                  Mandar o link ao WhatsApp cadastrado
                </a>
              )}
              {!waHref && podeGerar && (
                <button
                  type="button"
                  disabled={gerando === crianca.id}
                  onClick={() => linkNovo(crianca)}
                  className="tap flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca disabled:opacity-60"
                >
                  <RefreshCw size={18} />
                  O link venceu: gerar outro
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
