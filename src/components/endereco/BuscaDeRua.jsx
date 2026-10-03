import { useEffect, useRef, useState } from 'react';
import { Search, Check, MapPin } from 'lucide-react';
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
          <p className="truncate text-sm font-semibold text-text">{escolhida.logradouro}</p>
          <p className="truncate text-xs text-textMuted">
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
          className="tap shrink-0 text-xs font-semibold text-primary"
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
        </div>
      </label>

      {trocando ? (
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Cidade"
            aria-label="Cidade"
            className="h-11 rounded-xl border-2 border-border bg-card px-3 text-sm text-text focus:border-primary focus:outline-none"
          />
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            aria-label="Estado"
            className="h-11 rounded-xl border-2 border-border bg-card px-2 text-sm text-text focus:border-primary focus:outline-none"
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
        <p className="flex items-center gap-1.5 px-1 text-xs text-textMuted">
          <MapPin size={12} />
          Buscando em {cidade}/{uf}
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="tap font-semibold text-primary"
          >
            trocar
          </button>
        </p>
      )}

      {buscando && <p className="px-1 text-xs text-textMuted">Procurando…</p>}
      {falhou && (
        <p className="px-1 text-xs text-warningText">
          A busca de ruas está fora do ar. Use o CEP ou digite o endereço abaixo.
        </p>
      )}
      {!buscando && !falhou && rua.trim().length >= 3 && podeBuscarRua({ uf, cidade, rua }) && sugestoes.length === 0 && (
        <p className="px-1 text-xs text-textMuted">
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
                className="tap w-full px-3.5 py-2.5 text-left hover:bg-sunken"
              >
                <span className="block text-sm font-semibold text-text">{s.logradouro}</span>
                <span className="block text-xs text-textMuted">
                  {[s.bairro, `${s.localidade}/${s.uf}`, s.cep].filter(Boolean).join(' · ')}
                </span>
                {s.faixa && <span className="block text-[11px] text-textMuted">{s.faixa}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
