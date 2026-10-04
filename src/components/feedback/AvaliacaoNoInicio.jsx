import { useEffect, useMemo, useState } from 'react';
import CartaoDeAvaliacao from './CartaoDeAvaliacao';
import { useAuth } from '../../hooks/useAuth';
import { enviarAvaliacaoRapida, getLastFeedbackAt } from '../../services/feedbackService';
import { getPlatformConfig } from '../../services/platformConfigService';
import {
  avaliacaoLigada,
  chaveDoDiaLocal,
  deveMostrarAvaliacao,
  perguntaDaAvaliacao,
  registrarDia,
} from '../../dominio/suporte/avaliacaoRapida.js';

/**
 * A AVALIAÇÃO RÁPIDA NO INÍCIO de quem tem conta — motorista e responsável.
 *
 * Quem monta diz QUAL é o momento e se ele aconteceu HOJE (`momentoHoje`:
 * rota encerrada, filho entregue). Daqui para baixo é a régua de
 * `dominio/suporte/avaliacaoRapida.js`: nunca com a rota rodando, só a partir
 * do 5º dia com o momento, 60 dias de silêncio depois de responder e 14
 * depois de "Agora não".
 *
 * ── A CONTAGEM DOS DIAS MORA NO APARELHO
 * Um dia a mais ou a menos de quem trocou de celular não muda nada, e gravar
 * em `users` seria uma escrita por dia em toda conta só para decidir se um
 * cartão aparece. A ÚLTIMA RESPOSTA, essa, vem do banco — senão quem
 * respondeu no celular velho seria perguntado de novo no novo.
 *
 * ── DUAS LEITURAS, E SÓ QUANDO JÁ PODE APARECER
 * O interruptor do dono e a última resposta só são lidos depois de a conta
 * local dizer que sim. No dia comum, o cartão custa zero leitura.
 */
const CHAVE = 'ab_avaliacao_v1';

function lerLocal(uid, momento) {
  try {
    const raw = localStorage.getItem(`${CHAVE}:${uid}:${momento}`);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}

function gravarLocal(uid, momento, dados) {
  try {
    localStorage.setItem(`${CHAVE}:${uid}:${momento}`, JSON.stringify(dados));
  } catch {
    // Sem storage: o cartão só não lembra. Nada quebra.
  }
}

export default function AvaliacaoNoInicio({ papel, momento, momentoHoje, rotaRodando = false, crianca }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const hoje = chaveDoDiaLocal();

  // O dia de hoje entra na conta no mesmo cálculo que decide — sem efeito
  // nem segundo render para isso.
  const local = useMemo(() => {
    if (!uid) return null;
    const salvo = lerLocal(uid, momento);
    const dias = momentoHoje ? registrarDia(salvo.dias, hoje) : salvo.dias || [];
    if (momentoHoje && dias.length !== (salvo.dias || []).length) {
      gravarLocal(uid, momento, { ...salvo, dias });
    }
    return { ...salvo, dias };
  }, [uid, momento, momentoHoje, hoje]);

  const podeLocal =
    !!local &&
    deveMostrarAvaliacao({
      ligada: true,
      rotaRodando,
      momentoHoje,
      diasComMomento: local.dias.length,
      ultimaResposta: local.respondidaEm || null,
      dispensadaEm: local.dispensadaEm || null,
    });

  const [confirmado, setConfirmado] = useState(null); // null = ainda não perguntei ao banco
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (!podeLocal || !uid) return undefined;
    let vivo = true;
    Promise.all([getPlatformConfig(), getLastFeedbackAt(uid)]).then(([config, ultima]) => {
      if (!vivo) return;
      setConfirmado(
        deveMostrarAvaliacao({
          ligada: avaliacaoLigada(config),
          rotaRodando: false,
          momentoHoje: true,
          diasComMomento: local.dias.length,
          ultimaResposta: ultima,
          dispensadaEm: local.dispensadaEm || null,
        })
      );
    });
    return () => {
      vivo = false;
    };
    // `local` muda junto com `podeLocal`; a dependência é a decisão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeLocal, uid]);

  // ⚠️ A rota que liga DEPOIS de o cartão aparecer o tira na hora.
  if (!podeLocal || !confirmado || fechado || rotaRodando) return null;

  const enviar = async ({ nota, comentario }) => {
    await enviarAvaliacaoRapida({ uid, role: papel, nota, comentario, momento });
    gravarLocal(uid, momento, { ...lerLocal(uid, momento), respondidaEm: Date.now() });
  };

  const dispensar = () => {
    gravarLocal(uid, momento, { ...lerLocal(uid, momento), dispensadaEm: Date.now() });
    setFechado(true);
  };

  return (
    <CartaoDeAvaliacao
      pergunta={perguntaDaAvaliacao({ papel, crianca })}
      onEnviar={enviar}
      onDispensar={dispensar}
    />
  );
}
