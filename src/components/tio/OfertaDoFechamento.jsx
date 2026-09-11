import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import Sheet from '../common/Sheet';
import Button from '../common/Button';
import { formatCurrency } from '../../compartilhado/formatters';
import { textoDaOferta } from '../../dominio/associacao/ofertaDaPrimeiraRota';

/**
 * A OFERTA, na folha — o toque T0 e o T2 da cadência.
 *
 * Ela nasce quando ele ENCERRA a primeira rota, e volta na abertura seguinte
 * se ele não tiver respondido. O porquê de cada regra está em
 * `dominio/associacao/ofertaDaPrimeiraRota.js`; aqui é só a superfície.
 *
 * ── ⚠️ OS DOIS NÚMEROS APARECEM, E A FRASE OS SEPARA
 * O valor cheio ao lado do com desconto é o que dá tamanho aos 30% — "trinta
 * por cento" sozinho não é número, é adjetivo. Mas o que fica travado é a
 * FRAÇÃO, não o valor: quem trava com 4 crianças e cresce para 25 paga mais
 * no mês seguinte, com os mesmos 30%. Sem a linha que diz isso, a primeira
 * fatura maior vira reclamação — e com razão, porque a tela teria prometido
 * um número.
 *
 * ── ⚠️ DOIS BOTÕES, E O SEGUNDO NÃO É "FECHAR"
 * Fechar a folha (o X, o toque fora) deixa os outros toques acontecerem;
 * "Agora não" mata os três. São gestos diferentes com consequências
 * diferentes, e é por isso que o segundo é um botão escrito e não um ícone.
 *
 * ── ⚠️ A INDICAÇÃO NÃO ENTRA AQUI
 * `ConviteParaIndicar` tem lista fechada de quatro telas e o sino nos 90 dias
 * está fora, com o motivo escrito no teste: "colide com a escada, que tem
 * data; a indicação não tem". Esta folha É a escada. O convite mora no
 * destino do botão — `/tio/planos`, a um toque daqui.
 */
export default function OfertaDoFechamento({
  aberta,
  motorista,
  criancas,
  onFechar,
  onRecusar,
  onAceitar,
}) {
  const navigate = useNavigate();
  const oferta = textoDaOferta({ motorista, criancas });
  if (!oferta) return null;

  const data = oferta.ultimoDia
    ? oferta.ultimoDia.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
      })
    : null;

  const irParaPlanos = () => {
    if (onAceitar) onAceitar();
    navigate('/tio/planos');
  };

  return (
    <Sheet open={aberta} onClose={onFechar} title="Você destravou um desconto">
      <div className="space-y-5">
        <div className="rounded-2xl bg-primaryChip p-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles size={14} />
            {oferta.porcento}% de desconto
          </span>
          <p className="mt-3 text-sm text-text">
            {/* O valor cheio riscado ao lado do com desconto: é ele que dá
              * tamanho à porcentagem. */}
            <span className="text-textMuted line-through">
              {formatCurrency(oferta.bruto)}
            </span>{' '}
            <strong className="text-2xl font-extrabold text-primary">
              {formatCurrency(oferta.liquido)}
            </strong>
            <span className="text-textMuted"> /mês</span>
          </p>
          <p className="mt-1 text-[11px] text-textMuted">
            com as {oferta.criancas}{' '}
            {oferta.criancas === 1 ? 'criança' : 'crianças'} que você tem hoje
          </p>
        </div>

        <div className="space-y-2 text-sm leading-relaxed text-text">
          <p>
            Você acabou de rodar sua primeira rota — e com isso destravou{' '}
            <strong>{oferta.porcento}% pelo tempo que ficar</strong>. Não é
            promoção de um ano: a fração é sua enquanto você for cliente.
          </p>
          {/* ⚠️ A LINHA QUE IMPEDE A RECLAMAÇÃO DA PRIMEIRA FATURA MAIOR. */}
          <p className="text-textMuted">
            O que fica travado é o desconto, não o valor — a conta acompanha a
            sua turma, sempre com os {oferta.porcento}% aplicados.
          </p>
          {data && (
            <p>
              <strong>Só até {data}.</strong> Depois dessa data o desconto
              disponível cai, e não volta.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Button onClick={irParaPlanos} icon={ArrowRight}>
            Ver meu plano com o desconto
          </Button>
          {/* ⚠️ ESCRITO, E NÃO UM X. Este é o gesto que mata os três toques;
            * o X ao lado só adia. Consequências diferentes não podem ter a
            * mesma forma. */}
          <button
            type="button"
            onClick={onRecusar}
            className="tap w-full py-2 text-sm text-textMuted hover:text-text"
          >
            Agora não, obrigado
          </button>
        </div>
      </div>
    </Sheet>
  );
}
