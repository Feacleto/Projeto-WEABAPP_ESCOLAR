# Pendências abertas, com recomendação

Fotografia de 05/09/2026, no fim das cinco fases de estruturação do negócio.

**Este arquivo tem prazo de validade e deve encolher até sumir.** Ele não é
fonte de nada: cada pendência **pertence** a outro documento, e é lá que a
decisão é registrada quando for tomada. Aqui ficam só a recomendação e a ordem.

⚠️ **Não confundir com [decisoes.md](decisoes.md).** Aquele é normativo — o que
o código garante e o CI impede. Este é uma pauta: o que ainda não foi decidido.

---

## Se você só fizer três coisas

1. **Ratificar o alvo e o preço** (bloco A) — três documentos já assumem uma
   resposta que você não deu.
2. **Criar o campo de horas de consultor** (bloco B) — é o número que governa o
   negócio, e hoje ele não existe em lugar nenhum.
3. **Tirar "Desenvolva Algo" do contrato** (bloco C) — com **um** associado,
   custa uma conversa. Com trinta, custa trinta.

---

## Bloco A — Uma sentada de trinta minutos

Destravam tudo o que vem depois. Nenhuma precisa de dado novo.

| Pendência | Dono | **Recomendação** | Por quê |
|---|---|---|---|
| **Alvo da rodada** | [personas.md](personas.md) 1 | **O motorista de caderno** | A objeção dele é a que a marca já sabe responder, o custo de troca é zero e ele é a maioria da fila do portão. Já assumido em três documentos |
| **Régua de preço** | [negocio.md](negocio.md) 1 | **Ratificar R$ 69 / 149 / 229, por faixa** | O custo de infra é centavos, então a régua nunca esteve em risco por baixo — ela é limitada pela tolerância dele, não pelo custo. Faixa e não linear porque encurta a conversa |
| **Carência da indicação** | [negocio.md](negocio.md) 3 | **Só conta no 1º mês PAGO do indicado** | Sem isso, cinco cadastros de fachada zeram a conta de quem indicou antes de existir um real de receita |
| **Onboarding é de quem?** | [canvas-negocio.md](canvas-negocio.md) 3 | **Do consultor, e entra no CAC** | É o trecho que decide a métrica do piloto. Deixá-lo com o motorista transfere o risco pra quem menos absorve: ele não sabe que fez pela metade até o app parecer inútil |

---

## Bloco B — Medir, não decidir

Nenhuma pede opinião. Todas pedem que alguém olhe.

| Pendência | Dono | **Recomendação** | Custo |
|---|---|---|---|
| **Horas de consultor por fechamento** | [canvas-negocio.md](canvas-negocio.md) 2 | **Campo `horasConsultor` no lead, preenchido à mão.** O ciclo em dias já é derivável de `criadoEm`/`fechadoEm`, mas tempo decorrido não é esforço — e é o esforço que vira CAC | um campo |
| **Ponto de cruzamento da infra** | [negocio.md](negocio.md) 4 | **Console → Firestore → Uso**, leituras por dia ÷ motoristas ativos. **Não** a fatura: com 1 motorista você está dentro da cota gratuita e ela mostra zero | 20 min |
| **Padronizar `motivoPerda`** | [pitch-comercial.md](pitch-comercial.md) 3 | **Usar os seis nomes das objeções** como vocabulário fixo. O mapa vira dado: em vinte perdas você descobre qual objeção merece produto | zero, sem código |
| **Adoção da responsável** | [personas.md](personas.md) 2 | **Sim — carimbo de último acesso.** ⚠️ Dado pessoal com finalidade nova: entra na política de privacidade **antes** do código, e a finalidade é medir adoção, não vigiar família | pequeno |

---

## Bloco C — Coerência de marca, e o relógio está correndo

Todas ficam mais caras a cada associado novo. **Fazer juntas, numa passada só.**

