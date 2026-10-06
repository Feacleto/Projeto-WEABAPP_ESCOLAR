import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Smile, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import Spinner from '../common/Spinner';
import {
  listarAvaliacoesDoApp,
  watchConfigDaAvaliacao,
} from '../../services/avaliacaoDoAppService';
import {
  FILTROS_DE_COMENTARIO,
  PERIODOS,
  filtrarComentarios,
  perguntaLigada,
  resumirAvaliacao,
} from '../../dominio/suporte/resumoDaAvaliacao.js';

/**
 * A AVALIAÇÃO DO APP, DO LADO DO DONO (substitui a aba "Pesquisa").
 *
 * ── A PERGUNTA É SOBRE O APP, NUNCA SOBRE O MOTORISTA
 * O cartão de cinco rostos aparece depois de algo dar certo. A nota que a
 * família dá ao tio (`avaliacoesDoTio`) NÃO passa por aqui — o rodapé diz isso
 * para ninguém procurar.
 *
 * ── ONDE O NÚMERO NÃO EXISTE, A TELA ESCREVE "—", NUNCA 0,0
 * A régua devolve `null` e a tela só traduz.
 *
 * ── DE FAMÍLIA NUNCA APARECE O NOME
 * A régua já não entrega o nome; a tela mostra papel e momento.
 *
 * "Desde o começo" é desde o começo do que foi CARREGADO (as 500 mais novas):
 * a tela diz isso, em vez de fingir que leu a coleção inteira.
 */

const media = (v) => (v === null || v === undefined ? '—' : v.toFixed(1).replace('.', ','));

function Ficha({ rotulo, valor, detalhe }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xl font-extrabold tabular-nums tracking-tight text-text">{valor}</p>
      <p className="mt-0.5 text-xs leading-tight text-textMuted">{rotulo}</p>
      {detalhe && <p className="mt-0.5 text-xs text-textMuted">{detalhe}</p>}
    </div>
  );
}

function Secao({ icone: Icone, titulo, children }) {
  return (
    <section>
      <h2 className="mb-2 inline-flex items-center gap-1.5 px-1 font-mono text-xs uppercase tracking-[0.18em] text-textMuted">
        <Icone size={12} />
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Pilulas({ opcoes, valor, onChange, rotuloDoGrupo }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={rotuloDoGrupo}>
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={ativo}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${
              ativo
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-card text-text'
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

function Estrelas({ nota }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= nota ? 'fill-ouro text-ouro' : 'text-borderStrong'}
        />
      ))}
    </span>
  );
}

