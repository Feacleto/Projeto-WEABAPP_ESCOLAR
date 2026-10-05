import { useState } from 'react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import Input from '../common/Input';
import ConfirmDialog from '../common/ConfirmDialog';
import { acrescentarSubstituta, editarSubstituta, tirarSubstituta } from '../../services/substitutasService';
import { maskPhone } from '../../compartilhado/masks';

/**
 * ACRESCENTAR OU EDITAR UMA SUBSTITUTA (fase 5) — só nome e WhatsApp. Ela é
 * terceiro que não usa o app: o mínimo para ele chamar, e nada mais.
 *
 * `substituta` ausente = acrescentar. Presente = editar, com "Tirar da lista"
 * (as faltas que ela já cobriu guardam o nome dela, então o controle do mês
 * não perde nada).
 */
export default function FolhaDaSubstituta({ open, onClose, substituta = null }) {
  // A folha monta de novo a cada abertura (o `key` vem de quem chama), então
  // o estado inicial já é o da substituta escolhida.
  const [nome, setNome] = useState(substituta?.nome || '');
  const [telefone, setTelefone] = useState(maskPhone(substituta?.telefone || ''));
  const [salvando, setSalvando] = useState(false);
  const [tirando, setTirando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      if (substituta) await editarSubstituta(substituta.id, { nome, telefone });
      else await acrescentarSubstituta({ nome, telefone });
      toast.success(substituta ? 'Pronto.' : 'Ela entrou na lista.');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={substituta ? 'Editar substituta' : 'Acrescentar substituta'}>
      <div className="space-y-4">
        <Input label="Nome dela" value={nome} onChange={(e) => setNome(e.target.value)} falar="nome" semSalvar />
        <Input label="WhatsApp" inputMode="tel" value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} falar="telefone" semSalvar />
        <SheetCTA onClick={salvar} loading={salvando}>{substituta ? 'Salvar' : 'Acrescentar'}</SheetCTA>
        {substituta && (
          <button
            type="button"
            onClick={() => setTirando(true)}
            className="tap min-h-12 w-full rounded-xl border-2 border-dangerBorder bg-dangerSoft text-base font-bold text-dangerText"
          >
            Tirar da lista
          </button>
        )}
      </div>

      <ConfirmDialog
        open={tirando}
        title={`Tirar ${substituta?.nome || 'ela'} da lista?`}
        description="As substituições que ela já fez continuam no controle."
        confirmLabel="Tirar da lista"
        variant="danger"
        onConfirm={async () => {
          try {
            await tirarSubstituta(substituta.id);
            toast.success('Saiu da lista.');
            setTirando(false);
            onClose?.();
          } catch (err) {
            toast.error(err?.message || 'Não deu para tirar. Tente de novo.');
            setTirando(false);
          }
        }}
        onCancel={() => setTirando(false)}
      />
    </Sheet>
  );
}
