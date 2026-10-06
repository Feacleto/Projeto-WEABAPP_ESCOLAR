# Versões publicadas

Gerado por `npm run versao:lista` a partir das marcas `v*` do git — não
edite à mão. Cada versão é UMA publicação em produção; o número depois do
ponto sobe de um em um, e o da frente só muda por decisão do dono. A regra
mora em `src/compartilhado/versaoDoApp.js` e em `scripts/versao.mjs`.

## 1.3 · 5 de outubro de 2026

commit 523 (`1a53333`)

- O deploy sobe também as 5 functions novas da rodada (uso do app, contatos, segurança, falta e quem busca da auxiliar)
- Os Termos deixam de citar o botão "Estou na escola agora", que não existe
- O Buzi volta a falar, e valor em voz alta só quando o motorista toca em "Ouvir"
- A ficha, o perfil e as telas de lista cabem mais: o rosto vai para o lado do nome e as explicações viram uma linha
- Minha turma vira a tela de gerenciar a turma, e o Início diz "Bom dia, Tio Zé!" numa linha
- O registro de contatos e o uso do app existem no código, e a Política deixa de marcá-los como em construção
- O painel do dono ganha Kanban, CRM, Uso do app, ESG e Segurança, e o Jurídico mostra o modelo dos contratos
- A Política diz o que a equipe anota sobre o motorista e que o uso do app é contado só em números
- Casos de regra da correção no CRM do dono, escritos antes da regra
- Casos de regra da tela de segurança do painel, escritos antes da regra
- Casos de regra do kanban, dos contatos e do uso do app no painel do dono, escritos antes da regra
- A tela do celular cabe mais: o menu fica baixo, o botão verde cola nele e puxar não quebra mais a tela
- O painel do dono ganha o menu em cinco grupos e as telas de avaliação, calendário, economia, famílias, auxiliares, contas, vendas, marketing, relatório para investidor e política de bloqueio
- O caso do recado ainda inexistente lê o 404 como liberado, e uma sonda prova que outro tio recebe 403
- O "Faltou" no registro do dia vale para o dia inteiro, e a Política do recado deixa de estar em construção
- A jornada da auxiliar mede o Faltou dela e quem busca chegando só com o nome
- A Política diz o que é o recado do dia, que a auxiliar vê só o nome de quem busca, e que ela pode marcar a falta
- Só a família escreve o recado do dia do próprio filho, e só o tio dela o lê
- Casos de regra do recado do dia e de quem busca para a auxiliar, escritos antes da regra
- A família manda um recado curto ao tio sobre o dia, e ele lê em âmbar na ficha da rota
- A perua da rota ao vivo é a mesma perua de assentos do Início, com quem está nela aceso
- A auxiliar vê o nome de quem busca a criança hoje, e nunca o telefone dessa pessoa
- A auxiliar marca "Faltou" na rota, e a família recebe o mesmo aviso de quando o tio marca
- O registro do dia da auxiliar existe no código, e a Política deixa de marcá-lo como em construção
- A contagem de scripts da bateria no CLAUDE.md volta a bater com a cadeia
- A Política diz o que fica do registro do dia da auxiliar, e por quanto tempo
- O registro do que a auxiliar marcou só é lido pelo tio e pela auxiliar ativa dele
- Casos de regra do registro da rota, escritos antes da regra
- Na rota, o tio vê onde cada criança está e o que a auxiliar marcou; tocar numa criança abre a ficha rápida
- O que a auxiliar marca fica registrado com a hora, para o tio acompanhar
- A regra aceita as vagas da perua: inteiro de 1 a 60, só no documento do próprio motorista
- Casos de regra das vagas da perua, escritos antes da regra
- O motorista diz quantas vagas a perua tem e vê a turma dentro dela
- A jornada do motorista roda ponta a ponta contra o emulador, chamando as functions de verdade
- A jornada da família roda ponta a ponta contra o emulador, chamando as functions de verdade
- A jornada da auxiliar roda ponta a ponta contra o emulador, chamando as functions de verdade
- A Central passa a se chamar Carteira, e na rota a aba vira "Rota"
- O deploy volta a subir todas as functions: as 37 novas da rodada entram na lista
- A Política diz como a foto da comunidade funciona de verdade, e a última marca de "em construção" sai
- A foto da turma chega aos tios parceiros e às famílias deles, com o sim de cada família
- Casos de regra da foto da comunidade, escritos antes da regra
- A Política diz o que a substituta de um dia vê de verdade, e que a auxiliar apaga a foto que postou
- O tio vê no calendário os dias em que a auxiliar faltou e os dias que cada substituta cobriu
- A contagem de scripts da bateria no CLAUDE.md volta a bater com a cadeia
- O dono suspende, avisa ou reativa um motorista com motivo, prazo de resposta e registro de quem decidiu
- O prazo da suspensão só é gravado pelo servidor, nem o dono escreve à mão
- Casos de regra do registro de ações do dono e da suspensão só pelo servidor, escritos antes da regra
- O link da substituta morre quando a conta do tio deixa de operar
- A substituta da auxiliar recebe a rota de hoje por um link que vale só hoje
- A substituta de um dia ganha os casos de regra antes da regra: só o tio lê o acesso, ninguém escreve
- A ficha da criança e a folha "Abasteci" voltam a abrir no npm run dev
- O Buzi vira conversa: ele oferece os assuntos, responde da rota e da turma, e monta o Boletim que o motorista escolher
- Ninguém lê nem escreve pelo app quem postou a foto da turma, nem a autora nem o dono
- A auxiliar com tio ativo sobe a foto da turma só na própria pasta
- Casos de regra do Storage para a auxiliar subir a foto da turma na própria pasta, escritos antes da regra
- A auxiliar posta a foto da turma para as famílias, em nome do tio
- O dono passa a ver a evolução da base semana a semana, e o nível e as auxiliares de cada motorista
- A Política 1.4 diz quem vê a foto da turma na comunidade dos tios parceiros
- Casos de regra da foto diária da base e da leitura do dono em níveis e auxiliares, escritos antes da regra
- A família vê quem pede a passagem e sempre consegue falar com o tio
- A Política e os Termos 1.4 passam a falar da auxiliar, das substitutas e da passagem da família
- Três jornadas novas no navegador: a foto e as estrelas da família, a passagem da família com três aparelhos e a auxiliar com dois tios
- O dono abre o painel e vê se o app está sendo usado, quem assina e o que falta no papel
- auxiliar: textos e botões da auditoria de uso
- Para receber uma família, vale o contrato mais recente da assinatura, na tela e no servidor
- Dois pedidos de passar família feitos ao mesmo tempo não furam o teto de 10 por mês
- A tela de assinar mostra o contrato novo, mesmo quando há um antigo já aceito
- O tio só recebe uma família com o contrato da assinatura aceito, e o servidor confere
- Quem assina para receber uma família passa pelo contrato antes de voltar ao pedido
- Um tio passa até 10 famílias por mês, e quem assina para receber volta direto ao pedido
- A auxiliar não troca de perua com criança dentro, e cada perua aparece na cor do tio
- O tio vê no Início que a auxiliar faltou hoje, e quem substituiu, sem nenhum valor
- O tio passa a família para um parceiro, e ela aceita antes de qualquer coisa mudar
- O convite no WhatsApp mostra o cartão grande do tio, e o parceiro indicado fica sabendo
- As rules da recomendação e da nota da auxiliar ganham teste: só o par lê, e só o dono vê a nota
- O tio recomenda a auxiliar e ela diz como é trabalhar com ele
- As rules da auxiliar ganham teste do vínculo por par: dois tios, histórico e recontratação
- A auxiliar pode trabalhar para dois tios, e quem já trabalhou com o tio nunca some da lista dele
- A jornada do tio com senha confere a Central de uma rolagem só, com as mensalidades primeiro
- A Central ganha a Economia do mês: inflação, juros, dólar e o litro que o tio pagou
- O motorista assina o Contrato de Assinatura com CPF/CNPJ, e a multa do anual cai para 10%
- O tio posta a foto da turma só com o "sim" de cada família, e a família dá a nota dele
- O contrato da família ganha a versão 2 do texto, e a empresa aparece com a razão social e o número do endereço
- O projeto inteiro numa leitura: a visão geral para o dono e para quem chega
- As jornadas vão ao mesmo servidor pelo APP ou pelo APP_URL, e o login único segue a P1
- A jornada da auxiliar na rota ganha teste no navegador, e as jornadas param de pedir login toda vez
- O dinheiro da auxiliar ganha teste de regra: pagamento, falta e substitutas fechados a quem não é dono
- O tio anota que pagou a auxiliar, e ela confirma "Recebi" no app dela
- O tio registra a falta da auxiliar e quem substituiu, e ganha uma lista de substitutas
- A auxiliar ganha um espaço próprio na Central, e o detalhe dela passa a pedir a senha
- A conta da auxiliar ganha teste de regra: ela só vê o motorista e a turma dele, e só enquanto ativa
- A auxiliar ganha conta própria: entra pelo convite do tio, vê a turma do dia e marca a rota
- A Central do motorista volta a ser a visão do mês: mensalidades primeiro, depois a turma
- Os planos financeiros ganham teste de regra: no máximo 12, e só o próprio motorista grava
- O motorista cria planos financeiros na Central e vê quanto separar por mês
- Todo mês o motorista vê a fatura que pagaria, riscada, e "Você paga R$ 0,00"
- A mensalidade em aberto cabe na tela pequena, e o "Rota ativa" se lê sob o sol
- O que a auxiliar faz na rota sem a senha passa a ter teste: nenhuma tela mostra valor
- Cada motorista ganha um código de indicação próprio, para o cupom do cartão do app
- Fora da rota, a Central é do motorista: abre na senha, com o Buzi logo abaixo do saldo e quatro abas
- Na rota, a Central é da auxiliar: ela recebe na porta sem ver valor e mostra o PIX da perua
- A cor do logo aparece de verdade: o laranja continua laranja, e trocar o logo pergunta antes
- O Perfil volta a compilar: a mudança de cor de outra sessão sai do commit do sino
- O sino separa os avisos novos dos já vistos, e as chaves de aviso ficam no Perfil
- Os textos ficam curtos: "Abrir rota", "Abrir caixa", "Cadastrar criança"
- O Início fica com quatro blocos, e a rota ganha tela própria: "Minha rota"
- Tocar em "Atualizar" leva à versão mais nova de verdade, e o aviso não volta
- A lista de versões registra a 1.2, que acabou de ir ao ar

## 1.2 · 4 de outubro de 2026

commit 413 (`7a7c893`)

- O trabalho das outras sessões entra junto: nível no menu do perfil, site com "Use grátis. Decida depois.", ícones da marca, PIX e a tela de versão
- O motorista cria a conta e cadastra a turma no mesmo caminho, e "Meus planos" vira autoatendimento
- O rodapé do site vira quadrados com ícone e Ver, e o Entrar no app vira o botão verde largo

## 1.1 · 4 de outubro de 2026

commit 410 (`d87b4a6`)

- Primeira versão marcada: tudo o que veio antes dela.

## 1.0 · até 4 de outubro de 2026

- O número fixo que o app mostrava antes da numeração. Não corresponde a um
  commit exato: houve publicação feita com arquivo sem commit.
