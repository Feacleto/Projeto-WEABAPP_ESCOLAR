import { useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import Button from '../common/Button';
import BotaoDeFalar from '../common/BotaoDeFalar';
import ConfirmDialog from '../common/ConfirmDialog';
import { recomendarAuxiliar, retirarRecomendacao } from '../../services/avaliacoesDaAuxiliarService';
import {
  MAX_FRASE,
  MAX_PONTOS,
  MIN_DIAS_PARA_RECOMENDAR,
  PONTOS_FORTES,
  alternarPonto,
  estadoParaOTio,
  podeRecomendar,
} from '../../dominio/identidade/avaliacaoDaAuxiliar.js';

/**
 * A RECOMENDAÇÃO QUE O TIO ESCREVE PARA A AUXILIAR (05/10/2026, decisão do
 * dono) — no cartão de cada ativa e em "Quem já trabalhou comigo".
 *
 * Sem estrela e sem número: até 3 pontos fortes da lista fechada e uma frase
 * de até 80 letras, assinada por ele. Ela lê antes e decide se aparece;
 * editar volta para "esperando ela aprovar". Quem decide os 30 dias, o filtro
 * da frase e a assinatura é o servidor — aqui a tela só não oferece o botão
 * antes do prazo (`dias` vem de `diasDeVinculo`, a mesma soma dos períodos).
 *
 * Os botões são de CONTORNO: o verde cheio da tela é do convite, e o da
 * folha é o "Enviar para … aprovar".
 */
const TOM = {
  ambar: 'bg-warningSoft text-warningText',
  verde: 'bg-sunken text-accentText',
  cinza: 'bg-sunken text-textMuted',
};

export default function RecomendarAuxiliar({ auxiliar, recomendacao }) {
  const [aberta, setAberta] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const nome = String(auxiliar?.nome || '').trim().split(/\s+/)[0] || 'ela';

  if (!podeRecomendar(auxiliar?.dias)) {
    if (recomendacao) return null; // não acontece: o servidor só grava com 30 dias
    return (
      <p className="text-base text-textBody">Recomendar fica disponível com {MIN_DIAS_PARA_RECOMENDAR} dias de trabalho.</p>
    );
  }

  const estado = estadoParaOTio(recomendacao, auxiliar?.nome);
  return (
    <div className="space-y-2">
      {estado && (
        <p className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-base font-semibold ${TOM[estado.tom]}`}>
          {estado.tom === 'verde' && <Check size={18} aria-hidden="true" />}
          {estado.texto}
        </p>
      )}
      <div className={`grid gap-2 ${recomendacao ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          onClick={() => setAberta(true)}
          className="tap min-h-12 rounded-xl border-2 border-primaryBorder bg-card px-3 text-base font-bold text-primary"
        >
          {recomendacao ? 'Editar recomendação' : 'Recomendar'}
        </button>
        {recomendacao && (
          <button
            type="button"
            onClick={() => setRetirando(true)}
            className="tap min-h-12 rounded-xl border-2 border-border bg-card px-3 text-base font-bold text-text"
          >
            Retirar
          </button>
        )}
      </div>

      {aberta && (
        <FolhaDaRecomendacao
          auxiliar={auxiliar}
          nome={nome}
          recomendacao={recomendacao}
          onClose={() => setAberta(false)}
        />
      )}

      <ConfirmDialog
        open={retirando}
        title={`Retirar a recomendação de ${nome}?`}
        description="Ela deixa de ter a sua recomendação."
        confirmLabel="Retirar"
        variant="danger"
        loading={ocupado}
        onConfirm={async () => {
          setOcupado(true);
          try {
            await retirarRecomendacao(auxiliar.uid);
            toast.success('Recomendação retirada.');
          } catch (err) {
            toast.error(err?.message || 'Não deu para retirar. Tente de novo.');
          } finally {
            setOcupado(false);
            setRetirando(false);
          }
        }}
        onCancel={() => setRetirando(false)}
      />
    </div>
  );
}

function FolhaDaRecomendacao({ auxiliar, nome, recomendacao, onClose }) {
  const [pontos, setPontos] = useState(() => (Array.isArray(recomendacao?.pontos) ? recomendacao.pontos : []));
  const [frase, setFrase] = useState(() => recomendacao?.frase || '');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const tocar = (id) => {
    const r = alternarPonto(pontos, id);
    setPontos(r.pontos);
    setAviso(r.cheio ? `Até ${MAX_PONTOS}` : '');
  };
  const mudarFrase = (t) => setFrase(String(t).slice(0, MAX_FRASE));

  async function enviar() {
    if (pontos.length === 0) return toast.error('Marque pelo menos um ponto forte.');
    setEnviando(true);
    try {
      await recomendarAuxiliar({ auxiliarUid: auxiliar.uid, pontos, frase: frase.trim() });
      toast.success(`Enviado. ${nome} vai ler e decidir.`);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não deu para enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Recomendar ${nome}`} subtitle="Para trabalhar junto">
      <div className="space-y-4">
        <div>
          <p className="text-base font-bold text-text">Pontos fortes (até {MAX_PONTOS})</p>
          <div className="mt-2 grid gap-2">
            {PONTOS_FORTES.map((p) => {
              const marcado = pontos.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => tocar(p.id)}
                  className={`tap flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 text-left text-base font-bold ${
                    marcado ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      marcado ? 'border-primary bg-primary text-white' : 'border-borderStrong'
                    }`}
                    aria-hidden="true"
                  >
                    {marcado && <Check size={16} />}
                  </span>
                  {p.rotulo}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="mt-1 min-h-6 text-base font-semibold text-warningText">{aviso}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="frase-da-recomendacao" className="block text-base font-bold text-text">Uma frase (se quiser)</label>
          <BotaoDeFalar valor={frase} onChange={mudarFrase} />
          <textarea
            id="frase-da-recomendacao"
            value={frase}
            onChange={(e) => mudarFrase(e.target.value)}
            rows={2}
            maxLength={MAX_FRASE}
            className="w-full rounded-2xl border-2 border-border bg-card p-3 text-base text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-base text-textBody">{frase.length} de {MAX_FRASE}</p>
          <p className="text-base text-textBody">Sem telefone, link ou nome de criança e família. Vai assinada por você.</p>
        </div>

        <Button onClick={enviar} loading={enviando}>Enviar para {nome} aprovar</Button>
      </div>
    </Sheet>
  );
}
