import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useMeusVinculos } from '../../hooks/useAuxiliares';
import { usePeruaDaAuxiliar } from '../../hooks/usePeruaDaAuxiliar';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { FolhaDaMarcaContext } from '../../context/folhaDaMarcaContextObject';

const FolhaDaMarca = lazy(() => import('./FolhaDaMarca'));

/**
 * A FOLHA DA MARCA DA AUXILIAR (05/10/2026) — o provedor, no `AuxLayout`.
 *
 * Para ela, o logo do cabeçalho é o do TIO DA PERUA ESCOLHIDA: a marca vai
 * no contexto, e o `Header` desenha essa em vez da sua (ela não tem marca).
 * A escolha é a mesma `usePeruaDaAuxiliar` do Hoje e da Foto; trocar na
 * folha troca nos três.
 *
 * Do doc do tio sai só o que ela já lê hoje: marca, logo, cor, telefone e a
 * chave PIX (pelo `PixDaPerua`). Sem vínculo ativo, não há folha.
 */
export default function FolhaDaMarcaDaAuxiliar({ children }) {
  const { ativos } = useMeusVinculos();
  const { motoristaUid, escolher } = usePeruaDaAuxiliar(ativos);
  const { admin: motorista } = useAdminProfile(motoristaUid);
  const vinculoAtual = ativos.find((v) => v.motoristaUid === motoristaUid) || null;
  const [aberta, setAberta] = useState(false);
  const fechar = useCallback(() => setAberta(false), []);

  const nome = motorista?.marcaNome?.trim() || vinculoAtual?.marcaDoMotorista || '';
  const logoURL = motorista?.marcaLogoURL || null;
  const cor = motorista?.marcaCor || null;
  const valor = useMemo(
    () => (motoristaUid && (nome || logoURL) ? { abrir: () => setAberta(true), marca: { nome: nome || null, logoURL } } : null),
    [motoristaUid, nome, logoURL]
  );

  return (
    <FolhaDaMarcaContext.Provider value={valor}>
      {children}
      {aberta && valor && (
        <Suspense fallback={null}>
          <FolhaDaMarca
            papel="auxiliar"
            marca={{ nome, logoURL, cor }}
            auxiliar={{ ativos, motoristaUid, escolher, motorista, vinculoAtual }}
            onFechar={fechar}
          />
        </Suspense>
      )}
    </FolhaDaMarcaContext.Provider>
  );
}
