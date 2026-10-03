/* AS PÁGINAS PRÓPRIAS — o comportamento comum (ver o cabeçalho de paginas.css).
   Tudo aqui é melhoria: sem este arquivo a página continua inteira e legível. */
(function () {
  'use strict';
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* VOLTAR volta de onde a pessoa veio — se ela veio do próprio site. Quem
     chegou por link direto (Google, WhatsApp) não tem tela anterior aqui, e
     o "voltar" do navegador a levaria para fora: aí ele leva para a home. */
  var voltar = document.querySelector('[data-voltar]');
  if (voltar) {
    voltar.addEventListener('click', function (e) {
      var deDentro = document.referrer && document.referrer.indexOf(location.origin) === 0;
      if (deDentro && history.length > 1) { e.preventDefault(); history.back(); }
    });
  }

  /* A barra fina de leitura, embaixo do topo. */
  var lido = document.querySelector('.leitura i');
  function lendo() {
    if (!lido) return;
    var max = document.documentElement.scrollHeight - innerHeight;
    lido.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + '%';
  }

  /* COMO FUNCIONA: a linha entre os passos enche e as bolinhas ficam verdes. */
  var passos = document.querySelector('.passos'), enche = document.querySelector('.passos .enche');
  function linha() {
    if (!passos || !enche) return;
    var alvo = innerHeight * 0.6, fim = 0;
    passos.querySelectorAll('h2').forEach(function (h) {
      var ok = h.getBoundingClientRect().top < alvo;
      h.classList.toggle('feito', ok);
      if (ok) fim = h.offsetTop;
    });
    enche.style.height = Math.max(0, fim - 30) + 'px';
  }
  addEventListener('scroll', function () { lendo(); linha(); }, { passive: true });
  lendo(); linha();

  /* O valor do exemplo conta de 0 até o total, uma vez. */
  function contar(el) {
    var ate = +el.dataset.ate, t0 = performance.now(), dur = 1100;
    var fmt = function (v) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    if (reduz) { el.textContent = fmt(ate); return; }
    (function passo(t) {
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(ate * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(passo);
    })(t0);
  }

  /* O que entra na tela: os ✓ estalam, a barra enche, o valor conta, os
     blocos sobem. Só esconde de antemão o que estava FORA da tela. */
  var anima = document.documentElement.classList.contains('anima');
  var alvos = document.querySelectorAll('.lista, .exemplo, .rv');
  if (anima && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.remove('fora');
        e.target.classList.add('viu');
        var c = e.target.querySelector('.conta');
        if (c) contar(c);
        io.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    alvos.forEach(function (el) {
      if (el.classList.contains('rv') && el.getBoundingClientRect().top > innerHeight) el.classList.add('fora');
      io.observe(el);
    });
  } else {
    alvos.forEach(function (el) { el.classList.add('viu'); var c = el.querySelector('.conta'); if (c) contar(c); });
  }

  /* DÚVIDAS: duas abas, a pílula desliza; só o público escolhido aparece. */
  var tabs = document.querySelector('.tabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pub]');
      if (!b) return;
      var pub = b.dataset.pub;
      tabs.classList.toggle('fam', pub === 'fam');
      tabs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('.faq').forEach(function (f) { f.hidden = f.dataset.pub !== pub; });
    });
  }

  /* Ondinha a partir do ponto tocado, nos botões grandes. */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.btn');
    if (!b || reduz) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), o = document.createElement('span');
    o.className = 'onda';
    o.style.width = o.style.height = d + 'px';
    o.style.left = (e.clientX - r.left - d / 2) + 'px';
    o.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(o);
    setTimeout(function () { o.remove(); }, 600);
  });

  /* O botão do WhatsApp confirma o que fez. */
  document.querySelectorAll('[data-zap]').forEach(function (a) {
    a.addEventListener('click', function () {
      a.classList.add('feito');
      var t = a.querySelector('.txt');
      if (t) t.textContent = 'Abrindo o WhatsApp…';
    });
  });

  /* INVESTIDORES: o contato vai para /api/interesse-investidor, que o
     hosting repassa para a function (ver firebase.json). O endereço é do
     próprio site de propósito: a CSP da landing só deixa falar com 'self'. */
  var lead = document.querySelector('form.lead');
  if (lead) {
    lead.addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = lead.nome.value.trim(), email = lead.email.value.trim();
      var erro = lead.querySelector('.erro');
      var ok = nome.length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      if (!ok) {
        erro.textContent = 'Escreva seu nome e um e-mail válido.';
        erro.hidden = false;
        lead.classList.remove('errou'); void lead.offsetWidth; lead.classList.add('errou');
        return;
      }
      var botao = lead.querySelector('button[type=submit]');
      botao.disabled = true;
      botao.querySelector('.txt').textContent = 'Enviando…';
      fetch('/api/interesse-investidor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome, email: email, whatsapp: lead.whatsapp.value.trim(), site: lead.site.value })
      }).then(function (r) {
        if (!r.ok) throw new Error('falhou');
        var primeiro = nome.split(/\s+/)[0];
        lead.innerHTML = '<div class="lead-ok"><div class="bola"><svg viewBox="0 0 24 24" fill="none" stroke="#0B1210" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div><h2></h2><p>A gente manda o material no seu e-mail.</p></div>';
        lead.querySelector('h2').textContent = 'Recebemos, ' + primeiro + '.';
      }).catch(function () {
        erro.textContent = 'Não deu pra enviar agora. Tente de novo, ou fale com a gente pelo WhatsApp.';
        erro.hidden = false;
        botao.disabled = false;
        botao.querySelector('.txt').textContent = 'Quero receber o material';
      });
    });
  }
})();
