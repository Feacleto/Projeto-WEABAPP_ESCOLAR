import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Clock, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { useAtividadesDaPlatina } from '../../hooks/useAtividadesDaPlatina';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { recalcularMeuNivel } from '../../services/nivelService';
import {
  calcularNivel, diaPausado, proximaMissao, progressoDoNivel, ultimaFeita,
} from '../../dominio/identidade/nivel.js';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import SeloDoNivel from '../../components/nivel/SeloDoNivel';
import EstradaDosNiveis, { AnelDoNivel } from '../../components/nivel/EstradaDosNiveis';
import { METAL_DO_NIVEL } from '../../config/paletaCategorica';
import {
  DESTINO_DA_ATIVIDADE,
  ESTRADA_DO_MOTORISTA,
  NOME_DO_NIVEL,
  chaveDoNivel,
  fraseDoSonho,
  listaDeAtividades,
  oQueONivelPede,
  posicaoDoNivel,
  rotuloDoFeito,
} from '../../components/nivel/rotuloDoNivel';

/**
 * "MEU NÍVEL" — /tio/nivel (docs/niveis.md, seção 7).
 *
 * ── DUAS FONTES, CADA UMA COM UM PAPEL
 * O SELO é o do servidor (`niveis/{uid}`, por `useNivel`): é o do menu do perfil, e
 * a tela não pode mostrar a ele um nível diferente do que o cabeçalho mostra.
 * O CHECKLIST é a mesma régua rodando no aparelho, com os dados que ele já
 * lê — é o que responde "o que falta" na hora, sem esperar o servidor. O
 * nível gravado entra como `conquistado`, para o checklist respeitar o piso
 * (Bronze, Prata e Ouro não se perdem).
 *
 * ── AO ABRIR, PEDE O RECÁLCULO, UMA VEZ
 * `recalcularMeuNivel` atualiza o selo oficial com o que ele acabou de fazer.
 * Falhar (sem sinal, sem Blaze) não trava nada: a tela segue com o selo que
 * já estava gravado.
 *
 * ── O DESENHO É O MODELO D2 (04/10/2026, aprovado pelo dono)
 * No topo, o anel com a porcentagem do nível (a parte vazia na cor do
 * PRÓXIMO metal), o selo de metal e a estrada — tocar num nível mostra o selo
 * dele. Depois o que ele fez por último e a próxima missão. Embaixo, a
 * estrada inteira: o nível atual aberto no meio do caminho com as abas "Para
 * fazer" e "Feitas", que filtram só aquela lista — a estrada não some.
 *
 * ── SÓ O QUE O APP CONFERE
 * Não existe "Já fiz" aqui (regra 2). Feita é "o app confirmou"; a fazer é um
 * botão que leva para onde se faz.
 */
const POSICAO_DO_OURO = posicaoDoNivel('ouro');

