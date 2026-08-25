import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import PixForm from '../../components/payments/PixForm';

/**
 * A PÁGINA da chave PIX — a casca de quem chega de link direto ou favorito.
 *
 * Dentro do app, os três pontos que pedem a chave abrem a FOLHA
 * (components/payments/PixSheet): eles são interrupções de outra tarefa, e
 * interrupção que troca de tela cobra o dobro pra voltar.
 *
 * A rota continua existindo pra quem chega de fora — e porque `/tio/pix` é
 * um endereço que já circulou em conversa de suporte.
 */
export default function TioPixConfig() {
  const navigate = useNavigate();
  return (
    <>
      <Header title="Chave PIX" showBack backLabel="Financeiro" backTo="/tio/finance" />
      <div className="p-4 space-y-4">
        <Card>
          <p className="text-sm leading-relaxed text-textMuted">
            Cadastre a chave PIX que os pais vão usar pra pagar a mensalidade.
            Eles vão ver essa chave no app e copiar com um toque.
          </p>
        </Card>
        <PixForm onDone={() => navigate(-1)} />
      </div>
    </>
  );
}
