# Os níveis do motorista (Bronze, Prata, Ouro, Platina, Diamante)

> Aprovado pelo dono em 03/10/2026, depois de validado com as sessões de
> negócio, jornada, financeiro e "Sua perua". Este documento é a ESPECIFICAÇÃO:
> régua, servidor, telas e painel seguem o que está aqui. Mudou a regra, muda
> aqui primeiro.

## 1. A ideia

- **Bronze → Prata → Ouro: aprender o app**, na ordem em que a jornada acontece.
  Nível conquistado não se perde.
- **Platina: em dia com as novidades.** O dono lança uma atividade nova por vez;
  quem não faz no prazo volta ao Ouro.
- **Diamante: em dia + trilha do negócio completa** (fases 1 a 3).
- Depois do Ouro ele oscila entre Ouro, Platina e Diamante por UMA regra:
  ficou em dia ou não ficou.

## 2. Regras que não se negociam

1. **Nível é USO DO APP.** Nunca depende de plano, pagamento, nem do número de
   crianças (cadastro vira fatura depois do teste; nível por porte expõe o
   negócio dele e o faria apagar crianças).
2. **Só conta o que o app confere sozinho.** Nada de "Já fiz" no nível. O que
   ele declara mora na trilha como marco particular e não conta.
3. **Conta o GESTO dele, nunca o da família** (mandou o convite conta; a
   família entrar não).
4. **Atividade de Platina nunca exige pagar ou contratar** (plano anual,
   seguro, adesivo pago, subconta), nem indicar colega, nem meta de adesão das
   famílias, nem nada dirigindo, nem dado de saúde. Grátis, no app, em menos de
   10 minutos. No máximo uma por mês.
5. **Atividade feita antes conta** (progresso antecipado): a régua olha o
   histórico, não o momento.
6. **O que a jornada já obriga aparece JÁ MARCADO** (não é missão).
7. **Nenhuma frase afirma segurança** (`marca/promessas.js`). A família vê o
   nível, nunca o motivo.
8. **Nunca premia valor digitado** (reserva conta a DATA da atualização, nunca o
   valor), nota/avaliação do app, ação com rota rodando, nem saúde.

## 3. Entrada e degraus

- **Sem nível** até a PRIMEIRA ROTA ENCERRADA (`users.ultimaRota` existe). Antes
  disso o app só puxa o cadastro da turma — nenhum selo, nenhuma missão.
- **Bronze** ao encerrar a primeira rota. Aviso único: "Você ganhou o Bronze —
  toque para ver como subir".
- **Missões do Bronze completas → Prata. Missões da Prata completas → Ouro.**
- **Platina** = Ouro + missões do Ouro completas + ao menos UMA atividade de
  Platina concluída + nenhuma atividade de Platina VENCIDA.
- **Diamante** = Platina + trilha fases 1–3 completas.
- Caiu da Platina/Diamante → Ouro (piso). O selo muda calado.

## 4. As missões (todas conferidas pelo app)

`[pré]` = a jornada já obriga; aparece marcado.

| Nível de onde sai | Missão | Fonte do dado |
|---|---|---|
| Bronze | [pré] Primeiro acesso completo | `users.name`, `marcaNome`, `city` |
| Bronze | [pré] Primeira criança cadastrada | `children` ativo com `adminUid` |
| Bronze | [pré] Primeira rota encerrada | `users.ultimaRota` |
| Bronze | Logo da marca | `users.marcaLogoURL` |
| Bronze | Foto em uma criança | algum `children.photoURL` |
| Bronze | Avisos ligados no celular | `users.fcmTokens` não vazio |
| Bronze | App instalado na tela de início | **novo**: `users.marcos.appInstalado` (gravado quando abre em `display-mode: standalone`) |
| Prata | [pré] Contrato emitido para cada criança | `contratoAguardando` ou `contratoVigente` |
| Prata | Convite mandado a todas as famílias | `children.parentUid` OU **novo** `children.conviteEnviadoEm` (gravado no toque de compartilhar), em toda criança ativa |
| Prata | Telefone da escola de todas as crianças | `children.schoolPhone` em toda criança ativa |
| Prata | Turma ou professora de todas as crianças | `children.turma` ou `children.professora` |
| Prata | Um acesso de 24h mandado | `acessosTemporarios` criado por ele |
| Ouro | [pré] Senha do Financeiro | `configFinanceiro/{uid}.temSenha` |
| Ouro | [pré] Chave PIX | `users.pixKey` |
| Ouro | Primeira despesa lançada | `expenses` com `adminUid` |
| Ouro | "A perua roda só nas rotas?" respondido | `configFinanceiro.usoDaPerua` |
| Ouro | Primeira baixa numa mensalidade | `payments` com `adminUid`, `status: 'paid'` |
| Ouro | Alvará conferido | `users.verificacao === 'verificada'` e `alvaraValidade` vigente |

