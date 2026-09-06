import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { COMPANY_INFO } from './legalContent';

/**
 * Layout compartilhado pra documentos legais (Termos de Uso e Política de
 * Privacidade). Renderiza header navegável, botão de salvar como PDF (via
 * print do navegador) e o corpo do texto a partir de seções estruturadas.
 *
 * Estilo print-friendly: o @media print no index.css esconde header/footer
 * e fundo, deixando o texto pronto pra "Salvar como PDF" ou imprimir.
 *
 * POR QUE ELE SAI DO TETO DE 480px
 * O `#root` tem largura de bolso porque o app é usado na rua, com uma mão. Um
 * documento legal não é isso: ele é lido inteiro, muitas vezes num monitor,
 * às vezes por alguém que precisa conferir uma cláusula antes de assinar. No
 * teto de celular o `max-w-3xl` abaixo nunca valia nada — o texto ficava numa
 * tira de 480px no meio da tela, e o botão de imprimir saía do mesmo jeito.
 *
 * `data-painel="web"` é o mesmo mecanismo do painel do dono e da tela de
 * login: a regra `:has()` do index.css solta o teto enquanto esta tela estiver
 * montada. Diferente do login, aqui NÃO entra o `w-screen` com translate — a
 * garantia dele custaria um `transform` no ancestral, e o cabeçalho desta tela
 * é `sticky`. Navegador sem `:has()` cai no teto de 480px: é o que já
 * acontecia hoje, então o pior caso não é regressão.
 *
 * No celular nada muda: 480px de teto ou não, a tela tem a largura que tem.
 */
export default function LegalDocument({
  title,
  version,
  date,
  sections,
  headerExtra,
}) {
  return (
    <div data-painel="web" className="min-h-screen bg-bg">
      {/* Topo (não-printável) */}
      <header className="sticky top-0 z-10 border-b border-neutro bg-card print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm text-textMuted tap"
          >
            <ArrowLeft size={18} /> Voltar
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary tap px-3 py-1.5 rounded-lg bg-primary/10"
          >
            <Printer size={16} /> Salvar como PDF
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10 print:py-0 print:px-0">
        <div className="space-y-2 mb-6 print:mb-4">
          <h1 className="text-2xl font-bold text-text sm:text-3xl print:text-3xl">
            {title}
          </h1>
          <p className="text-xs text-textMuted">
            Versão {version} · Última atualização: {date}
          </p>
          {headerExtra}
        </div>

        <div className="space-y-6 leading-relaxed sm:space-y-8">
          {sections.map((sec) => (
            <section key={sec.id} className="space-y-2">
              <h2 className="text-base font-bold text-text sm:text-lg">
                {sec.title}
              </h2>
              {sec.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="whitespace-pre-line text-sm leading-relaxed text-text sm:text-[15px]"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-10 pt-6 border-t border-border text-xs text-textMuted print:mt-12">
          <p>Documento gerado a partir do aplicativo {COMPANY_INFO.name}.</p>
          <p>Versão {version} — {date}.</p>
        </footer>
      </article>
    </div>
  );
}
