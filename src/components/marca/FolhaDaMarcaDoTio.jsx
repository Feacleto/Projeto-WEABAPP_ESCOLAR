import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { FolhaDaMarcaContext } from '../../context/folhaDaMarcaContextObject';

// A folha só baixa quando ele toca no logo: este provedor mora no caminho
// eager do App, e a folha traz o PIX, a prévia e o selo junto.
const FolhaDaMarca = lazy(() => import('./FolhaDaMarca'));

/**
 * A FOLHA DA MARCA DO TIO (05/10/2026) — o provedor, montado em volta do
 * `TioLayout` no App.jsx. Entrega ao `Header` o `abrir`; a marca do
 * cabeçalho continua sendo a do perfil dele (`useMarcaDoTio`), então
 * `marca` aqui é `null`.
 */
export default function FolhaDaMarcaDoTio({ children }) {
  const { user, profile } = useAuth();
  const [aberta, setAberta] = useState(false);
  const fechar = useCallback(() => setAberta(false), []);
  const valor = useMemo(() => ({ abrir: () => setAberta(true), marca: null }), []);
  return (
    <FolhaDaMarcaContext.Provider value={valor}>
      {children}
      {aberta && (
        <Suspense fallback={null}>
          <FolhaDaMarca
            papel="tio"
            tio={profile}
            tioUid={user?.uid || null}
            marca={{
              nome: profile?.marcaNome?.trim() || profile?.name || '',
              logoURL: profile?.marcaLogoURL || null,
              cor: profile?.marcaCor || null,
            }}
            onFechar={fechar}
          />
        </Suspense>
      )}
    </FolhaDaMarcaContext.Provider>
  );
}
