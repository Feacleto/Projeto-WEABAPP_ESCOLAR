# O plano em fases — da porta única à cobrança

Escrito em 06/09/2026, no fim da sessão que reescreveu a entrada do app.

**Este arquivo não é normativo.** Ele registra o CAMINHO: o que já foi feito, o
que falta, em que ordem, e — a parte que mais se perde — **por que cada escolha
foi feita assim**. As regras que saíram daqui e viraram lei estão em
[decisoes.md](decisoes.md) (20, 21 e 22); o modelo de negócio está em
[negocio.md](negocio.md).

Quando a última fase fechar, este arquivo some.

---

## A jornada que o plano constrói

João é motorista escolar. Um colega mandou o link no WhatsApp.

1. Abre `alobuzinou.com.br`, lê, clica em **Entrar**
2. Cai no login em `alobuzinou.com`. Sem conta, entra com o Google
3. **A conta nasce sem papel.** A sala de espera pergunta por onde ele chegou;
   ele escolhe "sou motorista"
4. Coloca foto e logo da van, cadastra as 14 crianças, os horários, as escolas
5. Segunda de manhã, **inicia a primeira rota — e o relógio começa**
6. Manda os convites. As mães entram e veem a perua no mapa
7. **Aos 30 dias** o app pergunta se ele está gostando e pede avaliação
8. **A 30, 7 e 1 dia do fim**, três avisos de formas diferentes
9. Ele abre **Ver planos**: 14 crianças ativas, faixa de R$ 149, com os
   descontos dele já no número
10. Escolhe, aceita o contrato ali mesmo e paga
11. Se não escolher, a conta fica **inativa sobre o app desfocado**
12. **As mães não são punidas:** continuam com rota ao vivo, aviso de chegada e
    mensalidade. Some o histórico antigo, o extrato e os recados velhos

---

## Estado das fases

| Fase | O que é | Estado |
|---|---|---|
| 1 | A porta pública sai do app | ✅ |
| 2 | A tela de entrada | ✅ |
| 3 | Conta sem papel e as duas saídas | 🟡 parcial |
| 4 | Blaze | ⛔ travada |
| 5 | O relógio do teste | ✅ |
| 6 | Planos e assinatura | 🟡 régua e tela prontas |
| 7 | A conta inativa | ⬜ |
| 8 | Indicação | ⬜ |
| 9 | A avaliação do 1º mês | ⬜ |

---

## O que falta, fase por fase

### Fase 3 · o que ainda não roda
A sala de espera existe e mostra as duas saídas. **A saída do responsável leva
ao `/first-access`, que chama `redeemInvite` — Cloud Function.** E a conversão
de motorista vazio para responsável (aprovada: só quando a conta tem zero
crianças e zero rotas, porque aí nada se perde) é escrita de papel, que também
precisa ser Function. As duas destravam junto com o Blaze, sem tocar na tela.

### Fase 4 · Blaze
Travada no pagamento do cartão, não em código. Quando entrar:

- subir as 12 functions do núcleo (a ordem está no [deploy.md](deploy.md))
- virar `CLOUD_FUNCTIONS_ENABLED` **e** `STORAGE_ENABLED` no mesmo commit
- trazer a branch `alobuzinou` de volta para a principal — ela perde a razão de
  existir nesse momento
- **push volta**, e com ele o *aviso de chegada* que está prometido na
  `og:description` da landing. Enquanto não volta, esse aviso só existe dentro
  do app aberto

### Fase 6 · o que falta para o autoatendimento fechar
A régua e a tela estão prontas. O botão ainda abre o WhatsApp do consultor, e
virar "assinar agora" exige mexer nas duas rules de dinheiro:

- **`contratosAssociacao`** — hoje só o dono emite
- **`limiteCriancas`** — hoje só o dono escreve, e é o campo que o plano define

Não é lugar de pressa. Botão que promete autoatendimento e cai numa tela
quebrada é pior que botão honesto.

E os lembretes de PIX (no vencimento e no 5º dia) ainda não existem: com
**10 dias de tolerância** até a conta inativar, quem esquece precisa ser
lembrado antes de ser bloqueado.

### Fase 7 · a conta inativa
Uma tela para dois estados — fim do teste sem contrato, e 10 dias de atraso —
porque a situação é a mesma: existe conta, existe dado, falta acordo.

> ⚠️ **A tela precisa PARAR DE BUSCAR os dados antes de desfocá-los.**
> `filter: blur()` é CSS, não proteção: uma tela que carrega as crianças para
> borrá-las entrega nome, endereço e coordenada a quem abrir o inspetor. Isso
> é vazamento com aparência de segurança.

No app da família, limitar **só o que não foi prometido**: histórico, extrato e
recados antigos. Rota ao vivo, aviso de chegada e mensalidade continuam — é o
que a landing promete a ela, e ela não é parte do acordo que não fechou.

### Fase 8 · indicação
Não existe registro de quem indicou quem. Precisa do vínculo, da validação pelo
**número de WhatsApp normalizado** (com e sem nono dígito, com e sem DDI) e da
recusa de auto-indicação. As duas falhas produzem a mesma queixa — *"indiquei e
não recebi"* — e é o tipo de ruído que viaja rápido numa rede de indicação.

A conta do desconto já está pronta e testada em `dominio/associacao/planos.js`.

### Fase 9 · a avaliação do primeiro mês
A janela de avaliação **já existe** em `platformConfig`, ligada pelo dono sem
deploy. Falta o gatilho dos 30 dias de uso. É plugar, não construir.

---

## O gateway, quando entrar

A conta do Asaas foi aprovada em 06/09/2026. A integração está travada no mesmo
Blaze: webhook precisa de endereço, e endereço é Function. A chave da API vai
em `functions:secrets`, nunca em `.env` com prefixo `VITE_` — tudo com esse
prefixo entra no bundle, público por construção.

**O gateway cobra a TAXA, nunca a mensalidade.** Não é preferência: é a
[decisão 19](decisoes.md), o item 7 dos Termos e a frase que está publicada na
landing. O Asaas oferece split e subconta, e é natural pensar em processar tudo
por ele — processar a mensalidade transformaria a plataforma em intermediária
de dinheiro de terceiro.

Duas coisas a acertar antes de escrever código, e as duas cobram caro se
erradas:

1. **Qual evento marca a fatura como quitada.** Há diferença entre "pagamento
   confirmado" e "dinheiro disponível". Escolher errado dá baixa em algo que
   ainda pode ser estornado — ou deixa bloqueado quem já pagou.
2. **A baixa precisa ser idempotente.** O Asaas repete o webhook quando não
   recebe confirmação, e o mesmo aviso chega duas ou três vezes. Mesmo padrão
   do `rides`, cujo id é a data por esse motivo.

---

## O que continua em aberto

- **A condição de fundador precisa de dono.** Quem marca é o dono, num campo
  que só ele escreve — nunca um contador automático. Hoje o primeiro motorista
  no banco é uma conta de teste, e um contador daria gratuidade vitalícia a ela
- **A `/familia` está órfã:** a landing nova não linka para ela, e só o convite
  chega lá. Linkar é uma linha; aposentar é irreversível
- **Motorista que também é pai** continua impossível de representar — `role` é
  um só. Decidido: deixar assim, com mensagem clara mandando usar outro e-mail
- **Os dois modelos de preço** (`taxa.js` negociado e `planos.js` por faixa)
  convivem. A migração é pendência do [negocio.md](negocio.md)
