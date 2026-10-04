import { useState } from 'react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import CampoDeValor from '../common/CampoDeValor';
import { useAuth } from '../../hooks/useAuth';
import { anotarGuardado } from '../../services/configFinanceiroService';

/**
 * "QUANTO TEM GUARDADO HOJE?" — a folha que anota o valor de uma das duas
 * caixinhas da reserva da perua (03/10/2026, maquete aprovada, tela 5).
 *
 * ⚠️ O APP NÃO GUARDA DINHEIRO, E ESTA FOLHA SÓ ANOTA. O dinheiro está no
 * banco dele; o número aqui é o que ELE lê no app do banco e digita. Por isso
 * a anotação SUBSTITUI a anterior em vez de somar: somar faria o app virar a
 * conta, e a conta de verdade é a do banco. A dica embaixo do campo diz
 * exatamente isso, com o gesto ("abra o app do seu banco").
 *
 * O campo vem preenchido com o último valor anotado: quem só quer conferir
 * toca em Salvar e a data da anotação anda.
 *
 * Props: open, onClose, caixa ('troca' | 'manutencao'), valorAtual (number | null)
 */

const NOME_DA_CAIXA = {
  troca: 'Para trocar a perua',
  manutencao: 'Para manutenção',
};

export default function AnotarGuardadoSheet({ open, onClose, caixa, valorAtual = null }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Quanto tem guardado hoje?"
      subtitle={NOME_DA_CAIXA[caixa] || ''}
    >
      {/* O corpo só monta aberto: cada abertura começa do valor anotado. */}
      {open && <Corpo caixa={caixa} valorAtual={valorAtual} onClose={onClose} />}
    </Sheet>
  );
}

function Corpo({ caixa, valorAtual, onClose }) {
  const { user } = useAuth();
  const [valor, setValor] = useState(
    Number.isFinite(valorAtual) ? valorAtual.toFixed(2) : ''
  );
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    // O CampoDeValor não deixa digitar zero (zero à esquerda some), então
    // "digite zero" seria uma instrução impossível: o zero tem botão próprio.
    if (valor === '') {
      setErro('Digite o valor. Se não tem nada guardado, toque em "Não tenho nada guardado".');
      return;
    }
    setSalvando(true);
    try {
      await anotarGuardado(user?.uid, caixa, valor);
      toast.success('Anotação salva.');
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <CampoDeValor
        label="Valor na sua reserva do banco"
        value={valor}
        onChange={(v) => {
          setErro('');
          setValor(v);
        }}
        error={erro}
        hint="Abra o app do seu banco e digite o mesmo valor que aparece lá."
        autoFocus
      />
      <button
        type="button"
        onClick={() => {
          setErro('');
          setValor('0.00');
        }}
        className="tap -mt-2 flex min-h-12 items-center px-1 text-base font-bold text-primary underline"
      >
        Não tenho nada guardado
      </button>
      <SheetCTA onClick={salvar} loading={salvando}>
        Salvar anotação
      </SheetCTA>
    </div>
  );
}
