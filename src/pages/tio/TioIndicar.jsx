import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { indicar, watchIndicacoesDe } from '../../services/indicacaoService';
import {
  resumoDoIndicador,
  situacaoDaIndicacao,
  validarIndicacao,
} from '../../dominio/identidade/indicacao.js';
import {
  DESCONTO_POR_INDICACAO,
  PISO_DA_FATURA,
} from '../../dominio/associacao/planos.js';
import { maskPhone } from '../../compartilhado/masks';
import { formatCurrency } from '../../compartilhado/formatters';
import { SITE_INSTITUCIONAL } from '../../config/vitrine';

/**
 * INDICAR OUTRO MOTORISTA — /tio/indicar
 *
 * ── ⚠️ A TELA EXISTE POR CAUSA DE UMA FRASE
 * *"Indiquei e não recebi."* É a queixa que as duas falhas possíveis produzem —
 * o telefone que não bateu e a indicação que não devia valer — e numa rede de
 * indicação ela viaja mais rápido que a indicação.
 *
 * Sem uma tela que mostre o estado de cada uma, não há como responder a ela: o
 * motorista lembra que indicou cinco, a conta dele desconta uma, e ninguém
 * consegue mostrar onde as outras quatro pararam.
 *
 * ── OS TRÊS NÚMEROS SÃO SEPARADOS DE PROPÓSITO
 * "Indiquei 5" e "2 valem desconto" são frases diferentes. Juntá-las num
 * número só é literalmente como a reclamação nasce.
 *
 * ── E A CARÊNCIA É DITA ANTES, NÃO DEPOIS
 * "Vale quando ele pagar o primeiro mês" aparece no cabeçalho, antes de ele
 * indicar alguém — e não como explicação quando o desconto não veio. Regra de
 * dinheiro contada só na hora da frustração é regra que parece desculpa.
 */
export default function TioIndicar() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState(null);
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return watchIndicacoesDe(user.uid, setLista, () => setLista([]));
  }, [user?.uid]);

  const indicador = { uid: user?.uid, name: profile?.name, phone: profile?.phone };
  const { ok, erro } = validarIndicacao({
    indicador,
    telefone,
    jaIndicados: (lista || []).map((i) => i.telefoneDigitado),
  });
  const resumo = resumoDoIndicador(lista || []);

  const porIndicacao = Math.round(DESCONTO_POR_INDICACAO * 100);
  // ⚠️ NÃO HÁ MAIS TETO PERCENTUAL, E A TELA PRECISA DIZER O QUE HÁ.
  //
  // A frase antiga era "até 50% — 5 indicações zeram metade dela", e o teto
  // saiu porque não protegia margem nenhuma (a fatura chegava a zero de
  // qualquer forma). O que limita agora é o PISO, em reais — e ele é publicado
  // aqui de propósito: piso aplicado em silêncio é a origem da queixa que esta
  // tela inteira existe para evitar.
  const piso = PISO_DA_FATURA;

  const enviar = async () => {
    setSalvando(true);
    try {
      await indicar(indicador, { telefone, nome });
      toast.success('Indicação registrada.');
      setTelefone('');
      setNome('');
    } catch (err) {
      toast.error(err.message || 'Não deu pra indicar.');
    } finally {
      setSalvando(false);
    }
  };

  const convite = `Oi! Eu uso o Alô Buzinou pra organizar meu transporte escolar — rota ao vivo pras famílias, mensalidade e recados num lugar só. Dá uma olhada: ${SITE_INSTITUCIONAL}`;

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="border-b border-border bg-card px-5 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap -ml-1 inline-flex items-center gap-1 p-1 text-xs text-textMuted"
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <h1 className="mt-2 text-lg font-extrabold tracking-tight text-text">
          Indicar outro motorista
        </h1>
        {/* A REGRA INTEIRA, ANTES DE ELE INDICAR. Contada só na hora em que o
          * desconto não veio, ela pareceria desculpa. */}
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Cada motorista que você trouxer vale <strong>{porIndicacao}%</strong> na
          sua conta, todo mês, enquanto ele estiver com a gente — sem limite de
          quantidade. Os descontos descem até o piso de {formatCurrency(piso)},
          que é a manutenção do ambiente. O
          desconto entra quando <strong>ele pagar o primeiro mês</strong>, não
          quando se cadastra.
        </p>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
            <UserPlus size={15} />
            Quem você quer indicar
          </h2>
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-textMuted">Nome (opcional)</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como você o chama"
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-textMuted">WhatsApp dele</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                inputMode="tel"
                placeholder="(11) 98765-4321"
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text"
              />
            </label>
            {/* O erro só depois de ele digitar: repreender um campo em branco
              * que a pessoa nem tocou é a tela brigando antes da conversa. */}
            {erro && telefone.length > 3 && <p className="text-xs text-dangerText">{erro}</p>}
          </div>

          <button
            type="button"
            onClick={enviar}
            disabled={!ok || salvando}
            className="tap mt-3 h-11 w-full rounded-xl bg-primary text-xs font-bold text-white disabled:opacity-40"
          >
            {salvando ? 'Registrando…' : 'Registrar indicação'}
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(convite)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-bold text-text"
          >
            <Share2 size={13} />
            Mandar o convite no WhatsApp
          </a>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-extrabold text-text">Suas indicações</h2>
          {/* ⚠️ OS TRÊS NÚMEROS, SEPARADOS. Um número só é como nasce o
            * "indiquei e não recebi". */}
          <p className="mt-1 text-xs text-textMuted">
            {resumo.total} no total · <strong className="text-primary">{resumo.ativas}</strong>{' '}
            valendo desconto agora
          </p>

          {lista === null ? null : !lista.length ? (
            <p className="mt-3 text-xs text-textMuted">
              Você ainda não indicou ninguém.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {lista.map((i) => (
                <li key={i.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-text">
                    {i.nome || i.telefoneDigitado}
                  </p>
                  <p className="text-[11px] text-textMuted">
                    {/* O TELEFONE COMO ELE DIGITOU. Mostrar a chave
                      * normalizada faria ele achar que indicou outra pessoa. */}
                    {i.telefoneDigitado} · {situacaoDaIndicacao(i)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
