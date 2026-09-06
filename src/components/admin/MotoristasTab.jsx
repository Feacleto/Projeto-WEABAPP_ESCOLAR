import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import FichaDoMotorista from './FichaDoMotorista';
import { carregarConsole } from '../../services/adminMetricsService';
import { suspenderParceiro } from '../../services/taxaService';
import { degrauDo, mensalidadeDe } from '../../dominio/associacao/carteira.js';
import { diasRestantes } from '../../dominio/associacao/trial.js';
import { planoPorId } from '../../dominio/associacao/planos.js';
import { formatCurrency, getCurrentMonthKey } from '../../compartilhado/formatters';

/**
 * A ABA MOTORISTAS — a lista e a ficha, lado a lado.
 *
 * ── LISTA À ESQUERDA, FICHA À DIREITA, E NO CELULAR UMA DE CADA VEZ
 * No desktop a lista continua visível enquanto a ficha abre: é assim que se
 * varre uma carteira, comparando enquanto se olha. No celular não cabe, então
 * a ficha ocupa a tela e ganha um "voltar" — o mesmo componente, decidido por
 * uma media query.
 *
 * ── A ORDEM DA LISTA É A URGÊNCIA, NÃO O ALFABETO
 * Quem está a poucos dias do fim do teste vem antes de quem está pagando há
 * meses. Ordem alfabética é o padrão que faz uma lista de gestão virar uma
 * lista telefônica: o que precisa de você fica no meio, e você rola até
 * cansar.
 *
 * ── UMA CARGA, NÃO UMA POR FICHA
 * `carregarConsole()` traz parceiros e notas de uma vez. Trocar de motorista
 * na lista não espera rede — o que a ficha busca sob demanda é só o que é
 * dela (contrato, faturas, nota interna, GMV).
 */

/** A ordem em que cada degrau aparece. Menor vem primeiro. */
const PESO = { bloqueado: 0, em_teste: 1, nao_comecou: 2, contratado: 3 };

export default function MotoristasTab() {
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const mes = getCurrentMonthKey();

  const carregar = useCallback(() => {
    carregarConsole()
      .then(setDados)
      .catch((err) => {
        console.error('[admin] console não carregou:', err);
        setDados(false);
      });
  }, []);
  useEffect(carregar, [carregar]);

  const linhas = useMemo(() => {
    if (!dados?.parceiros) return null;
    const agora = new Date();
    const lista = dados.parceiros.map((mot) => {
      const degrau = degrauDo(mot, agora);
      return {
        mot,
        degrau,
        plano: planoPorId(mot.planoId),
        conta: mensalidadeDe(mot, mes),
        faltam: mot.trialInicio ? diasRestantes(mot.trialInicio, agora) : null,
        nota: dados.notas?.[mot.uid] || null,
      };
    });

    lista.sort((a, b) => {
      const p = PESO[a.degrau] - PESO[b.degrau];
      if (p !== 0) return p;
      // Dentro do mesmo degrau, quem tem menos tempo primeiro. Sem prazo, o
      // nome — que é o único critério estável que sobra.
      if (a.faltam !== null && b.faltam !== null) return a.faltam - b.faltam;
      return String(a.mot.name || '').localeCompare(String(b.mot.name || ''));
    });

    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((l) =>
      `${l.mot.name || ''} ${l.mot.email || ''} ${l.mot.city || ''}`.toLowerCase().includes(q)
    );
  }, [dados, busca, mes]);

  const suspender = async (mot) => {
    try {
      await suspenderParceiro(mot.uid, !mot.suspenso);
      toast.success(mot.suspenso ? 'Reativado.' : 'Suspenso.');
      carregar();
    } catch (err) {
      toast.error(err.message || 'Não deu pra mudar.');
    }
  };

  const aberto = linhas?.find((l) => l.mot.uid === escolhido) || null;

  if (dados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar os motoristas.
      </p>
    );
  }
  if (linhas === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[20rem_1fr] lg:items-start lg:gap-4">
      {/* No celular a lista SOME quando há ficha aberta — duas superfícies
        * empilhadas em 360px viram uma rolagem que ninguém percorre. */}
      <div className={aberto ? 'hidden lg:block' : ''}>
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search size={14} className="shrink-0 text-textMuted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, e-mail ou cidade"
            className="h-9 w-full bg-transparent text-xs text-text outline-none"
          />
        </div>

        {!linhas.length ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-xs text-textMuted">
            {busca ? 'Ninguém com esse nome.' : 'Nenhum motorista ainda.'}
          </p>
        ) : (
          <ul className="space-y-1 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            {linhas.map((l) => (
              <li key={l.mot.uid}>
                <button
                  type="button"
                  onClick={() => setEscolhido(l.mot.uid)}
                  className={`tap w-full rounded-xl border p-3 text-left transition-colors ${
                    escolhido === l.mot.uid
                      ? 'border-primary bg-primarySoft'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-bold text-text">
                      {l.mot.name || l.mot.uid}
                    </span>
                    <Pastilha degrau={l.degrau} faltam={l.faltam} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-textMuted">
                    {Number(l.mot.criancasAtivas) || 0}
                    {l.plano ? `/${l.plano.ate}` : ''} crianças
                    {l.plano ? ` · ${l.plano.rotulo.replace('crianças', '').trim()}` : ' · sem faixa'}
                    {l.conta?.liquido != null ? ` · ${formatCurrency(l.conta.liquido)}` : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={aberto ? '' : 'hidden lg:block'}>
        {aberto ? (
          <FichaDoMotorista
            // A `key` remonta a ficha ao trocar de motorista: o estado nasce
            // limpo, sem o dado do anterior aparecer por um render.
            key={aberto.mot.uid}
            motorista={aberto.mot}
            nota={aberto.nota}
            mes={mes}
            onVoltar={() => setEscolhido(null)}
            onSuspender={suspender}
          />
        ) : (
          // Vazio que ORIENTA, e não um retângulo em branco: a coluna da
          // direita ocupa metade da tela e precisa dizer o que fazer com ela.
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
            <Users size={22} className="text-textMuted" />
            <p className="mt-2 text-xs text-textMuted">
              Escolha um motorista à esquerda para ver a ficha dele.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Pastilha({ degrau, faltam }) {
  const mapa = {
    contratado: ['bg-primarySoft text-primary', 'ativo'],
    em_teste: ['bg-warningSoft text-warningText', faltam !== null ? `${faltam}d` : 'teste'],
    nao_comecou: ['bg-neutro text-textMuted', 'não rodou'],
    bloqueado: ['bg-dangerSoft text-dangerText', 'parado'],
  };
  const [skin, rotulo] = mapa[degrau] || mapa.nao_comecou;
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${skin}`}>
      {rotulo}
    </span>
  );
}
