import {
  Bell,
  DollarSign,
  HelpCircle,
  Lightbulb,
  Map,
  MapPin,
  Minimize2,
  Phone,
  Target,
  ThumbsUp,
  UserCheck,
  Users,
  UserX,
  ZoomIn,
} from 'lucide-react';

/**
 * Opções da pesquisa de métrica — as mesmas perguntas na folha de avaliação
 * e no painel do admin.
 *
 * Vivem num módulo só porque o painel precisa TRADUZIR os valores gravados
 * ('fewer_steps') de volta pra frase que a pessoa leu ('Menos toques pra
 * fazer as coisas'). Com duas listas separadas, a primeira pergunta nova
 * apareceria no painel como um código cru — e ninguém lembra o que
 * 'more_clear' queria dizer seis meses depois.
 *
 * Os `value` são contrato de dados: já existem gravados em `feedbacks`.
 * Mude o label livremente; mudar o value quebra o histórico.
 */

export const USE_OPTIONS_TIO = [
  { value: 'route', icon: Map, label: 'Fazer a rota' },
  { value: 'absences', icon: UserX, label: 'Marcar faltas' },
  { value: 'payments', icon: DollarSign, label: 'Cobrar mensalidade' },
  { value: 'children', icon: Users, label: 'Ver as crianças' },
  { value: 'call', icon: Phone, label: 'Ligar pro pai' },
  { value: 'map', icon: MapPin, label: 'Ver o mapa' },
];

export const USE_OPTIONS_PAI = [
  { value: 'map', icon: MapPin, label: 'Ver onde tá a van' },
  { value: 'absences', icon: UserX, label: 'Avisar quando vai faltar' },
  { value: 'payments', icon: DollarSign, label: 'Ver pagamento' },
  { value: 'altPickup', icon: UserCheck, label: 'Dizer quem vai buscar' },
  { value: 'notifications', icon: Bell, label: 'Receber avisos' },
];

export const WISH_OPTIONS = [
  { value: 'fewer_steps', icon: Target, label: 'Menos toques pra fazer as coisas' },
  { value: 'bigger_text', icon: ZoomIn, label: 'Letras maiores' },
  { value: 'more_clear', icon: Lightbulb, label: 'Mais claro o que cada coisa faz' },
  { value: 'less_buttons', icon: Minimize2, label: 'Menos botões na tela' },
  { value: 'more_help', icon: HelpCircle, label: 'Mais ajuda dentro do app' },
  { value: 'all_good', icon: ThumbsUp, label: 'Tá bom assim' },
];

/** Traduz um value gravado de volta pro rótulo lido pelo usuário. */
export function labelDaOpcao(value) {
  const todas = [...USE_OPTIONS_TIO, ...USE_OPTIONS_PAI, ...WISH_OPTIONS];
  return todas.find((o) => o.value === value)?.label || value;
}
