import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

/**
 * Layout compartilhado pra documentos legais (Termos de Uso e Política de
 * Privacidade). Renderiza header navegável, botão de salvar como PDF (via
 * print do navegador) e o corpo do texto a partir de seções estruturadas.
 *
 * Estilo print-friendly: o @media print no index.css esconde header/footer
 * e fundo, deixando o texto pronto pra "Salvar como PDF" ou imprimir.
 */
export default function LegalDocument({
  title,
  version,
  date,
  sections,
  headerExtra,
}) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Topo (não-printável) */}
      <header className="sticky top-0 z-10 bg-card border-b border-neutro h-14 px-4 flex items-center justify-between gap-3 print:hidden">
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
      </header>

      <article className="max-w-3xl mx-auto px-4 py-6 print:py-0 print:px-0">
        <div className="space-y-2 mb-6 print:mb-4">
          <h1 className="text-2xl font-bold text-text print:text-3xl">
            {title}
          </h1>
          <p className="text-xs text-textMuted">
            Versão {version} · Última atualização: {date}
          </p>
          {headerExtra}
        </div>

        <div className="space-y-6 leading-relaxed">
          {sections.map((sec) => (
            <section key={sec.id} className="space-y-2">
              <h2 className="text-base font-bold text-text">{sec.title}</h2>
              {sec.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-sm text-text leading-relaxed whitespace-pre-line"
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-10 pt-6 border-t border-border text-xs text-textMuted print:mt-12">
          <p>Documento gerado a partir do aplicativo Tio Nino Digital.</p>
          <p>Versão {version} — {date}.</p>
        </footer>
      </article>
    </div>
  );
}
