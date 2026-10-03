import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { watchConfigFinanceiro } from '../services/configFinanceiroService';
import { lerPedirSenha, gravarPedirSenha } from '../services/preferenciaDoFinanceiroService';
import {
  CAIXA,
  aoMudarDeRota,
  aoVoltarDoSegundoPlano,
  destravar,
  estadoTrancado,
  normalizarCaminho,
  rotaProtegida,
} from '../dominio/identidade/trancaDoFinanceiro.js';
import { TrancaDoFinanceiroContext } from './trancaDoFinanceiroContextObject';

/**
 * A TRANCA DO FINANCEIRO, uma por sessão (03/10/2026).
 *
 * Guarda em MEMÓRIA se o Financeiro está aberto — nunca no aparelho:
 * recarregar o app tranca, e é de propósito (ver
 * `dominio/identidade/trancaDoFinanceiro.js`, que decide cada transição).
 *
 * ⚠️ ELA MORA NO `App`, POR FORA DAS ROTAS, E NÃO NO `TioLayout`. O pedido
 * era montá-la no layout, como o sino. Mas `/tio/taxa` (a fatura da
 * plataforma) é protegida e mora FORA do layout — fora do `GuardaDaConta`,
 * pelo motivo escrito no `App.jsx`. Ir do Financeiro para a taxa desmontaria
 * o layout: o estado de "destravado" morreria no caminho e ninguém estaria
 * vigiando a rota para trancar na saída. Por fora das rotas ela vê as duas
 * metades. Para quem não é motorista ela não assina nada.
 *
 * O que ela faz:
 *   - vigia a ROTA: sair das protegidas tranca (ou começa a contar o prazo da
 *     preferência), e a entrada direta que volta ao caixa tranca;
 *   - vigia o SEGUNDO PLANO (`visibilitychange`);
 *   - assina `configFinanceiro/{uid}` para saber se já existe senha
 *     (`temSenha`: `undefined` enquanto carrega — o guarda espera, não pisca);
 *   - guarda o FLUXO em andamento ('criar' a senha, ou 'esqueci' = provar que
 *     é o dono da conta antes de trocar), que vale mais que "destravado":
 *     "Trocar a senha" dos ajustes acontece com o Financeiro aberto.
 *
 * Trocar de conta tranca: o estado leva o uid de quem destravou (`dono`).
 */
export function TrancaDoFinanceiroProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, profile } = useAuth();
  const uid = user?.uid || null;
  const ehMotorista = profile?.role === 'admin';

  const [estado, setEstado] = useState(() => ({ ...estadoTrancado(), dono: null }));
  const [preferencia, setPreferencia] = useState(lerPedirSenha);
  const [fluxo, setFluxo] = useState(null);

  // ── A senha existe? (só o servidor grava `temSenha`)
  const [config, setConfig] = useState({ chave: null, dados: null });
  useEffect(() => {
    if (!uid || !ehMotorista) return undefined;
    return watchConfigFinanceiro(uid, (dados) => setConfig({ chave: uid, dados }));
  }, [uid, ehMotorista]);
  const temSenha = uid && config.chave === uid ? config.dados?.temSenha === true : undefined;

  // ── A rota mudou
  const rotaAnterior = useRef(pathname);
  useEffect(() => {
    const de = rotaAnterior.current;
    rotaAnterior.current = pathname;
    if (normalizarCaminho(de) === normalizarCaminho(pathname)) return;
    setEstado((e) => {
      const novo = aoMudarDeRota(e, { de, para: pathname, agora: Date.now(), preferencia });
      return novo === e ? e : { ...novo, dono: novo.destravado ? e.dono : null };
    });
    // Um fluxo de senha pela metade não sobrevive à saída do Financeiro.
    if (!rotaProtegida(pathname)) setFluxo(null);
  }, [pathname, preferencia]);

  // ── O app foi para o segundo plano e voltou
  const escondeuEm = useRef(null);
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState === 'hidden') {
        escondeuEm.current = Date.now();
        return;
      }
      const em = escondeuEm.current;
      escondeuEm.current = null;
      setEstado((e) => {
        const novo = aoVoltarDoSegundoPlano(e, {
          escondeuEm: em,
          agora: Date.now(),
          preferencia,
          naRotaProtegida: rotaProtegida(window.location.pathname),
        });
        return novo === e ? e : { ...novo, dono: null };
      });
    };
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, [preferencia]);

  const destravado = !!uid && estado.destravado && estado.dono === uid;

  /** Senha ou digital conferidas: abre e leva ao destino. */
  const abrirCom = useCallback(
    (destino) => {
      const alvo = normalizarCaminho(destino || CAIXA);
      setEstado({ ...destravar(alvo), dono: uid });
      setFluxo(null);
      if (normalizarCaminho(window.location.pathname) !== alvo) navigate(alvo);
    },
    [uid, navigate]
  );

  /** O cadeado do topo. Numa subtela, volta para a tela trancada do caixa. */
  const trancar = useCallback(() => {
    setEstado({ ...estadoTrancado(), dono: null });
    setFluxo(null);
    const aqui = normalizarCaminho(window.location.pathname);
    if (rotaProtegida(aqui) && aqui !== CAIXA) navigate(CAIXA, { replace: true });
  }, [navigate]);

  const definirPreferencia = useCallback((valor) => {
    setPreferencia(gravarPedirSenha(valor));
  }, []);

  const valor = useMemo(
    () => ({
      destravado,
      temSenha,
      preferencia,
      fluxo,
      abrirCom,
      trancar,
      definirPreferencia,
      // O "Criar senha" da primeira vez: segura a tela de criação mesmo
      // depois de o servidor gravar `temSenha` no meio do caminho.
      iniciarCriacao: () => setFluxo('criar'),
      // "Esqueci a senha" e "Trocar a senha": antes de criar, provar que é
      // o dono da conta.
      pedirTrocaDeSenha: () => setFluxo('esqueci'),
      irParaCriacao: () => setFluxo('criar'),
      cancelarFluxo: () => setFluxo(null),
    }),
    [destravado, temSenha, preferencia, fluxo, abrirCom, trancar, definirPreferencia]
  );

  return (
    <TrancaDoFinanceiroContext.Provider value={valor}>{children}</TrancaDoFinanceiroContext.Provider>
  );
}
