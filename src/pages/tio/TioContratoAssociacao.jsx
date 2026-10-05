import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Printer, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card';
import Header from '../../components/layout/Header';
import ConviteParaIndicar from '../../components/tio/ConviteParaIndicar';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ContratoDoc from '../../components/admin/ContratoDoc';
import { useAuth } from '../../hooks/useAuth';
import {
  contratoVigente,
  aceitarContrato,
} from '../../services/contratoAssociacaoService';
import {
  CAMINHO_DA_VOLTA,
  contratoFechaAssinatura,
  lerVolta,
} from '../../components/transferencia/voltaAoAceite';

/**
 * O CONTRATO COM A PLATAFORMA, DO LADO DO MOTORISTA.
 *
 * Espelha o que o responsável já vive com o contrato de transporte: ele lê o
 * documento inteiro, digita o próprio nome e aceita. Mesmo padrão, mesma
 * prova — data, nome digitado, hash do conteúdo e dispositivo.
 *
 * POR QUE DIGITAR O NOME EM VEZ DE SÓ MARCAR UMA CAIXA
 * Caixa marcada é um clique que a mão dá sozinha. Digitar o próprio nome
 * exige parar, e é o gesto que a pessoa reconhece depois como "eu assinei
 * isso". Numa discordância sobre o que foi combinado, é a diferença entre
 * "cliquei sem ver" e um nome escrito por ele.
 *
 * O ACEITE NÃO BLOQUEIA O APP
 * De propósito. Contrato pendente é assunto comercial, e travar a operação de
 * quem transporta criança por causa de papel é desproporcional — a mesma
 * razão pela qual vencimento de vigência também não suspende ninguém.
 *
 * A VOLTA À FAMÍLIA PARA RECEBER (F2.4): quem chegou aqui vindo de "Aceito
 * receber" (o pedido no state ou no sessionStorage, `voltaAoAceite.js`)
 * volta à Comunidade com o pedido aberto assim que o contrato é aceito — é o
 * aceite que fecha a assinatura. Se o contrato que vale já está aceito para
 * o mesmo plano, ele volta na hora, sem assinar nada de novo.
 */
/**
 * O CABEÇALHO É O `Header` DE TODA TELA INTERNA, mesmo fora do `TioLayout`
 * (esta rota fica fora do `GuardaDaConta`: quem está bloqueado contrata para
 * desbloquear). O "Voltar" próprio, cinza e pequeno, era um dos quatro estilos
 * de voltar do app. O `Header` consome a história quando ela existe e cai em
 * "Meu plano" quando não existe — a área a que este contrato pertence. Sem
 * sino e sem rosto: a escuta do sino mora no `TioLayout`, e fora dele o sino
 * diria "nenhum aviso" a quem tem.
 */
function Cabecalho() {
  return (
    <Header
      title="Contrato de assinatura"
      showBack
      backLabel="Meu plano"
      backTo="/tio/taxa"
      showGlobal={false}
    />
  );
}

export default function TioContratoAssociacao() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [contrato, setContrato] = useState(undefined); // undefined = carregando
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    contratoVigente(user.uid)
      .then(setContrato)
      .catch((err) => {
        console.error('Contrato de assinatura não carregou:', err);
        setContrato(null);
      });
  }, [user?.uid]);

  // Já fechada (contratou antes, contrato aceito para este plano): volta
  // direto. Só quem ACABOU de vir dos planos com o pedido (state), para um
  // sessionStorage esquecido não desviar uma visita qualquer a esta tela.
  const pedidoNoState = location.state?.voltarAoPedido || null;
  useEffect(() => {
    if (pedidoNoState && contratoFechaAssinatura(contrato, profile?.plano)) {
      navigate(CAMINHO_DA_VOLTA, { replace: true, state: { pedidoAberto: pedidoNoState } });
    }
  }, [pedidoNoState, contrato, profile?.plano, navigate]);

  const aceitar = async () => {
    const digitado = nome.trim();
    if (digitado.length < 3) {
      toast.error('Escreva seu nome completo para aceitar.');
      return;
    }
    setEnviando(true);
    try {
      await aceitarContrato({
        id: contrato.id,
        nome: digitado,
        conteudo: contrato.conteudo,
      });
      const pedido = lerVolta(location.state);
      if (pedido) {
        toast.success('Contrato aceito.');
        navigate(CAMINHO_DA_VOLTA, { replace: true, state: { pedidoAberto: pedido } });
        return;
      }
      toast.success('Contrato aceito. Uma cópia fica sempre aqui.');
      const atualizado = await contratoVigente(user.uid);
      setContrato(atualizado);
    } catch (err) {
      console.error('Falha ao aceitar contrato:', err);
      toast.error('Não deu pra registrar o aceite. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  if (contrato === undefined) {
    return (
      <div className="min-h-screen bg-bg">
        <Cabecalho />
        <div className="px-5 pt-5">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="mt-4 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-10">
      <Cabecalho />

      <div className="mx-auto max-w-lg px-5 pt-4">
        <p className="mb-3 text-base leading-relaxed text-textMuted print:hidden">
          O que foi combinado entre você e o Alô Buzinou.
        </p>
        {!contrato ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum contrato emitido ainda"
            description="Quando você escolher um plano, o contrato da assinatura aparece aqui para você ler e aceitar."
          />
        ) : (
          <>
            <Card className="print:border-0 print:shadow-none">
              <ContratoDoc dados={contrato.conteudo} aceite={contrato} />
            </Card>

            <div className="mt-3 flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="tap inline-flex min-h-12 items-center gap-2 px-1 text-base font-semibold text-primary"
              >
                <Printer size={18} aria-hidden="true" /> Salvar em PDF
              </button>
            </div>

            {!contrato.aceitoEm && (
              <Card className="mt-4 print:hidden">
                <p className="text-base font-bold text-text">
                  Para aceitar, escreva seu nome
                </p>
                <p className="mt-1 text-sm leading-relaxed text-textMuted">
                  Registramos a data, o aparelho e uma verificação do texto
                  acima — é o que prova, depois, que o combinado foi este.
                </p>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite aqui"
                  autoComplete="name"
                  aria-label="Seu nome completo"
                  className="mt-3 h-12 w-full rounded-xl border border-borderStrong bg-surface px-3 text-base text-text"
                />
                {/* A AÇÃO DA TELA, e por isso cheia: era `secondary`, com o
                  * mesmo peso do "Salvar em PDF". */}
                <Button
                  onClick={aceitar}
                  loading={enviando}
                  icon={Check}
                  className="mt-3"
                >
                  Aceitar contrato
                </Button>
              </Card>
            )}

            {/* ⚠️ O INSTANTE DE MAIOR BOA-VONTADE DO FUNIL INTEIRO, e o produto
              * não fazia nada com ele.
              *
              * Ele acabou de decidir pagar. É também a PRIMEIRA vez que a
              * indicação vale dinheiro de verdade para ele: durante o teste a
              * fatura é isenta, e 5% de uma fatura isenta é zero — por isso
              * `ConviteParaIndicar` fala no futuro enquanto não há plano, e só
              * aqui passa a falar em reais.
              *
              * Não é uma segunda oferta: o preço dele não muda por causa
              * disto, e o convite não aparece porque ele recusou nada. */}
            {contrato.aceitoEm && (
              <ConviteParaIndicar
                className="mt-4 print:hidden"
                titulo="Pronto. E dá para pagar menos que isso"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
