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
 */
export default function BotoesDoTopoDoFinanceiro() {
  const { trancar } = useTrancaDoFinanceiro();
  const [ajustes, setAjustes] = useState(false);
  const classe =
    'tap w-11 h-11 rounded-xl bg-surface flex items-center justify-center text-text';

  return (
    <>
      <span className="flex gap-1.5">
        <button type="button" aria-label="Trancar o Financeiro" onClick={trancar} className={classe}>
          <Lock size={20} aria-hidden="true" />
        </button>
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
