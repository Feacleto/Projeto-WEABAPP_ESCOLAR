import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useMeusVinculos } from '../../hooks/useAuxiliares';
import { DEV_EMAIL } from '../../config/developer';
import RecomendacoesRecebidas from '../../components/avaliacaoDaAuxiliar/RecomendacoesRecebidas';
import EstrelasParaOTio from '../../components/avaliacaoDaAuxiliar/EstrelasParaOTio';

/**
 * PERFIL DA AUXILIAR (05/10/2026, fase 1): quem ela é, de quem é auxiliar e
 * sair. A nota para o motorista e a chave "aberta a trabalhar com outros tios"
 * entram nas próximas fases. Fase 4: "Trocar a senha dos pagamentos" leva à
 * aba Pagamentos já no passo de provar a conta.
 *
 * AS AVALIAÇÕES (05/10/2026): as recomendações que os tios escreveram (ela
 * aprova antes de aparecer) e "Como é trabalhar com …?", uma linha por tio
 * com quem ela trabalha ou já trabalhou — só a equipe vê a nota.
 *
 * ⚠️ EXCLUIR A CONTA, por enquanto, é pelo e-mail da plataforma — o mesmo
 * canal que os Termos já nomeiam para a família e o motorista. Um botão que
 * prometesse apagar sem a função que apaga seria promessa sem caminho.
 */
export default function AuxPerfil() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const { vinculos, ativos } = useMeusVinculos();
  const email = DEV_EMAIL;

  return (
    <>
      <Header title="Perfil" />
      <div className="space-y-4 p-4">
        <section className="rounded-2xl bg-card p-5 shadow-rest">
          <p className="font-display text-xl font-bold text-text">{profile?.name || 'Auxiliar'}</p>
          <p className="mt-1 text-base text-textBody">{profile?.email}</p>
          <p className="mt-1 text-base text-textBody">
            {vinculos === undefined
              ? '…'
              : ativos.length > 0
                ? `Auxiliar na perua de ${ativos.map((v) => v.marcaDoMotorista || 'um motorista').join(' e de ')}`
                : 'Acesso encerrado pelo motorista'}
          </p>
        </section>
        <RecomendacoesRecebidas />
        {(vinculos || []).map((v) => (
          <EstrelasParaOTio key={v.motoristaUid} motoristaUid={v.motoristaUid} marca={v.marcaDoMotorista} />
        ))}
        <Button
          variant="secondary"
          icon={KeyRound}
          className="border-2"
          onClick={() => navigate('/aux/pagamentos', { state: { trocar: true } })}
        >
          Trocar a senha dos pagamentos
        </Button>
        <Button
          variant="secondary"
          icon={LogOut}
          onClick={async () => {
            await logout?.();
            navigate('/login', { replace: true });
          }}
        >
          Sair da conta
        </Button>
        {email && (
          <p className="text-sm text-textMuted">
            Para excluir a sua conta, escreva para <span className="font-semibold text-text">{email}</span>.
          </p>
        )}
      </div>
    </>
  );
}
