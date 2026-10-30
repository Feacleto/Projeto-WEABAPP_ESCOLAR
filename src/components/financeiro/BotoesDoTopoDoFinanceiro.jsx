import { useState } from 'react';
import { Lock, SlidersHorizontal } from 'lucide-react';
import AjustesDoFinanceiro from './AjustesDoFinanceiro';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';

/**
 * OS DOIS BOTÕES DO TOPO DO CAIXA ABERTO (03/10/2026) — para o `action` do
 * `Header` das telas do Financeiro:
 *
 *   <Header title="Financeiro" action={<BotoesDoTopoDoFinanceiro />} />
 *
 * O cadeado TRANCA na hora (para quando ele vai passar o celular a alguém);
 * os controles abrem os ajustes. A folha mora aqui dentro, então quem usa
 * não precisa de estado nenhum.
 *
 * "Trancar" vai ESCRITO ao lado do cadeado: só o ícone, ele era lido como
 * "está trancado" (estado) e não como "trancar agora" (ação) — e é o botão
 * que ele precisa achar de relance antes de passar o celular à auxiliar.
 * Os ajustes ficam só no ícone, com nome para leitor de tela: o cabeçalho
 * não comporta duas palavras ao lado do título, e ajuste é visita rara.
 */
export default function BotoesDoTopoDoFinanceiro() {
  const { trancar, temSenha, iniciarCriacao } = useTrancaDoFinanceiro();
  const [ajustes, setAjustes] = useState(false);
  const classe =
    'tap h-12 min-w-12 rounded-xl bg-surface flex items-center justify-center gap-1.5 text-text';

  return (
    <>
      <span className="flex gap-2">
        {/* ⚠️ A SENHA É ESCOLHA DO MOTORISTA (30/10/2026). Sem senha, "Trancar"
          * não tranca nada — o mesmo lugar vira "Pôr senha", a um toque, que é
          * o "ligar fácil" que o dono pediu. Desligar mora nos ajustes, porque
          * pede a senha atual. */}
        {temSenha === false ? (
          <button
            type="button"
            aria-label="Pôr senha no Financeiro"
            onClick={iniciarCriacao}
            className={`${classe} px-3 text-base font-bold`}
          >
            <Lock size={20} aria-hidden="true" />
            Pôr senha
          </button>
        ) : (
          <button
            type="button"
            aria-label="Trancar o Financeiro"
            onClick={trancar}
            className={`${classe} px-3 text-base font-bold`}
          >
            <Lock size={20} aria-hidden="true" />
            Trancar
          </button>
        )}
        <button
          type="button"
          aria-label="Ajustes do Financeiro"
          onClick={() => setAjustes(true)}
          className={classe}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
        </button>
      </span>
      <AjustesDoFinanceiro open={ajustes} onClose={() => setAjustes(false)} />
    </>
  );
}
