/**
 * "PARA VOCÊ" — a linha de relação com o motorista no fim do Início
 * (04/10/2026, desenhado com a sessão do Início e aprovado pelo dono).
 *
 * O Início é a tela em que o tio sente que está organizado, e isso vem do
 * SILÊNCIO: quando não há nada em "Para resolver", sobram o cartão verde e o
 * botão. Esta linha não pode virar uma segunda lista de pendências, então:
 *
 *   - UM item por vez, numa LINHA (o mesmo desenho de "Meu transporte"), sem
 *     número, sem âmbar, sem botão; a linha inteira é o toque;
 *   - só quando ele está EM DIA (nada em "Para resolver") e fora da rota;
 *   - a frase começa pelo que ele JÁ tem e termina num verbo de VER, em até
 *     10 palavras — nunca "falta", "pendente", "complete" ou exclamação.
 *
 * A ÚNICA EXCEÇÃO ao "em dia" é o prazo da Platina nos últimos 3 dias: é o
 * único item que tira algo dele se ficar escondido (a atividade vence e ele
 * cai para o Ouro). O fim do teste NÃO é exceção: nos últimos 30 dias quem
 * avisa é o `AvisoDoTrial`, em toda tela — a linha existe só entre 60 e 31
 * dias do fim, para nunca haver dois avisos do mesmo prazo no mesmo dia.
 *
 * É um ATALHO, nunca o único caminho: o nível mora no menu do perfil, o
 * Boletim no Financeiro, a senha aparece na primeira vez que ele abre o
 * Financeiro. Se a linha sumir, nada se perde.
 *
 * Puro de propósito: `npm run testar:para-voce`.
 */
import { diasRestantes } from '../associacao/trial.js';

/** A janela do fim do teste: de 60 a 31 dias do fim (os 30 finais são do AvisoDoTrial). */
export const JANELA_DO_TESTE = { de: 60, ate: 31 };
/** O prazo da Platina fura o "em dia" só nos últimos dias. */
export const DIAS_DE_URGENCIA_DA_PLATINA = 3;
/** A linha da Platina aparece (em dia) a partir de tantos dias do fim. */
export const DIAS_DE_AVISO_DA_PLATINA = 7;

const NIVEIS = ['sem_nivel', 'bronze', 'prata', 'ouro', 'platina', 'diamante'];
const ROTULO = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', diamante: 'Diamante' };
// "chegou à Prata / à Platina", "chegou ao Bronze / ao Ouro / ao Diamante"
const AO = { bronze: 'ao', prata: 'à', ouro: 'ao', platina: 'à', diamante: 'ao' };
const DO = { bronze: 'do', prata: 'da', ouro: 'do', platina: 'da', diamante: 'do' };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function nomeDoMes(chave) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(chave || ''));
  return m ? MESES[Number(m[2]) - 1] : null;
}

export function posicao(nivel) {
  const i = NIVEIS.indexOf(nivel);
  return i < 0 ? 0 : i;
}

/**
 * O item da linha, ou null (a resposta mais comum: o silêncio).
 *
 * Tudo entra por parâmetro — quem lê o banco e o aparelho é o componente.
 *   foraDaRota      false com a rota rodando ou saindo para ela
 *   emDia           nada em "Para resolver"
 *   teste           { cobrancaLigada, jaContratou, trialInicio, criancas, familias }
 *   boletimMes      'AAAA-MM' a anunciar (boletimParaAnunciar) ou null
 *   nivel           o nível de hoje; nivelVisto o último que a linha já celebrou
 *   platina         { titulo, diasRestantes } da atividade mais perto do prazo, ou null
 *   proximo         `calcularNivel(...).proximo` ({ nivel, faltam: [] }) ou null
 *   senhaCriada     a missão da senha do Financeiro está feita
 *   faseDoNegocio   o título da última fase completa da trilha, ou null
 */
