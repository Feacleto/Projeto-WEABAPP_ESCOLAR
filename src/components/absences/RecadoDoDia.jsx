import { useState } from 'react';
import toast from 'react-hot-toast';
import { Send, Trash2 } from 'lucide-react';
import Input from '../common/Input';
import { useRecadoDoDia } from '../../hooks/useRecadosDoDia';
import { salvarRecadoDoDia, apagarRecadoDoDia } from '../../services/recadosDoDiaService';
import { RECADO_MAXIMO, letrasQueSobram, textoDoRecado } from '../../dominio/rota/recadoDoDia.js';

/**
 * "RECADO PARA O TIO (HOJE)" — o campo da família no aviso rápido do Início
 * (05/10/2026, decisão do dono), logo abaixo de "Não vai / Eu levo / Eu busco
 * / Quem busca": é o mesmo momento, o de avisar algo sobre o dia.
 *
 * Só para HOJE: o documento leva o dia no id, e o tio o lê no topo da ficha
 * rápida da rota, em âmbar. A auxiliar não lê. Até 140 letras; a família
 * edita e apaga quando quiser (`recadosDoDiaService`).
 *
 * ⚠️ "Para saúde, use a ficha da criança." mora EMBAIXO DO CAMPO (pedido do
 * jurídico): o recado é texto livre e pode trazer dado de saúde, e o caminho
 * com consentimento é a ficha (`SaudeDaCrianca`).
 *
 * O botão é de CONTORNO: o cheio do Início é a barra de baixo.
 */
export default function RecadoDoDia({ child, dateKey }) {
  const recado = useRecadoDoDia(child?.id, dateKey);
  // O rascunho só existe enquanto ela edita; sem ele, o campo mostra o que
  // está gravado (e acompanha se o recado mudar em outro aparelho).
  const [rascunho, setRascunho] = useState(null);
  const [enviando, setEnviando] = useState(false);
  if (!child?.id || recado === undefined) return null;

  const gravado = recado?.texto || '';
  const texto = rascunho ?? gravado;
  const mudou = texto.replace(/\s+/g, ' ').trim() !== gravado;
  const sobram = letrasQueSobram(texto);

  async function mandar() {
    const r = textoDoRecado(texto);
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    setEnviando(true);
    try {
      await salvarRecadoDoDia({ child, dateKey, texto: r.texto, existe: !!recado });
      setRascunho(null);
      toast.success('Recado enviado ao motorista.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Não deu pra mandar o recado. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  async function apagar() {
    setEnviando(true);
    try {
      await apagarRecadoDoDia(dateKey, child.id);
      setRascunho(null);
      toast.success('Recado apagado.');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra apagar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Input
        label="Recado para o tio (hoje)"
        value={texto}
        onChange={(e) => setRascunho(e.target.value.slice(0, RECADO_MAXIMO))}
        maxLength={RECADO_MAXIMO}
        falar="texto"
        semSalvar
        hint={sobram >= 0 ? `Cabem mais ${sobram} letras.` : undefined}
      />
      <p className="text-base text-textMuted">Para saúde, use a ficha da criança.</p>
      <div className={`grid gap-2 ${recado ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={enviando || !mudou || !texto.trim()}
          onClick={mandar}
          className="tap flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-3 text-base font-bold text-primary disabled:opacity-50"
        >
          <Send size={18} aria-hidden="true" />
          {recado ? 'Mudar recado' : 'Mandar recado'}
        </button>
        {recado && (
          <button
            type="button"
            disabled={enviando}
            onClick={apagar}
            className="tap flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-3 text-base font-bold text-text disabled:opacity-50"
          >
            <Trash2 size={18} aria-hidden="true" />
            Apagar
          </button>
        )}
      </div>
    </div>
  );
}
