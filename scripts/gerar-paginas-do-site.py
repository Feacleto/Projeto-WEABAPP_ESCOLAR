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

# Os ícones são os do lucide, o mesmo desenho do app (design system, D8).
CK = '<span class="ck" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#1F5F3F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>'
ZAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>'
MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'

VAN = '<g class="van-in"><rect x="0" y="0" width="92" height="40" rx="12" fill="#1F5F3F"/><rect x="0" y="22" width="92" height="6" fill="#F5A623"/><rect x="8" y="7" width="16" height="12" rx="3" fill="#CFF3DA"/><rect x="28" y="7" width="16" height="12" rx="3" fill="#CFF3DA"/><path d="M50 7h16l12 12H50z" fill="#CFF3DA"/><circle class="rd" cx="22" cy="42" r="8" fill="#0B1210"/><circle class="rd" cx="70" cy="42" r="8" fill="#0B1210"/><circle cx="22" cy="42" r="3" fill="#D9E1DC"/><circle cx="70" cy="42" r="3" fill="#D9E1DC"/></g>'
CENAS = {
 'motorista':'<div class="cena c-mot" aria-hidden="true"><svg viewBox="0 0 400 150"><line x1="0" y1="128" x2="400" y2="128" stroke="#BFD9B4" stroke-width="3"/><line class="faixa" x1="0" y1="138" x2="400" y2="138" stroke="#9CC98A" stroke-width="3"/><g transform="translate(154 70)"><g class="van">'+VAN+'</g></g></svg></div>',
 'familia':'<div class="cena c-fam" aria-hidden="true"><svg viewBox="0 0 400 150"><g class="cel"><rect x="140" y="10" width="120" height="180" rx="18" fill="#0B1210"/><rect x="148" y="20" width="104" height="170" rx="12" fill="#F4F7F5"/></g><g class="notif"><rect x="154" y="34" width="92" height="52" rx="10" fill="#fff" stroke="#D9E0DB"/><circle cx="168" cy="50" r="7" fill="#1F5F3F"/><rect x="180" y="45" width="56" height="7" rx="3" fill="#0B1210"/><rect x="162" y="64" width="74" height="6" rx="3" fill="#9AA8A1"/><rect x="162" y="74" width="50" height="6" rx="3" fill="#9AA8A1"/></g></svg></div>',
 # O caderno vira o app (modelo B, 04/10/2026, escolhido pelo dono): é a primeira frase
 # da página ("ainda roda em caderno e WhatsApp") em desenho. O padrão é o último quadro.
 'sobre':'<div class="cena c-cad" aria-hidden="true"><span class="caderno"><span class="espiral"></span><i></i><i></i><i></i><i></i><i></i></span><span class="seta"></span><span class="fone"><span class="tela"><span class="lin"><span></span><b></b><i style="animation-delay:2.1s"></i></span><span class="lin"><span></span><b></b><i style="animation-delay:2.4s"></i></span><span class="lin"><span></span><b></b><i style="animation-delay:2.7s"></i></span><span class="lin"><span></span><b></b><i style="animation-delay:3.0s"></i></span></span></span><span class="rotulo">do caderno para o app</span></div>',
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

# ⚠️ A PRIMEIRA FRASE RESPONDE SOZINHA (04/10/2026, aprovado pelo dono): o
# motorista lê a primeira frase e pula o resto. Cada resposta é (pergunta,
# resposta curta, o resto) — a curta vai em negrito e basta; o resto é para
# quem quis saber mais, e nunca passa de uma frase.
FAQ_MOT = [
 ('Vocês ficam com uma parte da minha mensalidade?','Não, nem um centavo.','O que o pai paga vai direto pra você: PIX, dinheiro ou maquininha.'),
 ('Quanto custa?','Por enquanto, é grátis.','Quando a cobrança começar, ela é por criança, com o app completo, e a gente avisa antes.'),
 ('E nas férias, quando as crianças param?','A conta acompanha as crianças ativas.','Perdeu crianças, a do mês seguinte cai junto. E quem escolhe quem sai é você.'),
 ('Como eu cobro quem atrasou?','O app mostra quem está em aberto.','E deixa o PIX pronto pra você mandar, sem caderno.'),
 ('Preciso saber mexer bem no celular?','Se você usa WhatsApp, você usa o app.','Ele foi feito pra usar em pé, na rua, com uma mão.'),
 ('Posso sair quando quiser?','Pode, pelo próprio app.','No mensal não tem multa. No anual, sair antes dos doze meses tem multa, escrita no contrato.'),
 ('Preciso ter CNPJ pra usar?','Não precisa.','Sem MEI, sem CNPJ e sem papelada pra começar.'),
 ('Os dados das crianças ficam onde?','No Google (Firebase), conforme a LGPD.','Endereço, foto e localização da criança só aparecem pra quem tem vínculo com ela.'),
]
FAQ_FAM = [
 ('Como eu crio minha conta?','Quem cria é o seu motorista.','Ele manda um link no WhatsApp, você abre e entra com o Google.'),
 ('Quem consegue ver onde meu filho está?','Só você e o motorista dele.','Endereço, foto e localização aparecem só pra quem tem vínculo com a criança.'),
 ('E se eu perder o link?','Peça outro pro seu motorista.','Ele manda de novo pelo app dele.'),
 ('Eu pago pelo app?','Não.','A mensalidade você paga direto pro motorista, como vocês já combinaram.'),
 ('Como eu aviso que hoje meu filho não vai?','Direto no app, com um toque.','O motorista vê antes de sair de casa.'),
 ('Preciso instalar alguma coisa?','Não precisa de loja.','Você abre o link e põe na tela de início do celular.'),
]
def faq(pub, itens, escondido):
    return '<div class="faq" data-pub="%s"%s>' % (pub, ' hidden' if escondido else '') + ''.join(
        '<details><summary>%s</summary><p class="resp"><b>%s</b> %s</p></details>' % (q, curta, resto) for q, curta, resto in itens) + '</div>'

# Peças novas do pouco texto (04/10/2026): ícone grande num quadrado.
def ic(caminho):
    return '<span class="icg" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + caminho + '</svg></span>'
IC_TURMA = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
IC_LINK = '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
IC_ROTA = '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>'
IC_PIX = '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'
IC_PIN = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
IC_FALTA = '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M14 14l-4 4M10 14l4 4"/>'
IC_DOC = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8"/>'
IC_MAO = '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>'
IC_GENTE = '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/>'
IC_ESCUDO = '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'

def telas(itens):
    """Os passos como telas que passam com o dedo (como-funciona)."""
    return ('<div class="telas" tabindex="0" aria-label="Os quatro passos, passe para o lado">' + ''.join(
        '<div class="tela-passo rv"><span class="n">%d</span>%s<b>%s</b><p>%s</p></div>' % (i + 1, ic(icone), titulo, linha)
        for i, (icone, titulo, linha) in enumerate(itens)) + '</div><p class="dica">Passe para o lado &#8594;</p>')

def dia(itens):
    """O dia do motorista numa linha do tempo (motorista)."""
    return '<ol class="dia">' + ''.join('<li class="rv"><span class="hora">%s</span><span>%s</span></li>' % (h, t) for h, t in itens) + '</ol>'

def icones(itens):
    """Três ícones grandes com uma frase cada (família, sobre)."""
    return '<div class="icones">' + ''.join('<div class="rv">%s<b>%s</b><p>%s</p></div>' % (ic(i), t, l) for i, t, l in itens) + '</div>'

RELATORIO = """<section class="rel" data-relatorio><span class="rel-chapeu">transparência</span><h2>Relatório de sustentabilidade</h2><p class="rel-linha">Um relatório por ano.</p><div class="rel-abas" role="tablist" aria-label="Ano do relatório"></div><div class="rel-painel"><p class="rel-breve">Em breve lançamos nosso relatório de sustentabilidade 2026.</p></div></section>"""

PAGINAS = {
 'como-funciona': dict(cena='como', titulo='Como funciona', desc='Como o Alô Buzinou funciona: o tio cadastra a turma, a família entra pelo link, a rota roda e a mensalidade se organiza sozinha.', corpo=
  # ⚠️ POUCO TEXTO (04/10/2026, aprovado pelo dono): cada passo é UMA tela
  # que passa com o dedo, com um título que se basta e uma linha.
  '<span class="chapeu">o seu ambiente digital de trabalho</span><h1>Como o app funciona?</h1>'
  + telas([
      (IC_TURMA, 'Você cadastra a turma.', 'Uma vez. A rota se monta na ordem dos horários.'),
      (IC_LINK, 'A família entra pelo link.', 'Você manda no WhatsApp, ela toca e entra.'),
      (IC_ROTA, 'A rota roda e todo mundo vê.', 'Quem subiu, quem chegou e o aviso de que a perua está chegando.'),
      (IC_PIX, 'A mensalidade se organiza.', 'Quem pagou, quem falta e o seu PIX à vista.'),
  ])
  + '<a class="btn" href="/motorista">Ver a parte do motorista</a><a class="btn esc" href="/familia">Ver a parte da família</a>'),
 'motorista': dict(cena='motorista', titulo='Pra quem dirige', desc='O seu ambiente digital de trabalho: rota pronta, aviso de chegada, mensalidade organizada e o PIX pronto pra mandar.', corpo=
  # ⚠️ POUCO TEXTO (04/10/2026): repetia a home. Virou "o seu dia com o app",
  # uma hora por linha — cada uma é algo que o app faz HOJE.
  '<span class="chapeu">pra quem dirige</span><h1>O seu dia com o app.</h1>'
  '<p class="sub">Você dirige. O app cuida do resto.</p>'
  + dia([
      ('6h02', 'A falta chega antes de você sair.'),
      ('6h40', 'Você inicia a rota, e as famílias são avisadas.'),
      ('7h10', 'Criança na escola, marcada com um toque.'),
      ('12h30', 'Na volta, a mãe sabe que a perua está chegando.'),
      ('Dia 10', 'Quem pagou e quem falta, com o PIX pronto.'),
  ])
  + '<div class="exemplo"><b>Recebido em agosto · <span class="conta" data-ate="2340">R$ 2.340,00</span></b><div class="barra"><i></i></div><p style="font-size:16px;margin-top:8px">6 de 9 famílias em dia</p><small>tela de exemplo</small></div>'
  '<h2>E se a mãe não souber usar?</h2><p>Se ela usa WhatsApp, ela usa o app: entra por um link.</p>'
  '<a class="btn" href="https://alobuzinou.com/quero-fazer-parte">Criar minha conta '+SETA+'</a>'),
 'familia': dict(cena='familia', titulo='Pra família', desc='Saber onde seu filho está: a hora da perua, o mapa, o aviso de chegada, a falta avisada e a mensalidade no celular.', corpo=
  # ⚠️ POUCO TEXTO (04/10/2026): o que ela ganha em três ícones grandes, e a
  # conta criada pelo motorista em dois passos desenhados. "Se o motorista
  # ligar": o mapa é escolha dele, e a página não promete o que ele desligou.
  '<span class="chapeu">pra quem confia</span><h1>Saber onde seu filho está.</h1>'
  '<p class="sub">Sem ficar na janela e sem ligar pro tio dirigindo.</p>'
  + icones([
      (IC_PIN, 'A perua está chegando', 'Aviso no celular e, se o tio ligar, o mapa.'),
      (IC_FALTA, 'Hoje ele não vai', 'Você avisa com um toque.'),
      (IC_DOC, 'Mensalidade e contrato', 'O PIX do tio e o contrato à vista.'),
  ])
  + '<h2>A agenda do seu filho.</h2><p>O recado do tio fica guardado, com data.</p>'
  '<h2>Sua conta é criada pelo motorista.</h2>'
  '<ol class="dois"><li class="rv">'+ic(IC_LINK)+'<span><b>1</b>O tio manda o link.</span></li><li class="rv">'+ic(IC_MAO)+'<span><b>2</b>Você toca e entra.</span></li></ol>'
  '<a class="btn esc" href="https://alobuzinou.com/first-access">Recebi um convite</a>'
  '<h2>O seu tio ainda não usa?</h2><p>Mande o app pra ele conhecer.</p>'
  '<a class="btn" data-zap href="'+html.escape(LINK_PEDIDO)+'" target="_blank" rel="noopener">'+ZAP+'<span class="txt">Mandar pro meu motorista no WhatsApp</span></a>'
  '<a class="peca" href="/brand/convite.jpg" download="alo-buzinou.jpg"><img src="/brand/convite.jpg" width="54" height="96" loading="lazy" decoding="async" alt="A imagem do convite, com o endereço do site escrito"><span><b>Baixar a imagem</b><small>Pra mandar no WhatsApp dele ou postar no Story — o endereço vai escrito nela.</small></span></a>'),
 'sobre': dict(cena='sobre', titulo='Sobre nós', desc='Quem é o Alô Buzinou: a missão de ligar quem dirige e quem confia, e os valores que guiam o app.', corpo=
  '<span class="chapeu">quem somos</span><h1>Quem é o Alô Buzinou</h1>'
  # ⚠️ POUCO TEXTO (04/10/2026): o tamanho já era bom; os valores viraram
  # três ícones grandes, com uma frase cada.
  '<p class="sub">O transporte escolar ainda roda em caderno e WhatsApp. A gente faz a ferramenta pra quem dirige.</p>'
  '<div class="cards rv"><div><b>Missão</b><p>Ligar quem dirige e quem confia, com a mesma informação dos dois lados.</p></div><div><b>Visão</b><p>Ser referência em confiança, não em tamanho.</p></div></div>'
  '<h2>Nossos valores</h2>'
  + icones([
      (IC_PIX, 'O dinheiro do motorista é do motorista', 'A mensalidade não passa pela gente.'),
      (IC_GENTE, 'A gente é comunidade', 'Tio indica tio. A gente cresce assim.'),
      (IC_ESCUDO, 'Do lado de quem dirige', 'Pra apoiar o motorista, não pra fiscalizar.'),
  ])
  + '<p style="font-size:15px;color:#55606E;margin-top:22px">Alô Buzinou · CNPJ 65.000.217/0001-47 · Rua das Trovas, 61, Socorro · São Paulo/SP</p>'),
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
 'investidores': dict(cena='investidores', titulo='Investidores', desc='O mercado do transporte escolar em São Paulo, como o Alô Buzinou ganha dinheiro e o contato para receber o material completo.', corpo=
  '<span class="chapeu">para quem investe</span><h1>O app do transporte escolar que é do motorista.</h1><p class="sub">Alô Buzinou · São Paulo/SP · CNPJ 65.000.217/0001-47</p>'
  # NÚMERO SÓ COM FONTE, conferida na página da fonte. Não invente número.
  '<h2>O mercado</h2><div class="cards rv">'
  '<div><b>Cerca de 140 mil crianças</b><p>no Transporte Escolar Gratuito (TEG) da Prefeitura de São Paulo (144 mil atendimentos em 2025).</p><p class="fonte"><a href="https://www.saopaulo.sp.leg.br/blog/reformulacao-do-transporte-escolar-gratuito-e-tema-de-audiencia-publica/" target="_blank" rel="noopener">Fonte: Câmara Municipal de São Paulo</a></p></div>'
  '<div><b>Cerca de 12,7 mil veículos</b><p>de transporte escolar cadastrados e regularizados no DTP da cidade de São Paulo.</p><p class="fonte"><a href="https://prefeitura.sp.gov.br/web/mobilidade/w/transporte-escolar-oferece-seguran%C3%A7a-a-pais-de-alunos-veja-o-que-checar-para-contratar-o-servi%C3%A7o" target="_blank" rel="noopener">Fonte: Prefeitura de São Paulo</a></p></div>'
  '<div><b>Cerca de 4 mil vans</b><p>no programa TEG [a confirmar].</p><p class="fonte"><a href="https://www.instagram.com/p/DPkANI_Edjf/" target="_blank" rel="noopener">Fonte: Prefeitura/SPTrans, em rede social</a></p></div></div>'
  '<p>Só na cidade de São Paulo, são milhares de motoristas autônomos — e quase toda operação ainda roda em caderno e WhatsApp.</p>'
  '<h2>Onde estamos</h2><p>Em teste com motoristas convidados desde outubro de 2026.</p>'
  '<h2>Como ganhamos dinheiro</h2><p>R$ 5,90 por criança por mês no plano mensal, R$ 2,90 no anual. Uma perua de 20 crianças rende R$ 118 por mês. A mensalidade da família vai direto ao motorista, pelo PIX: a plataforma não toca nesse dinheiro.</p>'
  '<h2>Por que ganhamos</h2><div class="cards rv">'
  '<div><b>O app é do motorista</b><p>A família vê o logo, a cor e o nome dele.</p></div>'
  '<div><b>Preço por criança, sem plano capado</b><p>O app inteiro em qualquer tamanho de perua.</p></div>'
  '<div><b>Família grátis, auxiliar com conta própria</b><p>Três usuários, só um paga.</p></div>'
  '<div><b>Cresce por indicação</b><p>Motorista indica motorista pelo próprio cartão.</p></div>'
  '<div><b>Feito para o celular de quem dirige</b><p>Abre no navegador, sem loja, letra grande.</p></div></div>'
  + RELATORIO +
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
  <!-- O RODAPÉ EM QUADRADOS (04/10/2026, modelo C escolhido pelo dono): cada
       página do site é um quadrado com ícone e "Ver", para quem rola até o fim
       entender que dá para tocar. "Entrar no app" é o botão verde largo, igual
       ao topo da página. O mesmo rodapé nas oito páginas. -->
  <p class="rodape-rotulo">Conheça mais</p>
  <nav class="quadros" aria-label="Mais sobre o Alô Buzinou">
    <a href="/como-funciona"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span><span><b>Como funciona</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
    <a href="/familia"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg></span><span><b>Pra família</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
    <a href="/sobre"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6"/></svg></span><span><b>Sobre nós</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
    <a href="/duvidas"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg></span><span><b>Dúvidas</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
    <a href="/contato"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.1-4.6A9 9 0 1 1 21 12z"/></svg></span><span><b>Contato</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
    <a href="/investidores"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg></span><span><b>Investidores</b><span class="ver">Ver <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span></span></a>
  </nav>
  <a class="rodape-app" href="https://alobuzinou.com/login">Entrar no app <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
  <div class="rodape-contato">
    <p>Rua das Trovas, 61 — Socorro · São Paulo/SP · CEP 04763-110</p>
    <p><a href="mailto:contato@alobuzinou.com">contato@alobuzinou.com</a> · <a href="https://wa.me/5511969170709" target="_blank" rel="noopener">(11) 96917-0709</a></p>
    <p class="leg">CNPJ 65.000.217/0001-47 · © 2026 Alô Buzinou · <a href="https://alobuzinou.com/termos">Termos de Uso</a> · <a href="https://alobuzinou.com/privacidade">Política de Privacidade</a></p>
  </div>
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
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/paginas.css">
<link rel="stylesheet" href="/relatorio.css">
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
<script src="/relatorio.js" defer></script>
</body>
</html>
'''

for slug, d in PAGINAS.items():
    with open(os.path.join(RAIZ, 'landing', slug + '.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(pagina(slug, d))
print('ok', len(PAGINAS))
