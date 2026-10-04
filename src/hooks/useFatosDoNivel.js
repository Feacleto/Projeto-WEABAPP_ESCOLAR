import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useChildren } from './useChildren';
import { useConfigDoFinanceiro } from './useDespesas';
import { watchExpensesByMonths, monthKeyOf } from '../services/expensesService';
import {
  watchAlgumAcessoCriado,
  watchAlgumaBaixa,
  watchUsuarioDoNivel,
} from '../services/fatosDoNivelService';

/**
 * OS FATOS DO NÍVEL, MONTADOS NO APARELHO DO MOTORISTA — o formato está no
 * cabeçalho de dominio/identidade/nivel.js.
 *
 * Só serve ao CHECKLIST da tela "Meu nível" e ao cartão de prazo da Platina.
 * O selo oficial é o do servidor (`niveis/{uid}`); este cálculo pode
 * discordar dele por minutos (o servidor recalcula ao encerrar a rota, ao
 * abrir "Meu nível" e uma vez por dia), e é por isso que a tela nunca troca
 * o selo pelo número daqui.
 *
 * ⚠️ AS DESPESAS SÃO AS DOS ÚLTIMOS 12 MESES — a janela que o Financeiro já
 * conhece (`watchExpensesByMonths`, um mês por chave). Tudo o que a régua pergunta sobre
 * despesa é "do mês" ou "pelo menos uma"; quem lançou a última há mais de um
 * ano veria "Lançar a primeira despesa" como a fazer aqui, e o servidor, que
 * lê tudo, continua com a resposta certa.
 *
 * Retorna `{ fatos, carregando }`. `fatos` é `null` enquanto carrega.
 */
export function useFatosDoNivel() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const { children, loading: carregandoCriancas } = useChildren();
  const config = useConfigDoFinanceiro();
  const { despesas, carregando: carregandoDespesas } = useDespesasDe12Meses(uid);

  // O estado carrega a chave — mesmo padrão de useChildren.
  const [usuario, setUsuario] = useState({ chave: null, dados: null });
  const [baixas, setBaixas] = useState({ chave: null, n: null });
  const [acessos, setAcessos] = useState({ chave: null, n: null });

  useEffect(() => {
    if (!uid) return undefined;
    return watchUsuarioDoNivel(uid, (dados) => setUsuario({ chave: uid, dados }));
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return watchAlgumaBaixa(uid, (n) => setBaixas({ chave: uid, n }));
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return watchAlgumAcessoCriado(uid, (n) => setAcessos({ chave: uid, n }));
  }, [uid]);

  const dadosDoUsuario = usuario.chave === uid ? usuario.dados : null;
  const nBaixas = baixas.chave === uid ? baixas.n : null;
  const nAcessos = acessos.chave === uid ? acessos.n : null;

  const carregando = !uid
    || carregandoCriancas
    || carregandoDespesas
    || config === null
    || dadosDoUsuario === null
    || nBaixas === null
    || nAcessos === null;

  const fatos = useMemo(() => {
    if (carregando) return null;
    const u = dadosDoUsuario || {};
    return {
      usuario: {
        name: u.name,
        marcaNome: u.marcaNome,
        city: u.city,
        ultimaRota: u.ultimaRota,
        marcaLogoURL: u.marcaLogoURL,
        fcmTokens: Array.isArray(u.fcmTokens) ? u.fcmTokens : [],
        pixKey: u.pixKey,
        verificacao: u.verificacao,
        alvaraValidade: u.alvaraValidade,
        marcos: u.marcos || {},
      },
      // `useChildren` só traz as ativas — e a régua só conta as ativas.
      criancas: children.map((c) => ({
        id: c.id,
        active: c.active === true,
        photoURL: c.photoURL,
        parentUid: c.parentUid,
        conviteEnviadoEm: c.conviteEnviadoEm,
        schoolPhone: c.schoolPhone,
        turma: c.turma,
        professora: c.professora,
        contratoAguardando: c.contratoAguardando,
        contratoVigente: c.contratoVigente,
      })),
      acessosTemporariosCriados: nAcessos,
      config: {
        temSenha: config.temSenha,
        usoDaPerua: config.usoDaPerua,
        planoDaTroca: config.planoDaTroca,
        guardado: config.guardado,
        marcosDeclarados: config.marcosDeclarados,
      },
      despesas: despesas.map((d) => ({ date: d.date, category: d.category, tanqueCheio: d.tanqueCheio })),
      baixas: nBaixas,
    };
  }, [carregando, dadosDoUsuario, children, nAcessos, config, despesas, nBaixas]);

  return { fatos, carregando };
}

/** As despesas dos últimos 12 meses, para a régua (uma escuta, 12 chaves de mês). */
function useDespesasDe12Meses(uid) {
  const [estado, setEstado] = useState({ uid: null, despesas: [] });
  useEffect(() => {
    if (!uid) return undefined;
    const hoje = new Date();
    const meses = Array.from({ length: 12 }, (_, i) =>
      monthKeyOf(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1))
    );
    return watchExpensesByMonths(
      meses,
      (lista) => setEstado({ uid, despesas: lista || [] }),
      () => setEstado({ uid, despesas: [] })
    );
  }, [uid]);
  return { despesas: estado.uid === uid ? estado.despesas : [], carregando: !!uid && estado.uid !== uid };
}
