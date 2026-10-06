import { Bus, Clock, Users } from 'lucide-react';
import { horaCurta, deMinutos } from '../../dominio/rota/horarios';
import './rota.css';

/**
 * A FAIXA VERDE NO TOPO DA ROTA — onde ele está, de relance.
 *
 * Substituiu o cartão branco "Levando pra escola · 2 de 5 resolvidas" e a
 * barra de progresso (03/10/2026, design system). A barra dizia QUANTO da
 * viagem foi; o trilho diz ONDE a perua está entre as paradas — casa, falta,
 * escola —, que é o que ele reconhece sem ler com o veículo andando. O número
 * continua escrito ao lado do relógio para quem para e confere.
 *
 * ⚠️ NENHUMA PREVISÃO EM MINUTOS. O "06:40 → 07:30" é o COMBINADO (primeira e
 * última porta do bloco), nunca uma estimativa de chegada.
 *
 * ⚠️ O PONTO SÓ PULSA COM DADO VIVO. Pulso sobre posição velha é a tela
 * dizendo "ao vivo" sobre algo que parou — quem decide é `vivo`, que a
 * operação calcula pela idade do último envio do GPS.
 *
 * `nos`: [{ chave, tipo: 'casa' | 'escola', estado: 'feito' | 'agora' | 'falta' | 'off' }]
 *
 * `controle` (03/10/2026): o encerrar e a chave do mapa (`ControleDeRota`
 * com `faixa`). Moram AQUI, no topo, desde que o rodapé da rota virou o botão
 * da parada — o gesto do fim da viagem no alto, o de todo minuto embaixo.
 *
 * Os textos de apoio foram de 12 para 14 px: a faixa é lida com o celular no
 * suporte, a um braço de distância.
 */
export default function FaixaDaViagem({
  titulo,
  direcao,
  inicio,
  fim,
  contagem,
  nos = [],
  ativa = false,
  vivo = false,
  controle = null,
}) {
  const dia = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .replace(' de ', ' ');

  return (
    <div className="bg-primary px-4 pb-3 pt-2.5 text-white">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-sm font-bold uppercase tracking-[0.1em] text-white">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${ativa ? 'bg-accent' : 'bg-white/40'} ${
              ativa && vivo ? 'rota-pulso' : ''
            }`}
          />
          {ativa ? 'Rota ativa' : 'Rota parada'}
        </span>
        <span className="font-mono text-sm font-semibold text-primaryChip">
          {direcao ? `${direcao === 'ida' ? 'ida' : 'volta'} · ` : ''}
          {dia}
        </span>
      </div>

      <h2 className="mt-1.5 font-display text-[22px] font-extrabold leading-tight tracking-tight">
        {titulo}
      </h2>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[15px] font-semibold text-primaryChip">
        {contagem && (
          <span className="inline-flex items-center gap-1.5">
            <Users size={16} aria-hidden="true" />
            {contagem}
          </span>
        )}
        {inicio != null && (
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} aria-hidden="true" />
            {horaCurta(deMinutos(inicio))}
            {fim != null && fim !== inicio && ` → ${horaCurta(deMinutos(fim))}`}
          </span>
        )}
      </div>

      {nos.length > 1 && <Trilho nos={nos} />}

      {controle}
    </div>
  );
}

/**
 * O TRILHO: um ponto por parada, na ordem da viagem. Feito é limão, a parada
 * atual é a perua (âmbar, com o ícone), o que falta é apagado, quem está fora
 * hoje é tracejado, e a escola é um losango — a mesma legenda do mapa.
 * Decorativo para leitor de tela: a lista logo abaixo diz tudo isso em texto.
 */
function Trilho({ nos }) {
  return (
    <div className="mt-2 flex items-center overflow-hidden" aria-hidden="true">
      {nos.map((no, i) => {
        const anterior = nos[i - 1];
        const trechoFeito =
          anterior?.estado === 'feito' && no.estado !== 'falta';
        const escola = no.tipo === 'escola';
        const base = 'flex shrink-0 items-center justify-center transition-all duration-entrada ease-freio';
        let forma;
        if (no.estado === 'agora') {
          forma = `${base} h-6 w-6 bg-perua text-white ring-4 ring-perua/30 ${escola ? 'rotate-45 rounded-md' : 'rounded-full'}`;
        } else if (no.estado === 'feito') {
          forma = `${base} h-3.5 w-3.5 bg-accent ${escola ? 'rotate-45 rounded' : 'rounded-full'}`;
        } else if (no.estado === 'off') {
          forma = `${base} h-3.5 w-3.5 rounded-full border-2 border-dashed border-white/40`;
        } else {
          forma = `${base} h-3.5 w-3.5 ${escola ? 'rotate-45 rounded bg-escolaBorder' : 'rounded-full bg-white/25'}`;
        }
        return (
          <span key={no.chave} className="contents">
            {i > 0 && (
              <i
                className={`h-[3px] min-w-[3px] flex-1 transition-colors duration-entrada ${
                  trechoFeito ? 'bg-accent' : 'bg-white/20'
                }`}
              />
            )}
            <span className={forma}>
              {no.estado === 'agora' && (
                <Bus size={13} className={escola ? '-rotate-45' : ''} />
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
