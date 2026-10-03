"""
GERA AS SETE PÁGINAS PRÓPRIAS DO SITE (landing/*.html) — 02/10/2026.

As páginas têm o mesmo cabeçalho, topo, cena e rodapé; escrever isso sete
vezes à mão é como uma delas fica para trás. ESTE ARQUIVO É A FONTE: mude o
texto aqui e rode `python scripts/gerar-paginas-do-site.py`. O estilo e o
comportamento comuns moram em landing/paginas.css e landing/paginas.js, e
`npm run testar:site` confere o resultado.

A marca (o SVG do logo) é lida da própria home, para as duas nunca divergirem.
"""
import os, re, html, urllib.parse
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_home = open(os.path.join(RAIZ, 'landing', 'index.html'), encoding='utf-8').read()
MARCA = re.search(r'<a href="#topo" class="marca"[\s\S]*?</a>', _home).group(0)
MARCA = MARCA.replace('href="#topo"', 'href="/"').replace('aria-label="Alô Buzinou — início"', 'aria-label="Alô Buzinou — página inicial"')

CK = '<span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#1F5F3F" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>'
ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z"/></svg>'
MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

VAN = '<g class="van-in"><rect x="0" y="0" width="92" height="40" rx="12" fill="#1F5F3F"/><rect x="0" y="22" width="92" height="6" fill="#F5A623"/><rect x="8" y="7" width="16" height="12" rx="3" fill="#CFF3DA"/><rect x="28" y="7" width="16" height="12" rx="3" fill="#CFF3DA"/><path d="M50 7h16l12 12H50z" fill="#CFF3DA"/><circle class="rd" cx="22" cy="42" r="8" fill="#0B1210"/><circle class="rd" cx="70" cy="42" r="8" fill="#0B1210"/><circle cx="22" cy="42" r="3" fill="#D9E1DC"/><circle cx="70" cy="42" r="3" fill="#D9E1DC"/></g>'
CENAS = {
 'motorista':'<div class="cena c-mot" aria-hidden="true"><svg viewBox="0 0 400 150"><line x1="0" y1="128" x2="400" y2="128" stroke="#BFD9B4" stroke-width="3"/><line class="faixa" x1="0" y1="138" x2="400" y2="138" stroke="#9CC98A" stroke-width="3"/><g transform="translate(154 70)"><g class="van">'+VAN+'</g></g></svg></div>',
 'familia':'<div class="cena c-fam" aria-hidden="true"><svg viewBox="0 0 400 150"><g class="cel"><rect x="140" y="10" width="120" height="180" rx="18" fill="#0B1210"/><rect x="148" y="20" width="104" height="170" rx="12" fill="#F4F7F5"/></g><g class="notif"><rect x="154" y="34" width="92" height="52" rx="10" fill="#fff" stroke="#D9E0DB"/><circle cx="168" cy="50" r="7" fill="#1F5F3F"/><rect x="180" y="45" width="56" height="7" rx="3" fill="#0B1210"/><rect x="162" y="64" width="74" height="6" rx="3" fill="#9AA8A1"/><rect x="162" y="74" width="50" height="6" rx="3" fill="#9AA8A1"/></g></svg></div>',
 'sobre':'<div class="cena c-sob" aria-hidden="true"><svg viewBox="0 0 400 150"><path class="liga" d="M96 75 C160 20, 240 130, 304 75" fill="none" stroke="#52C41A" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="75" r="26" fill="#1F5F3F"/><text x="80" y="122" text-anchor="middle" font-size="13" font-weight="700" fill="#1F5F3F">quem dirige</text><circle cx="320" cy="75" r="26" fill="#1F5F3F"/><text x="320" y="122" text-anchor="middle" font-size="13" font-weight="700" fill="#1F5F3F">quem confia</text><path class="cor" d="M200 92 l-15-14 a9 9 0 0 1 15-11 a9 9 0 0 1 15 11z" fill="#F5A623"/></svg></div>',
 'duvidas':'<div class="cena c-duv" aria-hidden="true"><svg viewBox="0 0 400 150"><rect x="140" y="22" width="120" height="86" rx="22" fill="#1F5F3F"/><path d="M178 106 l-6 24 24-22z" fill="#1F5F3F"/><text class="q" x="200" y="88" text-anchor="middle" font-size="58" font-weight="800" fill="#fff">?</text><path class="ok" d="M176 66 l16 16 32-34" fill="none" stroke="#7CE34E" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg></div>',
 'contato':'<div class="cena c-con" aria-hidden="true"><svg viewBox="0 0 400 150"><g class="dig"><rect x="120" y="50" width="84" height="44" rx="22" fill="#fff" stroke="#D9E0DB"/><circle class="pt" cx="146" cy="72" r="6" fill="#55606E"/><circle class="pt" cx="162" cy="72" r="6" fill="#55606E"/><circle class="pt" cx="178" cy="72" r="6" fill="#55606E"/></g><g class="msg"><rect x="120" y="40" width="190" height="64" rx="18" fill="#DCF8C6"/><rect x="136" y="58" width="150" height="9" rx="4" fill="#3B6E3A"/><rect x="136" y="76" width="104" height="9" rx="4" fill="#3B6E3A"/></g></svg></div>',
 'como':'<div class="cena c-como" aria-hidden="true"><svg viewBox="0 0 400 150"><path class="rota" d="M60 110 C140 110, 140 40, 220 40 S 320 100, 340 60" fill="none" stroke="#9CC98A" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="110" r="12" fill="#1F5F3F"/><text x="60" y="140" text-anchor="middle" font-size="12" font-weight="700" fill="#1F5F3F">casa</text><circle cx="340" cy="60" r="12" fill="#7C3AED"/><text x="340" y="92" text-anchor="middle" font-size="12" font-weight="700" fill="#5B21B6">escola</text><g><circle r="11" fill="#F5A623" stroke="#fff" stroke-width="3"/><animateMotion dur="2.4s" fill="freeze" begin="0.3s" path="M60 110 C140 110, 140 40, 220 40 S 320 100, 340 60"/></g></svg></div>',
 'investidores':'<div class="cena c-inv" aria-hidden="true"><svg viewBox="0 0 400 150"><line x1="90" y1="128" x2="310" y2="128" stroke="#BFD9B4" stroke-width="3"/><rect class="bar" x="110" y="98" width="34" height="30" rx="6" fill="#9CC98A"/><rect class="bar b2" x="160" y="78" width="34" height="50" rx="6" fill="#6FB257"/><rect class="bar b3" x="210" y="56" width="34" height="72" rx="6" fill="#3E8E4A"/><rect class="bar b4" x="260" y="30" width="34" height="98" rx="6" fill="#1F5F3F"/><path class="tend" d="M112 86 L178 64 L226 44 L286 16" fill="none" stroke="#F5A623" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>',
}

