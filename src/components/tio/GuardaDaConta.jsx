import { useAuth } from '../../hooks/useAuth';
import { estadoDaConta } from '../../dominio/associacao/contaAtiva.js';
import ContaInativa from '../../pages/tio/ContaInativa';

/**
 * O GUARDA DA CONTA — decide se o painel do motorista chega a montar.
 *
 * POR QUE ELE ENVOLVE O LAYOUT EM VEZ DE VIVER DENTRO DELE
 * O `TioLayout` assina `children`, chamadas ativas e faturas no topo, e hook
 * não pode ser condicional. Um cartão de "conta inativa" renderizado lá dentro
 * chegaria DEPOIS de todas as assinaturas terem sido abertas — e a tela
 * desfocada estaria desfocando dado real, já carregado, legível no inspetor.
 *
 * O `negocio.md` nomeia isso: `filter: blur()` é CSS, não proteção. Estando
 * aqui fora, quando a conta está inativa o layout **nunca monta** e nenhum
 * `onSnapshot` de criança, rota ou posição chega a existir.
 *
 * ELE LÊ SÓ O PERFIL, E ISSO NÃO É ECONOMIA — É O PONTO
 * Suspensão, início do teste e `assinaturaAte` já vêm no documento do usuário
 * que o AuthContext carregou. Nenhuma assinatura nova é aberta para decidir se
 * a conta está ativa, então a decisão acontece antes de existir qualquer
 * leitura de operação.
 *
 * O ATRASO NÃO ENTRA AQUI, e é de propósito. Ele depende da fatura em aberto,
 * que é outro documento — e buscá-lo aqui abriria uma segunda assinatura da
 * mesma coleção que o `TioLayout` já assina. Enquanto isso, o atraso segue
 * pelo caminho que sempre teve: o cartão do `AvisoDaPlataforma` e a suspensão
 * decidida por gente.
 *
 * O CAMINHO DE VOLTAR NÃO PASSA POR AQUI, E ISSO É ESTRUTURAL.
 * `/tio/planos`, `/tio/taxa` e `/tio/contrato-plataforma` foram movidas para
 * FORA deste guarda em 06/09/2026 (ver `App.jsx`). Elas moravam dentro do
 * layout, e quando a conta inativa o layout inteiro é substituído — o botão
 * "Ver planos" da tela de conta inativa navegava e a tela não mudava.
 *
 * Quem quer pagar precisa conseguir chegar na tela de pagar. É o gêmeo, na
 * interface, do `temPapelDeMotorista()` das rules: as duas metades da mesma
 * saída, e sem qualquer uma delas a tranca prende quem está tentando sair.
 *
 * `assinaturaAte` É O QUE TORNA O BLOQUEIO POR TESTE POSSÍVEL. Sem ele, o
 * primeiro cliente pagante seria trancado no dia 90 — nenhuma regra alcança o
 * contrato de associação, cujo id é `${tioUid}_${Date.now()}` e não se
 * calcula. Quem escreve o campo é quem cobra, e as rules recusam o motorista.
 */
export default function GuardaDaConta({ children }) {
  const { profile } = useAuth();

  const { ativa, motivo } = estadoDaConta({
    suspenso: profile?.suspenso === true,
    trialInicio: profile?.trialInicio || null,
    assinaturaAte: profile?.assinaturaAte || null,
    // Ver acima: o atraso não é decidido aqui.
    fatura: null,
    agora: new Date(),
  });

  if (!ativa) return <ContaInativa motivo={motivo} />;

  return children;
}
