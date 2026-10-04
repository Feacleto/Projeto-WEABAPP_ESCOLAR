import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Clock, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { useAtividadesDaPlatina } from '../../hooks/useAtividadesDaPlatina';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { recalcularMeuNivel } from '../../services/nivelService';
import { NIVEIS, calcularNivel, diaPausado } from '../../dominio/identidade/nivel.js';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Skeleton from '../../components/common/Skeleton';
import SeloDoNivel from '../../components/nivel/SeloDoNivel';
import {
  DESTINO_DA_ATIVIDADE,
  NOME_DO_NIVEL,
  chaveDoNivel,
  listaDeAtividades,
  posicaoDoNivel,
} from '../../components/nivel/rotuloDoNivel';

/**
 * "MEU NÍVEL" — /tio/nivel (docs/niveis.md, seção 7).
 *
 * ── DUAS FONTES, CADA UMA COM UM PAPEL
 * O SELO é o do servidor (`niveis/{uid}`, por `useNivel`): é o que as famílias
 * veem, e a tela não pode mostrar a ele um nível diferente do que elas veem.
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
 * ── SÓ O QUE O APP CONFERE
 * Não existe "Já fiz" aqui (regra 2). Feita é "o app confirmou"; a fazer é um
 * botão que leva para onde se faz.
 */
const POSICAO_DO_OURO = posicaoDoNivel('ouro');

const TITULO_DAS_MISSOES = {
  bronze: 'Missões do Bronze',
  prata: 'Missões da Prata',
  ouro: 'Missões do Ouro',
};

function hojeEmBrasilia() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function TioNivel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { nivel: nivelOficial, carregando: carregandoNivel } = useNivel(uid);
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
  const proximoNome = posicao > 0 && posicao < NIVEIS.length - 1 ? NOME_DO_NIVEL[NIVEIS[posicao + 1]] : null;
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
            <Card className="flex flex-col items-center gap-3 text-center">
              <p className="rotulo">seu nível</p>
              <SeloDoNivel nivel={nivel} tamanho="grande" />
              {proximoNome && (
                <p className="text-base text-textBody">
                  Próximo: <span className="font-bold text-text">{proximoNome}</span>
                </p>
              )}
              {nivel === 'diamante' && (
                <p className="text-base text-textBody">Você está no nível mais alto.</p>
              )}
            </Card>

            {missoes.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-lg font-bold text-text">
                  {TITULO_DAS_MISSOES[nivelDasMissoes]}
                </h2>
                <Card className="divide-y divide-neutro p-0">
                  {missoes.map((m) => (
                    <LinhaDaMissao key={m.id} missao={m} onIr={() => navigate(m.destino)} />
                  ))}
                </Card>
              </section>
            )}

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
