import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import CampoDeValor from '../../components/common/CampoDeValor';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Skeleton from '../../components/common/Skeleton';
import PagamentoDaAuxiliar from '../../components/auxiliar/PagamentoDaAuxiliar';
import { useAuth } from '../../hooks/useAuth';
import { useAuxiliaresDoMotorista } from '../../hooks/useAuxiliares';
import { useSubstitutas } from '../../hooks/useSubstitutas';
import { useRecomendacoesQueEscrevi } from '../../hooks/useAvaliacoesDaAuxiliar';
import RecomendarAuxiliar from '../../components/avaliacaoDaAuxiliar/RecomendarAuxiliar';
import NotaDasAuxiliares from '../../components/avaliacaoDaAuxiliar/NotaDasAuxiliares';
import HojeDaAuxiliar from '../../components/auxiliar/HojeDaAuxiliar';
import ControleDoMes from '../../components/auxiliar/ControleDoMes';
import { getDateKey } from '../../dominio/rota/horarios.js';
import { convidarAuxiliar, desativarAuxiliar } from '../../services/auxiliarService';
import {
  historicoDeAuxiliares,
  rotatividade,
  mensagemDoConviteDeAuxiliar,
  urlDoConviteDeAuxiliar,
  linkDoZap,
} from '../../dominio/identidade/auxiliar.js';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';

