import { MessageCircle, Phone } from 'lucide-react';
import Sheet from '../common/Sheet';
import Avatar from '../common/Avatar';
import { linkDoZap } from '../../dominio/identidade/auxiliar.js';

/**
 * A FICHA RÁPIDA NA ROTA — a moldura (05/10/2026, decisão do dono).
 *
 * Tocar numa criança da rota (na perua, na escola ou na fila de casa) abre
 * esta folha. A MOLDURA é a mesma para o tio e para a auxiliar; o que muda é
 * o conteúdo, e ele é montado por quem chama:
 *   - `FichaRapidaDoTio`      recado de hoje, quem busca, horário, responsável,
 *                             endereço, saúde e "Ver ficha completa";
 *   - `FichaRapidaDaAuxiliar` só o que a cópia da turma dela leva.
 * São dois arquivos de propósito: o da auxiliar não pode nem citar os campos
 * que ela não vê, e `testar:rota-ao-vivo` confere isso lendo o arquivo.
 *
 * `aviso` é o bloco âmbar do topo (o recado de hoje): âmbar é aviso, algo a
 * atender antes de entregar a criança. `linhas` é `[{ titulo, valor, nota }]`.
 * O WhatsApp é o botão cheio da folha; Ligar, o de contorno.
 */
export default function FichaRapida({ open, onClose, child, lugar, aviso = null, linhas = [], telefone = null, rodape = null }) {
  if (!open || !child) return null;
  return (
    <Sheet open={open} onClose={onClose} title={child.name || 'Criança'}>
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <Avatar photoURL={child.photoURL} gender={child.gender} seed={child.id} kind="child" size="md" />
          <p className="text-base font-semibold text-textBody">{lugar}</p>
        </div>

        {aviso && (
          <div className="rounded-xl border border-warningBorder bg-warningSoft p-3">
            <p className="text-base font-bold text-warningText">{aviso.titulo}</p>
            <p className="mt-1 text-base text-text">{aviso.texto}</p>
          </div>
        )}

        <dl className="divide-y divide-border rounded-xl bg-surface px-3">
          {linhas.filter((l) => l && l.valor).map((l) => (
            <div key={l.titulo} className="py-2.5">
              <dt className="text-sm font-semibold text-textMuted">{l.titulo}</dt>
              <dd className="text-base text-text">
                {l.valor}
                {l.nota && <span className="block text-sm text-textMuted">{l.nota}</span>}
              </dd>
            </div>
          ))}
        </dl>

        {telefone && (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={linkDoZap(telefone)}
              target="_blank"
              rel="noreferrer"
              className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca"
            >
              <MessageCircle size={20} aria-hidden="true" />
              WhatsApp
            </a>
            <a
              href={`tel:${String(telefone).replace(/\D/g, '')}`}
              className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
            >
              <Phone size={20} aria-hidden="true" />
              Ligar
            </a>
          </div>
        )}

        {rodape}
      </div>
    </Sheet>
  );
}
