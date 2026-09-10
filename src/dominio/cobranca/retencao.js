/**
 * POR QUANTO TEMPO O PAGAMENTO FICA GUARDADO — e quem manda nesse número.
 *
 * ── ⚠️ O NÚMERO VEM DA POLÍTICA DE PRIVACIDADE, NÃO O CONTRÁRIO
 * A seção 8 promete guardar registro fiscal por cinco anos. O código guardava
 * doze meses: o app apagava em um ano o que o documento diz manter por cinco,
 * e das duas versões a que vale contra a plataforma é a escrita. O servidor
 * foi para 60; **as telas não foram junto.**
 *
 * ── O QUE ISSO ESTAVA CUSTANDO
 * `MonthSwitcher` travava a navegação em doze meses, com a justificativa
 * escrita de que era "para casar com a retenção" — uma razão que deixou de
 * existir. O efeito não é cosmético: **48 meses de mensalidade estão no banco
 * e a tela não deixava chegar neles**, exatamente na conversa em que eles
 * importam, que é a discussão sobre atraso e a conferência fiscal. É o mesmo
 * dado que o cabeçalho de `billing.js` cita como o motivo de guardar cinco
 * anos.
 *
 * ── POR QUE AQUI, E POR QUE UM TESTE DE TEXTO
 * O número precisa existir dos dois lados: `functions/lib/billing.js` é quem
 * APAGA, e ele requer o SDK — nenhum script da bateria pode importá-lo (ver
 * `testar:imports`). Então a cópia do servidor é conferida por LEITURA DE
 * ARQUIVO em `npm run testar:cobranca`, o mesmo recurso que `testar:selo` usa
 * para o texto do selo e `testar:busca` para a landing.
 *
 * Divergir aqui tem duas caras, e as duas são ruins: a tela mostrando meses
 * que o servidor já apagou (lista vazia sem explicação), ou a tela escondendo
 * meses que existem.
 */

/**
 * ⚠️ SE MUDAR AQUI, MUDA EM `functions/lib/billing.js` (`RETENTION_MONTHS`) E
 * NA SEÇÃO 8 DA POLÍTICA DE PRIVACIDADE, na mesma alteração.
 */
export const MESES_DE_RETENCAO = 60;

/**
 * Quantos meses para trás a navegação pode ir, contando o mês corrente.
 *
 * `-1` porque o mês de hoje conta: 60 meses de retenção são o atual mais 59
 * atrás. Sem isso a tela ofereceria um mês que o servidor já apagou, e a
 * pessoa veria uma lista vazia sem nada explicando por quê.
 */
export const MESES_NAVEGAVEIS_ATRAS = MESES_DE_RETENCAO - 1;