def lista(itens):
    return '<ul class="lista">' + ''.join('<li>%s<span>%s</span></li>' % (CK, t) for t in itens) + '</ul>'

PEDIDO = ('Oi! Queria acompanhar a perua pelo Alô Buzinou — dá pra ver quando ela está chegando, '
          'avisar quando meu filho não vai e acertar a mensalidade por lá.\n\n'
          'Você cria a sua conta aqui: https://alobuzinou.com/quero-fazer-parte\n\n'
          'Depois é você que me manda o convite pelo WhatsApp.')
LINK_PEDIDO = 'https://wa.me/?text=' + urllib.parse.quote(PEDIDO)
ZAP_CONTATO = 'https://wa.me/5511969170709?text=' + urllib.parse.quote('Oi! Vim pelo site do Alô Buzinou.')

FAQ_MOT = [
 ('Vocês ficam com uma parte da minha mensalidade?','Não. Nem um centavo. O que o pai te paga vai direto pra você — PIX, dinheiro ou maquininha. A conta do app é separada, e ela não tem nada a ver com quanto você fatura.'),
 ('Quanto custa?','O app está em fase de teste: por enquanto, é grátis. Quando a cobrança começar, ela é por criança que você leva, com o app completo pra todo mundo, sem plano capado — e a gente avisa antes, com tempo.'),
 ('E nas férias, quando as crianças param?','A conta acompanha quantas crianças estão ativas. Perdeu crianças, a conta do mês seguinte cai junto. E quem escolhe as crianças que saem é você — a gente nunca desativa ninguém no seu lugar.'),
 ('Como eu cobro quem atrasou?','O app mostra quem pagou e quem está em aberto, e deixa o PIX pronto pra você mandar. Você não precisa mais lembrar de cabeça nem abrir caderno.'),
 ('Preciso saber mexer bem no celular?','Se você usa WhatsApp, você usa o Alô Buzinou. O app foi desenhado pra ser usado em pé, na rua, com uma mão só.'),
 ('Posso sair quando quiser?','Pode, pelo próprio app. No plano mensal não tem multa nenhuma. No anual, sair antes dos doze meses tem multa — e ela está escrita no contrato antes de você assinar.'),
 ('Preciso ter CNPJ pra usar?','Não precisa. Se você dirige e tem suas famílias, você usa. A gente não pede MEI, não pede CNPJ e não pede papelada pra você começar.'),
 ('Os dados das crianças ficam onde?','Na infraestrutura do Google (Firebase), tratados conforme a LGPD. Endereço, foto e localização de criança só aparecem pra quem tem vínculo real com ela — nem outro motorista consegue ver.'),
]
FAQ_FAM = [
 ('Como eu crio minha conta?','Quem cria é o seu motorista. Ele te manda um link no WhatsApp, você abre e entra com o Google em dois toques — sem cadastro pra preencher e sem código pra digitar.'),
 ('Quem consegue ver onde meu filho está?','Só você e o motorista dele. Endereço, foto e localização aparecem exclusivamente pra quem tem vínculo real com aquela criança.'),
 ('E se eu perder o link?','Peça outro pro seu motorista. Ele consegue mandar de novo a qualquer momento pelo app dele.'),
 ('Eu pago pelo app?','Não. A mensalidade do transporte você continua pagando direto pro motorista, do jeito que vocês já combinaram.'),
 ('Como eu aviso que hoje meu filho não vai?','Direto no app, com um toque, e dá pra marcar pra frente também. O motorista vê antes de sair de casa.'),
 ('Preciso instalar alguma coisa?','Não precisa passar por loja. O Alô Buzinou instala direto do navegador: você abre o link e coloca na tela de início do celular como qualquer app.'),
]
def faq(pub, itens, escondido):
    return '<div class="faq" data-pub="%s"%s>' % (pub, ' hidden' if escondido else '') + ''.join(
        '<details><summary>%s</summary><p class="resp">%s</p></details>' % (q, a) for q, a in itens) + '</div>'

