import { useNavigate } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import AppSheet from '../../components/common/AppSheet';
import Header from '../../components/layout/Header';
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
        <p className="text-base text-text leading-relaxed">
          Abra o <strong>link</strong> que o motorista mandou para o seu outro
          filho, com esta mesma conta. Ele aparece aqui na hora, e você troca
          entre os dois na tela de início.
        </p>
      </div>
      <p className="text-base text-textMuted leading-relaxed">
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
 *
 * O voltar é o do `Header` (03/10/2026): era um link de ~28 px escrito à mão,
 * cinza, sem dizer para onde. O do cabeçalho tem 48 px, diz "Início" e não
 * empilha história quando ela chegou direto pelo endereço.
 */
export default function AddChild() {
  const navigate = useNavigate();
  return (
    <>
      <Header title="Adicionar outro filho" showBack backLabel="Início" backTo="/pai" />
      <div className="px-5 py-5">
        <p className="mb-4 text-base text-textMuted">
          É pelo link que o motorista mandou.
        </p>
        <AddChildBody onDone={() => navigate('/pai', { replace: true })} />
      </div>
    </>
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