⚠️ `marcos.*` e `conviteEnviadoEm` são gravados pelo próprio cliente — a mesma
troca consciente de `users.ultimaRota` (CLAUDE.md): mentir ali exige devtools e
só faz ele subir um degrau de aprendizado.

## 5. Platina

- Coleção `atividadesDaPlatina/{id}`: `{ titulo, descricao, verificacao,
  lancadaEm, ativa }`. Só o dono escreve; todo motorista lê.
- `verificacao` é uma CHAVE do catálogo da régua (atividade sem chave conhecida
  não existe — nada é marcado à mão). Catálogo inicial:
  - `despesasDoMes` — despesa lançada no mês corrente;
  - `reservaAtualizadaNoMes` — `configFinanceiro.guardado.*.em` no mês corrente;
  - `fotoDeTodas` — foto em todas as crianças ativas;
  - `horarioDeCostumeVisto` — **novo** `users.marcos.horarioDeCostumeVisto`.
- **Prazo: 30 dias**, contados de `lancadaEm`, **pausando** de 1 a 31 de julho e
  de 15 de dezembro a 31 de janeiro (férias escolares).
- Aviso 7 dias antes do prazo (cartão único no Início).

## 6. A trilha do negócio (só o motorista vê, dentro do Financeiro)

| Fase | Conta para o Diamante (o app confere) | Marco particular (não conta) |
|---|---|---|
| 1. Organizado | Despesas em 2 meses diferentes · Abastecimento com `tanqueCheio` 2 vezes · `usoDaPerua` respondido | — |
| 2. Planejado | `configFinanceiro.planoDaTroca` feito · Reserva criada (`guardado.*.em` existe) | "Revisão da perua feita" |
| 3. Formalizado | Contrato no app (`contratoAguardando` ou `contratoVigente`) em todas as crianças ativas | "Tenho contador" · CNPJ (opcional; NÃO exigido — o motorista não precisa de MEI) |
| 4. Protegido e conectado | **Não conta na v1** (seguro e subconta só existem em 2028) | — |

Marcos particulares: `configFinanceiro.marcosDeclarados.{chave}` (só ele lê).

## 7. Onde aparece

- **Motorista**: selo no cabeçalho ao lado da marca a partir do Bronze; toque
  abre **/tio/nivel** ("Meu nível": selo, missões do nível atual, o que já foi
  feito, atividade de Platina com prazo). Missões só aparecem nessa tela.
  Cartão no Início SÓ quando uma atividade de Platina está a 7 dias do prazo.
- **Trilha**: cartão "Meu negócio" no Financeiro → **/tio/finance/negocio**.
- **Família: NÃO VÊ** (decisão do dono, 04/10/2026). Ela via o selo a partir
  da Prata, com uma frase ("Seu tio é engajado no Alô Buzinou"). Saiu: o nível
  mede o uso que ELE faz do app, e mostrado ao cliente dele vira nota do
  motorista diante da família. As rules fecharam `niveis/{uid}` para ela, e
  `npm run testar:nivel` falha se a frase ou o selo da família voltarem.
- Sem animação, sem emoji, ícone do lucide (`Medal`/`Gem`).

## 8. Quem calcula e onde mora

- Régua pura: `src/dominio/identidade/nivel.js`, espelho
  `functions/lib/reguaDoNivel.js` (sem require), `npm run testar:nivel` compara
  os dois caso a caso.
- Servidor: agendada diária `calcularNiveis` + callable `recalcularMeuNivel`
  (o motorista chama ao encerrar a rota e ao abrir "Meu nível").
- Grava `niveis/{uid}`: `{ nivel, desde, atualizadoEm }` — SÓ o rótulo. Lê:
  o motorista e as famílias dele (`ehMotoristaDaFamilia`). Escreve: ninguém pelo
  cliente.
- O checklist da tela "Meu nível" é calculado no aparelho dele com a MESMA
  régua (ele lê os próprios dados); o selo oficial é o do servidor.
