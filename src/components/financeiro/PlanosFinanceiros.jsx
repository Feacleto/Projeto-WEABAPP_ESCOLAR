import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, ChevronRight, PiggyBank } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet, { SheetCTA } from '../common/Sheet';
import CampoDeValor from '../common/CampoDeValor';
import Input from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { useConfigDoFinanceiro } from '../../hooks/useDespesas';
import { criarPlano, anotarNoPlano, encerrarPlano } from '../../services/planosFinanceirosService';
import {
  contaDoPlano,
  planoValido,
  IDEIAS_DE_PLANO,
  PRAZOS,
  MAX_PLANOS,
} from '../../dominio/cobranca/planosFinanceiros.js';

/**
 * OS PLANOS FINANCEIROS, NA ABA CONTAS DA CENTRAL (05/10/2026, simulação "Rota
 * e Central" aprovada pelo dono).
 *
 * Cada plano é uma meta que ele anota (para quê, quanto, até quando), com a
 * barra do que ele DISSE ter separado e "separe R$ X por mês". O primeiro da
 * lista é a Reserva da perua (troca e manutenção), que já existia e tem a tela
 * dela; os outros ele cria aqui.
 *
 * ⚠️ O APP NÃO GUARDA DINHEIRO. "Anotar o que separei" SUBSTITUI o número —
 * é o que ele lê no app do banco. Nada de saldo, depósito, saque ou
 * rendimento nesta tela (`testar:perua` confere as palavras).
 *
 * `reais` vem da Central, já obedecendo ao olho de esconder.
 */
