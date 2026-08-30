/**
 * Saudação pela hora do relógio.
 *
 * ERA CONFIGURÁVEL, E DEIXOU DE SER.
 *
 * O motorista escolhia em que hora começava cada saudação, num cartão do
 * perfil com três campos. Nenhum dos três é uma decisão de negócio: "bom dia"
 * até meio-dia não é preferência, é português. O cartão pedia atenção pra uma
 * pergunta que já tem resposta, ocupava espaço numa tela onde mora o PIX e a
 * exclusão de conta, e criava um jeito de o app ficar errado — quem salvasse
 * 03h por engano passava a ser saudado com "boa tarde" no fim da madrugada.
 *
 * Os cortes abaixo são os mesmos que já eram o padrão, então nada muda pra
 * quem nunca mexeu. Quem tinha configurado outra coisa volta pro normal, e o
 * campo `greetingHours` que sobrou nos documentos deixa de ser lido — não
 * apagamos: dado órfão não faz mal, e migração pra remover um campo que
 * ninguém consulta é risco sem retorno.
 *
 * A HORA É A DO APARELHO de quem está lendo, e não a do motorista. É o certo:
 * a saudação cumprimenta quem está com o celular na mão.
 */

const BOM_DIA = 5;
const BOA_TARDE = 12;
const BOA_NOITE = 18;

/**
 * @param {Date} date — data/hora atual (default: agora)
 */
export function greet(date = new Date()) {
  const hora = date.getHours();
  if (hora >= BOM_DIA && hora < BOA_TARDE) return 'Bom dia';
  if (hora >= BOA_TARDE && hora < BOA_NOITE) return 'Boa tarde';
  return 'Boa noite';
}
