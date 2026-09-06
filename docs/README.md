# Documentação

**Leia este primeiro** para saber onde procurar. Quatorze arquivos, cinco grupos — e nada fora daqui: a raiz guarda só o README, que roteia.

### Normativo — o que não se quebra por conveniência

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`decisoes.md`](decisoes.md) | agente e pessoa | **Sempre.** Cada decisão em ~30 linhas, com o que a prova. É o que impede uma "melhoria" plausível de quebrar uma regra de negócio. |

### Referência — o alicerce, o rumo e o dinheiro

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`arquitetura.md`](arquitetura.md) | pessoa, e agente sob demanda | Antes de mexer em permissão, dado sensível, cobrança ou fronteira de camada. |
| [`evolucao.md`](evolucao.md) | pessoa | Ao decidir o que construir depois. Nenhum estágio tem data — todos têm gatilho. |
| [`negocio.md`](negocio.md) | pessoa | Antes de mexer em preço, taxa, trial, indicação ou meio de pagamento — e antes de escrever qualquer peça de marketing. Escrito **depois** do produto, em 04/09/2026: o app existia e o modelo estava implícito no código. |
| [`personas.md`](personas.md) | pessoa | Antes de escrever pitch, landing ou qualquer texto que fale COM alguém. Quem paga (o motorista) não é quem usa (a responsável), e por isso são dois canvas de valor. A coluna de encaixe diz o que o produto ainda **não** resolve — e o que o pitch, portanto, não pode prometer. |
| [`canvas-negocio.md`](canvas-negocio.md) | pessoa | Ao pensar o negócio como um todo — canal, custo, parceria, quem faz o quê. Os nove blocos não resumem `negocio.md`: eles mostram o que falta. A tensão que o quadro revelou é que **o canal é escalável e a conversão não é**. |
| [`marca.md`](marca.md) | pessoa | Antes de escrever qualquer texto público, e sempre que uma proposta parecer boa e cheirar a promessa. O manifesto tem oito declarações, e cada uma vem com o jeito de pegar a gente mentindo — é isso que o torna teste, e não cartaz. Registra também **por que não existe valor de segurança**. |
| [`pitch-comercial.md`](pitch-comercial.md) | pessoa | Antes de falar com um motorista. Roteiro de 40 segundos, as seis objeções (a última é a que ele **não** faz), e a peça que ele encaminha sozinho. A seção 5 lista as frases que soam ótimas e são **falsas hoje** — é a parte que envelhece primeiro. |
| [`pitch-investidor.md`](pitch-investidor.md) | pessoa | Só se aparecer uma conversa. **A captação foi decidida como "não"** — o plano é crescer com receita. O documento existe pela tese, pelos onze slides e pelo portão da seção 7: não capte antes de medir hora de consultor, porque é a única coisa que o dinheiro compraria. |

### Caminho — o que está sendo construído, e em que ordem

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`plano-fases.md`](plano-fases.md) | pessoa, e agente | Antes de pegar uma fase. Nove fases, o que trava cada uma e **por que cada escolha foi feita assim** — que é a parte que some quando ninguém escreve. Não é normativo: o que virou lei está em `decisoes.md`. **Tem prazo de validade:** some quando a última fase fechar. |

### Pauta — o que ainda não foi decidido

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`pendencias.md`](pendencias.md) | pessoa | Quando sentar para decidir. **Toda pendência aberta dos outros documentos, com recomendação e ordem** — cinco blocos, do que destrava tudo ao que pode esperar. Tem prazo de validade: some quando esvaziar, e não é fonte de nada (a decisão é registrada no documento dono). |

### Operação — como colocar no ar e como testar

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`deploy.md`](deploy.md) | pessoa | Antes de publicar. A ordem importa, há dois pré-requisitos de console, e a CSP está em Report-Only esperando uma passada de navegador. |
| [`testes.md`](testes.md) | pessoa | Para entrar como motorista, dono ou responsável. Os três acessos são diferentes por natureza. |

Versões longas e navegáveis (mesmo conteúdo, mais contexto e diagramas) estão publicadas como páginas privadas no Claude. `decisoes.md` é a fonte normativa: se algo divergir, vale ele.

## Estado deste documento

Escrito em 30/08/2026, com o projeto **em desenvolvimento, sem usuário real**. Essa premissa é o que torna várias decisões baratas — não há dado para migrar. Boa parte delas fica cara no dia em que a primeira família entrar.

## O ponteiro no CLAUDE.md — JÁ COLADO

O trecho abaixo está no `CLAUDE.md` desde 30/08/2026, logo depois da seção "Os quatro papéis". Fica aqui como referência do que ele deve dizer, se alguém precisar reescrevê-lo. É curto de propósito: o `CLAUDE.md` é carregado em toda sessão, então ele aponta, não repete.

```markdown
## Decisões de arquitetura

[docs/decisoes.md](docs/decisoes.md) — regras que NÃO podem ser quebradas por
conveniência, cada uma com o teste que a prova. **Leia antes de mexer em
permissão, dinheiro, vínculo de família ou dado sensível.** Se uma mudança
parece uma melhoria óbvia e contraria uma decisão de lá, a decisão vence até
alguém mudá-la explicitamente naquele arquivo.

Referência longa: [docs/arquitetura.md](docs/arquitetura.md) (alicerce técnico)
e [docs/evolucao.md](docs/evolucao.md) (para onde o produto anda).
```

## Divergências que existiam entre o CLAUDE.md e o código

Achadas na análise. Enquanto não forem corrigidas, o índice está mentindo para todo agente que abrir uma sessão:

**As cinco foram fechadas em 30/08/2026.** Ficam registradas porque o padrão
importa mais que os itens: toda uma delas era prosa afirmando garantia que o
código ao lado não dava, e é assim que o defeito volta — alguém lê, confia, e
constrói em cima.

1. ~~Diz "38 services" — são 36.~~ São **37**, e o índice já diz 37. (A própria
   contagem desta lista tinha envelhecido: o número mudou duas vezes entre a
   análise e a correção. É o argumento contra guardar contagem em prosa.)
2. ~~`redeemInvite` cria a conta do responsável.~~ Corrigido no `CLAUDE.md`: a
   SESSÃO nasce no cliente (`authenticateAndRedeem`), e a function escreve o
   DOCUMENTO com `role: 'parent'` e o vínculo — que é o que o cliente não pode.
3. ~~`papeis.js` diz que o fallback `superAdmin` foi removido.~~ O cabeçalho
   agora diz que ele continua lá, por que, e o que fecha a pendência.
4. ~~`firestore.rules` afirma que o parceiro não escreve o próprio
   `limiteCriancas`.~~ Agora é verdade, com o teste que prova
   (`motorista_nao_escreve_o_proprio_limiteCriancas`).
5. ~~`accountService.js` descreve uma regra de contador que não existe.~~ A
   regra existe (o contador anda de ±1) — e a descrição antiga estava
   **invertida**: ela prometia "descida livre", que era justamente o ataque.
