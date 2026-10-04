import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Fingerprint, Lock } from 'lucide-react';
import TecladoDeBanco from './TecladoDeBanco';
import { conferirNoServidor } from './conferirNoServidor';
import { useAuth } from '../../hooks/useAuth';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { biometriaLigada, conferirBiometria } from '../../services/biometriaService';

/**
 * "DIGITE SUA SENHA" — o teclado de banco a caminho de um destino.
 *
 * Serve à tela trancada (depois de tocar num cartão, ou de cancelar a
 * digital) e ao link direto para uma tela protegida (o aviso "sua fatura
 * vence", que abre `/tio/taxa`). No link direto a digital NÃO é pedida
 * sozinha: o navegador só abre o leitor depois de um toque da pessoa, então
 * ela ganha um botão próprio aqui.
 *
 * ⚠️ PORTA VERDE, FOLHA BRANCA (04/10/2026, versão C escolhida pelo dono no
 * artifact "Senha do Financeiro em três versões"). Esta tela não usa a
 * `MolduraDoFinanceiro`: o topo é a faixa verde das telas de entrada, e o
 * teclado mora numa folha branca com alça, descendo até o polegar. Antes o
 * teclado ficava no alto e metade da tela sobrava vazia embaixo, e nada
 * explicava o "4 ou 8" — daí a dica embaixo das bolinhas.
 */

export default function DigiteASenhaDoFinanceiro({ destino, onVoltar = null, voltarPara = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tranca = useTrancaDoFinanceiro();
  const comDigital = biometriaLigada(user?.uid);
  // Fora do layout do /tio (a fatura) não há a barra de baixo para desviar.
  const dentroDoLayout = !voltarPara;

  const aoCompletar = async (pares) => {
    const r = await conferirNoServidor(pares, { comDigital });
    if (r.ok) tranca.abrirCom(destino);
    return r;
  };

  const usarDigital = async () => {
    if (await conferirBiometria(user?.uid)) tranca.abrirCom(destino);
  };

  // Sempre há saída: o cartão que trouxe até aqui, a tela de onde a fatura
  // veio, ou o Início para quem chegou por link direto.
  const voltar = () => {
    if (onVoltar) onVoltar();
    else navigate(voltarPara || '/tio');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-primary">
      <header
        className="px-5 pb-9 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="max-w-lg mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={voltar}
              className="tap -ml-2 inline-flex min-h-12 items-center gap-1 px-2 text-base font-semibold text-menta"
            >
              <ChevronLeft size={22} aria-hidden="true" />
              Voltar
            </button>
            <span className="flex items-center gap-1.5 text-base font-semibold text-menta">
              <Lock size={18} aria-hidden="true" />
              Protegido
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-tight">Financeiro</h1>
          <p className="text-base text-menta">Mensalidades, extrato e boletim</p>
        </div>
      </header>

      <main
        className={`-mt-5 flex-1 flex flex-col rounded-t-[22px] bg-card px-5 pt-3 ${
          dentroDoLayout ? 'pb-28' : 'pb-6'
        }`}
      >
        <div className="max-w-lg w-full mx-auto flex-1 flex flex-col gap-4">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          {/* A DIGITAL VEM ANTES DO TECLADO (04/10/2026, item 15). Quando ela
            * existe neste aparelho, é o caminho mais curto — um toque contra
            * quatro — e ficava escondida embaixo das cinco teclas, onde quem
            * está cansado já começou a digitar. Por isso ela é o verde da tela. */}
          {comDigital && (
            <>
              <button
                type="button"
                onClick={usarDigital}
                className="tap h-14 rounded-xl bg-marca shadow-focus flex items-center justify-center gap-2 text-base font-bold text-naMarca"
              >
                <Fingerprint size={22} aria-hidden="true" />
                Usar a digital ou o rosto
              </button>
              <p className="flex items-center gap-3 text-base font-semibold text-textMuted">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                ou digite a senha
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </p>
            </>
          )}
          <TecladoDeBanco
            titulo={comDigital ? null : 'Digite sua senha'}
            dica="Toque no botão que tem o seu número"
            naFolha
            aoCompletar={aoCompletar}
          >
            <button
              type="button"
              onClick={tranca.pedirTrocaDeSenha}
              className="tap h-12 text-base font-bold text-primary underline"
            >
              Esqueci a senha
            </button>
          </TecladoDeBanco>
        </div>
      </main>
    </div>
  );
}