export default function AvaliacaoTab() {
  const [feedbacks, setFeedbacks] = useState(null); // null = carregando, false = falhou
  const [config, setConfig] = useState(null);
  const [periodo, setPeriodo] = useState('90');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    let vivo = true;
    listarAvaliacoesDoApp()
      .then((l) => vivo && setFeedbacks(l))
      .catch((err) => {
        console.error('[avaliacao] leitura falhou:', err);
        if (vivo) setFeedbacks(false);
      });
    const parar = watchConfigDaAvaliacao((c) => vivo && setConfig(c));
    return () => {
      vivo = false;
      parar?.();
    };
  }, []);

  const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? null;

  const resumo = useMemo(
    () => (Array.isArray(feedbacks) ? resumirAvaliacao(feedbacks, { dias, agora: new Date() }) : null),
    [feedbacks, dias]
  );

  const comentarios = useMemo(
    () => (resumo ? filtrarComentarios(resumo.comentarios, filtro) : []),
    [resumo, filtro]
  );

  const ligada = perguntaLigada(config);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-text">Avaliação do app</h1>
        <p className="mt-1 text-sm leading-relaxed text-textMuted">
          O cartão de cinco rostos aparece depois de algo dar certo. A pergunta é sobre o app,
          nunca sobre o motorista.
        </p>
        <p
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            ligada ? 'bg-primaryChip text-primary' : 'bg-warningChip text-warningText'
          }`}
        >
          {ligada ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {ligada ? 'Pergunta ligada' : 'Pergunta desligada'}
        </p>
      </header>

      {feedbacks === null && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-textMuted">
          <Spinner size={18} />
          carregando
        </div>
      )}

      {feedbacks === false && (
        <div className="rounded-2xl border border-dangerBorder bg-dangerChip p-4">
          <p className="text-sm font-bold text-text">Não deu para ler as avaliações</p>
          <p className="mt-1 text-xs leading-relaxed text-dangerText">
            Só a conta de dono lê esta coleção. Confira o papel da sua conta e tente de novo.
          </p>
        </div>
      )}

      {resumo && (
        <>
          <div>
            <Pilulas
              opcoes={PERIODOS}
              valor={periodo}
              onChange={setPeriodo}
              rotuloDoGrupo="Período"
            />
            <p className="mt-2 px-1 text-xs text-textMuted">
              Sobre as {feedbacks.length} avaliações mais recentes carregadas.
            </p>
          </div>

          {resumo.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-borderStrong p-6 text-center">
              <Smile size={22} className="mx-auto mb-2 text-textMuted" />
              <p className="text-sm font-bold text-text">Nenhuma avaliação neste período</p>
              <p className="mx-auto mt-1 max-w-[20rem] text-xs leading-relaxed text-textMuted">
                Quando alguém tocar num rosto, a resposta aparece aqui.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Ficha rotulo="Média geral" valor={media(resumo.media)} detalhe={`${resumo.total} respostas`} />
                <Ficha rotulo="Motoristas" valor={media(resumo.motoristas.media)} detalhe={`${resumo.motoristas.n} respostas`} />
                <Ficha rotulo="Famílias" valor={media(resumo.familias.media)} detalhe={`${resumo.familias.n} respostas`} />
                <Ficha rotulo="Quem busca, pelo link" valor={media(resumo.link.media)} detalhe={`${resumo.link.n} respostas`} />
                <Ficha rotulo="Notas 1 e 2" valor={resumo.notasBaixas} />
              </div>

              <Secao icone={Star} titulo="Como responderam">
                <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4">
                  {resumo.distribuicao.map((d) => (
                    <div key={d.nota} className="flex items-center gap-2">
                      <span className="inline-flex w-8 shrink-0 items-center gap-0.5 text-xs font-bold text-textMuted">
                        {d.nota}
                        <Star size={11} className="fill-ouro text-ouro" />
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutro">
                        <span
                          className={`block h-full rounded-full ${d.nota <= 2 ? 'bg-danger' : 'bg-primary'}`}
                          style={{ width: `${d.pct ?? 0}%` }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-textMuted">
                        {d.pct}% · {d.n}
                      </span>
                    </div>
                  ))}
                </div>
              </Secao>

              <Secao icone={Smile} titulo="Por momento">
                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full min-w-[20rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-textMuted">
                        <th className="px-4 py-2 font-semibold">Momento</th>
                        <th className="px-4 py-2 text-right font-semibold">Respostas</th>
                        <th className="px-4 py-2 text-right font-semibold">Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.porMomento.map((m) => (
                        <tr key={m.momento} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 text-text">{m.rotulo}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-textMuted">{m.n}</td>
                          <td className="px-4 py-2 text-right font-bold tabular-nums text-text">{media(m.media)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Secao>

              <Secao icone={MessageSquare} titulo="O que escreveram">
                <Pilulas
                  opcoes={FILTROS_DE_COMENTARIO}
                  valor={filtro}
                  onChange={setFiltro}
                  rotuloDoGrupo="Filtro dos comentários"
                />
                <div className="mt-3 space-y-2">
                  {comentarios.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-borderStrong p-4 text-center text-xs text-textMuted">
                      Nenhum comentário neste filtro.
                    </p>
                  )}
                  {comentarios.map((c) => (
                    <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Estrelas nota={c.nota} />
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                            c.nota <= 2 ? 'bg-dangerChip text-dangerText' : 'bg-primaryChip text-primary'
                          }`}
                        >
                          {c.rotuloDoGrupo}
                        </span>
                        <span className="text-xs text-textMuted">{c.rotuloDoMomento}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-text">“{c.texto}”</p>
                      <p className="mt-1.5 text-xs text-textMuted">
                        {[c.nome, c.em ? new Date(c.em).toLocaleDateString('pt-BR') : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </article>
                  ))}
                </div>
              </Secao>
            </>
          )}
        </>
      )}

      <p className="px-1 text-xs leading-relaxed text-textMuted">
        A pergunta é sobre o app. A nota que a família dá ao tio não aparece aqui.
      </p>
    </div>
  );
}