PAGINAS = {
 'como-funciona': dict(cena='como', titulo='Como funciona', desc='Como o Alô Buzinou funciona: o tio cadastra a turma, a família entra pelo link, a rota roda e a mensalidade se organiza sozinha.', corpo=
  '<span class="chapeu">o seu ambiente digital de trabalho</span><h1>Como o app funciona?</h1>'
  '<div class="passos"><span class="enche" aria-hidden="true"></span>'
  '<h2><span class="n">1</span>O tio cadastra a turma</h2><p>Cada criança com nome, foto, endereço, escola e o horário combinado com os pais. Você preenche uma vez, e a rota do dia se monta sozinha na ordem das horas — sem você arrastar nada.</p>'
  '<h2><span class="n">2</span>A família entra pelo link</h2><p>O tio manda um link no WhatsApp e pronto: a conta dela nasce dali, com o Google em dois toques. A partir daí ela vê o embarque e o desembarque, avisa a falta sem depender de ninguém ler mensagem, e o celular dela toca quando você quiser — a buzina digital, pra ninguém buzinar na rua.</p>'
  '<h2><span class="n">3</span>A rota roda e todo mundo vê</h2><p>Todo dia você dá partida no app. A família acompanha a perua no mapa, vê quando a criança subiu, chegou na escola e desceu em casa, e recebe um aviso no celular quando você está chegando.</p>'
  '<h2><span class="n">4</span>A mensalidade se organiza sozinha</h2><p>O app mostra quem pagou, quem atrasou e quem ainda está em aberto, e põe o seu PIX na frente do pai na hora de pagar. Depois fica a lista do mês inteiro, registrada — sem caderno, sem planilha e sem cobrar de boca.</p></div>'
  '<a class="btn" href="/motorista">Ver a parte do motorista</a><a class="btn esc" href="/familia">Ver a parte da família</a>'),
 'motorista': dict(cena='motorista', titulo='Pra quem dirige', desc='O seu ambiente digital de trabalho: rota pronta, aviso de chegada, mensalidade organizada e o PIX pronto pra mandar.', corpo=
  '<span class="chapeu">pra quem dirige</span><h1>O seu ambiente digital de trabalho.</h1>'
  '<p class="sub">A gente não vem te ensinar a dirigir nem a cuidar de criança. Nisso você já é bom — é por isso que as mesmas famílias confiam em você há anos. A gente vem tirar o resto do seu ombro.</p>'
  + lista(['A rota do dia pronta, na ordem dos horários','Aviso automático pra família quando você está chegando','Quem pagou, quem falta, e o PIX pronto pra mandar','Contrato digital, aceito pelo celular do responsável','Falta avisada pela família antes de você sair de casa','Dia sem aula avisado pra todos os pais com um clique só','A hora que a criança subiu, chegou na escola e desceu em casa, registrada todo dia','O horário combinado de embarque e desembarque, acompanhado pela família'])
  + '<div class="exemplo"><b>Recebido em agosto · <span class="conta" data-ate="2340">R$ 2.340,00</span></b><div class="barra"><i></i></div><p style="font-size:16px;margin-top:8px">6 de 9 famílias em dia · Theo Nakamura, venceu 10/07</p><small>tela de exemplo · quem pagou, quem falta, e o PIX pronto</small></div>'
  '<h2>E se a mãe não souber usar?</h2><p>Se você sabe mexer no WhatsApp, sabe mexer nesse app. O tio cria a conta, e com um clique no link ela já entra.</p>'
  '<a class="btn" href="https://alobuzinou.com/quero-fazer-parte">Criar minha conta '+SETA+'</a>'),
 'familia': dict(cena='familia', titulo='Pra família', desc='Saber onde seu filho está: a hora da perua, o mapa, o aviso de chegada, a falta avisada e a mensalidade no celular.', corpo=
  '<span class="chapeu">pra quem confia</span><h1>Saber onde seu filho está faz parte do serviço que você já paga.</h1>'
  '<p class="sub">“Que horas o tio vai chegar?” “Será que ele já passou?” Você não precisa ficar na janela, nem ligar pro tio no meio da rota — ele está dirigindo.</p>'
  + lista(['A hora de estar na porta, combinada com o motorista.','Onde a perua está agora, no mapa.','Um aviso no celular quando ela está chegando.','Avisar que hoje não vai — e o tio já vê o aviso na rota dele.','A mensalidade, o mês que está pago e o PIX do tio, fácil.'])
  + '<h2>A agenda digital do seu filho.</h2><p>O tio avisa pelo app, e o recado fica guardado: dia sem aula, o dia em que ele não estava bem, o desentendimento com um colega. Fica na agenda dele, com data.</p>'
  '<h2>Sua conta é criada pelo motorista.</h2><p>Ele te manda um link de convite, você entra, e pronto. Não existe cadastro aberto aqui — e é justamente isso que protege os dados do seu filho.</p>'
  '<a class="btn esc" href="https://alobuzinou.com/first-access">Recebi um convite</a>'
  '<h2>O seu tio ainda não usa?</h2><p>Quem abre a conta da família é ele. Manda o link pra ele conhecer — é você quem leva o Alô Buzinou pra sua perua.</p>'
  '<a class="btn" data-zap href="'+html.escape(LINK_PEDIDO)+'" target="_blank" rel="noopener">'+ZAP+'<span class="txt">Mandar pro meu motorista no WhatsApp</span></a>'
  '<a class="peca" href="/brand/convite.jpg" download="alo-buzinou.jpg"><img src="/brand/convite.jpg" width="54" height="96" loading="lazy" decoding="async" alt="A imagem do convite, com o endereço do site escrito"><span><b>Baixar a imagem</b><small>Pra mandar no WhatsApp dele ou postar no Story — o endereço vai escrito nela.</small></span></a>'),
 'sobre': dict(cena='sobre', titulo='Sobre nós', desc='Quem é o Alô Buzinou: a missão de ligar quem dirige e quem confia, e os valores que guiam o app.', corpo=
  '<span class="chapeu">quem somos</span><h1>Quem é o Alô Buzinou</h1>'
  '<p class="sub">A gente nasceu olhando pra um trabalho que move milhares de crianças todo dia e que, mesmo assim, roda em caderno, planilha e conversa de WhatsApp. Não é falta de capricho de quem dirige. É falta de ferramenta feita pra ele.</p>'
  '<div class="cards rv"><div><b>Missão</b><p>Ligar as duas pontas com confiança: quem dirige e quem confia, com a mesma informação chegando dos dois lados.</p></div><div><b>Visão</b><p>Ser referência em confiança, não em tamanho. A gente prefere ser o app que motorista e família recomendam.</p></div></div>'
  '<h2>Nossos valores</h2><div class="cards rv"><div><b>O dinheiro do motorista é do motorista</b><p>A mensalidade não passa pela gente. Nunca passou.</p></div><div><b>A gente é comunidade</b><p>Tio indica tio, tia avisa tia. A gente cresce assim, e não por anúncio.</p></div><div><b>Do lado de quem dirige</b><p>A gente existe pra apoiar o motorista, não pra fiscalizar ele.</p></div></div>'
  '<p style="font-size:15px;color:#55606E;margin-top:22px">Alô Buzinou · CNPJ 65.000.217/0001-47 · Rua das Trovas, Socorro · São Paulo/SP</p>'),
 'duvidas': dict(cena='duvidas', titulo='Dúvidas', desc='As perguntas de quem dirige e de quem confia: preço, dinheiro, dados das crianças, link do convite e como avisar a falta.', corpo=
  '<span class="chapeu">perguntas frequentes</span><h1>Dúvidas</h1>'
  '<div class="tabs" role="tablist" aria-label="Escolha o público"><span class="pilula" aria-hidden="true"></span><button type="button" role="tab" data-pub="mot" aria-selected="true">Quem dirige</button><button type="button" role="tab" data-pub="fam" aria-selected="false">Quem confia</button></div>'
  + faq('mot', FAQ_MOT, False) + faq('fam', FAQ_FAM, True)
  + '<p style="font-size:16px">Não achou? <a href="/contato">Fala com a gente</a>.</p>'),
 'contato': dict(cena='contato', titulo='Contato', desc='Fala com a gente pelo WhatsApp ou por e-mail. Dúvida, sugestão ou reclamação — a gente responde tudo.', corpo=
  '<span class="chapeu">fala com a gente</span><h1>Fala com a gente</h1><p class="sub">Dúvida, sugestão ou reclamação — a gente responde tudo.</p>'
  '<div class="cards rv"><div><b>WhatsApp</b><p>(11) 96917-0709</p></div><div><b>E-mail</b><p>contato@alobuzinou.com</p></div></div>'
  '<a class="btn" data-zap href="'+html.escape(ZAP_CONTATO)+'" target="_blank" rel="noopener">'+ZAP+'<span class="txt">Chamar no WhatsApp</span></a>'
  '<a class="btn esc" href="mailto:contato@alobuzinou.com">'+MAIL+'Mandar e-mail</a>'
  '<p style="font-size:16px">O WhatsApp abre com a conversa já começada. Você escreve e envia.</p>'),
 'investidores': dict(cena='investidores', titulo='Investidores', desc='A tese do Alô Buzinou em três linhas, e o contato para receber o material completo.', corpo=
  '<span class="chapeu">para quem investe</span><h1>A tese, em três linhas.</h1><p class="sub">Alô Buzinou · transporte escolar · São Paulo/SP · CNPJ 65.000.217/0001-47</p>'
  '<div class="cards rv"><div><b>O mercado</b><p>O transporte escolar move crianças todo dia no Brasil inteiro, e quase toda a operação roda sem sistema de gestão — em caderno, planilha e conversa de WhatsApp.</p></div><div><b>Por que agora</b><p>PIX, smartphone barato e app que instala pelo navegador tornaram viável digitalizar um autônomo que nunca instalaria um software de gestão.</p></div><div><b>Por que nós</b><p>Produto rodando com operação real, dinheiro do motorista separado do da plataforma, e um canal de aquisição que é a própria comunidade de motoristas.</p></div></div>'
  '<form class="lead rv" novalidate><h2>Quer receber o material completo?</h2><p>Os números da operação, o modelo de cobrança e o roadmap. Deixa seu contato que a gente manda.</p>'
  '<label class="campo">Seu nome<input name="nome" autocomplete="name" maxlength="80" required></label>'
  '<label class="campo">Seu e-mail<input name="email" type="email" autocomplete="email" maxlength="120" required></label>'
  '<label class="campo">WhatsApp <small>(opcional)</small><input name="whatsapp" inputmode="tel" autocomplete="tel" maxlength="20"></label>'
  '<label class="isca" aria-hidden="true">Site<input name="site" tabindex="-1" autocomplete="off"></label>'
  '<p class="erro" role="alert" hidden></p>'
  '<button type="submit" class="btn esc"><span class="txt">Quero receber o material</span></button>'
  '<p style="font-size:14px;color:#55606E">Usamos seu contato só para falar sobre investimento no Alô Buzinou.</p></form>'),
}

