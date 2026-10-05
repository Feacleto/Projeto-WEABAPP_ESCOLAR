import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../common/ConfirmDialog';
import { useChildren } from '../../hooks/useChildren';
import { useVagasDaPerua } from '../../hooks/useVagasDaPerua';
import { frasesDaPerua, passaDasVagas } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * "PASSOU DAS VAGAS QUE VOCÊ DISSE. QUER CONTINUAR?" (05/10/2026, decisão do
 * dono) — no cadastro da criança, quando as ativas já são tantas quanto as
 * vagas.
 *
 * ⚠️ NUNCA TRAVA: "Continuar" segue o cadastro como sempre, e nenhuma rule
 * compara vagas com crianças. A pergunta vem NO COMEÇO, e não ao salvar: lá
 * o "não" jogaria fora tudo o que ele acabou de digitar.
 *
 * `chave` é o id reservado da criança: "Cadastrar outra criança" troca a
 * chave, e a pergunta volta a valer para a próxima.
 */
export default function PerguntaDasVagas({ chave }) {
  const navigate = useNavigate();
  const { vagas } = useVagasDaPerua();
  const { children: ativas, loading } = useChildren();
  const [respondida, setRespondida] = useState(null);

  if (loading || typeof vagas !== 'number') return null;
  const aberta = respondida !== chave && passaDasVagas({ vagas, ativas: ativas.length });
  const frases = frasesDaPerua({ vagas, criancas: ativas });

  return (
    <ConfirmDialog
      open={aberta}
      title={frases.passouTitulo}
      description={frases.passouPergunta}
      confirmLabel="Continuar o cadastro"
      cancelLabel="Voltar"
      onConfirm={() => setRespondida(chave)}
      onCancel={() => {
        setRespondida(chave);
        navigate(-1);
      }}
    />
  );
}
