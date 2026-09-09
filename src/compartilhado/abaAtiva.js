/**
 * QUAL ABA DO RODAPÉ ESTÁ ATIVA NESTE CAMINHO.
 *
 * ── POR QUE ISTO É UM ARQUIVO, E NÃO UMA FUNÇÃO DENTRO DO `BottomNav`
 * Três lugares precisam da MESMA resposta: o rodapé, para saber onde pôr a
 * pastilha, e os dois layouts, para saber de que lado a tela entra. Duas
 * contas em dois arquivos é como as duas divergem — a pastilha iria para um
 * lado e a tela entraria pelo outro, e ninguém entenderia por quê.
 *
 * Ele nasceu dentro do `BottomNav.jsx` e o lint recusou, com razão: arquivo de
 * componente que exporta função quebra o fast refresh, e a regra existe para
 * isso não virar hábito.
 *
 * ── ELE MORA EM `compartilhado/` PORQUE NÃO CONHECE O DOMÍNIO
 * É comparação de texto sobre um caminho de URL. Não sabe o que é motorista,
 * criança ou fatura — e o lint recusa que passe a saber.
 *
 * ⚠️ `-1` É RESPOSTA, NÃO ERRO. A maior parte das telas do app não é aba:
 * `/tio/children`, `/tio/route`, `/tio/agenda`. Quem consome precisa tratar
 * isso — a pastilha some em vez de ficar parada numa coluna dizendo que a
 * pessoa está numa aba em que ela não está.
 */
export function indiceDaAba(pathname, items) {
  const caminho = String(pathname || '');
  return (Array.isArray(items) ? items : []).findIndex((item) =>
    item?.end
      ? caminho === item.to
      : caminho === item?.to || caminho.startsWith(`${item?.to}/`)
  );
}
