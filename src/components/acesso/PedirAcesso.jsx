import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { pedirAcessoPeloTelefone } from '../../services/pedidosDeAcessoService';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';

/**
 * "QUAL O SEU WHATSAPP?" — a entrada de quem chega sem o link (02/10/2026).
 *
 * O número que ela digita gera um PEDIDO para o motorista de cada criança
 * cadastrada com ele, e nada mais: quem libera é o motorista, que conhece a
 * família (`functions/lib/pedidosDeAcesso.js`). Sem criança com o número, a
 * conta nasce mesmo assim, e o app pede para ela chamar o motorista.
 *
 * Usado no `/first-access` (sessão sem conta) e no "Corrigir meu número" do
 * card de espera.
 */
export default function PedirAcesso({ aoConcluir }) {
  const { user, refreshProfile } = useAuth();
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!isValidPhone(telefone)) {
      setErro('WhatsApp com DDD.');
      return;
    }
    setEnviando(true);
    try {
      await pedirAcessoPeloTelefone({
        telefone: unmaskPhone(telefone),
        nome: user?.displayName || '',
      });
      await refreshProfile();
      aoConcluir?.();
    } catch (err) {
      toast.error(err.message || 'Não deu pra continuar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <h2 className="text-xl font-extrabold text-text">Qual o seu WhatsApp?</h2>
      <p className="mt-1 text-sm text-textMuted">O número que o motorista tem.</p>
      <div className="mt-4">
        <Input
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => {
            setTelefone(maskPhone(e.target.value));
            setErro('');
          }}
          error={erro}
          autoComplete="tel"
          required
        />
      </div>
      <div className="mt-5">
        <Button type="submit" loading={enviando}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
