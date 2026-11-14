import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import BuscaDeRua from '../endereco/BuscaDeRua';
import { montarEndereco } from '../../compartilhado/formatters';
import { procurarPontoDaCasa } from '../../services/listaDaTurmaService';
import { ROTULOS, NUMERO_PELA_FAMILIA } from '../../marca/textosDaLista.js';
import { RotuloDoCampo, CLASSE_DO_CAMPO } from './CamposDaLinha';

/**
 * A RUA E O NÚMERO NA LINHA DA LISTA (RC2) — pela busca do nome da rua (o CEP
 * vem junto) e o número num campo próprio, com "Não sei o número".
 *
 * O que ele quase nunca sabe de cabeça é o NÚMERO. "Não sei o número" grava a
 * rua com `numeroPendente` e as partes dela (`enderecoPartes`), como o
 * cadastro completo: a família completa no primeiro acesso dela, e o ponto
 * fica no meio da rua até lá.
 *
 * A rua só vai ao banco quando ASSENTA — com o número, ou com o "não sei". A
 * rua sem número e sem a marca seria o pino na quadra errada que a tela chama
 * de casa (ver "o endereço tem um modo de falhar" no CLAUDE.md).
 *
 * O ponto no mapa é UMA consulta, depois de gravar (`procurarPontoDaCasa`).
 */
export default function CampoDaRua({ crianca, estado, salvar, onTentar }) {
  const idNumero = useId();
  const pendente = crianca.numeroPendente === true && crianca.enderecoPartes?.logradouro;
  const temRua = String(crianca.address || '').trim() !== '';
  const [trocando, setTrocando] = useState(!temRua);
  // A rua escolhida na busca, ainda sem número; ou as partes de quem já está
  // com o número pendente.
  const [partes, setPartes] = useState(null);
  const [numero, setNumero] = useState('');
  const partesAtuais = partes || (pendente ? crianca.enderecoPartes : null);

  const gravarComNumero = async () => {
    const n = numero.trim();
    if (!partesAtuais || !n) return;
    const endereco = montarEndereco({ ...partesAtuais, numero: n });
    const ok = await salvar('rua', {
      address: endereco,
      ...(partesAtuais.cep ? { cep: partesAtuais.cep } : {}),
      numeroPendente: false,
      enderecoPartes: null,
      lat: null,
      lng: null,
    });
    if (!ok) return;
    setPartes(null);
    setNumero('');
    setTrocando(false);
    procurarPontoDaCasa(crianca, endereco, { ...partesAtuais, numero: n });
  };

  const gravarSemNumero = async () => {
    if (!partesAtuais) return;
    const endereco = montarEndereco({ ...partesAtuais });
    const ok = await salvar('rua', {
      address: endereco,
      ...(partesAtuais.cep ? { cep: partesAtuais.cep } : {}),
      numeroPendente: true,
      enderecoPartes: {
        logradouro: partesAtuais.logradouro || '',
        bairro: partesAtuais.bairro || '',
        localidade: partesAtuais.localidade || '',
        uf: partesAtuais.uf || '',
      },
      lat: null,
      lng: null,
    });
    if (!ok) return;
    setPartes(null);
    setTrocando(false);
    procurarPontoDaCasa(crianca, endereco, { ...partesAtuais });
  };

  const escolherRua = (s) =>
    setPartes({ cep: s.cep, logradouro: s.logradouro, bairro: s.bairro, localidade: s.localidade, uf: s.uf });

  return (
    <div className="space-y-2">
      <RotuloDoCampo rotulo={ROTULOS.rua} estado={estado} onTentar={onTentar} />
      {temRua && !trocando && !partes && (
        <div className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2">
          <p className="min-w-0 flex-1 text-base text-text">{crianca.address}</p>
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="tap min-h-11 shrink-0 px-2 text-base font-semibold text-primary"
          >
            {ROTULOS.trocarRua}
          </button>
        </div>
      )}
      {(trocando || !temRua) && !partes && <BuscaDeRua onEscolher={escolherRua} />}
      {partesAtuais && (
        <div>
          <label htmlFor={idNumero} className="mb-1.5 block text-base font-semibold text-text">
            {ROTULOS.numeroDaCasa}
          </label>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <input
              id={idNumero}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={numero}
              onChange={(e) => setNumero(e.target.value.slice(0, 12))}
              onBlur={gravarComNumero}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              enterKeyHint="done"
              placeholder="Digite aqui"
              className={CLASSE_DO_CAMPO}
            />
            <button
              type="button"
              aria-pressed={!!pendente && !partes}
              onClick={gravarSemNumero}
              className={`tap inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-base font-semibold ${
                pendente && !partes ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
              }`}
            >
              {pendente && !partes && <Check size={18} aria-hidden="true" />}
              {ROTULOS.naoSeiONumero}
            </button>
          </div>
          {pendente && <p className="mt-1 text-sm text-textMuted">{NUMERO_PELA_FAMILIA.texto}</p>}
        </div>
      )}
    </div>
  );
}