RODAPE = '''<section class="fecho"><div class="wrap"><h2>Daqui em diante, você decide.</h2><p>Digitalizar a sua rota começa com uma conta.</p><a class="btn" href="https://alobuzinou.com/quero-fazer-parte">Criar minha conta '''+SETA+'''</a></div></section>
<footer><div class="wrap">
  <nav aria-label="Mais sobre o Alô Buzinou"><a href="/como-funciona">Como funciona</a><a href="/familia">Pra família</a><a href="/sobre">Sobre nós</a><a href="/duvidas">Dúvidas</a><a href="/contato">Contato</a><a href="https://alobuzinou.com/login">Entrar no app</a></nav>
  <p>Rua das Trovas — Socorro · São Paulo/SP · CEP 04763-110</p>
  <p><a href="mailto:contato@alobuzinou.com">contato@alobuzinou.com</a> · <a href="https://wa.me/5511969170709" target="_blank" rel="noopener">(11) 96917-0709</a></p>
  <p class="leg">CNPJ 65.000.217/0001-47 · © 2026 Alô Buzinou · <a href="https://alobuzinou.com/termos">Termos de Uso</a> · <a href="https://alobuzinou.com/privacidade">Política de Privacidade</a> · <a href="/investidores">Investidores</a></p>
</div></footer>'''

