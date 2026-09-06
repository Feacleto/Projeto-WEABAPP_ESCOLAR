import { useState } from 'react';
import { ArrowRight, Clock, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { avisoDoTrial, fimDoTrial } from '../../dominio/associacao/trial.js';
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
export default function AvisoDoTrial({ temContrato = false }) {
  const { profile } = useAuth();
  const [fechado, setFechado] = useState(false);

  const aviso = avisoDoTrial({
    inicio: profile?.trialInicio,
    agora: new Date(),
    temContrato,
  });

  if (!aviso || aviso.nivel === 'expirado') return null;
  if (aviso.nivel === 'discreto') {
    const fim = fimDoTrial(profile?.trialInicio);
    return (
      <div className="border-b border-border bg-sunken px-4 py-2 text-center text-xs text-textMuted">
        Seu teste grátis vai até{' '}
        <strong className="font-semibold text-text">
          {fim?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
        </strong>
        .
      </div>
    );
  }

  const ultimo = aviso.nivel === 'ultimo';
  if (fechado && !ultimo) return null;

  const quantos = ultimo
    ? aviso.dias <= 1
      ? 'Seu teste grátis termina amanhã.'
      : `Seu teste grátis termina em ${aviso.dias} dias.`
    : `Seu teste grátis termina em ${aviso.dias} dias.`;

  return (
    <div className="border-b border-warningBorder bg-warningSoft px-4 py-3">
      <div className="mx-auto flex max-w-mobile items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warningChip">
          <Clock size={17} className="text-warningText" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warningText">{quantos}</p>
          <p className="mt-0.5 text-xs text-textMuted">
            Depois disso o app pausa até você escolher um plano. Suas crianças e
            seus dados continuam aqui.
          </p>

          {/* A tela de planos já existe e mostra o preço DELE, com os
            * descontos aplicados. Antes dela isto abria o WhatsApp — o que
            * era honesto enquanto não havia para onde ir. */}
          <Link
            to="/tio/planos"
            className="tap mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-warningText underline"
          >
            <ArrowRight size={15} /> Ver planos
          </Link>
        </div>

        {!ultimo && (
          <button
            type="button"
            onClick={() => setFechado(true)}
            aria-label="Fechar aviso"
            className="tap -mr-1 -mt-1 shrink-0 p-1 text-textMuted hover:text-text"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
