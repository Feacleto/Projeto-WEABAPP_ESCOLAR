import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Home, Bus, School, CheckCircle2, RefreshCw } from 'lucide-react';
import Logo from '../components/common/Logo';
import Spinner from '../components/common/Spinner';
import { verAcompanhamento } from '../services/acompanhamentoService';

/**
 * "Acompanhar" — /acompanhar/:token
 *
 * A tela de quem vai pegar a criança hoje no lugar do responsável: a avó, a
 * vizinha, o pai que não é o titular da conta. Ela não tem conta, não vai ter,
 * e o link morre à meia-noite.
 *
 * ── O QUE ELA RESPONDE, E SÓ ISSO
 * "Já saiu?", "já embarcou?", "falta muito?". Três perguntas, e a tela é a
 * resposta das três sem pedir nada em troca.
 *
 * ── ⚠️ O QUE ELA NÃO MOSTRA, E POR QUÊ
 * Nada de endereço, telefone, mensalidade ou MAPA AO VIVO. A posição da perua
 * é o veículo de um autônomo, na rua dele, agora — e ele não decidiu
 * compartilhar isso com terceiros. A posição na fila responde "falta muito?"
 * sem entregar onde alguém está. Quem monta o recorte é o servidor
 * (`reguaDoAcompanhamento`), e há teste batendo campo a campo.
 *
 * ── ⚠️ ELA NÃO TEM RODAPÉ, MENU NEM LOGIN
 * É uma janela, não uma porta. Oferecer "entrar no app" aqui convidaria um
 * terceiro a virar usuário de um produto que não é dele — e a marca aparece
 * só para ela saber de onde veio a mensagem.
 *
 * ── A ATUALIZAÇÃO É SOB DEMANDA, COM UM RELÓGIO LENTO ATRÁS
 * Um minuto, e só com a aba à vista. É endpoint público: cada consulta é uma
 * invocação que ninguém autenticou, e a espera dela dura meia hora. Quando a
 * criança é entregue o relógio para sozinho — não há mais o que mudar.
 */
export default function Acompanhar() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const jaMontou = useRef(false);

  const buscar = useCallback(
    async (silencioso) => {
      if (silencioso) setAtualizando(true);
      try {
        const d = await verAcompanhamento(token);
        setDados(d);
        setErro(null);
      } catch (e) {
        // Só derruba a tela se ainda não houver nada: uma falha de rede no
        // meio da espera não pode apagar a informação que ela já está lendo.
        if (!jaMontou.current) setErro(e.message);
      } finally {
        jaMontou.current = true;
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [token]
  );

  /* A PRIMEIRA BUSCA MORA NO EFEITO, e não numa chamada a `buscar`.
   *
   * Não é estilo: chamar dali uma função que faz `setState` é o que o lint
   * recusa, e com razão — o `alive` precisa existir para uma resposta que
   * chega depois de a pessoa ter fechado a aba não tentar pintar uma tela
   * desmontada. É o mesmo desenho do `Invite.jsx`. */
  useEffect(() => {
    let vivo = true;
    verAcompanhamento(token)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setErro(null);
      })
      .catch((e) => {
        if (vivo) setErro(e.message);
      })
      .finally(() => {
        if (!vivo) return;
        jaMontou.current = true;
        setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  useEffect(() => {
    if (!dados || dados.estado === 'entregue') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') buscar(true);
    }, 60000);
    return () => clearInterval(t);
  }, [dados, buscar]);

  if (carregando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Spinner size={30} className="text-primary" />
        <p className="text-sm text-textMuted">Abrindo o acompanhamento...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        <Logo height={30} />
        <p className="text-sm text-textMuted max-w-xs leading-relaxed">{erro}</p>
      </div>
    );
  }

  const passos = [
    { chave: 'esperando', rotulo: 'Esperando na porta', Icone: Home, hora: null },
    { chave: 'na_perua', rotulo: 'Na perua', Icone: Bus, hora: dados.marcos.naPerua },
    { chave: 'na_escola', rotulo: 'Chegou na escola', Icone: School, hora: dados.marcos.naEscola },
    { chave: 'entregue', rotulo: 'Entregue', Icone: CheckCircle2, hora: dados.marcos.entregue },
  ];
  const atual = passos.findIndex((p) => p.chave === dados.estado);

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-gradient-to-br from-primary via-primary to-primaryDark text-white px-6 pt-8 pb-7">
        <Logo height={24} tone="onDark" />
        <h1 className="text-2xl font-extrabold leading-tight mt-4">
          {dados.crianca || 'A criança'} hoje
        </h1>
        {dados.motorista && (
          <p className="text-white/85 mt-1 text-sm">
            Transporte de {dados.motorista}
          </p>
        )}
      </header>

      <main className="px-5 py-6 space-y-4">
        {/* A LINHA DO DIA. Cada marco com a hora em que aconteceu — a hora é o
          * que ela usa pra decidir quando sair de casa, e é por isso que ela
          * fica em negrito e o rótulo não. */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          {passos.map((p, i) => {
            const feito = i <= atual;
            return (
              <div key={p.chave} className="flex items-center gap-3 py-2">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    feito ? 'bg-primaryChip text-primary' : 'bg-sunken text-textMuted'
                  }`}
                >
                  <p.Icone size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      i === atual ? 'font-bold text-text' : 'font-medium text-textMuted'
                    }`}
                  >
                    {p.rotulo}
                  </span>
                </span>
                {p.hora && (
                  <span className="text-sm font-bold text-text tabular-nums">
                    {p.hora}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* "FALTA MUITO?" — a fila responde sem dizer onde a perua está. */}
        {dados.estado !== 'entregue' && dados.paradasNaVolta && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm text-text leading-relaxed">
              Na volta, {dados.crianca || 'a criança'} é a{' '}
              <strong>{dados.paradasNaVolta}ª parada</strong>
              {dados.combinado.volta && (
                <>
                  {' '}— por volta das <strong>{dados.combinado.volta}</strong>
                </>
              )}
              .
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => buscar(true)}
            disabled={atualizando}
            className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-60"
          >
            <RefreshCw size={13} className={atualizando ? 'animate-spin' : ''} />
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* Ela precisa saber que isto acaba, senão volta amanhã e acha que
          * quebrou. E precisa saber a quem pedir — não a nós. */}
        <p className="text-[11px] text-textMuted text-center leading-relaxed max-w-xs mx-auto pt-2">
          Este link vale só hoje. Amanhã, peça um novo a quem te mandou.
        </p>
      </main>
    </div>
  );
}
