import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { useAtividadesDaPlatina } from '../../hooks/useAtividadesDaPlatina';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import {
  CATALOGO_PLATINA,
  calcularNivel,
  diasRestantes,
  paraData,
  prazoDaAtividade,
} from '../../dominio/identidade/nivel.js';
import Button from '../common/Button';
import { DESTINO_DA_ATIVIDADE, listaDeAtividades, posicaoDoNivel } from './rotuloDoNivel';

/**
 * O ÚNICO CARTÃO DO NÍVEL NO INÍCIO (docs/niveis.md, seções 5 e 7): uma
 * atividade de Platina a 7 dias do prazo, ainda não feita e não vencida.
 * Fora disso, nada — missão nunca aparece no Início.
 *
 * ── SÓ A PARTIR DO OURO
 * Antes do Ouro a Platina não está em jogo, e cobrar prazo de quem ainda
 * está aprendendo o app seria ruído no Início. (A atividade feita antes
 * continua contando quando ele chegar lá — regra 5.)
 *
 * ── DUAS ETAPAS, PELO CUSTO
 * Saber se está "feita" exige os fatos (o doc dele, a turma, as despesas, o
 * Financeiro…). O Início é a tela mais aberta do app, então a primeira etapa
 * olha só as DATAS das atividades; os fatos só são lidos quando alguma está
 * de fato na janela dos 7 dias.
 */
export default function CartaoPrazoPlatina({ className = '' }) {
  const { user } = useAuth();
  const { nivel } = useNivel(user?.uid || null);
  const atividades = listaDeAtividades(useAtividadesDaPlatina());

  const naJanela = useMemo(() => {
    const agora = new Date();
    return atividades.filter((a) => {
      if (!a || a.ativa === false || !CATALOGO_PLATINA[a.verificacao]) return false;
      const lancada = paraData(a.lancadaEm);
      if (!lancada || lancada.getTime() > agora.getTime()) return false;
      const prazo = prazoDaAtividade(a.lancadaEm);
      if (!prazo || agora.getTime() >= prazo.getTime()) return false; // vencida
      return diasRestantes(a.lancadaEm, agora) <= 7;
    });
  }, [atividades]);

  if (posicaoDoNivel(nivel) < posicaoDoNivel('ouro')) return null;
  if (naJanela.length === 0) return null;
  return <CartaoComFatos atividades={naJanela} className={className} />;
}

function CartaoComFatos({ atividades, className }) {
  const navigate = useNavigate();
  const { fatos } = useFatosDoNivel();
  if (!fatos) return null;

  const { platina } = calcularNivel(fatos, { atividades });
  const pendente = platina.atividades
    .filter((a) => !a.feita && !a.vencida && a.diasRestantes <= 7)
    .sort((a, b) => a.diasRestantes - b.diasRestantes)[0];
  if (!pendente) return null;

  const doc = atividades.find((a) => a.id === pendente.id);
  const destino = DESTINO_DA_ATIVIDADE[doc?.verificacao] || '/tio/nivel';
  const quando = pendente.diasRestantes === 0
    ? 'O prazo termina hoje.'
    : pendente.diasRestantes === 1
      ? 'Falta 1 dia.'
      : `Faltam ${pendente.diasRestantes} dias.`;

  return (
    <div className={`space-y-3 rounded-2xl bg-card p-4 shadow-rest ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip">
          <Clock size={22} className="text-primary" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-text">{pendente.titulo}</p>
          <p className="text-base text-textBody">
            {quando} É o que mantém sua Platina.
          </p>
        </div>
      </div>
      <Button size="md" className="w-full" onClick={() => navigate(destino)}>
        Fazer agora
      </Button>
    </div>
  );
}