/**
 * A AUXILIAR, DO LADO DO MOTORISTA — `/tio/finance/auxiliar` (05/10/2026, simulação
 * "Aba Auxiliar do Motorista" aprovada pelo dono; fase 1).
 *
 * Aqui ele chama uma auxiliar nova (o link vai pelo WhatsApp e a conta dela
 * nasce ligada a ele), vê quem está ativa, desativa na hora e vê quem já
 * trabalhou com ele — a rotatividade dele, só para ele.
 *
 * Mora embaixo de `/tio/finance` (atrás da senha) desde a seção Auxiliar da
 * Central: o pagamento dela vai pôr valores aqui.
 *
 * Fase 4: o pagamento dela, em `PagamentoDaAuxiliar` (ele anota, ela
 * confirma "Recebi").
 * Fase 5: a falta de hoje no cartão de cada ativa (`HojeDaAuxiliar`), o
 * controle do mês e a porta para "Minhas substitutas".
 *
 * O vínculo é por PAR (`auxiliares/{ele}_{ela}`): desativar fecha o período e
 * o documento fica, então "Quem já trabalhou comigo" nunca perde ninguém — nem
 * quando ela vai trabalhar também para outro tio.
 *
 * AS AVALIAÇÕES (05/10/2026): com 30 dias de trabalho (a soma dos períodos),
 * "Recomendar" no cartão de cada uma — ela aprova antes de aparecer — e, no
 * topo, a nota que as auxiliares dão a ele: só a média, com 3 ou mais.
 */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function mesAno(ms) {
  if (ms == null) return '…';
  const d = new Date(ms);
  return `${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

export default function TioAuxiliar() {
  const { profile } = useAuth();
  const vinculos = useAuxiliaresDoMotorista();
  // Fase 5: a falta de hoje, as substitutas e o controle do mês.
  const { substitutas, faltas } = useSubstitutas();
  const recomendacoes = useRecomendacoesQueEscrevi();
  const recomendacaoDe = (auxUid) => (recomendacoes || []).find((r) => r.auxiliarUid === auxUid) || null;
  const hoje = getDateKey();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [convite, setConvite] = useState(null);
  const [desativando, setDesativando] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const historico = historicoDeAuxiliares(vinculos || []);
  const ativas = historico.filter((h) => h.ativa);
  const sairam = historico.filter((h) => !h.ativa);
  const rot = rotatividade(vinculos || []);
  const marca = profile?.marcaNome || profile?.name || 'o seu motorista';

  async function convidar() {
    if (!nome.trim()) return toast.error('Qual o nome dela?');
    if (!isValidPhone(telefone)) return toast.error('WhatsApp com DDD.');
    setEnviando(true);
    try {
      const codigo = await convidarAuxiliar({ nome: nome.trim(), telefone: unmaskPhone(telefone), valorMensal: Number(valor) || null });
      const link = urlDoConviteDeAuxiliar(codigo, window.location.origin);
      setConvite({ nome: nome.trim(), telefone: unmaskPhone(telefone), link });
      setNome(''); setTelefone(''); setValor('');
    } catch (err) {
      toast.error(err?.message || 'Não deu para criar o convite. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Header title="Auxiliar" showBack backLabel="Central" backTo="/tio/finance" />
      <div className="space-y-4 p-4">
        {historico.length > 0 && <NotaDasAuxiliares />}
        {vinculos === null ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : ativas.length === 0 ? (
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <p className="font-display text-lg font-bold text-text">Você está sem auxiliar</p>
            <p className="mt-1 text-base text-textBody">Ela entra com a conta dela, no celular dela, e você desativa quando quiser.</p>
          </section>
        ) : (
          ativas.map((a) => (
            <section key={a.uid} className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
              <div>
                <p className="font-display text-lg font-bold text-text">{a.nome}</p>
                <p className="text-base text-textBody">Desde {mesAno(a.desdeMs)} · vê a turma e a rota de hoje</p>
                <p className="mt-1 text-sm text-textMuted">Ela não vê mensalidade, contrato nem a sua Central.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={linkDoZap(a.telefone)}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primaryBorder bg-primarySoft text-base font-bold text-primary"
                >
                  <MessageCircle size={20} aria-hidden="true" />
                  Falar
                </a>
                <button
                  type="button"
                  onClick={() => setDesativando(a)}
                  className="tap min-h-12 rounded-xl border-2 border-dangerBorder bg-dangerSoft text-base font-bold text-dangerText"
                >
                  Desativar acesso
                </button>
              </div>
              <HojeDaAuxiliar auxiliar={a} dateKey={hoje} faltas={faltas} substitutas={substitutas} />
              <PagamentoDaAuxiliar auxiliar={a} />
              {recomendacoes !== null && <RecomendarAuxiliar auxiliar={a} recomendacao={recomendacaoDe(a.uid)} />}
            </section>
          ))
        )}

        {historico.length > 0 && <ControleDoMes faltas={faltas} monthKey={hoje.slice(0, 7)} />}

        <Link
          to="/tio/finance/auxiliar/substitutas"
          className="tap flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-2 shadow-rest"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-text">Minhas substitutas</span>
            <span className="block text-sm text-textMuted">
              {(substitutas || []).length} {(substitutas || []).length === 1 ? 'contato' : 'contatos'} para quando a auxiliar faltar
            </span>
          </span>
          <ChevronRight size={20} className="text-textMuted" aria-hidden="true" />
        </Link>

        {/* CONVIDAR — o link sai pelo WhatsApp. */}
        <section className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
          <h2 className="font-display text-lg font-bold text-text">Convidar auxiliar</h2>
          {convite ? (
            <>
              <p className="text-base text-textBody">Convite pronto para {convite.nome}. O link vale 15 dias e só serve para ela.</p>
              <a
                href={linkDoZap(convite.telefone, mensagemDoConviteDeAuxiliar({ marca, nome: convite.nome, link: convite.link }))}
                target="_blank"
                rel="noreferrer"
                className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-white shadow-focus"
              >
                <MessageCircle size={22} aria-hidden="true" />
                Mandar no WhatsApp
              </a>
              <Button variant="secondary" onClick={() => setConvite(null)}>Convidar outra pessoa</Button>
            </>
          ) : (
            <>
              <Input label="Nome dela" value={nome} onChange={(e) => setNome(e.target.value)} falar="nome" semSalvar />
              <Input label="WhatsApp" inputMode="tel" value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} falar="telefone" semSalvar />
              <CampoDeValor label="Quanto vai pagar por mês (se quiser anotar)" value={valor} onChange={setValor} />
              <p className="text-sm text-textMuted">
                Ela vai poder ver a turma e a rota de hoje, marcar embarque e entrega e ligar para as famílias. Nunca vê
                mensalidade, contrato nem saúde das crianças.
              </p>
              <Button icon={UserPlus} onClick={convidar} loading={enviando}>Criar convite</Button>
            </>
          )}
        </section>

        {/* QUEM JÁ TRABALHOU COMIGO — e a rotatividade, só para ele. */}
        {historico.length > 0 && (
          <section className="space-y-3">
            <h2 className="px-1 font-display text-lg font-bold text-text">Quem já trabalhou comigo</h2>
            <div className="grid grid-cols-3 gap-2">
              <Numero valor={rot.total} rotulo={rot.total === 1 ? 'auxiliar no total' : 'auxiliares no total'} />
              <Numero valor={rot.mediaDeMeses == null ? '—' : `${rot.mediaDeMeses} ${rot.mediaDeMeses === 1 ? 'mês' : 'meses'}`} rotulo="ficam, em média" />
              <Numero valor={rot.ultimos12} rotulo="nos últimos 12 meses" />
            </div>
            {sairam.map((h) => (
              <div key={h.uid} className="space-y-2 rounded-2xl bg-card px-4 py-2 shadow-rest">
              <div className="flex min-h-16 items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-text">{h.nome}</span>
                  <span className="block text-sm text-textMuted">
                    {/* O tempo é a SOMA dos períodos (`diasDeVinculo`): quem
                      * saiu e voltou aparece uma vez, com tudo somado. */}
                    {mesAno(h.primeiroMs)} a {mesAno(h.ateMs)} · {h.meses} {h.meses === 1 ? 'mês' : 'meses'}
                    {h.voltas > 0 ? ` em ${h.voltas + 1} períodos` : ''}
                  </span>
                </span>
                <a
                  href={linkDoZap(h.telefone)}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primaryBorder bg-primarySoft px-3 text-base font-bold text-primary"
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  Falar
                </a>
              </div>
              {recomendacoes !== null && <RecomendarAuxiliar auxiliar={h} recomendacao={recomendacaoDe(h.uid)} />}
              </div>
            ))}
            <Link
              to="/tio/finance/auxiliar/substitutas"
              className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-text"
            >
              Ver minhas substitutas
            </Link>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={!!desativando}
        title={desativando ? `Desativar o acesso de ${desativando.nome}?` : ''}
        description="Ela perde a turma e a rota na hora. Os pagamentos dela continuam com ela."
        confirmLabel="Desativar"
        variant="danger"
        loading={ocupado}
        onConfirm={async () => {
          setOcupado(true);
          try {
            await desativarAuxiliar(desativando.uid);
            toast.success('Acesso encerrado.');
          } catch (err) {
            toast.error(err?.message || 'Não deu para desativar. Tente de novo.');
          } finally {
            setOcupado(false);
            setDesativando(null);
          }
        }}
        onCancel={() => setDesativando(null)}
      />
    </>
  );
}

function Numero({ valor, rotulo }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-rest">
      <p className="font-display text-xl font-extrabold text-text">{valor}</p>
      <p className="text-sm leading-tight text-textMuted">{rotulo}</p>
    </div>
  );
}
