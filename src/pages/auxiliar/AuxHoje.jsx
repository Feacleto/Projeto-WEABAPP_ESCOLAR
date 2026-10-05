import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Phone, MessageCircle, School, Wallet } from 'lucide-react';
import Header from '../../components/layout/Header';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useMeuVinculo, useTurmaDaAuxiliar } from '../../hooks/useAuxiliares';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { getEffectiveStatus } from '../../services/childrenService';
import { statusNaDirecao, getActionForStatus } from '../../services/routeStatusService';
import { marcarParadaPelaAuxiliar } from '../../services/auxiliarService';
import PixDaPerua from '../../components/route/PixDaPerua';
import { diaCompleto, getDateKey, horaCurta, deMinutos, precisaDaPerua, ROTULO_ESTADO } from '../../dominio/rota/horarios';
import { linkDoZap } from '../../dominio/identidade/auxiliar.js';

/**
 * HOJE — a turma do dia da auxiliar (05/10/2026, fase 2).
 *
 * Ela lê a CÓPIA que o servidor mantém (`turmaDaAuxiliar`), nunca `children`:
 * só nome, foto, escola, horário, quem é a família e o status do dia. Nada de
 * mensalidade, contrato ou saúde — e `testar:auxiliar` reprova valor aqui.
 *
 * A ordem é a mesma do motorista (`diaCompleto`): as viagens do dia pela
 * hora, quem faltou riscado no lugar.
 *
 * FASE 3: cada criança tem o próximo passo dela (EMBARQUEI, ENTREGUEI NA
 * ESCOLA, ENTREGUEI), e a marcação vai pelo SERVIDOR
 * (`marcarParadaPelaAuxiliar`) — ela não escreve em `children`. Só para a
 * frente: desfazer um toque errado é do motorista. O "Mostrar PIX da perua"
 * mostra a chave DELE.
 */
const ROTULO_DO_STATUS = {
  home: 'Em casa',
  onboard: 'Na perua',
  atSchool: 'Na escola',
  delivered: 'Entregue em casa',
};

export default function AuxHoje() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const vinculo = useMeuVinculo();
  const motoristaUid = profile?.motoristaUid || null;
  const { admin: motorista } = useAdminProfile(vinculo?.ativa ? motoristaUid : null);
  const marca = motorista?.marcaNome || motorista?.name || 'o motorista';
  const hoje = getDateKey();
  const { criancas, faltas } = useTurmaDaAuxiliar(vinculo?.ativa ? motoristaUid : null, hoje);

  const blocos = useMemo(
    () => (criancas ? diaCompleto(criancas, { declaracoes: faltas, escolasPorId: {} }) : []),
    [criancas, faltas]
  );
  const [marcando, setMarcando] = useState(null);
  async function marcar(child, acao) {
    setMarcando(child.id);
    try {
      const r = await marcarParadaPelaAuxiliar(child.id, acao.nextStatus);
      toast.success(r?.avisou ? 'Marcado. A família foi avisada.' : 'Marcado.');
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      toast.error(err?.message || 'Não deu para marcar. Tente de novo.');
    } finally {
      setMarcando(null);
    }
  }
  const vaoHoje = new Set(blocos.flatMap((b) => b.paradas.filter((p) => precisaDaPerua(p.estado)).map((p) => p.child.id))).size;

  if (vinculo && !vinculo.ativa) {
    return (
      <>
        <Header title="Hoje" />
        <div className="space-y-4 p-4">
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <h2 className="font-display text-xl font-bold text-text">{marca} encerrou o seu acesso</h2>
            <p className="mt-2 text-base text-textBody">Você não vê mais a turma nem a rota. Obrigado pelo trabalho.</p>
          </section>
          {/* Os pagamentos continuam dela depois do acesso encerrado (fase 4). */}
          <button
            type="button"
            onClick={() => navigate('/aux/pagamentos')}
            className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
          >
            <Wallet size={20} aria-hidden="true" />
            Ver os meus pagamentos
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Hoje" />
      <div className="space-y-4 p-4">
        <section className="rounded-2xl bg-primary p-5 text-white">
          <p className="rotulo text-menta">Perua de {marca}</p>
          <p className="mt-1 font-display text-2xl font-extrabold leading-tight">
            {criancas === null ? 'Carregando a turma…' : blocos.length === 0 ? 'Sem viagem hoje' : `${vaoHoje} ${vaoHoje === 1 ? 'criança vai' : 'crianças vão'} hoje`}
          </p>
        </section>

        {criancas === null && <Skeleton className="h-40 rounded-2xl" />}

        {blocos.map((b) => (
          <section key={`${b.direcao}-${b.inicio}`} className="space-y-2">
            <h2 className="px-1 font-display text-lg font-bold text-text">
              {b.direcao === 'ida' ? 'Ida' : 'Volta'} · sai {horaCurta(deMinutos(b.inicio))}
            </h2>
            {b.paradas.map((p) => {
              const fora = !precisaDaPerua(p.estado);
              const status = ROTULO_DO_STATUS[getEffectiveStatus(p.child)] || 'Em casa';
              const dir = b.direcao === 'ida' ? 'pickup' : 'dropoff';
              const acao = fora ? null : getActionForStatus(statusNaDirecao(p.child, faltas[p.child.id], dir), dir);
              return (
                <div key={p.child.id} className={`rounded-2xl bg-card px-3 py-2.5 shadow-rest ${fora ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-base font-semibold tabular-nums text-textBody">{horaCurta(p.hora)}</span>
                  <Avatar photoURL={p.child.photoURL} gender={p.child.gender} seed={p.child.id} kind="child" size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base font-bold ${fora ? 'text-textMuted line-through' : 'text-text'}`}>{p.child.name}</span>
                    <span className={`block text-sm ${fora ? 'font-semibold text-warningText' : 'text-textMuted'}`}>
                      {fora ? ROTULO_ESTADO[p.estado] || 'Fora hoje' : status}
                    </span>
                  </span>
                  {!fora && p.child.parentPhone && (
                    <span className="flex shrink-0 gap-1.5">
                      <a href={`tel:${p.child.parentPhone}`} aria-label={`Ligar para a família de ${p.child.name}`} className="tap flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary">
                        <Phone size={20} aria-hidden="true" />
                      </a>
                      <a href={linkDoZap(p.child.parentPhone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp da família de ${p.child.name}`} className="tap flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary">
                        <MessageCircle size={20} aria-hidden="true" />
                      </a>
                    </span>
                  )}
                </div>
                {acao && (
                  <button
                    type="button"
                    disabled={marcando === p.child.id}
                    onClick={() => marcar(p.child, acao)}
                    className="tap mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary bg-card text-base font-extrabold text-primary disabled:opacity-60"
                  >
                    {marcando === p.child.id ? 'Marcando…' : acao.shortLabel}
                  </button>
                )}
                </div>
              );
            })}
            {b.escolas?.length > 0 && (
              <p className="flex min-h-12 items-center gap-2 rounded-xl bg-escolaSoft px-3 text-base font-semibold text-escola">
                <School size={18} aria-hidden="true" />
                {b.escolas.map((e) => e.nome).join(' · ')}
              </p>
            )}
          </section>
        ))}

        <PixDaPerua perfil={motorista} />
        <p className="px-1 text-sm text-textMuted">
          O que você marca, {marca} vê na hora. Para desfazer um toque errado, fale com ele.
        </p>
      </div>
    </>
  );
}
