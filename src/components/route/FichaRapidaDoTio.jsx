import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import FichaRapida from './FichaRapida';
import { horaCurta, horariosCombinados, ROTULO_ESTADO } from '../../dominio/rota/horarios';
import { rotuloDoLugar } from '../../dominio/rota/zonasDaRota.js';

/**
 * A FICHA RÁPIDA DO TIO NA ROTA (05/10/2026, decisão do dono), nesta ordem:
 *   1. o RECADO DE HOJE, em âmbar, se houver;
 *   2. quem busca hoje (senão, "o responsável de sempre");
 *   3. o horário combinado (pegar na ida, entregar na volta);
 *   4. o responsável, com WhatsApp e Ligar;
 *   5. o endereço; 6. a saúde, se a família escreveu; 7. "Ver ficha completa".
 *
 * ⚠️ DE ONDE VEM O "RECADO DE HOJE" — UMA FONTE SÓ: o `note` da declaração do
 * dia (`absenceDeclarations/{hoje}_{criança}`), o único texto da FAMÍLIA que
 * é do dia. O caderno (`agendaEntries`) não entra: ele é o recado do
 * MOTORISTA para a família — mostrar a ele, como "recado", o que ele mesmo
 * escreveu seria confundir quem fala.
 *
 * ⚠️ NENHUMA LEITURA NOVA: tudo chega por props, do que a rota já escuta —
 * a turma (`useChildren`), as declarações do dia (`useAbsences`, uma
 * consulta para a turma) e quem busca hoje (`useQuemBuscaHoje`, uma consulta
 * para a turma). Abrir a folha não abre escuta nenhuma.
 */
export default function FichaRapidaDoTio({ item, direcao, declaracao, quemBusca, onClose }) {
  const navigate = useNavigate();
  const child = item?.child;
  if (!child) return null;
  const ida = direcao !== 'volta';
  const { pega, entrega } = horariosCombinados(child);
  const recado = String(declaracao?.note || '').trim();
  const fora = !!item.estado && item.estado !== 'normal';
  const responsavel = child.parentName || 'O responsável';

  const aviso = recado
    ? { titulo: 'Recado de hoje', texto: recado }
    : fora
      ? { titulo: 'Hoje', texto: ROTULO_ESTADO[item.estado] || 'Não vai hoje' }
      : null;

  const busca = quemBusca?.name
    ? {
        valor: [quemBusca.name, quemBusca.relationship].filter(Boolean).join(' · '),
        nota: quemBusca.phone || null,
      }
    : { valor: `${responsavel} (de sempre)` };

  const combinado = ida
    ? pega ? `Pegar às ${horaCurta(pega)}` : null
    : entrega ? `Entregar às ${horaCurta(entrega)}` : null;

  const linhas = [
    { titulo: 'Busca hoje', ...busca },
    { titulo: 'Combinado', valor: combinado },
    { titulo: 'Escola', valor: [child.school, child.turma].filter(Boolean).join(' · ') || null },
    { titulo: 'Responsável', valor: child.parentName || null, nota: child.parentPhone || null },
    { titulo: 'Endereço', valor: child.address || null },
    child.saudeNotas ? { titulo: 'Saúde', valor: child.saudeNotas, nota: 'Escrito pela família.' } : null,
  ];

  return (
    <FichaRapida
      open
      onClose={onClose}
      child={child}
      lugar={fora ? ROTULO_ESTADO[item.estado] || 'Fora hoje' : rotuloDoLugar(item.status, direcao)}
      aviso={aviso}
      linhas={linhas}
      telefone={child.parentPhone || null}
      rodape={
        <button
          type="button"
          onClick={() => navigate(`/tio/children/${child.id}`)}
          className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
        >
          <FileText size={20} aria-hidden="true" />
          Ver ficha completa
        </button>
      }
    />
  );
}
