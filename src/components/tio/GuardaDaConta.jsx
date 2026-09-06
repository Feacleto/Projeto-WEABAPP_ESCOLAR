import { useAuth } from '../../hooks/useAuth';
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
 * HOJE ELE SÓ TRATA `suspenso`, E ISSO É SEQUENCIAMENTO, NÃO ESQUECIMENTO
 * Bloquear por fim de trial exige saber quem JÁ ASSINOU — senão o primeiro
 * cliente pagante é trancado no dia 90. E esse sinal não existe: o id do
 * contrato é `${tioUid}_${Date.now()}`, que uma regra não alcança, e não há
 * campo em `users` dizendo "esta conta está paga até quando".
 *
 * Enquanto esse campo não existir, bloquear por trial trancaria justamente
 * quem paga. Então o guarda cobre o caso que já é inequívoco — suspensão é
 * decisão de uma pessoa e já nega em `isAdmin()` nas rules — e os outros dois
 * motivos entram quando houver o que os desfaça.
 *
 * O GANHO JÁ VALE HOJE: a conta suspensa já era negada pelas rules, então o
 * app abria e quebrava por dentro, com um cartão explicando por cima de telas
 * vazias. Agora ela recebe uma tela inteira que diz o que aconteceu.
 */
export default function GuardaDaConta({ children }) {
  const { profile } = useAuth();

  if (profile?.suspenso === true) return <ContaInativa motivo="suspenso" />;

  return children;
}
