import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2 } from 'lucide-react';
import AppSheet from '../../components/common/AppSheet';
import Button from '../../components/common/Button';

/**
 * Adicionar outro filho a uma conta que já existe — /pai/adicionar-filho
 *
 * ⚠️ O CAMPO DE CÓDIGO SAIU (02/10/2026). O acesso do responsável é SÓ pelo
 * link — decisão do dono. Esta tela pedia o código de 8 letras do segundo
 * filho, e quem tinha o código tinha o link: os dois viajam na mesma mensagem.
 * O link já faz tudo sozinho — aberto com a conta dela, `Invite.jsx` oferece
 * "vincular à conta" e o filho novo aparece aqui.
 *
 * Então a tela virou uma explicação de um parágrafo. Ela continua existindo
 * porque o seletor de filhos e o perfil a abrem: tirar o botão "adicionar
 * filho" deixaria sem resposta a pergunta "e o meu outro filho?".
 */
function AddChildBody({ onDone }) {
  return (
    <div className="space-y-4">
      <div className="bg-sunken border border-border rounded-xl p-4 flex gap-3">
        <Link2 size={18} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-text leading-relaxed">
          Abra o <strong>link</strong> que o motorista mandou para o seu outro
          filho, com esta mesma conta. Ele aparece aqui na hora, e você troca
          entre os dois na tela de início.
        </p>
      </div>
      <p className="text-xs text-textMuted leading-relaxed">
        Não achou o link? Peça ao motorista para mandar de novo. Ele reenvia
        pela ficha da criança.
      </p>
      <Button variant="secondary" onClick={onDone}>
        Entendi
      </Button>
    </div>
  );
}

/**
 * CASCA 1 — a página. Link direto e o gesto de voltar do sistema.
 */
export default function AddChild() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col px-6 py-6">
      <Link
        to="/pai"
        className="tap -ml-1 mb-4 inline-flex items-center gap-1 self-start p-1 text-sm text-textMuted"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-bold text-text">Adicionar outro filho</h1>
        <p className="text-sm text-textMuted">
          É pelo link que o motorista mandou.
        </p>
      </div>

      <AddChildBody onDone={() => navigate('/pai', { replace: true })} />
    </div>
  );
}

/**
 * CASCA 2 — a folha. É por onde o seletor de filhos e o perfil abrem.
 *
 * Nos dois casos o responsável está no meio de outra coisa: trocando de
 * filho, ou conferindo os dados dele. Uma explicação de um parágrafo não
 * justifica trocar de tela.
 */
export function AddChildSheet({ open, onClose }) {
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Adicionar outro filho"
      subtitle="É pelo link que o motorista mandou."
      icon={Link2}
    >
      {open && <AddChildBody onDone={onClose} />}
    </AppSheet>
  );
}
