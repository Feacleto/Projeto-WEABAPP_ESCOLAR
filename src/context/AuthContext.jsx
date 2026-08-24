import { createContext, useEffect, useMemo, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getUserDoc,
  login as loginService,
  logout as logoutService,
} from '../services/authService';
import { getChildIds, resolveActiveChildId } from '../utils/childIds';

// Filho ativo escolhido pelo responsável. Fica em localStorage pra o app
// abrir no mesmo filho da última vez — trocar de filho a cada reload seria
// desorientador pra quem tem dois.
const ACTIVE_CHILD_KEY = 'ab_active_child_v1';

function readSavedChildId() {
  try {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  } catch {
    return null;
  }
}

export const AuthContext = createContext(null);

/**
 * Provê o estado de autenticação para a árvore inteira.
 *
 * Estado exposto:
 *   - user:    objeto FirebaseUser (ou null)
 *   - profile: doc users/{uid} do Firestore (ou null se ainda não criado)
 *   - role:    "admin" | "parent" | null (atalho pra profile?.role)
 *   - loading: true enquanto onAuthStateChanged ainda não disparou pela 1ª vez
 *
 * O profile é carregado SOB DEMANDA quando o user muda — chamadas críticas
 * que dependem do profile devem aguardar `loading === false && profile != null`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedChildId, setSavedChildId] = useState(readSavedChildId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userProfile = await getUserDoc(firebaseUser.uid);
          setProfile(userProfile);
        } catch (err) {
          console.error('Falha ao carregar perfil:', err);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(
    (email, password) => loginService(email, password),
    []
  );

  const logout = useCallback(async () => {
    await logoutService();
    setProfile(null);
    // Não deixa o filho de uma conta vazar pra próxima que logar no mesmo
    // aparelho — cenário real em celular compartilhado.
    setSavedChildId(null);
    try {
      localStorage.removeItem(ACTIVE_CHILD_KEY);
    } catch {
      // ignorado
    }
  }, []);

  // Re-busca o doc users/{uid}. Necessário após signup, porque o documento
  // é criado DEPOIS do onAuthStateChanged disparar pela primeira vez.
  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return null;
    const updated = await getUserDoc(auth.currentUser.uid);
    setProfile(updated);
    return updated;
  }, []);

  // Atualiza o profile no estado local sem refetch — usado quando já
  // sabemos o que mudou no Firestore (ex: tutorialDone após o tutorial).
  const updateProfile = useCallback((partial) => {
    setProfile((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const childIds = useMemo(() => getChildIds(profile), [profile]);

  // Nunca devolve um id que não pertence mais à conta: se o tio removeu a
  // criança, cai no primeiro filho restante em vez de tela vazia.
  const activeChildId = useMemo(
    () => resolveActiveChildId(profile, savedChildId),
    [profile, savedChildId]
  );

  const setActiveChildId = useCallback((id) => {
    setSavedChildId(id);
    try {
      localStorage.setItem(ACTIVE_CHILD_KEY, id);
    } catch {
      // modo privado / quota — segue só em memória
    }
  }, []);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    childIds,
    activeChildId,
    setActiveChildId,
    login,
    logout,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
