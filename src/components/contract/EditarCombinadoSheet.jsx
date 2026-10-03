import { useState } from 'react';
import { DollarSign, Calendar, FileSignature, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import CampoVigencia from './CampoVigencia';
import { useAuth } from '../../hooks/useAuth';
import { salvarCombinado } from '../../services/contratosDaFamiliaService';
import {
  vigenciaDaCrianca,
  erroDaVigencia,
  estadoDoContrato,
} from '../../dominio/cobranca/contratoDaFamilia.js';

/**
 * MUDAR O COMBINADO — mensalidade, vencimento e prazo do contrato
 * (02/10/2026). Não existia: o valor só era escrito no cadastro, e a família
 * que renegociava obrigava o motorista a apagar a criança e refazer.
 *
 * ⚠️ DEPOIS DO ACEITE, SALVAR NÃO MUDA O VALOR NA HORA. Vira um ADITIVO que a
 * família precisa aceitar; até lá vale o que ela assinou, e a cobrança do mês
 * continua com o valor antigo. A folha diz isso ANTES do botão, porque o
 * motorista que muda a mensalidade espera ver o número novo na próxima
 * cobrança — e é melhor ele saber agora do que descobrir no dia 10.
 *
 * `key` no uso: os campos são estado local inicializado da criança.
 */
export default function EditarCombinadoSheet({ open, onClose, child, contratos }) {
  const { profile } = useAuth();
  const vig = vigenciaDaCrianca(child);
  const [fee, setFee] = useState(child?.monthlyFee ? String(child.monthlyFee) : '');
  const [dia, setDia] = useState(String(child?.dueDay || 10));
  const [inicio, setInicio] = useState(vig.inicio);
  const [fim, setFim] = useState(vig.fim);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const aceito = ['aceito', 'mudanca'].includes(estadoDoContrato(child));

  const salvar = async () => {
    const e = {};
    const valor = parseFloat(String(fee).replace(',', '.'));
    if (!valor || valor <= 0) e.fee = 'Escreva o valor da mensalidade.';
    const d = parseInt(dia, 10);
    if (!d || d < 1 || d > 28) e.dia = 'Dia entre 1 e 28.';
    const ev = erroDaVigencia(inicio, fim);
    if (ev) e.vigencia = ev;
    setErros(e);
    if (Object.keys(e).length) return;
    if (!contratos) return;

    setSalvando(true);
    try {
      const r = await salvarCombinado({
        child,
        admin: profile,
        contratos,
        novos: { monthlyFee: valor, dueDay: d, vigenciaInicio: inicio, vigenciaFim: fim },
      });
      if (r === 'aditivo') {
        toast.success('Contrato novo enviado. Vale quando a família assinar.');
      } else if (r === 'nada') {
        toast('Nada mudou no contrato.');
      } else {
        toast.success('Combinado salvo.');
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message?.startsWith('Complete') ? err.message : 'Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet
      open={open}
      onClose={salvando ? () => {} : onClose}
      title="Mudar o combinado"
      icon={FileSignature}
      size="full"
    >
      <div className="space-y-5 px-5 pb-6">
        <section className="space-y-3">
          <Input
            label="Mensalidade (R$)"
            icon={DollarSign}
            inputMode="decimal"
            value={fee}
            onChange={(ev) => setFee(ev.target.value.replace(/[^\d.,]/g, ''))}
            error={erros.fee}
          />
          <Input
            label="Dia do vencimento"
            icon={Calendar}
            inputMode="numeric"
            maxLength={2}
            value={dia}
            onChange={(ev) => setDia(ev.target.value.replace(/\D/g, '').slice(0, 2))}
            hint="Em que dia do mês a família paga (1 a 28)."
            error={erros.dia}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-text">Prazo do contrato</h3>
          <CampoVigencia
            inicio={inicio}
            fim={fim}
            erro={erros.vigencia}
            onChange={({ inicio: i, fim: f }) => {
              setInicio(i);
              setFim(f);
            }}
          />
        </section>

        {aceito && (
          <p className="rounded-2xl border border-warningBorder bg-warningSoft p-4 text-sm leading-relaxed text-warningText">
            A família já assinou o contrato. Salvar manda um <strong>contrato
            novo</strong> para ela assinar, e ele <strong>só vale depois da
            assinatura</strong> — até lá, a cobrança continua com o valor de hoje.
          </p>
        )}

        <Button icon={Save} loading={salvando} disabled={!contratos} onClick={salvar}>
          {aceito ? 'Mandar o contrato novo para a família' : 'Salvar'}
        </Button>
      </div>
    </AppSheet>
  );
}
