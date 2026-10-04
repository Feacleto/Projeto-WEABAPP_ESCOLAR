import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bus, Clock } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import ControleDeRota from '../../components/route/ControleDeRota';
import ListaDaViagem from '../../components/route/ListaDaViagem';
import ChildDetailSheet from '../../components/children/FichaDaCriancaSobDemanda';
import { useViagemDoDia } from '../../hooks/useViagemDoDia';
import { horaCurta, deMinutos } from '../../dominio/rota/horarios';
import { saidaDaViagem } from '../../dominio/rota/focoDaViagem.js';

/**
 * MINHA ROTA — a rota padrão, num lugar só (04/10/2026, decisão do dono).
 *
 * O Início ficou com o dia dele em quatro blocos e o link "Ver a rota". Aqui
 * moram o que saiu de lá: as viagens do dia (Ida e Volta, com a hora de
 * saída), quem vai em cada uma, na ordem, com a escola como marco, a chave do
 * mapa para as famílias e o "Iniciar a rota". Num domingo ou feriado, o
 * próprio `ControleDeRota` troca o botão por "Hoje é domingo · Rodar mesmo
 * assim".
 *
 * "Editar a rota" leva a "Horários da rota": a rota é a lista de paradas
 * ordenada pela hora (dominio/rota/horarios.js), então mudar o horário É
 * mudar a ordem.
 */
export default function MinhaRota() {
  const navigate = useNavigate();
  const {
    carregando,
    blocos,
    bloco,
    pendentesDaViagem,
    alvosDaRota,
    publicarOrdem,
    rotaAtiva,
    temViagem,
    children,
  } = useViagemDoDia();
  const [escolhido, setEscolhido] = useState(null);
  const [fichaDe, setFichaDe] = useState(null);

  // A viagem que aparece: a que ele tocou, ou a do momento, ou a primeira.
  const visto =
    blocos.find((b) => `${b.direcao}-${b.inicio}` === escolhido) || bloco || blocos[0] || null;

  const iniciarEAbrir = () => {
    publicarOrdem();
    navigate('/tio/route/now');
  };

  const nCriancas = new Set(blocos.flatMap((b) => b.paradas.map((p) => p.child.id))).size;
  const nEscolas = new Set(blocos.flatMap((b) => (b.escolas || []).map((e) => e.nome))).size;

  return (
    <>
      <Header title="Minha rota" showBack backLabel="Início" backTo="/tio" />

      <div className="space-y-4 px-5 pb-6 pt-4">
        {!carregando && blocos.length === 0 && (
          <div className="space-y-3 rounded-2xl bg-card p-5 text-center shadow-rest">
            <p className="text-base font-bold text-text">Rota ainda vazia</p>
            <Button onClick={() => navigate(children.length ? '/tio/horarios' : '/tio/children/new')}>
              {children.length ? 'Definir horários' : 'Cadastrar criança'}
            </Button>
          </div>
        )}

        {blocos.length > 0 && (
          <>
            {/* AS VIAGENS DO DIA, cada uma com a hora de saída. */}
            <div
              className="grid gap-1.5 rounded-2xl bg-neutro p-1"
              style={{ gridTemplateColumns: `repeat(${Math.min(blocos.length, 3)}, minmax(0, 1fr))` }}
              role="tablist"
              aria-label="Viagens do dia"
            >
              {blocos.map((b) => {
                const chave = `${b.direcao}-${b.inicio}`;
                const ativo = visto && `${visto.direcao}-${visto.inicio}` === chave;
                return (
                  <button
                    key={chave}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setEscolhido(chave)}
                    className={`tap min-h-12 rounded-xl px-2 py-1.5 text-center ${
                      ativo ? 'bg-card text-text shadow-rest' : 'text-textMuted'
                    }`}
                  >
                    <span className="block text-base font-bold">{b.direcao === 'ida' ? 'Ida' : 'Volta'}</span>
                    <span className="block text-sm font-semibold">sai {horaCurta(deMinutos(b.inicio))}</span>
                  </button>
                );
              })}
            </div>

            <p className="px-1 text-sm font-semibold text-textMuted">
              {nCriancas} {nCriancas === 1 ? 'criança' : 'crianças'}
              {nEscolas > 0 && ` · ${nEscolas} ${nEscolas === 1 ? 'escola' : 'escolas'}`}
            </p>

            <ListaDaViagem bloco={visto} onAbrirFicha={setFichaDe} />

            {/* A CHAVE DO MAPA mora aqui, no começo da rota (ControleDeRota). */}
            {!rotaAtiva && (
              <div className="rounded-2xl bg-primary p-4 text-white">
                <ControleDeRota
                  destaque
                  parte="chave"
                  direcao={bloco?.direcao}
                  alvos={alvosDaRota}
                  saida={saidaDaViagem(bloco)}
                  pendentes={pendentesDaViagem}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/tio/horarios')}
              className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
            >
              <Clock size={19} aria-hidden="true" />
              Editar a rota
            </button>
          </>
        )}
      </div>

      {/* O BOTÃO DA ROTA, no pé, onde o polegar descansa. */}
      {blocos.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-bg px-5 py-3">
          {rotaAtiva ? (
            <button
              type="button"
              onClick={() => navigate('/tio/route/now')}
              className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-marca px-3 text-lg font-extrabold text-naMarca shadow-focus"
            >
              <Bus size={24} aria-hidden="true" />
              Abrir a rota
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          ) : (
            <ControleDeRota
              parte="botao"
              secundario={!temViagem}
              onIniciar={iniciarEAbrir}
              direcao={bloco?.direcao}
              alvos={alvosDaRota}
              saida={saidaDaViagem(bloco)}
              pendentes={pendentesDaViagem}
            />
          )}
        </div>
      )}

      <ChildDetailSheet open={!!fichaDe} childId={fichaDe} onClose={() => setFichaDe(null)} />
    </>
  );
}
