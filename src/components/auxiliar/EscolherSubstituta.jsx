import { useState } from 'react';
import { ChevronRight, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import Input from '../common/Input';
import CampoDeValor from '../common/CampoDeValor';
import { registrarSubstituicao } from '../../services/substitutasService';
import { linhaDaEscolha, ordenarSubstitutas, valorDoDia } from '../../dominio/identidade/faltaDaAuxiliar.js';
import { maskPhone } from '../../compartilhado/masks';

/**
 * "QUEM SUBSTITUIU HOJE?" — a escolha na lista de substitutas (fase 5).
 *
 * Uma folha, três passos: a LISTA (quem mais veio primeiro, porque é quem ele
 * chama de novo), o VALOR do dia — já com o último que ele pagou a ela — e,
 * para quem não está na lista, "Outra pessoa" com nome e WhatsApp, que entra
 * na lista no mesmo toque. Folha e não tela: ele está no meio do dia.
 *
 * O valor vira despesa do mês. O app não desconta nada do pagamento da
 * auxiliar — isso é conversa entre os dois.
 */
export default function EscolherSubstituta({ open, onClose, falta, substitutas, faltas }) {
  const [passo, setPasso] = useState('lista');
  const [escolhida, setEscolhida] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setPasso('lista');
    setEscolhida(null);
    setNome('');
    setTelefone('');
    setValor('');
    onClose?.();
  }

  function escolher(s) {
    setEscolhida(s);
    const ultimo = valorDoDia(s.ultimoValor);
    setValor(ultimo ? ultimo.toFixed(2) : '');
    setPasso('valor');
  }

  async function confirmar() {
    setSalvando(true);
    try {
      await registrarSubstituicao({
        falta,
        substituta: passo === 'valor' ? escolhida : null,
        nova: passo === 'nova' ? { nome, telefone } : null,
        valor,
        faltas: faltas || [],
      });
      toast.success('Substituição registrada.');
      fechar();
    } catch (err) {
      toast.error(err?.message || 'Não deu para registrar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const lista = ordenarSubstitutas(substitutas || []);
  const titulo = passo === 'valor' ? escolhida?.nome : passo === 'nova' ? 'Outra pessoa' : 'Quem substituiu hoje?';

  return (
    <Sheet open={open} onClose={fechar} onBack={passo === 'lista' ? undefined : () => setPasso('lista')} title={titulo}>
      {passo === 'lista' && (
        <div className="space-y-2">
          {lista.length === 0 && (
            <p className="text-base text-textBody">Sua lista de substitutas está vazia. Toque em "Outra pessoa".</p>
          )}
          {lista.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => escolher(s)}
              className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-text">{s.nome}</span>
                <span className="block text-sm text-textMuted">{linhaDaEscolha(s)}</span>
              </span>
              <ChevronRight size={20} className="text-textMuted" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setValor(''); setPasso('nova'); }}
            className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primaryBorder bg-primarySoft text-base font-bold text-primary"
          >
            <UserPlus size={20} aria-hidden="true" />
            Outra pessoa
          </button>
        </div>
      )}

      {passo === 'valor' && (
        <div className="space-y-4">
          <CampoDeValor label="Quanto você pagou pelo dia" value={valor} onChange={setValor} autoFocus />
          <p className="text-sm text-textMuted">Entra nas despesas do mês. O app não desconta nada da auxiliar.</p>
          <SheetCTA onClick={confirmar} loading={salvando}>Confirmar</SheetCTA>
        </div>
      )}

      {passo === 'nova' && (
        <div className="space-y-4">
          <Input label="Nome dela" value={nome} onChange={(e) => setNome(e.target.value)} falar="nome" semSalvar />
          <Input label="WhatsApp" inputMode="tel" value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} falar="telefone" semSalvar />
          <CampoDeValor label="Quanto você pagou pelo dia" value={valor} onChange={setValor} />
          <p className="text-sm text-textMuted">Ela entra na sua lista de substitutas. Não precisa ter conta no app.</p>
          <SheetCTA onClick={confirmar} loading={salvando}>Confirmar</SheetCTA>
        </div>
      )}
    </Sheet>
  );
}
