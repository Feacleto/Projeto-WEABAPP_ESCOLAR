import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
import { useEscolas } from '../../hooks/useEscolas';
import { addChild } from '../../services/childrenService';
import { useDeclaracaoDaSessao } from '../../hooks/useDeclaracaoDaSessao';
import DeclaracaoDeAutorizacao, { DeclaracaoJaFeita } from './DeclaracaoDeAutorizacao';
import CampoDeValor from '../common/CampoDeValor';
import { formatCurrency } from '../../compartilhado/formatters';
import { valorDoCampoFalta } from '../../dominio/cobranca/valorDaMensalidade.js';
import { ROTULOS } from '../../marca/textosDaLista.js';

/**
 * O CADASTRO RÁPIDO DA CRIANÇA — dentro do primeiro acesso (04/10/2026,
 * pedido do dono).
 *
 * Só o que o motorista sabe DE CABEÇA: o nome, se é menino ou menina, a
 * escola e o período. O resto (endereço com número, WhatsApp do responsável,
 * horário exato, mensalidade) ele não sabe na hora — e exigir faria ele parar
 * na primeira criança. Fica para a ficha, e o Início cobra o que falta pelo
 * "Para resolver" (sem horário, convite aberto) e pelo Financeiro (sem
 * mensalidade).
 *
 * ⚠️ O NOME E A MENSALIDADE são obrigatórios. A mensalidade entrou em
 * 14/11/2026 (decisão do dono, "valor zero não"): sem ela a mensalidade do
 * mês não nasce e o contrato sairia de R$ 0,00. O valor aparece em letra
 * grande antes de salvar — o campo é de caixa eletrônico, e "350" vira
 * R$ 3,50.
 */
const PERIODOS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
];

export default function CadastroRapidoDaCrianca({ onSalva }) {
  const { escolas } = useEscolas();
  const [form, setForm] = useState({ name: '', gender: '', schoolId: '', school: '', period: '', parentName: '', monthlyFee: '' });
  const [erro, setErro] = useState('');
  const [erroValor, setErroValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  // A declaração de autorização: uma pergunta por sessão, um registro por criança.
  const declaracao = useDeclaracaoDaSessao();
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const escolherEscola = (e) =>
    setForm((p) =>
      p.schoolId === e.id
        ? { ...p, schoolId: '', school: '' }
        : { ...p, schoolId: e.id, school: e.nome || '' }
    );

  const salvar = async (ev) => {
    ev.preventDefault();
    if (!form.name.trim()) {
      setErro('Escreva o nome da criança.');
      return;
    }
    if (valorDoCampoFalta(form.monthlyFee)) {
      setErroValor(ROTULOS.erroSemValor);
      return;
    }
    if (!declaracao.confirmar()) return;
    setErro('');
    setSalvando(true);
    try {
      const escola = escolas.find((e) => e.id === form.schoolId) || null;
      const { id } = await addChild({
        name: form.name,
        // Só chega aqui com a declaração feita (marcada agora ou nesta sessão);
        // o `addChild` recusa criança sem ela. O que vai é o que a caixa diz.
        autorizacaoDeclarada: declaracao.jaDeclarou || declaracao.marcada,
        gender: form.gender || null,
        parentName: form.parentName,
        monthlyFee: Number(form.monthlyFee),
        ...(escola
          ? {
              schoolId: escola.id,
              school: escola.nome || '',
              schoolAddress: escola.endereco || '',
              schoolLat: escola.lat ?? '',
              schoolLng: escola.lng ?? '',
              schoolPhone: escola.telefone || '',
            }
          : { school: form.school }),
        ...(form.period ? { period: form.period, pickupPeriod: form.period, dropoffPeriod: form.period } : {}),
      });
      declaracao.lembrar();
      onSalva({ id, nome: form.name.trim().split(/\s+/)[0] });
    } catch (err) {
      console.error('[cadastro rápido] não salvou:', err);
      toast.error('Não deu pra salvar. Tente de novo.');
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-3">
      <Input
        falar="nome"
        label="Nome da criança"
        value={form.name}
        onChange={set('name')}
        error={erro}
        required
      />
      <div>
        <p className="mb-2 text-base font-semibold text-text">É</p>
        <Opcoes
          rotulo="Menino ou menina"
          opcoes={[
            { value: 'male', label: 'Menino' },
            { value: 'female', label: 'Menina' },
          ]}
          valor={form.gender}
          onEscolher={(v) => setForm((p) => ({ ...p, gender: v }))}
        />
      </div>
      <div>
        <p className="mb-2 text-base font-semibold text-text">Escola</p>
        {escolas.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {escolas.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => escolherEscola(e)}
                className={`tap min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${
                  form.schoolId === e.id ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
                }`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        )}
        {!form.schoolId && (
          <Input
            falar="nome"
            label={escolas.length > 0 ? 'Outra escola' : 'Nome da escola'}
            value={form.school}
            onChange={set('school')}
          />
        )}
      </div>
      <div>
        <p className="mb-2 text-base font-semibold text-text">Período</p>
        <Opcoes
          rotulo="Período"
          opcoes={PERIODOS}
          valor={form.period}
          onEscolher={(v) => setForm((p) => ({ ...p, period: v }))}
        />
      </div>
      <Input falar="nome" label="Nome do responsável" value={form.parentName} onChange={set('parentName')} />
      <div className="space-y-1">
        <CampoDeValor
          label={ROTULOS.mensalidade}
          value={form.monthlyFee}
          onChange={(v) => {
            setErroValor('');
            setForm((p) => ({ ...p, monthlyFee: v }));
          }}
          error={erroValor}
        />
        {!valorDoCampoFalta(form.monthlyFee) && (
          <p className="text-lg font-bold text-text">{formatCurrency(Number(form.monthlyFee))}</p>
        )}
      </div>
      {declaracao.jaDeclarou ? (
        <DeclaracaoJaFeita />
      ) : (
        <DeclaracaoDeAutorizacao
          marcada={declaracao.marcada}
          onChange={declaracao.marcar}
          erro={declaracao.erro}
        />
      )}
      <p className="text-sm text-textMuted">Endereço e WhatsApp você completa depois, na ficha.</p>
      <Button type="submit" loading={salvando} className="shadow-focus">
        Salvar criança
      </Button>
    </form>
  );
}

/** Duas escolhas lado a lado; tocar de novo desmarca (os dois campos são opcionais). */
function Opcoes({ opcoes, valor, onEscolher, rotulo }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={rotulo} data-campo-escolha tabIndex={-1}>
      {opcoes.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={valor === o.value}
          onClick={() => onEscolher(valor === o.value ? '' : o.value)}
          className={`tap min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
            valor === o.value ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
