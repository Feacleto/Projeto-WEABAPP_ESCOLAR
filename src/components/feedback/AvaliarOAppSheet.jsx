import { MessageSquare } from 'lucide-react';
import Sheet from '../common/Sheet';
import CartaoDeAvaliacao from './CartaoDeAvaliacao';
import { enviarAvaliacaoRapida } from '../../services/feedbackService';
import { MOMENTO, perguntaDaAvaliacao } from '../../dominio/suporte/avaliacaoRapida.js';

/**
 * "AVALIAR O APP", NO PERFIL — a mesma pergunta do Início, quando a pessoa
 * quer (03/10/2026). Substituiu a folha longa, que prometia publicar o
 * depoimento numa home que não existe mais. Nada daqui é público: só o dono lê.
 */
export default function AvaliarOAppSheet({ open, onClose, uid, role }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Avaliar o app"
      subtitle="Só a equipe do Alô Buzinou lê."
      icon={MessageSquare}
    >
      <CartaoDeAvaliacao
        semMoldura
        pergunta={perguntaDaAvaliacao({})}
        onEnviar={({ nota, comentario }) =>
          enviarAvaliacaoRapida({ uid, role, nota, comentario, momento: MOMENTO.PERFIL })
        }
      />
    </Sheet>
  );
}
