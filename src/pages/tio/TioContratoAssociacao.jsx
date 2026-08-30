import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Printer, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ContratoDoc from '../../components/admin/ContratoDoc';
import { useAuth } from '../../hooks/useAuth';
import {
  contratoVigente,
  aceitarContrato,
} from '../../services/contratoAssociacaoService';

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
 */
export default function TioContratoAssociacao() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [contrato, setContrato] = useState(undefined); // undefined = carregando
  const [nome, setNome] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    contratoVigente(user.uid)
      .then(setContrato)
      .catch((err) => {
        console.error('Contrato de associação não carregou:', err);
        setContrato(null);
      });
  }, [user?.uid]);

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
      <div className="min-h-screen px-5 pt-5">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="mt-4 h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-bg px-5 pb-3 pt-4 print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap -ml-1 mb-2 inline-flex items-center gap-1 p-1 text-sm text-textMuted"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-xl font-bold text-text">Contrato com a plataforma</h1>
        <p className="text-sm text-textMuted">
          O que foi combinado entre você e o Alô Buzinou.
        </p>
      </header>

      <div className="px-5 pt-4">
        {!contrato ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum contrato emitido ainda"
            description="Quando a associação for combinada, o contrato aparece aqui para você ler e aceitar."
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
                className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-textMuted"
              >
                <Printer size={15} /> Salvar em PDF
              </button>
            </div>

            {!contrato.aceitoEm && (
              <Card className="mt-4 print:hidden">
                <p className="text-sm font-bold text-text">
                  Para aceitar, escreva seu nome
                </p>
                <p className="mt-1 text-xs leading-relaxed text-textMuted">
                  Registramos a data, o aparelho e uma verificação do texto
                  acima — é o que prova, depois, que o combinado foi este.
                </p>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={profile?.name || 'Seu nome completo'}
                  autoComplete="name"
                  className="mt-3 w-full rounded-xl border border-borderStrong bg-surface px-3 py-2.5 text-[15px] text-text"
                />
                <Button
                  onClick={aceitar}
                  loading={enviando}
                  variant="secondary"
                  className="mt-3"
                >
                  {!enviando && <Check size={18} />}
                  Aceitar contrato
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
