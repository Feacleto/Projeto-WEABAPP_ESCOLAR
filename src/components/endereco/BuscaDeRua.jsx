import { useEffect, useRef, useState } from 'react';
import { Search, Check, MapPin, Mic } from 'lucide-react';
import { useDitado } from '../../hooks/useDitado';
import { textoDitado } from '../../compartilhado/ditado.js';
import { useAuth } from '../../hooks/useAuth';
import { buscarRuas } from '../../services/locationService';
import { UFS, podeBuscarRua } from '../../compartilhado/ruas';

/**
 * "NOME DA RUA" — e o CEP vem junto (02/10/2026).
 *
 * O motorista sabe o nome da rua, quase nunca o CEP. Ele digita, a lista
 * mostra rua, bairro, cidade e CEP (ViaCEP, busca ao contrário), e um toque
 * preenche tudo. Se a busca achar UMA rua só, ela já é escolhida sozinha.
 *
 * A busca começa na cidade DELE (`profile.city` + `profile.uf`, gravados no
 * primeiro acesso pela localização), com "trocar" — escola e casa às vezes
 * ficam na cidade vizinha. Sem UF no perfil, a troca abre já pedindo a UF.
 *
 * Espera ele parar de digitar (450 ms) e só busca com 3 letras: o ViaCEP é
 * serviço gratuito de terceiro, e uma consulta por tecla seria abuso.
 *
 * Props: onEscolher({ cep, logradouro, bairro, localidade, uf, faixa })
 */
export default function BuscaDeRua({ onEscolher }) {
  const { profile } = useAuth();
  const [cidade, setCidade] = useState(profile?.city || '');
  const [uf, setUf] = useState(profile?.uf || '');
  const [trocando, setTrocando] = useState(!profile?.uf || !profile?.city);
  const [rua, setRua] = useState('');
  // O nome da rua também se fala (04/10/2026): "Rua das Flores" sai com as
  // iniciais certas (`textoDitado(…, 'nome')`), e a busca roda igual.
  const ditado = useDitado();
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [escolhida, setEscolhida] = useState(null);
  const [falhou, setFalhou] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    if (escolhida || !podeBuscarRua({ uf, cidade, rua })) return undefined;
    const meu = ++pedido.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      setFalhou(false);
      try {
        const lista = await buscarRuas({ uf, cidade, rua });
        if (meu !== pedido.current) return; // chegou uma busca mais nova
        setSugestoes(lista);
        // Uma rua só: já é ela. O motorista não precisa tocar.
        if (lista.length === 1) escolher(lista[0]);
      } catch {
        if (meu === pedido.current) setFalhou(true);
      } finally {
        if (meu === pedido.current) setBuscando(false);
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf, cidade, rua, escolhida]);

  function escolher(s) {
    setEscolhida(s);
    setSugestoes([]);
    onEscolher(s);
  }

  if (escolhida) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primaryBorder bg-primarySoft px-3.5 py-3">
        <Check size={18} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text">{escolhida.logradouro}</p>
          <p className="truncate text-sm text-textMuted">
            {[escolhida.bairro, `${escolhida.localidade}/${escolhida.uf}`, escolhida.cep]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEscolhida(null);
            setRua('');
          }}
          className="tap -my-2 flex h-12 shrink-0 items-center px-3 text-base font-semibold text-primary"
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-text">Nome da rua</span>
        <div className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 focus-within:border-primary">
          <Search size={18} className="shrink-0 text-textMuted" />
          <input
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-text focus:outline-none"
            autoComplete="off"
          />
          {ditado.suportado && (
            <button
              type="button"
              onClick={() =>
                ditado.ouvindo
                  ? ditado.parar()
                  : ditado.comecar((bruto) => setRua(textoDitado(bruto, 'nome')))
              }
              aria-label={ditado.ouvindo ? 'Parar de ouvir' : 'Falar o nome da rua'}
              aria-pressed={ditado.ouvindo}
              className={`tap -mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                ditado.ouvindo ? 'bg-primary text-white' : 'bg-primaryChip text-primary'
              }`}
            >
              <Mic size={22} aria-hidden="true" />
            </button>
          )}
        </div>
      </label>
      {(ditado.ouvindo || ditado.naoEntendi) && (
        <p aria-live="polite" className={`text-sm font-semibold ${ditado.ouvindo ? 'text-primary' : 'text-textMuted'}`}>
          {ditado.ouvindo ? 'Ouvindo… pode falar o nome da rua' : 'Não entendi. Toque no microfone e fale de novo.'}
        </p>
      )}

      {trocando ? (
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Digite aqui"
            aria-label="Cidade"
            className="h-12 rounded-xl border-2 border-border bg-card px-3 text-base text-text focus:border-primary focus:outline-none"
          />
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            aria-label="Estado"
            className="h-12 rounded-xl border-2 border-border bg-card px-2 text-base text-text focus:border-primary focus:outline-none"
          >
            <option value="">UF</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex min-h-12 items-center gap-1.5 px-1 text-sm text-textMuted">
          <MapPin size={16} className="shrink-0" />
          <span className="min-w-0">Buscando em {cidade}/{uf}</span>
          {/* 48px de alvo: a linha é discreta, o toque não pode ser. */}
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="tap flex h-12 shrink-0 items-center px-3 text-base font-semibold text-primary"
          >
            Trocar cidade
          </button>
        </div>
      )}

      {buscando && <p className="px-1 text-sm text-textMuted">Procurando…</p>}
      {falhou && (
        <p className="px-1 text-sm text-warningText">
          A busca de ruas está fora do ar. Use o CEP ou digite o endereço abaixo.
        </p>
      )}
      {!buscando && !falhou && rua.trim().length >= 3 && podeBuscarRua({ uf, cidade, rua }) && sugestoes.length === 0 && (
        <p className="px-1 text-sm text-textMuted">
          Nenhuma rua com esse nome aqui. Confira a cidade ou digite o endereço abaixo.
        </p>
      )}

      {sugestoes.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {sugestoes.map((s) => (
            <li key={s.cep}>
              <button
                type="button"
                onClick={() => escolher(s)}
                className="tap w-full min-h-12 px-3.5 py-2.5 text-left hover:bg-sunken"
              >
                <span className="block text-base font-semibold text-text">{s.logradouro}</span>
                <span className="block text-sm text-textMuted">
                  {[s.bairro, `${s.localidade}/${s.uf}`, s.cep].filter(Boolean).join(' · ')}
                </span>
                {s.faixa && <span className="block text-sm text-textMuted">{s.faixa}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
