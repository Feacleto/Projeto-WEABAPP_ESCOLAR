import FichaRapida from './FichaRapida';
import { horaCurta, horariosCombinados } from '../../dominio/rota/horarios';
import { rotuloDoLugar } from '../../dominio/rota/zonasDaRota.js';

/**
 * A FICHA RÁPIDA DA AUXILIAR (05/10/2026, decisão do dono): a mesma folha do
 * tio, SÓ com o que a cópia da turma dela leva (`turmaDaAuxiliar`, lista
 * fechada no servidor) — primeiro nome, turma, escola, hora combinada e o
 * responsável com o telefone.
 *
 * ⚠️ O que fica de fora é decisão, não esquecimento: o recado da família, a
 * casa e os dados de saúde. A cópia dela nem traz esses campos, e este
 * arquivo não os cita — `testar:rota-ao-vivo` lê o arquivo.
 *
 * QUEM BUSCA HOJE (05/10/2026, decisão do dono): SÓ O NOME, "Hoje busca: Avó
 * Lúcia" (`buscaHoje`, da cópia `turmaDaAuxiliar/{tio}/quemBusca`). Telefone
 * e parentesco à parte ficam de fora — a cópia nem os leva.
 */
export default function FichaRapidaDaAuxiliar({ item, direcao, buscaHoje = null, onClose }) {
  const child = item?.child;
  if (!child) return null;
  const ida = direcao !== 'volta';
  const { pega, entrega } = horariosCombinados(child);
  const primeiroNome = String(child.name || '').trim().split(/\s+/)[0] || 'Criança';
  const combinado = ida
    ? pega ? `Pegar às ${horaCurta(pega)}` : null
    : entrega ? `Entregar às ${horaCurta(entrega)}` : null;
  const linhas = [
    buscaHoje ? { titulo: 'Hoje busca', valor: buscaHoje } : null,
    { titulo: 'Escola', valor: [child.school, child.turma].filter(Boolean).join(' · ') || null },
    { titulo: 'Combinado', valor: combinado },
    { titulo: 'Responsável', valor: child.parentName || null, nota: child.parentPhone || null },
  ];
  return (
    <FichaRapida
      open
      onClose={onClose}
      child={{ ...child, name: primeiroNome }}
      lugar={rotuloDoLugar(item.status, direcao)}
      linhas={linhas}
      telefone={child.parentPhone || null}
    />
  );
}
