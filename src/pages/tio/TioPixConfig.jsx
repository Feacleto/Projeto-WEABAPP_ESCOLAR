import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
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
        {/* A MESMA frase do subtítulo da folha (PixSheet): as duas portas
          * são o mesmo formulário (PixForm), e uma explicação diferente em
          * cada uma faria parecer que são duas chaves. */}
        <p className="text-base leading-relaxed text-textBody">
          É a chave que os pais copiam com um toque pra pagar a mensalidade.
        </p>
        <PixForm onDone={() => navigate(-1)} />
      </div>
    </>
  );
}
