import { useState } from 'react';
import { ArrowRight, Clock, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  avisoDoTrial,
  fimDoTrial,
  degrauDaDecisao,
} from '../../dominio/associacao/trial.js';
import { descontoDoFechamento } from '../../dominio/associacao/planos.js';
import { useModuloDeCobranca } from '../../hooks/useCobrancaLigada';
import { Link } from 'react-router-dom';

/**
 * O AVISO DO TESTE GRÁTIS — três formas, e o silêncio como estado padrão.
 *
 * NOS PRIMEIROS SESSENTA DIAS ESTE COMPONENTE NÃO DESENHA NADA, e isso é o
 * recurso principal dele. O motorista entrou pra testar um app de transporte
 * escolar, não pra ser lembrado de dinheiro toda manhã. `avisoDoTrial`
 * devolve `null` na maior parte da vida da conta, e `null` aqui é tela limpa.
 *
 * A URGÊNCIA É COMUNICADA PELA FORMA, NÃO PELA REPETIÇÃO
 * A ideia original eram cinco avisos — 20, 15, 7, 5 e 3 dias. Um a cada quatro
 * dias, e o projeto já pagou por essa lição em `dominio/rota/avisoDoMomento.js`:
 * atraso comum não gera tarja porque "tarja semanal ensina a pular tarja". O
 * quinto aviso, que é o mais importante, seria o que ele menos leria.
 *
 * Então são três, e cada um tem um PESO diferente:
 *
 *   discreto  linha fina, cinza, sem ícone e sem botão. Informa a data e sai
 *             do caminho. A partir de 30 dias do fim.
 *   atencao   cartão âmbar, com ação. A partir de 7. Fecha — ele trabalha o
 *             dia inteiro e o aviso volta na próxima sessão, pelo mesmo
 *             motivo que o `AvisoDaPlataforma` deixa fechar o atraso: aviso
 *             que não fecha no primeiro dia vira humilhação diária.
 *   ultimo    cartão âmbar que NÃO fecha, no último dia. Aqui fechar seria
 *             deixar a conta expirar em silêncio.
 *
 * O TERCEIRO ESTADO, `expirado`, NÃO MORA AQUI. Ele é a conta inativa sobre o
 * app desfocado — mesma tela de quem está inadimplente —, e ela precisa PARAR
 * DE BUSCAR OS DADOS antes de desfocá-los: `filter: blur()` é CSS, não
 * proteção, e uma tela que carrega criança pra borrar entrega nome e endereço
 * a quem abrir o inspetor. Isso é a fase 7, e é por isso que este componente
 * devolve `null` no expirado em vez de improvisar um bloqueio.
 *
 * QUEM JÁ TEM CONTRATO NUNCA VÊ NADA DISTO, e é por isso que `temContrato`
 * atravessa até a regra pura: o motorista que assina no dia 60 não pode
 * continuar vendo contagem regressiva por mais um mês.
 */
/**
 * ⚠️ FECHAR VALE PELA SESSÃO, e mora no `sessionStorage` (03/10/2026). O
 * aviso passou a ser desenhado logo abaixo do cabeçalho de cada tela (ver
 * `AvisosDoCabecalhoContext`), e por isso remonta a cada troca de tela — um
 * `useState(false)` faria o aviso fechado voltar na tela seguinte. Mesma
 * regra do `AvisoDaPlataforma`: volta na próxima vez que ele abrir o app.
 */
const CHAVE_FECHADO = 'alobuzinou:avisoTrialFechado';

function lerFechado() {
  try {
    return sessionStorage.getItem(CHAVE_FECHADO) === '1';
  } catch {
    return false;
  }
}