export function itemDoParaVoce({
  foraDaRota = false,
  emDia = false,
  teste = null,
  boletimMes = null,
  nivel = 'sem_nivel',
  nivelVisto = 'sem_nivel',
  platina = null,
  proximo = null,
  senhaCriada = true,
  faseDoNegocio = null,
  agora = new Date(),
} = {}) {
  if (!foraDaRota) return null;

  const platinaPerto =
    platina && posicao(nivel) >= posicao('ouro') && Number.isFinite(platina.diasRestantes);

  // A única exceção ao "em dia".
  if (platinaPerto && platina.diasRestantes <= DIAS_DE_URGENCIA_DA_PLATINA) {
    return linhaDaPlatina(platina);
  }
  if (!emDia) return null;

  if (teste && teste.cobrancaLigada && !teste.jaContratou) {
    const restam = diasRestantes(teste.trialInicio, agora);
    if (restam !== null && restam <= JANELA_DO_TESTE.de && restam >= JANELA_DO_TESTE.ate) {
      return {
        tipo: 'teste',
        frase: `Seu ambiente digital de trabalho está pronto: ${teste.criancas} ${
          teste.criancas === 1 ? 'criança' : 'crianças'
        }${teste.familias > 0 ? `, ${teste.familias} ${teste.familias === 1 ? 'família' : 'famílias'}` : ''}.`,
        toque: 'Ver como continuar',
        destino: '/tio/planos',
        icone: 'ambiente',
      };
    }
  }

  const mes = nomeDoMes(boletimMes);
  if (mes) {
    return { tipo: 'boletim', frase: `O boletim de ${mes} está pronto.`, toque: 'Abrir', destino: '/tio/finance/boletim', icone: 'boletim' };
  }

  if (ROTULO[nivel] && posicao(nivel) > posicao(nivelVisto)) {
    return {
      tipo: 'nivel',
      frase: `Você chegou ${AO[nivel]} ${ROTULO[nivel]}.`,
      toque: 'Ver meu nível',
      destino: '/tio/nivel',
      icone: 'selo',
      nivel,
    };
  }

  if (platinaPerto && platina.diasRestantes <= DIAS_DE_AVISO_DA_PLATINA) return linhaDaPlatina(platina);

  const faltam = proximo && Array.isArray(proximo.faltam) ? proximo.faltam.length : 0;
  if (ROTULO[proximo?.nivel] && faltam >= 1 && faltam <= 2) {
    return {
      tipo: 'missao',
      frase: `Você está a ${faltam} ${faltam === 1 ? 'passo' : 'passos'} ${DO[proximo.nivel]} ${ROTULO[proximo.nivel]}.`,
      toque: 'Ver o passo',
      destino: '/tio/nivel',
      icone: 'missao',
    };
  }

  if (!senhaCriada) {
    return { tipo: 'senha', frase: 'Os valores do Financeiro, só pra você ver.', toque: 'Proteger', destino: '/tio/finance', icone: 'senha' };
  }

  if (faseDoNegocio && posicao(nivel) >= posicao('ouro')) {
    return { tipo: 'trilha', frase: `Seu negócio está na fase ${faseDoNegocio}.`, toque: 'Ver a trilha', destino: '/tio/finance/negocio', icone: 'trilha' };
  }

  return null;
}

function linhaDaPlatina(platina) {
  const d = platina.diasRestantes;
  return {
    tipo: 'platina',
    frase: d <= 0 ? `${platina.titulo}: o prazo é hoje.` : `${platina.titulo}: até ${d === 1 ? 'amanhã' : `daqui a ${d} dias`}.`,
    toque: 'Ver a atividade',
    destino: '/tio/nivel',
    icone: 'platina',
  };
}

/** A última fase completa EM SEQUÊNCIA da trilha (a de "Seu negócio hoje"). */
export function faseDeHoje(fases) {
  let atual = null;
  for (const f of fases || []) {
    if (!f?.contaParaDiamante) continue;
    if (!f.completa) break;
    atual = f.titulo;
  }
  return atual;
}
