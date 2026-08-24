import { Key } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import PixForm from './PixForm';

/**
 * A chave PIX, como folha.
 *
 * Os três caminhos que levam aqui — o perfil, o banner do financeiro e o
 * bloco de pendências — são todos interrupções de outra tarefa. O motorista
 * está conferindo o mês, vê "cadastre sua chave", resolve, e quer voltar
 * pro mês. Como página, voltar era um gesto a mais e a tela recarregava
 * do zero.
 */
export default function PixSheet({ open, onClose }) {
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Chave PIX"
      subtitle="É a chave que os pais copiam com um toque pra pagar a mensalidade."
      icon={Key}
    >
      <PixForm onDone={onClose} />
    </AppSheet>
  );
}
