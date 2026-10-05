import { useState } from 'react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import PublicarFoto from '../../components/comunidade/PublicarFoto';
import FotoNaLista from '../../components/comunidade/FotoNaLista';
import { useAuth } from '../../hooks/useAuth';
import { useMeusVinculos, useTurmaDaAuxiliar } from '../../hooks/useAuxiliares';
import { usePeruaDaAuxiliar } from '../../hooks/usePeruaDaAuxiliar';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useFotosQueEuPostei } from '../../hooks/useFotosDaTurma';
import { STORAGE_ENABLED } from '../../config/capabilities';
import { getDateKey } from '../../dominio/rota/horarios';
import { PUBLICO } from '../../dominio/identidade/comunidade.js';

/**
 * A FOTO DA TURMA, PELA AUXILIAR — /aux/foto (F1.5, 05/10/2026).
 *
 * Ela posta, pela conta dela, a foto da turma para as FAMÍLIAS do tio da
 * perua escolhida no topo do Hoje (a mesma escolha, `usePeruaDaAuxiliar`).
 * Para os tios parceiros, não: parceria é entre tios.
 *
 * - A turma vem da CÓPIA (`turmaDaAuxiliar`), que traz o "sim" de cada
 *   família (`fotoDaTurmaConsentida`); quem confere de novo é o servidor.
 * - O arquivo sobe para a pasta DELA; o servidor copia para a do tio. A foto
 *   sai em nome do tio, e o aviso às famílias leva a marca dele.
 * - "As que você postou" vêm de uma callable (o registro de quem postou só o
 *   servidor lê), e ela apaga a dela — mesmo depois de desativada.
 *
 * Um botão cheio só: "Postar foto da turma" (dentro do formulário, o
 * "Publicar" toma o lugar dele).
 */
export default function AuxFoto() {
  const { user } = useAuth();
  const { ativos } = useMeusVinculos();
  const { motoristaUid } = usePeruaDaAuxiliar(ativos);
  const { admin: motorista } = useAdminProfile(motoristaUid);
  const vinculo = ativos.find((v) => v.motoristaUid === motoristaUid);
  const marca = motorista?.marcaNome || motorista?.name || vinculo?.marcaDoMotorista || 'o motorista';
  const { criancas } = useTurmaDaAuxiliar(motoristaUid, getDateKey());
  const { fotos, recarregar } = useFotosQueEuPostei();
  const [postando, setPostando] = useState(false);

  return (
    <>
      <Header title="Foto da turma" showBack backLabel="Hoje" backTo="/aux" />
      <div className="space-y-4 p-4">
        {motoristaUid ? (
          <>
            <p className="text-base leading-relaxed text-textBody">
              Para as famílias da perua de {marca}. Elas veem no app por 30 dias.
            </p>
            {!STORAGE_ENABLED ? null : criancas === null ? (
              <Skeleton className="h-24 rounded-2xl" />
            ) : postando ? (
              <PublicarFoto
                uid={user?.uid}
                tioUid={motoristaUid}
                publico={PUBLICO.FAMILIAS}
                turma={criancas}
                onPronto={() => {
                  setPostando(false);
                  recarregar();
                }}
              />
            ) : (
              <Button onClick={() => setPostando(true)}>Postar foto da turma</Button>
            )}
          </>
        ) : (
          <p className="rounded-2xl bg-card p-4 text-base text-textBody">
            Seu acesso à perua foi encerrado. Você ainda pode apagar as fotos que postou.
          </p>
        )}

        <h2 className="px-1 pt-2 font-display text-lg font-bold text-text">As que você postou</h2>
        {fotos === null ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : fotos.length === 0 ? (
          <p className="text-base text-textMuted">Nenhuma foto sua no ar agora.</p>
        ) : (
          <ul className="space-y-3">
            {fotos.map((f) => (
              <FotoNaLista key={f.id} foto={f} podeApagar onApagada={recarregar} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
