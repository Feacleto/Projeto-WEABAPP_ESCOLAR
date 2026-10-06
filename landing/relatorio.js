/* O RELATÓRIO DE SUSTENTABILIDADE. Um ano novo entra acrescentando UMA linha
   aqui: { ano: 2027, pdf: '/relatorios/2027.pdf' }. As abas saem desta lista.
   `pdf: null` = ainda não lançado: aparece o quadro "Em breve", sem baixar.
   O PDF é do próprio site (pasta landing/relatorios/), por isso a CSP o abre. */
(function () {
  'use strict';
  var RELATORIOS = [{ ano: 2026, pdf: null }];
  var raiz = document.querySelector('[data-relatorio]');
  if (!raiz) return;
  var abas = raiz.querySelector('.rel-abas'), painel = raiz.querySelector('.rel-painel');
  function mostrar(r) {
    painel.innerHTML = '';
    if (r.pdf) {
      var f = document.createElement('iframe');
      f.src = r.pdf; f.title = 'Relatório de sustentabilidade ' + r.ano; f.className = 'rel-visor';
      var a = document.createElement('a');
      a.href = r.pdf; a.className = 'rel-baixar'; a.setAttribute('download', ''); a.textContent = 'Baixar PDF';
      painel.appendChild(f); painel.appendChild(a);
    } else {
      var p = document.createElement('p');
      p.className = 'rel-breve';
      p.textContent = 'Em breve lançamos nosso relatório de sustentabilidade ' + r.ano + '.';
      painel.appendChild(p);
    }
  }
  RELATORIOS.forEach(function (r, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = String(r.ano);
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () {
      abas.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      mostrar(r);
    });
    abas.appendChild(b);
  });
  mostrar(RELATORIOS[0]);
})();
