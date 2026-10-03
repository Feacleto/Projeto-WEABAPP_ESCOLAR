import { Fingerprint } from 'lucide-react';
import MolduraDoFinanceiro from './MolduraDoFinanceiro';
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
 */
export default function DigiteASenhaDoFinanceiro({ destino, onVoltar = null, voltarPara = null }) {
  const { user } = useAuth();
  const tranca = useTrancaDoFinanceiro();
  const comDigital = biometriaLigada(user?.uid);

  const aoCompletar = async (pares) => {
    const r = await conferirNoServidor(pares, { comDigital });
    if (r.ok) tranca.abrirCom(destino);
    return r;
  };

  const usarDigital = async () => {
    if (await conferirBiometria(user?.uid)) tranca.abrirCom(destino);
  };

  return (
    <MolduraDoFinanceiro voltarPara={voltarPara}>
      <TecladoDeBanco titulo="Digite sua senha" aoCompletar={aoCompletar}>
        {comDigital && (
          <button
            type="button"
            onClick={usarDigital}
            className="tap h-14 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 text-base font-bold text-text"
          >
            <Fingerprint size={22} className="text-primary" aria-hidden="true" />
            Usar a digital ou o rosto
          </button>
        )}
        <button
          type="button"
          onClick={tranca.pedirTrocaDeSenha}
          className="tap h-12 text-base font-bold text-primary underline"
        >
          Esqueci a senha
        </button>
        {onVoltar && (
          <button type="button" onClick={onVoltar} className="tap h-12 text-base font-bold text-textBody">
            Voltar
          </button>
        )}
      </TecladoDeBanco>
    </MolduraDoFinanceiro>
  );
}
