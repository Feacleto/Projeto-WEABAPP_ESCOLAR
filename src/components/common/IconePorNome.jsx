import {
  Angry,
  BookOpen,
  Bus,
  ClipboardList,
  Clock,
  ClockAlert,
  Drama,
  FileText,
  Flag,
  Flame,
  Flower2,
  Fuel,
  Ghost,
  Heart,
  Package,
  PartyPopper,
  Pencil,
  Rabbit,
  School,
  Shield,
  Sun,
  Thermometer,
  TreePine,
  TriangleAlert,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';

/**
 * O ÍCONE QUE VEM DE UM DADO, E NÃO DE UM COMPONENTE.
 *
 * Os tipos de recado da agenda (`AGENDA_TYPES`, no agendaService), as
 * categorias de despesa (`EXPENSE_CATEGORIES`) e os temas
 * das datas festivas (`marca/festivities.js`) carregavam um EMOJI — e a regra
 * do projeto é sem emoji em lugar nenhum da interface (design system,
 * 03/10/2026). Os dois arquivos não podem importar React (um é service, o
 * outro mora em `marca/`, que o lint mantém sem React), então guardam o NOME
 * do ícone do lucide, e é aqui que o nome vira desenho.
 *
 * ⚠️ A LISTA É FECHADA de propósito: `import * from 'lucide-react'` levaria
 * os mil ícones para o bundle. Nome que não está aqui não desenha nada — e
 * tipo novo de recado ou tema novo precisa acrescentar o seu.
 */
const ICONES = {
  Angry,
  BookOpen,
  Bus,
  ClipboardList,
  Clock,
  ClockAlert,
  Drama,
  FileText,
  Flag,
  Flame,
  Flower2,
  Fuel,
  Ghost,
  Heart,
  Package,
  PartyPopper,
  Pencil,
  Rabbit,
  School,
  Shield,
  Sun,
  Thermometer,
  TreePine,
  TriangleAlert,
  UserRound,
  Users,
  Wrench,
};

export default function IconePorNome({ nome, size = 20, className = '' }) {
  const Icone = ICONES[nome];
  if (!Icone) return null;
  return <Icone size={size} className={className} aria-hidden="true" />;
}
