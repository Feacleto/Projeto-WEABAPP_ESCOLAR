import { useState } from 'react';
import { User, FileText, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile } from '../../services/profileService';
import { maskCpfCnpj, documentoValido } from '../../compartilhado/masks';

/**
 * OS DADOS DO MOTORISTA PARA O CONTRATO COM O RESPONSÁVEL — um formulário só,
 * usado no perfil e no convite (02/10/2026).
 *
 * O contrato não nasce sem a parte contratada (`dadosDaContratadaFaltando` em
 * contractService), e o dono decidiu que esses dados são OBRIGATÓRIOS antes de
 * mandar o convite: senão a família entra sem nada para assinar, ou o contrato
 * sai com dado errado. Por isso o documento é CONFERIDO (dígitos de CPF/CNPJ),
 * não só preenchido.
 *
 * O que ele já disse não é pedido de novo do zero: o nome vem do primeiro
 * acesso e o endereço começa com a cidade dele. Ele só confere e completa.
 *
 * Os campos gravados continuam os de sempre (`companyName`,
 * `companyDocument`, `companyAddress`) — o contrato e as rules já os leem.
 */
export default function DadosDoContratoForm({ onSalvo, textoDoBotao = 'Salvar' }) {
  const { user, profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.companyName || profile?.name || '');
  const [doc, setDoc] = useState(maskCpfCnpj(profile?.companyDocument || ''));
  const [endereco, setEndereco] = useState(
    profile?.companyAddress || (profile?.city ? `${profile.city}${profile?.uf ? `/${profile.uf}` : ''}` : '')
  );
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const validar = () => {
    const e = {};
    if (nome.trim().split(/\s+/).length < 2) e.nome = 'Escreva o nome completo (ou o da empresa).';
    if (!documentoValido(doc)) e.doc = 'CPF ou CNPJ inválido — confira os números.';
    if (endereco.trim().length < 8) e.endereco = 'Escreva rua, número e cidade.';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    setSalvando(true);
    try {
      await updateProfile(user.uid, {
        companyName: nome.trim(),
        companyDocument: doc.trim(),
        companyAddress: endereco.trim(),
      });
      await refreshProfile();
      toast.success('Dados do contrato salvos.');
      onSalvo?.();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-3" noValidate>
      <Input
        label="Seu nome completo (ou o da empresa)"
        icon={User}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={erros.nome}
        autoComplete="name"
      />
      <Input
        label="CPF ou CNPJ"
        icon={FileText}
        inputMode="numeric"
        placeholder="Digite aqui"
        value={doc}
        onChange={(e) => setDoc(maskCpfCnpj(e.target.value))}
        error={erros.doc}
      />
      <Input
        label="Seu endereço"
        icon={MapPin}
        placeholder="Digite aqui"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
        error={erros.endereco}
        hint="Vai no contrato como o endereço de quem presta o transporte."
        autoComplete="street-address"
      />
      <Button type="submit" icon={Save} loading={salvando}>
        {textoDoBotao}
      </Button>
    </form>
  );
}
