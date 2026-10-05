import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import Spinner from '../components/common/Spinner';
import { verRotaDaSubstituta } from '../services/substitutaDeUmDiaService';
import { falaComQuem, viagensDaSubstituta } from '../dominio/rota/rotaDaSubstituta.js';
import { deMinutos, horaCurta } from '../dominio/rota/horarios.js';

/**
 * "Rota de hoje" — /substituta/:token (F3, 05/10/2026).
 *
 * A tela de quem cobre a auxiliar UM dia. Ela não tem conta e não vai ter:
 * o tio mandou o link pelo WhatsApp, e ele vale só hoje (morre à meia-noite,
 * quando o tio encerra, ou quando a rota do dia acaba).
 *
 * ── O QUE ELA RESPONDE
 * "Quem é a próxima, a que horas, em que escola?" — a rota na ordem da
 * viagem, com o primeiro nome, a hora combinada, a escola e onde a criança
 * está agora (Em casa · Na perua · Na escola · Entregue em casa). Quem não
 * vai hoje aparece riscado, no lugar dela na fila.
 *
 * ── ⚠️ O QUE ELA NUNCA VÊ
 * Sobrenome, foto, telefone, endereço, mapa, mensalidade, saúde. Quem recorta
 * é o servidor (`reguaDaSubstitutaDeUmDia.js`), e há teste procurando cada
 * valor sensível no JSON. Ela só VÊ: nenhuma marcação sai daqui.
 *
 * ── SEM TEMPO REAL
 * Sem sessão do Firebase não há escuta: ela relê ao tocar em "Atualizar" e a
 * cada minuto com a página à vista — o mesmo relógio lento do `/acompanhar`,
 * porque cada leitura é uma chamada pública.
 */
export default function Substituta() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [morto, setMorto] = useState(null); // { marca } quando o link não vale
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const marcaConhecida = useRef(null);

  const aplicar = useCallback((d) => {
    marcaConhecida.current = d?.marca?.nome ? d.marca : null;
    setDados(d);
    setMorto(null);
    setAtualizadoEm(new Date());
  }, []);

  const recusar = useCallback((e) => {
    // Falha de rede no meio não derruba a lista que ela já está lendo; só a
    // recusa do servidor (o link morreu) troca a tela.
    if (e?.cause?.code && String(e.cause.code).includes('not-found')) {
      setMorto({ marca: e.marca || marcaConhecida.current });
      return true;
    }
    return false;
  }, []);

  const buscar = useCallback(async () => {
    setAtualizando(true);
    try {
      aplicar(await verRotaDaSubstituta(token));
    } catch (e) {
      recusar(e);
    } finally {
      setAtualizando(false);
    }
  }, [token, aplicar, recusar]);

  // A primeira leitura mora no efeito (o mesmo desenho do Acompanhar.jsx).
  useEffect(() => {
    let vivo = true;
    verRotaDaSubstituta(token)
      .then((d) => {
        if (vivo) aplicar(d);
      })
      .catch((e) => {
        if (vivo && !recusar(e)) setMorto({ marca: e?.marca || null });
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [token, aplicar, recusar]);

  useEffect(() => {
    if (!dados || morto) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') buscar();
    }, 60000);
    return () => clearInterval(t);
  }, [dados, morto, buscar]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <Spinner size={30} className="text-primary" />
        <p className="text-base text-textMuted">Abrindo a rota de hoje...</p>
      </div>
    );
  }

  if (morto || !dados) {
    const marca = morto?.marca;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <p className="font-display text-2xl font-bold text-text">Este link não vale mais.</p>
        <p className="max-w-xs text-lg text-textBody">
          {falaComQuem(marca)}
        </p>
      </div>
    );
  }

  const viagens = viagensDaSubstituta(dados.paradas);

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-primary px-5 pb-6 pt-8 text-white">
        <div className="flex items-center gap-3">
          {dados.marca?.logoURL && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              <img src={dados.marca.logoURL} alt="" className="max-h-10 max-w-10 object-contain" />
            </span>
          )}
          {dados.marca?.nome && <p className="text-lg font-bold">{dados.marca.nome}</p>}
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight">Rota de hoje</h1>
        {dados.substituta && (
          <p className="mt-1 text-base text-white/90">Com você, {dados.substituta}.</p>
        )}
      </header>

      <main className="space-y-5 px-4 py-6">
        {viagens.length === 0 ? (
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <p className="text-lg text-textBody">Nenhuma criança com horário na rota de hoje.</p>
          </section>
        ) : (
          viagens.map((v) => (
            <section key={`${v.direcao}-${v.inicio}`} className="rounded-2xl bg-card p-4 shadow-rest">
              <h2 className="mb-2 font-display text-xl font-bold text-text">
                {v.direcao === 'ida' ? 'Ida' : 'Volta'} · {horaCurta(deMinutos(v.inicio))}
              </h2>
              <ol className="divide-y divide-border">
                {v.paradas.map((p) => (
                  <li key={p.chave} className="flex items-start gap-3 py-3">
                    <span
                      className={`w-14 shrink-0 text-lg font-bold tabular-nums ${p.fora ? 'text-textMuted' : 'text-text'}`}
                    >
                      {p.hora}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-lg font-bold ${p.fora ? 'text-textMuted line-through' : 'text-text'}`}
                      >
                        {p.nome}
                      </span>
                      {p.escola && <span className="block text-base text-textBody">{p.escola}</span>}
                      {p.fora && <span className="block text-base text-textMuted">{p.motivo}</span>}
                    </span>
                    {!p.fora && (
                      <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-base font-bold text-text">
                        {p.palavra}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={buscar}
            disabled={atualizando}
            className="tap inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-border bg-card px-5 text-base font-bold text-text disabled:opacity-60"
          >
            <RefreshCw size={18} aria-hidden="true" className={atualizando ? 'animate-spin' : ''} />
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
          {atualizadoEm && (
            <p className="text-base text-textMuted">
              Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <p className="mx-auto max-w-xs text-center text-base text-textMuted">
          Este link vale só hoje.
        </p>
      </main>
    </div>
  );
}
