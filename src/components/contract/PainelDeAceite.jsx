import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { aceitarContrato } from '../../services/contratosDaFamiliaService';
import { notifyContractAccepted } from '../../services/notificationsService';

/**
 * O ACEITE: nome completo, a caixa marcada e o botão.
 *
 * Usado no primeiro contrato (o portão que bloqueia o app) e no aditivo (a
 * tela do contrato, sem bloquear nada). Quem grava é o SERVIDOR
 * (`aceitarContrato`): o aceite e o hash não nascem no celular de ninguém.
 *
 * ⚠️ DUAS METADES DESDE 03/10/2026. O nome e a caixa moram NO FLUXO, logo
 * depois da última cláusula; no rodapé fixo ficam só "Assinar contrato" e
 * "Não concordo". O painel fixo inteiro ocupava ~250 px de uma tela de 640 —
 * o contrato era lido por uma fresta. E a caixa no fim do texto é também o
 * lugar honesto dela: "li e aceito" marcado depois de chegar ao fim.
 *
 * ⚠️ O BOTÃO NUNCA FICA APAGADO. Ele era `disabled` enquanto faltava nome ou
 * caixa, e as mensagens que explicavam o que faltava nunca rodavam: ela
 * tocava e nada acontecia. Agora o toque sem o requisito escreve o que falta
 * AO LADO do campo, rola até ele e põe o foco nele. A validação é a mesma —
 * nada é enviado sem nome e sobrenome e sem a caixa marcada.
 */
export default function PainelDeAceite({ child, contrato, adminUid, onNaoConcordo }) {
  const { profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.name || '');
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // O que faltou no último toque: 'nome' | 'caixa' | null.
  const [falta, setFalta] = useState(null);
  const campoNome = useRef(null);
  const caixa = useRef(null);

  const nomeValido = nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  // ⚠️ PARA A FAMÍLIA NÃO EXISTE "MUDANÇA" (decisão do dono, 03/10/2026):
  // ela recebe um contrato novo e ASSINA, igual ao primeiro. Sem "aceito a
  // mudança" — o aditivo é coisa do motorista, que é quem decidiu mudar.
  const novo = contrato?.tipo === 'aditivo';

  // Leva os olhos E o foco ao que falta: o campo está no fim do contrato, e
  // quem tocou no rodapé pode estar lá no meio do texto.
  const mostrar = (ref) => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  const aceitar = async () => {
    if (!nomeValido) {
      setFalta('nome');
      mostrar(campoNome);
      return;
    }
    if (!marcado) {
      setFalta('caixa');
      mostrar(caixa);
      return;
    }
    setFalta(null);
    setEnviando(true);
    try {
      await aceitarContrato({ childId: child.id, numero: contrato.numero, nome: nome.trim() });
      notifyContractAccepted({ adminUid, parentName: nome.trim(), childName: child.name });
      await refreshProfile?.();
      toast.success(novo ? 'Contrato assinado.' : 'Contrato assinado. Bem-vindo(a)!');
    } catch (err) {
      console.error('Falha ao aceitar contrato:', err);
      toast.error(
        err?.code === 'functions/failed-precondition'
          ? err.message
          : 'Não foi possível registrar o aceite. Tente de novo.'
      );
    } finally {
      setEnviando(false);
    }
  };

  const erroNome = falta === 'nome' && !nomeValido;
  const erroCaixa = falta === 'caixa' && !marcado;

  return (
    <>
      {/* NO FLUXO: depois da última cláusula, antes do botão fixo. */}
      <section className="mx-5 mb-5 space-y-4 rounded-2xl border border-border bg-card p-4 print:hidden">
        <div>
          <label htmlFor="aceite-nome" className="block text-base font-semibold text-text">
            Seu nome completo
          </label>
          <input
            ref={campoNome}
            id="aceite-nome"
            type="text"
            placeholder="Digite aqui"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={erroNome || undefined}
            aria-describedby={erroNome ? 'aceite-nome-erro' : undefined}
            className={`mt-1.5 h-12 w-full rounded-xl border-2 px-4 text-base text-text focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              erroNome ? 'border-dangerText' : 'border-border focus:border-primary'
            }`}
            autoComplete="name"
            disabled={enviando}
          />
          {erroNome && (
            <p id="aceite-nome-erro" role="alert" className="mt-1.5 text-sm font-semibold text-dangerText">
              Escreva seu nome e sobrenome.
            </p>
          )}
        </div>

        <div>
          <label
            className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl p-2 text-base text-text ${
              erroCaixa ? 'ring-2 ring-dangerText' : ''
            }`}
          >
            <input
              ref={caixa}
              type="checkbox"
              checked={marcado}
              onChange={(e) => setMarcado(e.target.checked)}
              disabled={enviando}
              aria-invalid={erroCaixa || undefined}
              aria-describedby={erroCaixa ? 'aceite-caixa-erro' : undefined}
              className="mt-0.5 h-6 w-6 shrink-0 rounded accent-primary"
            />
            <span className="leading-snug">
              Li e aceito todas as cláusulas deste contrato de transporte escolar.
            </span>
          </label>
          {erroCaixa && (
            <p id="aceite-caixa-erro" role="alert" className="mt-1.5 text-sm font-semibold text-dangerText">
              Marque a caixa acima para assinar.
            </p>
          )}
        </div>
      </section>

      {/* PORTAL PARA O <body>: dentro da tela, o painel ficava preso na camada
        * do conteúdo, e a barra de abas (que mora fora) cobria o botão de
        * aceitar — z-index não atravessa camadas (teste R2b). */}
      {createPortal(
        <div
          // z-50: ACIMA do aviso de cookies (z-40). Por baixo dele, o botão
          // "Aceitar contrato" sumia e a mãe não tinha como entrar (teste R1).
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-mobile space-y-1 border-t border-border bg-card px-4 pt-3 shadow-rest print:hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 0.5rem)' }}
        >
          <Button icon={CheckCircle2} loading={enviando} onClick={aceitar}>
            Assinar contrato
          </Button>
          <button
            type="button"
            onClick={onNaoConcordo}
            disabled={enviando}
            className="tap min-h-12 w-full text-base font-semibold text-textMuted hover:text-text disabled:opacity-50"
          >
            Não concordo
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
