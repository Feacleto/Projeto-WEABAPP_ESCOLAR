import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import NotificationsBody from '../components/notifications/NotificationsBody';

/**
 * A PÁGINA de notificações — a casca de quem chega DE FORA.
 *
 * Dentro do app o sino abre uma folha (components/notifications/
 * NotificationsSheet): assim o motorista não perde a rolagem e o filtro da
 * tela em que estava só pra dar uma olhada.
 *
 * Mas a rota tinha que continuar viva. Notificação pushada abre
 * `/tio/notifications` direto, sem nenhuma tela por baixo — e uma folha
 * flutuando sobre o nada não é uma tela, é um erro de desenho. Quem chega
 * assim recebe página de verdade, com cabeçalho e seta de voltar.
 *
 * As duas cascas montam o MESMO corpo. Uma lista só, dois lugares.
 */
export default function Notifications() {
  const navigate = useNavigate();
  return (
    <>
      <Header title="Notificações" showBack />
      <div className="p-4">
        <NotificationsBody onNavigate={(to) => navigate(to)} />
      </div>
    </>
  );
}
