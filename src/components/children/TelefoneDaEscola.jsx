import { useState } from 'react';
import { Phone, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
import { maskPhone, unmaskPhone } from '../../compartilhado/masks';
import { formatPhone } from '../../compartilhado/formatters';
import {
  definirTelefoneDaEscola,
  informarTelefoneDaEscola,
} from '../../services/escolasService';

/**
 * O TELEFONE DA ESCOLA NA FICHA DA CRIANÇA (03/10/2026, pedido do dono).
 *
 * Opcional, e qualquer um dos dois lados cadastra: o motorista (que grava na
 * escola e copia para as crianças dele) ou a família (pela function, que
 * confere que a criança é dela). Quem cadastra mostra para os outros — o
 * número lido aqui é a cópia em `children.schoolPhone`, a mesma para todas as
 * crianças daquela escola na turma dele.
 *
 * ⚠️ A família só preenche quando ainda NÃO há número (03/10/2026): uma
 * família corrigindo trocava o telefone que todas as outras veem. Se já
 * houver, o servidor não grava e responde `jaTinha`.
 */
export default function TelefoneDaEscola({ child, isAdmin }) {
  const [editando, setEditando] = useState(false);
  const [numero, setNumero] = useState(maskPhone(child?.schoolPhone || ''));
  const [salvando, setSalvando] = useState(false);

  // Sem escola cadastrada (só o nome digitado, criança antiga) não há onde
  // guardar o número.
  if (!child?.schoolId) return null;

  const salvar = async () => {
    const digitos = unmaskPhone(numero);
    if (digitos.length < 10) {
      toast.error('Telefone com DDD.');
      return;
    }
    setSalvando(true);
    try {
      if (isAdmin) {
        await definirTelefoneDaEscola(child.schoolId, digitos);
      } else {
        const r = await informarTelefoneDaEscola({ childId: child.id, telefone: digitos });
        if (r?.jaTinha) {
          toast('A escola já tem telefone cadastrado pelo motorista.');
          setEditando(false);
          return;
        }
      }
      toast.success('Telefone da escola salvo.');
      setEditando(false);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  if (editando) {
    return (
      <div className="space-y-2">
        <Input
          label="Telefone da escola"
          icon={Phone}
          inputMode="tel"
          maxLength={15}
          value={numero}
          onChange={(e) => setNumero(maskPhone(e.target.value))}
          hint="Fica visível para o motorista e as famílias desta escola."
        />
        <div className="flex gap-2">
          <Button size="sm" loading={salvando} onClick={salvar}>
            Salvar
          </Button>
          <Button size="sm" variant="secondary" disabled={salvando} onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!child.schoolPhone) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="tap flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 text-left text-sm font-semibold text-primary"
      >
        <Phone size={16} />
        Informar o telefone da escola
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`tel:${child.schoolPhone}`}
        className="tap flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-text"
      >
        <Phone size={16} className="text-primary" />
        Ligar para a escola
        <span className="ml-auto font-normal text-textMuted">{formatPhone(child.schoolPhone)}</span>
      </a>
      {/* A família só PREENCHE o vazio; corrigir um número já gravado é do
          motorista — senão uma família trocava o telefone que todas as outras
          daquela escola veem (o servidor recusa do mesmo jeito). */}
      {isAdmin && (
      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label="Corrigir o telefone da escola"
        className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-textMuted"
      >
        <Pencil size={15} />
      </button>
      )}
    </div>
  );
}
