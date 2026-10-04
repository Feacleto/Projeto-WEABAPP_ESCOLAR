import { useState } from 'react';
import { Check, MapPin, Plus } from 'lucide-react';
import Sheet, { SheetCTA } from '../common/Sheet';
import Input from '../common/Input';
import { formatCurrency } from '../../compartilhado/formatters';
import {
  haQuantoTempo,
  mesmoPosto,
  nomeDoPosto,
  postosEmOrdem,
} from '../../dominio/cobranca/combustivel.js';

/**
 * TROCAR DE POSTO (03/10/2026).
 *
 *   <EscolherPostoSheet open onClose postos escolhido onEscolher />
 *
 *   postos      `configFinanceiro.postos` como veio (a folha ordena)
 *   escolhido   o nome do posto em uso na tela, para marcar na lista
 *   onEscolher  (nome) => void — o nome já limpo por `nomeDoPosto`
 *
 * ⚠️ A LISTA É A MEMÓRIA DELE, NA ORDEM EM QUE ELE VIU — nunca do mais barato
 * para o mais caro, e nenhum posto ganha destaque. Ordenar pelo preço seria o
 * app escolhendo o posto por ele, e a escolha tem outros critérios (caminho,
 * fila, confiança na bomba). O preço aparece com HÁ QUANTO TEMPO ele o viu,
 * porque preço de duas semanas atrás não é preço de hoje.
 *
 * "Cadastrar posto" pede só o nome. Nada é gravado aqui: o posto entra na
 * lista quando ele guarda um preço ou lança um abastecimento nele.
 */
export default function EscolherPostoSheet({ open, onClose, postos, escolhido, onEscolher }) {
  if (!open) return null;
  return (
    <Folha onClose={onClose} postos={postos} escolhido={escolhido} onEscolher={onEscolher} />
  );
}

function Folha({ onClose, postos, escolhido, onEscolher }) {
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(null);
  const lista = postosEmOrdem(postos || []).filter((p) => nomeDoPosto(p?.nome));
  const hoje = new Date();

  const escolher = (n) => {
    onEscolher?.(nomeDoPosto(n));
    onClose?.();
  };

  const cadastrar = () => {
    const limpo = nomeDoPosto(nome);
    if (!limpo) {
      setErro('Escreva o nome do posto.');
      return;
    }
    escolher(limpo);
  };

  return (
    <Sheet open onClose={onClose} title="Trocar de posto" icon={MapPin}>
      <div className="space-y-4">
        {lista.length === 0 ? (
          <p className="text-base text-textMuted">Nenhum posto guardado ainda.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border-2 border-border">
            {lista.map((p, i) => {
              const ativo = mesmoPosto(p.nome, escolhido);
              const quando = haQuantoTempo(p.vistoEm, hoje);
              return (
                <li key={p.nome} className={i > 0 ? 'border-t border-neutro' : ''}>
                  <button
                    type="button"
                    onClick={() => escolher(p.nome)}
                    aria-current={ativo ? 'true' : undefined}
                    className={`tap flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left ${
                      ativo ? 'bg-primarySoft' : 'bg-card'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-bold text-text">{p.nome}</span>
                      {typeof p.preco === 'number' && (
                        <span className="block text-[15px] tabular-nums text-textMuted">
                          {formatCurrency(p.preco)} o litro{quando ? ` · ${quando}` : ''}
                        </span>
                      )}
                    </span>
                    {ativo && <Check size={22} className="shrink-0 text-primary" aria-label="Em uso" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {cadastrando ? (
          <div className="space-y-3">
            <Input falar="nome"
              label="Nome do posto"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErro(null);
              }}
              maxLength={60}
              error={erro}
              autoFocus
              avancar={false}
              enterKeyHint="done"
              onKeyUp={(e) => {
                if (e.key === 'Enter') cadastrar();
              }}
            />
            <SheetCTA onClick={cadastrar}>Usar este posto</SheetCTA>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCadastrando(true)}
            className="tap inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borderStrong bg-card text-base font-bold text-primary"
          >
            <Plus size={20} />
            Cadastrar posto
          </button>
        )}
      </div>
    </Sheet>
  );
}
