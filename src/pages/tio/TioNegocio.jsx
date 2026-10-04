import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, ChevronRight, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { calcularNivel } from '../../dominio/identidade/nivel.js';
import { marcarMarcoDeclarado } from '../../services/trilhaService';

/**
 * MEU NEGÓCIO — /tio/finance/negocio (docs/niveis.md, seção 6). A trilha do
 * negócio, que só o motorista vê: mora embaixo de `/tio/finance`, e por isso
 * fica atrás da senha do Financeiro sozinha (quem decide a tranca é o
 * CAMINHO — ver GuardaDoFinanceiro).
 *
 * Duas espécies de linha, e a tela não pode confundi-las:
 *   - ITEM: o APP confere ("o app confirmou"). Quando falta, o botão leva à
 *     tela onde aquilo se faz — nunca há "marcar como feito" à mão.
 *   - MARCO PARTICULAR: ele DECLARA ("você marcou"), com "Já fiz"/"Desfazer".
 *     ⚠️ Não conta para o nível (regra 2), e a tela diz isso no próprio bloco.
 *
 * ⚠️ A FASE 4 APARECE SEM PROMESSA: "Em breve", sem data e sem nome de
 * produto. Prometer prazo a um autônomo e não cumprir custa a confiança.
 *
 * Nada se mexe sozinho: as linhas mudam porque o dado mudou, sem animação.
 */

/** Onde cada item da trilha se faz. Item sem destino não ganha botão. */
const DESTINO_DO_ITEM = {
  despesasEmDoisMeses: { para: '/tio/finance/expenses', rotulo: 'Lançar despesa' },
  tanqueCheioDuasVezes: { para: '/tio/abastecer', rotulo: 'Abastecer' },
  usoDaPerua: { para: '/tio/finance/expenses', rotulo: 'Responder' },
  planoDaTroca: { para: '/tio/finance/reserva', rotulo: 'Fazer o plano' },
  reservaCriada: { para: '/tio/finance/reserva', rotulo: 'Criar a reserva' },
  contratoEmTodas: { para: '/tio/finance/turma', rotulo: 'Ver a turma' },
};

export default function TioNegocio() {
  const { fatos, carregando } = useFatosDoNivel();

  const trilha = useMemo(
    () => (carregando || !fatos ? null : calcularNivel(fatos).trilha),
    [fatos, carregando]
  );

  return (
    <div className="pb-28">
      <Header title="Meu negócio" showBack backLabel="Financeiro" backTo="/tio/finance" />

      <div className="space-y-4 p-4">
        <p className="text-base leading-snug text-textBody">
          Passos para organizar o seu negócio. Só você vê.
        </p>

        {trilha === null ? (
          <>
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
          </>
        ) : (
          <>
            {trilha.fases.map((fase) =>
              fase.contaParaDiamante ? (
                <Fase key={fase.id} fase={fase} />
              ) : (
                <FaseEmBreve key={fase.id} fase={fase} />
              )
            )}

            {trilha.completa && (
              <p className="flex items-start gap-3 rounded-2xl bg-primaryChip p-4 text-base font-bold leading-snug text-accentText">
                <CircleCheck size={22} className="mt-0.5 shrink-0" aria-hidden />
                Trilha completa — com a Platina, você chega ao Diamante.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Fase({ fase }) {
  const feitos = fase.itens.filter((i) => i.feito).length;
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-rest">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold leading-tight text-text">
          {fase.numero}. {fase.titulo}
        </h2>
        <span className="shrink-0 text-sm font-bold tabular-nums text-textMuted">
          {fase.completa ? 'Completa' : `${feitos} de ${fase.itens.length}`}
        </span>
      </div>

      <ul className="flex flex-col">
        {fase.itens.map((item, i) => (
          <Item key={item.id} item={item} divisor={i > 0} />
        ))}
      </ul>

      {fase.marcos.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-neutro p-3">
          <p className="text-sm leading-snug text-textBody">
            <b className="text-text">Para você acompanhar.</b> Estes você marca, e eles não contam
            para o nível.
          </p>
          <ul className="flex flex-col">
            {fase.marcos.map((marco, i) => (
              <Marco key={marco.id} marco={marco} divisor={i > 0} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Item({ item, divisor }) {
  const navigate = useNavigate();
  const destino = DESTINO_DO_ITEM[item.id];
  const classe = `flex min-h-16 items-center gap-3 py-3 ${divisor ? 'border-t border-neutro' : ''}`;

  if (item.feito) {
    return (
      <li className={classe}>
        <CircleCheck size={24} className="shrink-0 text-accentText" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">{item.titulo}</span>
          <span className="block text-sm text-accentText">O app confirmou</span>
        </span>
      </li>
    );
  }

  return (
    <li className={classe}>
      <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border" aria-hidden />
      <span className="min-w-0 flex-1 text-base text-text">{item.titulo}</span>
      {destino && (
        <button
          type="button"
          onClick={() => navigate(destino.para)}
          className="tap flex min-h-12 shrink-0 items-center gap-1 rounded-xl border-2 border-border bg-card px-3 text-sm font-bold text-text"
        >
          {destino.rotulo}
          <ChevronRight size={18} aria-hidden />
        </button>
      )}
    </li>
  );
}

function Marco({ marco, divisor }) {
  const { user } = useAuth();
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await marcarMarcoDeclarado(user?.uid, marco.id, !marco.declarado);
    } catch (err) {
      console.error('[trilha] marco', err);
      toast.error('Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className={`flex min-h-16 items-center gap-3 py-2 ${divisor ? 'border-t border-border' : ''}`}>
      {marco.declarado ? (
        <Flag size={22} className="shrink-0 text-textBody" aria-hidden />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border-2 border-border bg-card" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base text-text">{marco.titulo}</span>
        {marco.declarado && <span className="block text-sm text-textMuted">Você marcou</span>}
      </span>
      <button
        type="button"
        onClick={alternar}
        disabled={salvando}
        className={`tap flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${
          marco.declarado ? 'text-textBody' : 'bg-primary text-white'
        }`}
      >
        {marco.declarado ? 'Desfazer' : 'Já fiz'}
      </button>
    </li>
  );
}

function FaseEmBreve({ fase }) {
  return (
    <section className="flex flex-col gap-2 rounded-3xl border-2 border-dashed border-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold leading-tight text-textBody">
          {fase.numero}. {fase.titulo}
        </h2>
        <span className="shrink-0 rounded-full bg-neutro px-3 py-1 text-sm font-bold text-textBody">
          Em breve
        </span>
      </div>
      <p className="text-base leading-snug text-textMuted">
        Esta fase ainda não abriu. Quando abrir, ela aparece aqui.
      </p>
    </section>
  );
}
