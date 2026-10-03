import { useState } from 'react';
import { School, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import Input from '../common/Input';
import Button from '../common/Button';
import { addEscola } from '../../services/escolasService';
import { buscarCep, searchAddress } from '../../services/locationService';
import { maskCep, unmaskCep, isValidCep } from '../../compartilhado/masks';
import { montarEndereco } from '../../compartilhado/formatters';
import BuscaDeRua from '../endereco/BuscaDeRua';

/**
 * NOVA ESCOLA, SEM SAIR DO CADASTRO DA CRIANÇA (02/10/2026).
 *
 * O passo "Onde estuda" mandava para `/tio/children/escolas` quando não havia
 * escola — e o formulário da criança é `useState` local: tudo o que ele tinha
 * digitado (nome, endereço, autorização) sumia, e nada o trazia de volta.
 * Agora a escola nasce num popup por cima do cadastro e volta já escolhida.
 *
 * ── SÓ O NOME É OBRIGATÓRIO, como na tela de escolas
 * O CEP preenche a rua e, se o geocodificador achar, a coordenada vem junto,
 * calada. Se não achar, a escola nasce com `geoPending` — o mesmo caminho da
 * tela de escolas, onde dá para marcar no mapa depois. O motorista aqui está
 * cadastrando uma criança, não catalogando a cidade.
 *
 * Props: open, onClose, onCriada({ id, nome, endereco, lat, lng })
 */
export default function NovaEscolaSheet({ open, onClose, onCriada }) {
  const [nome, setNome] = useState('');
  const [cep, setCep] = useState('');
  const [partes, setPartes] = useState(null);
  const [cepState, setCepState] = useState(null); // null | 'ok' | 'notFound' | 'offline'
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const endereco = partes ? montarEndereco({ ...partes, numero, complemento: '' }) : '';

  // A rua escolhida pelo nome traz o CEP junto (ViaCEP, busca ao contrário).
  const onRuaEscolhida = (r) => {
    setPartes({ cep: r.cep, logradouro: r.logradouro, bairro: r.bairro, localidade: r.localidade, uf: r.uf });
    setCep(maskCep(r.cep));
    setCepState('ok');
  };

  const onCepChange = async (valor) => {
    const mascarado = maskCep(valor);
    setCep(mascarado);
    setPartes(null);
    setCepState(null);
    const digitos = unmaskCep(mascarado);
    if (digitos.length < 8 || !isValidCep(mascarado)) return;
    try {
      setPartes(await buscarCep(digitos));
      setCepState('ok');
    } catch (err) {
      setCepState(/consultar/.test(err?.message || '') ? 'offline' : 'notFound');
    }
  };

  const fechar = () => {
    setNome('');
    setCep('');
    setPartes(null);
    setCepState(null);
    setNumero('');
    setErro('');
    onClose();
  };

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('Diga o nome da escola.');
      return;
    }
    setSalvando(true);
    try {
      // A coordenada é tentativa, nunca trava: sem ela a escola nasce com
      // `geoPending` e o passo 3 já mostra o aviso de "sem localização".
      let lat = null;
      let lng = null;
      if (partes) {
        try {
          const r = await searchAddress(endereco, { ...partes, numero });
          lat = r.lat;
          lng = r.lng;
        } catch {
          // segue sem coordenada
        }
      }
      const dados = { nome: nome.trim(), endereco, cep: partes ? cep : '', lat, lng };
      const id = await addEscola(dados);
      onCriada({ id, ...dados, geoPending: lat == null });
      fechar();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não deu pra salvar a escola.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={open} onClose={fechar} title="Nova escola" icon={School}>
      <div className="space-y-4 pb-2">
        <Input
          label="Nome da escola"
          icon={School}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErro('');
          }}
          error={erro}
          required
        />
        {/* PELO NOME DA RUA (02/10/2026): o motorista quase nunca sabe o CEP
          * da escola. O CEP fica logo abaixo para quem tem. */}
        <BuscaDeRua onEscolher={onRuaEscolhida} />
        <Input
          label="Ou o CEP"
          icon={MapPin}
          inputMode="numeric"
          value={cep}
          onChange={(e) => onCepChange(e.target.value)}
          hint={
            cepState === 'ok'
              ? endereco
              : cepState === 'notFound'
              ? 'CEP não encontrado. Pode salvar só com o nome.'
              : cepState === 'offline'
              ? 'Sem conexão com o serviço de CEP. Pode salvar só com o nome.'
              : undefined
          }
        />
        {/* O NÚMERO DA ESCOLA É OPCIONAL, e sempre foi: prédio grande, de
          * esquina, ou num campus sem número útil. Não sabe agora? Fica em
          * branco e ele completa depois, em Crianças › Escolas. */}
        {partes && (
          <Input
            label="Número (opcional)"
            inputMode="numeric"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            hint="Não sabe agora? Deixe em branco e complete depois em Escolas."
          />
        )}
        <Button loading={salvando} onClick={salvar}>
          Salvar e usar
        </Button>
      </div>
    </Sheet>
  );
}
