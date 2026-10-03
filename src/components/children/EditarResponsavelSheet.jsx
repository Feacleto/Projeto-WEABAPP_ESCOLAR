import { useState } from 'react';
import { User, Phone, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import { updateChild } from '../../services/childrenService';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';

/**
 * CORRIGIR O NOME E O TELEFONE DO RESPONSÁVEL — só ANTES de a família entrar
 * (02/10/2026).
 *
 * Não havia como: um telefone digitado errado no cadastro mandava o convite
 * para o número errado, e o único conserto era apagar a criança e refazer.
 *
 * Depois que a família entra, os dados são DELA: o nome é o de quem assinou o
 * contrato, e o telefone é a chave que vincula os irmãos (`phoneChave`). A
 * ficha nem oferece o botão nesse caso.
 */
export default function EditarResponsavelSheet({ open, onClose, child }) {
  const [nome, setNome] = useState(child?.parentName || '');
  const [fone, setFone] = useState(maskPhone(child?.parentPhone || ''));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const e = {};
    if (!nome.trim()) e.nome = 'Escreva o nome do responsável.';
    if (!isValidPhone(fone)) e.fone = 'Telefone com DDD — é por ele que o convite vai.';
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      await updateChild(child.id, { parentName: nome.trim(), parentPhone: unmaskPhone(fone) });
      toast.success('Responsável corrigido.');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet open={open} onClose={salvando ? () => {} : onClose} title="Corrigir o responsável" icon={User}>
      <div className="space-y-4 px-5 pb-6">
        <Input label="Nome" icon={User} value={nome} onChange={(ev) => setNome(ev.target.value)} error={erros.nome} />
        <Input
          label="Telefone (WhatsApp)"
          icon={Phone}
          inputMode="tel"
          maxLength={15}
          value={fone}
          onChange={(ev) => setFone(maskPhone(ev.target.value))}
          error={erros.fone}
        />
        <Button icon={Save} loading={salvando} onClick={salvar}>
          Salvar
        </Button>
      </div>
    </AppSheet>
  );
}
