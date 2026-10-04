import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Send, UserPlus, X } from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import {
  encerrarAcessoTemporario,
  gerarAcessoTemporario,
  salvarSegundoResponsavel,
  watchAcessoTemporario,
} from '../../services/acessoTemporarioService';
import { maskPhone } from '../../compartilhado/masks';

/**
 * O ACESSO DE 24 HORAS DO SEGUNDO RESPONSÁVEL — o cartão (03/10/2026).
 *
 * Mora na ficha da criança, embaixo do segundo responsável, para os dois
 * lados (a titular e o motorista). Três estados:
 *   - sem segundo responsável: a FAMÍLIA cadastra nome e WhatsApp aqui
 *     (o motorista cadastra no formulário dele, como sempre);
 *   - sem acesso aberto: "Mandar o acesso de 24 horas" abre o WhatsApp com o
 *     link pronto, para o número dele;
 *   - acesso aberto: diz até quando vale, e "Encerrar agora".
 *
 * O que ele vê e recebe é decidido no servidor
 * (`functions/lib/reguaDoAcessoTemporario.js`), e a frase da tela diz isso
 * com as palavras de quem usa.
 */
function horaDoFim(ms) {
  const fim = new Date(ms);
  const hoje = new Date();
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  const hora = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (fim.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  if (fim.toDateString() === amanha.toDateString()) return `amanhã às ${hora}`;
  return `${fim.toLocaleDateString('pt-BR')} às ${hora}`;
}

export default function AcessoDeUmDia({ child }) {
  const { user, role } = useAuth();
  const papel = role === 'admin' ? 'admin' : 'parent';
  const [acesso, setAcesso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  useEffect(
    () => watchAcessoTemporario({ childId: child?.id, uid: user?.uid, papel }, setAcesso),
    [child?.id, user?.uid, papel]
  );

  if (!child?.id) return null;
  const segundo = String(child.parent2Name || '').trim().split(/\s+/)[0];
  const temNumero = String(child.parent2Phone || '').replace(/\D/g, '').length >= 10;
  const filho = String(child.name || '').trim().split(/\s+/)[0] || 'a criança';

  // A família ainda não entrou no app: não há de quem o acesso dependa.
  if (!child.parentUid) return null;

  if (!temNumero) {
    if (papel !== 'parent') return null;
    if (!cadastrando) {
      return (
        <button
          type="button"
          onClick={() => setCadastrando(true)}
          className="tap w-full flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
        >
          <UserPlus size={20} className="text-primary shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold text-text">Cadastrar um segundo responsável</span>
            <span className="block text-sm text-textMuted">
              Para mandar a ele um acesso de 24 horas, quando precisar.
            </span>
          </span>
        </button>
      );
    }
    const salvar = async (e) => {
      e.preventDefault();
      if (!nome.trim() || telefone.replace(/\D/g, '').length < 10) {
        toast.error('Escreva o nome e o WhatsApp com DDD.');
        return;
      }
      setOcupado(true);
      try {
        await salvarSegundoResponsavel(child.id, { nome, telefone });
        toast.success('Segundo responsável salvo.');
        setCadastrando(false);
      } catch (err) {
        console.error(err);
        toast.error('Não deu para salvar agora.');
      } finally {
        setOcupado(false);
      }
    };
    return (
      <form onSubmit={salvar} className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <p className="font-semibold text-text">Segundo responsável</p>
        <label className="block text-sm text-textBody">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-border bg-card px-3 text-base"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm text-textBody">
          WhatsApp com DDD
          <input
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
            inputMode="tel"
            className="mt-1 h-12 w-full rounded-lg border border-border bg-card px-3 text-base"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" loading={ocupado}>Salvar</Button>
          <Button type="button" variant="ghost" onClick={() => setCadastrando(false)}>Cancelar</Button>
        </div>
      </form>
    );
  }

  const mandar = async () => {
    setOcupado(true);
    try {
      const { link } = await gerarAcessoTemporario(child.id);
      const texto =
        `${segundo ? `Olá, ${segundo}! ` : 'Olá! '}` +
        `Este link mostra o dia de ${filho} na perua escolar: a saída, a chegada na escola e em casa. ` +
        `Ele vale por 24 horas: ${link}`;
      const tel = String(child.parent2Phone).replace(/\D/g, '');
      window.open(`https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${encodeURIComponent(texto)}`, '_blank');
      toast.success('Link criado. Confira a mensagem no WhatsApp e envie.');
    } catch (err) {
      toast.error(err.message || 'Não deu para criar o link agora.');
    } finally {
      setOcupado(false);
    }
  };

  const encerrar = async () => {
    setOcupado(true);
    try {
      await encerrarAcessoTemporario(child.id);
      toast.success('Acesso encerrado. O link não abre mais.');
    } catch (err) {
      toast.error(err.message || 'Não deu para encerrar agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <p className="flex items-center gap-2 font-semibold text-text">
        <Clock size={18} className="text-primary shrink-0" />
        Acesso de 24 horas{segundo ? ` para ${segundo}` : ''}
      </p>
      {acesso ? (
        <>
          <p className="text-sm text-textBody">
            Ligado até <strong>{horaDoFim(acesso.expiraEm.toMillis())}</strong>.
            {acesso.fcmTokens?.length ? ' Ele está recebendo os avisos da rota.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Send} loading={ocupado} onClick={mandar}>
              Mandar um link novo
            </Button>
            <Button variant="ghost" icon={X} loading={ocupado} onClick={encerrar}>
              Encerrar agora
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-textBody">
            Ele vê, por 24 horas, quando {filho} sai, chega na escola e chega em casa, e pode receber
            os avisos da rota. Não vê endereço, mensalidade nem contrato.
          </p>
          <Button icon={Send} loading={ocupado} onClick={mandar}>
            Mandar o acesso pelo WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}
