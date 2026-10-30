import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { OPCOES_DE_PEDIR_SENHA } from '../../dominio/identidade/trancaDoFinanceiro.js';
import TecladoDeBanco from './TecladoDeBanco';
import { conferirNoServidor } from './conferirNoServidor';
import { removerSenhaDoFinanceiro } from '../../services/senhaDoFinanceiroService';
import {
  biometriaDisponivel,
  biometriaLigada,
  desligarBiometria,
  ligarBiometria,
} from '../../services/biometriaService';

/**
 * OS AJUSTES DO FINANCEIRO (03/10/2026) — a folha do botão de controles no
 * topo do caixa.
 *
 *   Pedir a senha     sempre / depois de 5 / depois de 30 minutos fora —
 *                     escolha DESTE APARELHO (preferenciaDoFinanceiroService)
 *   Digital ou rosto  só aparece se o aparelho tiver; liga e desliga aqui
 *   Trocar a senha    o mesmo caminho do "Esqueci a senha": provar a conta
 *                     primeiro, depois criar a nova
 */
export default function AjustesDoFinanceiro({ open, onClose }) {
  const { user, profile } = useAuth();
  const tranca = useTrancaDoFinanceiro();
  const [temDigital, setTemDigital] = useState(false);
  const [digitalLigada, setDigitalLigada] = useState(() => biometriaLigada(user?.uid));
  const [mexendo, setMexendo] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let vivo = true;
    biometriaDisponivel().then((sim) => {
      if (!vivo) return;
      setTemDigital(sim);
      setDigitalLigada(biometriaLigada(user?.uid));
    });
    return () => {
      vivo = false;
    };
  }, [open, user?.uid]);

  const alternarDigital = async () => {
    if (digitalLigada) {
      desligarBiometria(user?.uid);
      setDigitalLigada(false);
      return;
    }
    setMexendo(true);
    const ligou = await ligarBiometria(user?.uid, profile?.name || user?.email);
    setMexendo(false);
    setDigitalLigada(ligou);
    if (!ligou) toast('Não deu para ligar agora.');
  };

  const trocarSenha = () => {
    onClose?.();
    tranca.pedirTrocaDeSenha();
  };

  const porSenha = () => {
    onClose?.();
    tranca.iniciarCriacao();
  };

  // Desligar pede a senha ATUAL, no mesmo teclado de banco e com a mesma
  // contagem de tentativas do servidor (`removerSenhaDoFinanceiro`).
  const [desligando, setDesligando] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setDesligando(false);
  }, [open]);
  const confirmarDesligar = async (pares) => {
    const r = await conferirNoServidor(pares, { chamar: removerSenhaDoFinanceiro });
    if (r.ok) {
      // Sem senha a digital não tem o que abrir.
      desligarBiometria(user?.uid);
      setDigitalLigada(false);
      setDesligando(false);
      onClose?.();
      toast.success('Senha desligada. A Carteira abre direto.');
    }
    return r;
  };

  // ⚠️ SEM SENHA (30/10/2026, a senha é escolha do motorista): não há o que
  // pedir nem trocar. Uma frase neutra sobre o que muda — a auxiliar é
  // parceira, e a decisão é dele — e o caminho para pôr a senha.
  if (tranca.temSenha === false) {
    return (
      <Sheet open={open} onClose={onClose} title="Ajustes do Financeiro" icon={SlidersHorizontal}>
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-[22px] font-extrabold text-text">Senha</h3>
          <p className="text-[17px] leading-snug text-textBody">
            Sem senha, a Carteira abre direto e quem usar o seu celular vê os valores.
          </p>
          <Button size="md" onClick={porSenha} className="text-[17px]">
            Pôr senha
          </Button>
          <Button variant="secondary" size="md" onClick={onClose} className="border-2 text-base">
            Pronto
          </Button>
        </div>
      </Sheet>
    );
  }

  if (desligando) {
    return (
      <Sheet open={open} onClose={onClose} title="Desligar a senha" icon={SlidersHorizontal}>
        <div className="flex flex-col gap-3">
          <TecladoDeBanco
            naFolha
            titulo="Digite a senha atual"
            dica="Depois disso a Carteira abre sem senha"
            aoCompletar={confirmarDesligar}
          >
            <button
              type="button"
              onClick={() => setDesligando(false)}
              className="tap h-12 text-base font-bold text-textBody"
            >
              Voltar
            </button>
          </TecladoDeBanco>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ajustes do Financeiro" icon={SlidersHorizontal}>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-[22px] font-extrabold text-text">Pedir a senha</h3>
        <div role="radiogroup" aria-label="Pedir a senha" className="flex flex-col gap-2">
          {OPCOES_DE_PEDIR_SENHA.map((o) => {
            const marcada = tranca.preferencia === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => tranca.definirPreferencia(o.valor)}
                className={`tap flex items-center gap-3 min-h-[52px] px-3.5 rounded-xl border-2 text-left text-base font-semibold text-text ${
                  marcada ? 'bg-primarySoft border-primary' : 'bg-card border-border'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 shrink-0 rounded-full ${
                    marcada ? 'border-[6px] border-primary' : 'border-2 border-textMuted'
                  }`}
                />
                {o.rotulo}
              </button>
            );
          })}
        </div>

        {temDigital && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutro">
            <span className="text-[17px] font-semibold text-text">Digital ou rosto</span>
            <button
              type="button"
              role="switch"
              aria-checked={digitalLigada}
              aria-label="Digital ou rosto"
              disabled={mexendo}
              onClick={alternarDigital}
              className={`relative w-14 h-8 shrink-0 rounded-full p-[3px] flex transition-colors duration-estado before:absolute before:-inset-2 before:content-[''] ${
                digitalLigada ? 'bg-primary justify-end' : 'bg-border justify-start'
              }`}
            >
              <span className="w-[26px] h-[26px] rounded-full bg-card" />
            </button>
          </div>
        )}

        <Button variant="secondary" size="md" onClick={trocarSenha} className="border-2 text-base">
          Trocar a senha
        </Button>
        <Button variant="secondary" size="md" onClick={() => setDesligando(true)} className="border-2 text-base">
          Desligar a senha
        </Button>
        <Button size="md" onClick={onClose} className="text-[17px]">
          Pronto
        </Button>
      </div>
    </Sheet>
  );
}