| Pendência | Dono | **Recomendação** |
|---|---|---|
| **Tirar "Desenvolva Algo"** | [marca.md](marca.md) 1 | **Nos três lugares:** rodapé da home, rodapé de `/familia` e **o contrato de associação**. Não são duas empresas — o CNPJ é o mesmo —, então é decisão de marca, não de societário |
| **E-mail legal** | [marca.md](marca.md) 2 | **`contato@alobuzinou.com.br`**, que já existe. Gmail no rodapé de uma marca cuja visão é *referência em confiança* é o conserto mais barato e o que custa mais desproporcionalmente |
| **`VERSAO_CONTRATO` → 3** | [marca.md](marca.md) 3 | **Junto com a troca de nome.** Mudou o texto, sobe a versão e todo associado reaceita — a regra é do projeto. Hoje é **uma** conversa |
| **Declarações na landing** | [marca.md](marca.md) 4 | **1, 3, 6 e 8.** A 8 ("a gente diz em que pé está") é a que vão querer cortar e a que não pode sair |

---

## Bloco D — Produto, com risco real

| Pendência | Dono | **Recomendação** |
|---|---|---|
| **O que a família vê com a conta do motorista inativa** | [negocio.md](negocio.md) 11 | **Ela nunca perde o que é dela** — faltas, histórico de pagamento e contrato continuam. Some o que depende de ele operar: mapa, buzina, status. A tarja diz *"o transporte não está publicando a rota hoje — fale direto com o motorista"*. ⚠️ **Nunca "o motorista está inadimplente"**: usar a família como alavanca de cobrança quebra o terceiro valor na frente de quem não tem culpa |
| **Parar de carregar dado na tela inativa** | [negocio.md](negocio.md) 13 | **Prioridade alta, e é segurança, não estética.** `filter: blur()` não tira nada do DOM: quem abrir o inspetor lê nome, endereço e coordenada de criança por baixo do borrão. A tela precisa **parar de buscar**, e o desfoque virar enfeite sobre tela já vazia |

---

## Bloco E — Podem esperar, mas com data

| Pendência | Dono | **Recomendação** |
|---|---|---|
| **PSP com split** | [negocio.md](negocio.md) 6 | **Não escolha fornecedor agora. Faça UMA pergunta a três deles:** *abre subconta com split para pessoa física sem CNPJ?* Custa três e-mails e a resposta decide se o cartão recorrente existe para o público-alvo. Hoje o roadmap depende de uma suposição que ninguém testou |
| **Validar personas em campo** | [personas.md](personas.md) 3 | **Cinco a oito conversas no portão, antes de imprimir qualquer peça.** Tudo em [pitch-comercial.md](pitch-comercial.md) é dedução, inclusive as seis objeções |
| **Sindicato ou associação como canal** | [canvas-negocio.md](canvas-negocio.md) 4 | **Examinar com prazo — uma tarde.** É a única lista organizada de motoristas que existe. Se não servir, **recuse por escrito**, para parar de voltar à mesa |
| **Dados de mercado** | [negocio.md](negocio.md) 7 | **Adiar.** Só servem ao deck, e o deck está na gaveta por decisão sua |
| **Slides do deck** | [pitch-investidor.md](pitch-investidor.md) 3 | **Escreva só o 5 e o 10** — a promessa arquitetural e a lista de recusas. São os únicos que não se improvisam, e servem igual para conversar com uma escola |

---

## O que eu recomendo NÃO fazer agora

| | Por quê |
|---|---|
| **Captar** | Se o CAC é tempo de consultor, o dinheiro compra capacidade de venda — e você não sabe o preço de uma hora dela. Ver a seção 7 de [pitch-investidor.md](pitch-investidor.md) |
| **Contratar um segundo consultor** | Mesma razão, sem o aporte: é comprar uma unidade cujo custo você não mediu |
| **Construir cartão recorrente** | Depende do PSP responder a pergunta do bloco E. Construir antes é apostar |
| **Mexer na missão** | É a peça mais fraca das três e mesmo assim fica. Missão trocada a cada rodada não é missão — ver [marca.md](marca.md) seção 1 |
| **Reescrever a landing inteira** | As quatro declarações do bloco C resolvem o texto. A página só precisa da assinatura certa |

---

## Manutenção

**Regra única:** quando uma pendência for decidida, registre a decisão **no
documento dono** e risque a linha aqui. Quando as tabelas esvaziarem, **apague
este arquivo** — pauta que sobrevive à reunião vira lista de culpa.

Se uma decisão daqui virar regra que o código precisa garantir, ela **também**
vira entrada em [decisoes.md](decisoes.md), com a linha de como verificar.
