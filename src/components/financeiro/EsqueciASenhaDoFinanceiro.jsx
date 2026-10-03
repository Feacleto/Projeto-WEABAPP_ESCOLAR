import { useState } from 'react';
import Button from '../common/Button';
import MolduraDoFinanceiro from './MolduraDoFinanceiro';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { metodoDeReautenticacao, reautenticarConta } from '../../services/authService';
import { mensagemDeAuth } from '../../dominio/identidade/authErrors.js';

/**
 * "ESQUECI A SENHA" E "TROCAR A SENHA" — provar que é o dono da CONTA
 * (03/10/2026).
 *
 * A senha de 4 números não tem e-mail de recuperação: quem a esqueceu entra
 * de novo na conta. Conta de e-mail digita a senha da conta ("Senha da
 * conta", como no protótipo); conta do Google abre a janela do Google. Depois
 * disso o servidor aceita a senha nova por 5 minutos (`auth_time`) — e
 * `reautenticarConta` já renova o token, senão ele levaria o login antigo.
 *
 * É a mesma tela para a troca dos ajustes: trocar com o Financeiro aberto
 * também exige provar a conta, senão quem achou o celular destravado
 * trocaria a senha e trancaria o dono do lado de fora.
 */
export default function EsqueciASenhaDoFinanceiro({ voltarPara = null }) {
  const tranca = useTrancaDoFinanceiro();
  const metodo = metodoDeReautenticacao();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const continuar = async (e) => {
    e?.preventDefault();
    if (metodo === 'senha' && !senha) {
      setErro('Digite a senha da sua conta.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await reautenticarConta(senha);
      tranca.irParaCriacao();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setErro('');
      } else {
        setErro(mensagemDeAuth(err, 'entrar'));
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <MolduraDoFinanceiro voltarPara={voltarPara}>
      <form onSubmit={continuar} className="flex flex-col gap-4">
        <section className="bg-card rounded-2xl shadow-rest px-5 py-6 flex flex-col gap-3">
          <h2 className="font-display text-[26px] font-extrabold text-text">Nova senha</h2>
          {metodo === 'senha' ? (
            <>
              <p className="text-[17px] text-textBody">Confirme com a senha da sua conta.</p>
              <input
                type="password"
                autoComplete="current-password"
                aria-label="Senha da conta"
                placeholder="Senha da conta"
                value={senha}
                onChange={(ev) => {
                  setSenha(ev.target.value);
                  setErro('');
                }}
                className="h-14 rounded-xl border-2 border-border px-4 text-lg text-text bg-card focus:outline-none focus:border-primary"
              />
            </>
          ) : (
            <p className="text-[17px] text-textBody">Confirme entrando de novo com a sua conta do Google.</p>
          )}
          {erro && (
            <p role="alert" className="px-3.5 py-2.5 rounded-xl bg-dangerSoft text-dangerText text-base font-semibold">
              {erro}
            </p>
          )}
        </section>
        <Button type="submit" loading={enviando} className="h-[60px] text-lg">
          Continuar
        </Button>
        <button type="button" onClick={tranca.cancelarFluxo} className="tap h-12 text-base font-bold text-textBody">
          Voltar
        </button>
      </form>
    </MolduraDoFinanceiro>
  );
}