def pagina(slug, d):
    url = 'https://alobuzinou.com.br/' + slug
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1F5F3F">
<meta name="color-scheme" content="light">
<!-- PÁGINA PRÓPRIA do site — gerada a partir do mesmo molde das outras seis.
     O estilo e o comportamento são comuns: paginas.css e paginas.js. Ver o
     cabeçalho de paginas.css antes de mexer. -->
<title>{d["titulo"]} — Alô Buzinou</title>
<meta name="description" content="{html.escape(d["desc"])}">
<link rel="canonical" href="{url}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Alô Buzinou">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{d["titulo"]} — Alô Buzinou">
<meta property="og:description" content="{html.escape(d["desc"])}">
<meta property="og:image" content="https://alobuzinou.com.br/brand/og-image.png">
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
<link rel="alternate icon" href="/brand/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/paginas.css">
<script>
/* A página nasce completa. Só ganha permissão de esconder coisa pra revelar
   se houver IntersectionObserver e a pessoa não pediu movimento reduzido. */
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {{
  document.documentElement.className += ' anima';
}}
</script>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="voltar" href="/" data-voltar><span class="seta" aria-hidden="true">&#8592;</span> Voltar</a>
  {MARCA}
  <a class="entrar" href="https://alobuzinou.com/login">Entrar no app</a>
</div></header>
<div class="leitura" aria-hidden="true"><i></i></div>
<main><div class="wrap">
{CENAS[d["cena"]]}
{d["corpo"]}
</div></main>
{RODAPE}
<script src="/paginas.js" defer></script>
</body>
</html>
'''

for slug, d in PAGINAS.items():
    with open(os.path.join(RAIZ, 'landing', slug + '.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(pagina(slug, d))
print('ok', len(PAGINAS))