export default function AvisoDoTrial({ temContrato = false }) {
  const { profile } = useAuth();
  const [fechado, setFechadoNaTela] = useState(lerFechado);
  const setFechado = (v) => {
    setFechadoNaTela(v);
    try {
      sessionStorage.setItem(CHAVE_FECHADO, v ? '1' : '0');
    } catch {
      // Modo privado: o aviso volta na próxima tela. Custa vê-lo de novo.
    }
  };

  const aviso = avisoDoTrial({
    inicio: profile?.trialInicio,
    agora: new Date(),
    temContrato,
  });

  // O desconto do degrau em que ele está AGORA — ver o comentário da oferta,
  // mais abaixo. Zero quando a escada já passou, e aí a oferta não aparece.
  // ⚠️ E SÓ COM O MÓDULO DA ESCADA LIGADO (02/10/2026): o servidor só concede
  // com ele, e prometer aqui o que não vai ser gravado é o defeito de sempre.
  const escada = useModuloDeCobranca('escada');
  const fracaoDoDegrau = escada
    ? descontoDoFechamento(
        degrauDaDecisao({ inicio: profile?.trialInicio, agora: new Date() })
      )
    : 0;

  if (!aviso || aviso.nivel === 'expirado') return null;
  if (aviso.nivel === 'discreto') {
    const fim = fimDoTrial(profile?.trialInicio);
    return (
      <div className="border-b border-border bg-sunken px-4 py-2.5 text-center text-sm text-textMuted">
        Você está no período de teste, até{' '}
        <strong className="font-semibold text-text">
          {fim?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
        </strong>
        . Nada é cobrado até lá.
      </div>
    );
  }

  const ultimo = aviso.nivel === 'ultimo';
  if (fechado && !ultimo) return null;

  const quantos = ultimo
    ? aviso.dias <= 1
      ? 'Seu teste termina amanhã.'
      : `Seu teste termina em ${aviso.dias} dias.`
    : `Seu teste termina em ${aviso.dias} dias.`;

  // ⚠️ VERDE CALMO, NÃO ÂMBAR (04/10/2026, decisão do dono): o fim do teste
  // não é alerta. Continua no topo de toda tela do /tio — é o único aviso que
  // precisa ser visto mesmo com pendências —, mas no verde da casa (`tema-alo`),
  // porque é a plataforma falando, não o negócio dele.
  return (
    <div className="tema-alo border-b border-primaryBorder bg-primarySoft px-4 py-3">
      <div className="mx-auto flex max-w-mobile items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primaryChip">
          <Clock size={17} className="text-accentText" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-accentText">{quantos}</p>
          <p className="mt-0.5 text-sm text-textBody">
            Depois dessa data o app pausa até você escolher um plano. Suas
            crianças, horários e histórico continuam salvos.
          </p>

          {/* A OFERTA MORA AQUI, E ISSO NÃO É ESPERTEZA DE VENDA.
            *
            * O preço fica discreto durante o teste de propósito: quem está
            * provando o app não deveria estar decidindo compra. Só que o
            * desconto de fechamento precisa de UM momento em que seja dito —
            * senão ninguém contrata antes, e o mecanismo não existe na prática.
            *
            * Este aviso é esse momento: ele já é sobre o fim do teste.
            *
            * ⚠️ O NÚMERO É O DO DEGRAU ATUAL, não um valor fixo. Quando este
            * cartão aparece (7 dias do fim) o degrau já é o 3º, e prometer os
            * 30% do 1º mês aqui seria anunciar um desconto que o servidor não
            * vai gravar — o motorista veria 30% na tela e 10% na fatura.
            *
            * ⚠️ E O PRAZO SAIU DA FRASE (10/09/2026). Ela dizia "pelos 12 meses
            * de contrato", que era verdade enquanto o desconto expirava. Hoje
            * ele é VITALÍCIO, e a frase antiga prometia MENOS do que o sistema
            * dá — um desconto que a tela diz durar um ano e a fatura mantém
            * para sempre é o raro caso de erro a favor do cliente, e mesmo
            * assim é erro: ele decide contra um número que não é o dele. */}
          {fracaoDoDegrau > 0 && (
            <p className="mt-1.5 text-sm leading-relaxed text-accentText">
              Quanto antes contratar, menor fica sua mensalidade. Contratando
              agora você garante{' '}
              <strong>{Math.round(fracaoDoDegrau * 100)}% de desconto</strong>, sem
              prazo para acabar.
            </p>
          )}

          {/* A tela de planos já existe e mostra o preço DELE, com os
            * descontos aplicados. Antes dela isto abria o WhatsApp — o que
            * era honesto enquanto não havia para onde ir. */}
          <Link
            to="/tio/planos"
            className="tap mt-1 inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-accentText underline"
          >
            <ArrowRight size={18} /> Ver planos
          </Link>
        </div>

        {!ultimo && (
          <button
            type="button"
            onClick={() => setFechado(true)}
            aria-label="Fechar aviso"
            className="tap -mr-3 -mt-2 flex h-12 w-12 shrink-0 items-center justify-center text-textMuted hover:text-text"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
