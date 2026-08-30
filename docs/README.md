# Documentação de arquitetura

Três arquivos, três usos diferentes. **Leia este primeiro** para saber onde procurar.

| Arquivo | Para quem | Quando ler |
|---|---|---|
| [`decisoes.md`](decisoes.md) | agente e pessoa | **Sempre.** Cada decisão em ~30 linhas, com o que a prova. É o que impede uma "melhoria" plausível de quebrar uma regra de negócio. |
| [`arquitetura.md`](arquitetura.md) | pessoa, e agente sob demanda | Antes de mexer em permissão, dado sensível, cobrança ou fronteira de camada. |
| [`evolucao.md`](evolucao.md) | pessoa | Ao decidir o que construir depois. Nenhum estágio tem data — todos têm gatilho. |

Versões longas e navegáveis (mesmo conteúdo, mais contexto e diagramas) estão publicadas como páginas privadas no Claude. `decisoes.md` é a fonte normativa: se algo divergir, vale ele.

## Estado deste documento

Escrito em 30/08/2026, com o projeto **em desenvolvimento, sem usuário real**. Essa premissa é o que torna várias decisões baratas — não há dado para migrar. Boa parte delas fica cara no dia em que a primeira família entrar.

## Trecho para colar no CLAUDE.md

Cole isto no `CLAUDE.md`, logo depois da seção "Os quatro papéis". É curto de propósito: o `CLAUDE.md` é carregado em toda sessão, então ele aponta, não repete.

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

## Divergências conhecidas entre o CLAUDE.md e o código

Achadas na análise. Enquanto não forem corrigidas, o índice está mentindo para todo agente que abrir uma sessão:

1. Diz **"38 services"** — são **36**.
2. Diz que **`redeemInvite` cria a conta do responsável**. Não cria: a conta nasce no cliente (`authService.js:151-213`) e a function apenas **vincula** uma sessão existente (`invites.js:126-130`).
3. `papeis.js` afirma no comentário que o fallback `superAdmin` **foi removido**. Não foi — está na linha 49.
4. `firestore.rules:428` afirma que o parceiro não escreve o próprio `limiteCriancas`. Escreve (ver decisão 12).
5. `accountService.js:196` descreve uma regra de contador que **não existe** nas rules.
