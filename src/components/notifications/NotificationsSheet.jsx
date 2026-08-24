import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import NotificationsBody from './NotificationsBody';

/**
 * O sino, como FOLHA.
 *
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO DA PÁGINA
 * A primeira versão exportava esta folha de dentro de `pages/Notifications`.
 * Compilava — e era uma dependência circular: o `Header` importava a folha da
 * página, e a página importava o `Header` de volta. Empacotador resolve isso
 * na sorte da ordem de avaliação, e o sintoma quando não resolve é um
 * componente `undefined` em produção, não um erro de build.
 *
 * A quebra é simples e vale a pasta nova:
 *
 *   NotificationsBody   o conteúdo. Não conhece casca nenhuma.
 *   NotificationsSheet  esta folha  → Header abre por aqui
 *   pages/Notifications a página    → push e link direto caem por lá
 *
 * Ninguém importa ninguém de volta.
 */
export default function NotificationsSheet({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Notificações"
      subtitle="O que aconteceu desde a última vez que você abriu."
      icon={Bell}
      size="tall"
    >
      {/* Fecha ANTES de trocar de rota: senão a folha fica por cima da tela
        * de destino e o toque parece não ter funcionado. */}
      <NotificationsBody
        onNavigate={(to) => {
          onClose();
          navigate(to);
        }}
      />
    </AppSheet>
  );
}