function hojeEmBrasilia() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function TioNivel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { nivel: nivelOficial, dados: dadosDoNivel, carregando: carregandoNivel } = useNivel(uid);
  const [vendo, setVendo] = useState(null);
  const [aba, setAba] = useState('fazer');
  const atividades = listaDeAtividades(useAtividadesDaPlatina());
  const { fatos, carregando: carregandoFatos } = useFatosDoNivel();

  const pediu = useRef(false);
  useEffect(() => {
    if (!uid || pediu.current) return;
    pediu.current = true;
    Promise.resolve()
      .then(() => recalcularMeuNivel())
      .catch((err) => console.warn('[nivel] recálculo falhou; segue o selo gravado.', err));
  }, [uid]);

  const oficial = chaveDoNivel(nivelOficial);

  const regua = useMemo(() => {
    if (!fatos) return null;
    return calcularNivel(fatos, {
      atividades,
      conquistado: oficial === 'sem_nivel' ? null : oficial,
    });
  }, [fatos, atividades, oficial]);

  const carregando = carregandoNivel || carregandoFatos || !regua;

  // O selo é o oficial; enquanto o servidor ainda não gravou nada (primeira
  // rota acabou de terminar), a régua do aparelho segura a tela.
  const nivel = oficial !== 'sem_nivel' ? oficial : chaveDoNivel(regua?.nivel);
  const posicao = posicaoDoNivel(nivel);
  // Platina e Diamante continuam cuidando das missões do Ouro.
  const nivelDasMissoes = posicao >= POSICAO_DO_OURO ? 'ouro' : nivel;
  const missoes = regua ? regua.missoes.filter((m) => m.nivel === nivelDasMissoes) : [];
  // O próximo degrau sai do selo OFICIAL, não da régua: os dois podem
  // discordar por minutos, e "Bronze · Próximo: Ouro" seria a tela mentindo.
  const iAtual = ESTRADA_DO_MOTORISTA.indexOf(nivel);
  const proximoNivel = iAtual >= 0 ? ESTRADA_DO_MOTORISTA[iAtual + 1] || null : null;
  const olhando = vendo || nivel;
  const progresso = regua ? progressoDoNivel(regua.missoes, nivel) : { feitas: 0, total: 0 };
  const proxima = regua ? proximaMissao(regua.missoes, nivel) : null;
  const destinoDaProxima = proxima ? regua.missoes.find((m) => m.id === proxima.id)?.destino : null;
  const ultima = regua ? ultimaFeita(regua.missoes, dadosDoNivel?.feitasEm, nivel) : null;
  const faltamAte = (alvo) => {
    if (!regua) return null;
    const iAlvo = ESTRADA_DO_MOTORISTA.indexOf(alvo);
    // Só do nível em que ele está até o alvo: o que ficou por fazer de um
    // nível já conquistado não segura ninguém (o nível tem piso).
    return regua.missoes.filter((m) => {
      const i = ESTRADA_DO_MOTORISTA.indexOf(m.nivel);
      return !m.pre && !m.feita && i >= iAtual && i < iAlvo;
    }).length;
  };
  const listaDaAba = missoes.filter((m) => (aba === 'feitas' ? m.feita : !m.feita));
  const atividadesAvaliadas = regua?.platina?.atividades || [];
  const ferias = diaPausado(hojeEmBrasilia());

  return (
    <div className="min-h-screen bg-bg pb-16">
      <Header title="Meu nível" showBack backLabel="Início" backTo="/tio" />

      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        {carregando ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </>
        ) : nivel === 'sem_nivel' ? (
          <Card className="space-y-2 text-center">
            <p className="font-display text-xl font-bold text-text">Seu nível começa na primeira rota</p>
            <p className="text-base leading-relaxed text-textBody">
              Quando você encerrar a primeira rota, ganha o Bronze e aparece
              aqui o que fazer para subir.
            </p>
          </Card>
        ) : (
          <>
            <Card className="space-y-4">
              <div className="flex items-center gap-4">
                <AnelDoNivel
                  feitas={progresso.feitas}
                  total={progresso.total}
                  atual={nivelDasMissoes}
                  proximo={proximoNivel}
                />
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <SeloDoNivel nivel={olhando} />
                  <p className="text-sm leading-snug text-textMuted">
                    {olhando === nivel
                      ? proximoNivel
                        ? `Próximo: ${NOME_DO_NIVEL[proximoNivel]}`
                        : 'Você está no nível mais alto.'
                      : fraseDoSonho({ vendo: olhando, atual: nivel, estrada: ESTRADA_DO_MOTORISTA, faltam: faltamAte(olhando) })}
                  </p>
                </div>
              </div>
              <EstradaDosNiveis
                estrada={ESTRADA_DO_MOTORISTA}
                atual={nivel}
                vendo={olhando}
                onVer={(c) => setVendo(c)}
              />
            </Card>

            {ultima && (
              <div className="flex items-center gap-3 rounded-2xl bg-accent/15 px-4 py-3">
                <CheckCircle2 size={22} className="shrink-0 text-accentText" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm text-accentText">{rotuloDoFeito(ultima.em)}</p>
                  <p className="text-base font-bold leading-snug text-text">{ultima.titulo}</p>
                </div>
              </div>
            )}
            {proxima && (
              <button
                type="button"
                onClick={() => navigate(destinoDaProxima || '/tio')}
                className="tap flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left"
              >
                <Circle size={22} className="shrink-0 text-textMuted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-textMuted">Próxima</p>
                  <p className="text-base font-bold leading-snug text-text">{proxima.titulo}</p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
              </button>
            )}

            {/* A ESTRADA INTEIRA. O nível atual fica ABERTO no meio do
              * caminho, com as abas — o filtro mexe só na lista dele. */}
            <section className="space-y-1 pt-2">
              <h2 className="rotulo px-1 pb-2">Sua estrada</h2>
              <ol>
                {ESTRADA_DO_MOTORISTA.map((chave, i) => {
                  const passou = i < iAtual;
                  const aberto = chave === nivelDasMissoes;
                  const ultimo = i === ESTRADA_DO_MOTORISTA.length - 1;
                  const brilho = METAL_DO_NIVEL[chave]?.brilho;
                  return (
                    <li key={chave} className="relative flex gap-3 pb-4">
                      {!ultimo && (
                        <span
                          aria-hidden
                          className={`absolute bottom-0 left-[14px] top-[30px] w-[3px] ${passou ? 'bg-primary' : 'bg-border'}`}
                        />
                      )}
                      <span
                        aria-hidden
                        className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[3px] ${
                          passou || chave === nivel ? 'border-primary bg-primary text-white' : 'border-border bg-card'
                        }`}
                        style={chave === nivel ? { boxShadow: `0 0 0 3px #fff, 0 0 0 6px ${brilho}, 0 0 18px 6px ${brilho}` } : undefined}
                      >
                        {passou && <CheckCircle2 size={18} />}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-lg font-bold leading-tight text-text">
                          {NOME_DO_NIVEL[chave]}
                          {chave === nivel && (
                            <span className="ml-1.5 text-sm font-normal text-textMuted">
                              · você está aqui{aberto ? ` · ${progresso.feitas} de ${progresso.total}` : ''}
                            </span>
                          )}
                        </p>
                        {passou && !aberto && <p className="text-sm text-textMuted">Conquistado</p>}
                        {!passou && chave !== nivel && !aberto && (
                          <p className="text-sm text-textMuted">{oQueONivelPede(chave, regua?.missoes)}</p>
                        )}
                        {/* A ÚNICA PONTE COM A TRILHA: o Diamante leva a
                          * "Meu negócio", que mora no Financeiro (atrás da
                          * senha). Os passos da trilha não aparecem aqui. */}
                        {chave === 'diamante' && (
                          <CartaoDaTrilha
                            trilha={regua?.trilha}
                            completo={iAtual >= ESTRADA_DO_MOTORISTA.indexOf('platina')}
                            onAbrir={() => navigate('/tio/finance/negocio')}
                          />
                        )}
                        {aberto && missoes.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {chave !== nivel && (
                              <p className="text-sm text-textMuted">As missões do Ouro continuam valendo.</p>
                            )}
                            <div className="flex rounded-xl bg-neutro p-1" role="tablist">
                              {[
                                ['fazer', `Para fazer (${missoes.filter((m) => !m.feita).length})`],
                                ['feitas', `Feitas (${missoes.filter((m) => m.feita).length})`],
                              ].map(([id, rotulo]) => (
                                <button
                                  key={id}
                                  type="button"
                                  role="tab"
                                  aria-selected={aba === id}
                                  onClick={() => setAba(id)}
                                  className={`tap h-11 flex-1 rounded-lg text-base font-bold ${
                                    aba === id ? 'bg-card text-text shadow-rest' : 'text-textMuted'
                                  }`}
                                >
                                  {rotulo}
                                </button>
                              ))}
                            </div>
                            {listaDaAba.length === 0 ? (
                              <p className="px-1 py-2 text-base text-textMuted">
                                {aba === 'fazer' ? 'Nenhuma por fazer neste nível.' : 'Nenhuma feita ainda.'}
                              </p>
                            ) : (
                              <Card className="divide-y divide-neutro p-0">
                                {listaDaAba.map((m) => (
                                  <LinhaDaMissao key={m.id} missao={m} onIr={() => navigate(m.destino)} />
                                ))}
                              </Card>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {posicao >= POSICAO_DO_OURO && (
              <section className="space-y-2">
                <h2 className="px-1 text-lg font-bold text-text">Atividade da Platina</h2>
                {atividadesAvaliadas.length === 0 ? (
                  <Card>
                    <p className="text-base leading-relaxed text-textBody">
                      Nenhuma atividade agora. Quando sair uma nova, ela aparece
                      aqui com o prazo.
                    </p>
                  </Card>
                ) : (
                  <Card className="divide-y divide-neutro p-0">
                    {atividadesAvaliadas.map((a) => {
                      const doc = atividades.find((x) => x.id === a.id);
                      return (
                        <LinhaDaAtividade
                          key={a.id}
                          atividade={a}
                          ferias={ferias}
                          onIr={() => navigate(DESTINO_DA_ATIVIDADE[doc?.verificacao] || '/tio')}
                        />
                      );
                    })}
                  </Card>
                )}

                <div className="flex gap-3 rounded-2xl bg-surface p-4">
                  <Info size={20} className="mt-0.5 shrink-0 text-textMuted" aria-hidden />
                  <div className="space-y-2 text-base leading-relaxed text-textBody">
                    <p>
                      Platina e Diamante dependem de estar em dia: faça cada
                      atividade nova dentro do prazo de 30 dias. Se o prazo
                      passar, o selo volta para o Ouro — e sobe de novo quando
                      você ficar em dia.
                    </p>
                    <p>
                      O Diamante é a Platina com a trilha de Meu negócio
                      completa, no Financeiro.
                    </p>
                    <p className="text-sm text-textMuted">
                      O prazo para nas férias: julho, e de 15 de dezembro a 31
                      de janeiro.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LinhaDaMissao({ missao, onIr }) {
  if (missao.feita) {
    return (
      <div className="flex min-h-16 items-center gap-3 px-4 py-3">
        <CheckCircle2 size={22} className="shrink-0 text-accentText" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text">{missao.titulo}</p>
          <p className="text-sm text-textMuted">
            {missao.pre ? 'Já feito no começo' : 'O app confirmou'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <button type="button" onClick={onIr} className="tap flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
      <Circle size={22} className="shrink-0 text-borderStrong" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-text">{missao.titulo}</p>
        <p className="text-sm font-semibold text-primary">Toque para fazer</p>
      </div>
      <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
    </button>
  );
}

function LinhaDaAtividade({ atividade, ferias, onIr }) {
  if (atividade.feita) {
    return (
      <div className="flex min-h-16 items-center gap-3 px-4 py-3">
        <CheckCircle2 size={22} className="shrink-0 text-accentText" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text">{atividade.titulo}</p>
          <p className="text-sm text-textMuted">O app confirmou</p>
        </div>
      </div>
    );
  }

  const prazo = atividade.vencida
    ? 'O prazo passou'
    : ferias
      ? `Prazo parado nas férias · faltam ${atividade.diasRestantes} dias`
      : atividade.diasRestantes === 0
        ? 'O prazo termina hoje'
        : atividade.diasRestantes === 1
          ? 'Falta 1 dia'
          : `Faltam ${atividade.diasRestantes} dias`;

  return (
    <button type="button" onClick={onIr} className="tap flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
      <Clock
        size={22}
        className={`shrink-0 ${atividade.vencida ? 'text-dangerText' : 'text-textMuted'}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-text">{atividade.titulo}</p>
        <p className={`text-sm font-semibold ${atividade.vencida ? 'text-dangerText' : 'text-textMuted'}`}>
          {prazo}
        </p>
      </div>
      <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
    </button>
  );
}

/**
 * A PONTE COM A TRILHA, na parada Diamante (modelo D, 04/10/2026). Antes da
 * Platina é só o link: a trilha ainda não conta, e um placar ali puxaria o
 * olho para longe das missões de agora. A partir da Platina vira o cartão —
 * quantos passos, em que fase ele está e o botão. Os passos não aparecem
 * aqui: eles moram em "Meu negócio".
 */
function CartaoDaTrilha({ trilha, completo, onAbrir }) {
  if (!completo || !trilha) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="tap mt-1 inline-flex min-h-12 items-center gap-1 text-base font-bold text-accentText"
      >
        Ver a trilha do Diamante
        <ChevronRight size={18} aria-hidden />
      </button>
    );
  }
  const fases = trilha.fases.filter((f) => f.contaParaDiamante);
  const itens = fases.flatMap((f) => f.itens);
  const feitos = itens.filter((i) => i.feito).length;
  const agora = fases.find((f) => !f.completa);
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-3">
      <p className="flex items-center justify-between text-base font-bold text-text">
        Trilha do negócio
        <span className="text-sm font-normal text-textMuted">{feitos} de {itens.length}</span>
      </p>
      <span className="block h-2 w-full overflow-hidden rounded-full bg-neutro" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${itens.length ? (feitos / itens.length) * 100 : 0}%` }} />
      </span>
      <p className="text-sm text-textMuted">
        {agora ? `Você está na fase ${agora.numero}: ${agora.titulo}` : 'Trilha completa'}
      </p>
      <button
        type="button"
        onClick={onAbrir}
        className="tap flex h-12 w-full items-center justify-center gap-1 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
      >
        Ver a trilha
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
