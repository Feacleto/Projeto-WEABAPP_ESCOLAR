import { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import Header from '../../components/layout/Header';
import { fotosDaComunidade } from '../../services/comunidadeService';
import { quandoSome } from '../../dominio/identidade/comunidade.js';

/**
 * AS FOTOS DA COMUNIDADE, DO LADO DA FAMÍLIA — /pai/comunidade (05/10/2026,
 * decisão do dono). Ela vê as fotos que os tios dela e os tios PARCEIROS
 * deles postaram para a comunidade. Ver as dos outros é o que motiva o "sim".
 *
 * Num lugar SEPARADO das fotos da turma (decisão do dono): as da turma são do
 * tio dela; aqui é a rede.
 *
 * ⚠️ O QUE ESTA TELA NÃO FAZ, e a Política promete:
 * - nada de curtir nem comentar;
 * - nada de baixar nem compartilhar pelo app (sem botão, e o toque longo do
 *   navegador fica desligado na imagem). Quem tira print, tira — é o limite
 *   de qualquer tela; o app não oferece o caminho.
 * - nenhum nome de criança: a callable devolve só a foto, a época, a legenda,
 *   a marca do tio e a validade.
 * Os links valem 15 minutos: a tela pede de novo a cada abertura.
 */
export default function PaiComunidade() {
  const [fotos, setFotos] = useState(null);
  const [erro, setErro] = useState(null);
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let vivo = true;
    fotosDaComunidade()
      .then((lista) => vivo && setFotos(lista))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const semMenu = (e) => e.preventDefault();

  return (
    <div className="min-h-screen bg-bg pb-16">
      <Header title="Fotos da comunidade" showBack backLabel="Início" backTo="/pai" />
      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        <p className="text-base leading-relaxed text-textMuted">
          As fotos que o seu tio e os tios parceiros dele postaram numa data especial. Cada uma some em 30 dias.
        </p>
        {erro ? (
          <p className="rounded-2xl bg-card p-4 text-base text-textMuted">{erro}</p>
        ) : !fotos ? (
          <p className="text-base text-textMuted">Carregando…</p>
        ) : !fotos.length ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <Users size={28} className="mx-auto text-primary" aria-hidden="true" />
            <p className="mt-2 text-base text-text">Nenhuma foto da comunidade agora.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {fotos.map((f) => (
              <li key={f.id} className="overflow-hidden rounded-2xl bg-card">
                <button type="button" onClick={() => setAberta(f)} className="block w-full text-left">
                  <img
                    src={f.url}
                    alt={`Foto de ${f.marca}: ${f.epoca}`}
                    className="h-56 w-full select-none object-cover"
                    loading="lazy"
                    draggable={false}
                    onContextMenu={semMenu}
                  />
                  <span className="flex items-center gap-3 p-3">
                    {f.logoURL ? (
                      <img src={f.logoURL} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-cover" draggable={false} />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primarySoft text-base font-bold text-primary">
                        {String(f.marca || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-text">{f.marca} · {f.epoca}</span>
                      {f.legenda && <span className="block text-base text-text">{f.legenda}</span>}
                      <span className="block text-base text-textMuted">{quandoSome(f.expiraEmMs || 0)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {aberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${aberta.marca}: ${aberta.epoca}`}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={() => setAberta(null)}
        >
          <button
            type="button"
            onClick={() => setAberta(null)}
            className="m-3 flex min-h-12 items-center gap-2 self-end rounded-xl bg-white px-4 text-base font-bold text-text"
          >
            <X size={20} aria-hidden="true" />
            Fechar
          </button>
          <img
            src={aberta.url}
            alt=""
            className="min-h-0 flex-1 select-none object-contain"
            draggable={false}
            onContextMenu={semMenu}
          />
          <p className="p-4 text-center text-base font-bold text-white">
            {aberta.marca} · {aberta.epoca}
            {aberta.legenda ? ` · ${aberta.legenda}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