export default function PlanosFinanceiros({ reais }) {
  const navigate = useNavigate();
  const config = useConfigDoFinanceiro();
  const planos = (config?.planos || []).filter(planoValido);
  const [criando, setCriando] = useState(false);
  const [anotando, setAnotando] = useState(null);

  return (
    <section className="space-y-3">
      <h3 className="px-1 font-display text-lg font-bold text-text">Planos financeiros</h3>

      <button
        type="button"
        onClick={() => navigate('/tio/finance/reserva')}
        className="tap flex min-h-16 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left shadow-rest"
      >
        <PiggyBank size={22} className="shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">Reserva da perua</span>
          <span className="block text-sm text-textMuted">Troca e manutenção</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-textBody" aria-hidden="true" />
      </button>

      {planos.map((p) => {
        const c = contaDoPlano(p);
        return (
          <div key={p.id} className="space-y-2 rounded-2xl bg-card p-4 shadow-rest">
            <div className="flex items-center gap-3">
              <Target size={22} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-base font-bold text-text">{p.nome}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutro" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(c.fracao * 100)}%` }} />
            </div>
            <p className="text-base text-textBody">
              Você separou {reais(c.separado)} de {reais(c.meta)}
            </p>
            <p className="text-base font-bold text-accentText">
              {c.chegou ? 'Chegou na meta.' : `Separe ${reais(c.porMes)} por mês`}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAnotando(p)}
                className="tap min-h-12 rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
              >
                Anotar o que separei
              </button>
              <EncerrarPlano plano={p} planos={planos} />
            </div>
          </div>
        );
      })}

      {planos.length < MAX_PLANOS && (
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-base font-bold text-primary"
        >
          <Plus size={20} aria-hidden="true" />
          Criar plano financeiro
        </button>
      )}

      <p className="px-1 text-sm text-textMuted">
        O app não guarda dinheiro: ele anota o que você separou no banco e faz a conta do mês.
      </p>

      <Sheet open={criando} onClose={() => setCriando(false)} title="Novo plano financeiro">
        {criando && <CriarPlano planos={planos} reais={reais} onClose={() => setCriando(false)} />}
      </Sheet>
      <Sheet open={!!anotando} onClose={() => setAnotando(null)} title="Quanto você separou?" subtitle={anotando?.nome || ''}>
        {anotando && <AnotarNoPlano plano={anotando} planos={planos} onClose={() => setAnotando(null)} />}
      </Sheet>
    </section>
  );
}

function CriarPlano({ planos, reais, onClose }) {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [meta, setMeta] = useState('');
  const [meses, setMeses] = useState(6);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const porMes = Number(meta) > 0 ? Math.ceil((Number(meta) / meses) * 100) / 100 : null;

  async function salvar() {
    setSalvando(true);
    try {
      await criarPlano(user?.uid, planos, { nome, meta, meses });
      toast.success('Plano criado.');
      onClose();
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-base font-bold text-text">Para quê?</p>
        <div className="flex flex-wrap gap-2">
          {IDEIAS_DE_PLANO.map((ideia) => (
            <button
              key={ideia}
              type="button"
              aria-pressed={nome === ideia}
              onClick={() => { setNome(ideia); setErro(''); }}
              className={`tap min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                nome === ideia ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text'
              }`}
            >
              {ideia}
            </button>
          ))}
        </div>
        <Input
          label="Ou escreva"
          value={nome}
          onChange={(e) => { setNome(e.target.value); setErro(''); }}
          maxLength={40}
          falar="texto"
          semSalvar
        />
      </div>
      <CampoDeValor label="Quanto vai precisar?" value={meta} onChange={(v) => { setMeta(v); setErro(''); }} />
      <div className="space-y-2">
        <p className="text-base font-bold text-text">Até quando?</p>
        <div className="grid grid-cols-3 gap-2">
          {PRAZOS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={meses === m}
              onClick={() => setMeses(m)}
              className={`tap min-h-12 rounded-xl border-2 text-base font-semibold ${
                meses === m ? 'border-primary bg-primary text-white' : 'border-border bg-card text-text'
              }`}
            >
              {m === 12 ? '1 ano' : `${m} meses`}
            </button>
          ))}
        </div>
      </div>
      {porMes !== null && (
        <p className="rounded-xl bg-primarySoft p-3 text-base text-textBody">
          Separando <strong className="text-text">{reais(porMes)} por mês</strong>, você chega lá.
        </p>
      )}
      {erro && <p className="text-base font-semibold text-dangerText">{erro}</p>}
      <SheetCTA onClick={salvar} loading={salvando}>
        Criar plano
      </SheetCTA>
    </div>
  );
}

function AnotarNoPlano({ plano, planos, onClose }) {
  const { user } = useAuth();
  const [valor, setValor] = useState(Number(plano.separado) > 0 ? Number(plano.separado).toFixed(2) : '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (valor === '') {
      setErro('Digite o valor. Se ainda não separou nada, toque em "Ainda não separei nada".');
      return;
    }
    setSalvando(true);
    try {
      await anotarNoPlano(user?.uid, planos, plano.id, valor);
      toast.success('Anotação salva.');
      onClose();
    } catch (e) {
      setErro(e?.message || 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <CampoDeValor
        label="Quanto já separou para este plano"
        value={valor}
        onChange={(v) => { setErro(''); setValor(v); }}
        error={erro}
        hint="Olhe no app do seu banco e digite o mesmo valor."
        autoFocus
      />
      <button
        type="button"
        onClick={() => { setErro(''); setValor('0.00'); }}
        className="tap -mt-2 flex min-h-12 items-center px-1 text-base font-bold text-primary underline"
      >
        Ainda não separei nada
      </button>
      <SheetCTA onClick={salvar} loading={salvando}>
        Salvar anotação
      </SheetCTA>
    </div>
  );
}

/** "Encerrar" pergunta antes: o plano some da lista, e a anotação junto. */
function EncerrarPlano({ plano, planos }) {
  const { user } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="tap min-h-12 rounded-xl border-2 border-border bg-card text-base font-semibold text-textBody"
      >
        Encerrar plano
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await encerrarPlano(user?.uid, planos, plano.id);
          toast.success('Plano encerrado.');
        } catch {
          toast.error('Não deu para encerrar. Tente de novo.');
          setConfirmando(false);
        }
      }}
      className="tap min-h-12 rounded-xl border-2 border-dangerBorder bg-dangerSoft text-base font-bold text-dangerText"
    >
      Tocar de novo para encerrar
    </button>
  );
}
