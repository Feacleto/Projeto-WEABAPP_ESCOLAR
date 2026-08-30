import { useAuth } from './useAuth';
import { useActiveChild } from './useActiveChild';
import { useAdminProfile } from './useAdminProfile';

/**
 * A MARCA QUE VAI NO CABEÇALHO — resolvida a partir de quem está olhando.
 *
 * UM HOOK, DUAS ORIGENS. Pro motorista, a marca é a dele e já está no perfil
 * carregado; pro responsável, é a do motorista que atende o filho dele, e vem
 * pelo `adminUid` da criança ativa. Cada tela resolver isso por conta própria
 * significaria a mesma pergunta respondida de dois jeitos, e um dia diferente.
 *
 * O RESPONSÁVEL VÊ A MARCA DO TIO, E NÃO A DELE PRÓPRIA. Não é detalhe de
 * implementação: o cabeçalho é onde ele confirma que está no app certo. Um pai
 * que atende dois motoristas troca de filho e o topo da tela muda junto —
 * ler "Tia Lene" enquanto olha a rota do filho que anda com o Tio Nino é o
 * tipo de erro que faz a pessoa desconfiar de tudo o mais.
 *
 * `useAdminProfile` faz a leitura e já tinha esse caminho pronto: o pai já lia
 * o doc do motorista pra pegar chave PIX e telefone. As rules permitem
 * (`isAppUser() && role == 'admin'`), então nada de novo se abre aqui.
 *
 * SEM MARCA CADASTRADA, DEVOLVE `nome: null` — e quem chama mostra o título
 * de sempre. O motorista que nunca abriu essa configuração não pode ficar com
 * um cabeçalho vazio, e um placeholder ("Sua marca aqui") apareceria pras
 * famílias dele, que não têm nada a ver com a configuração pendente.
 */
export function useMarcaDoTio() {
  const { profile, role } = useAuth();
  const ehMotorista = role === 'admin';

  // O pai chega pelo adminUid da criança ativa. O motorista não consulta nada:
  // passar `null` deixa o `useAdminProfile` inerte, sem assinatura aberta.
  const { child } = useActiveChild();
  const { admin } = useAdminProfile(ehMotorista ? null : child?.adminUid);

  const fonte = ehMotorista ? profile : admin;

  return {
    nome: fonte?.marcaNome?.trim() || null,
    logoURL: fonte?.marcaLogoURL || null,
  };
}
