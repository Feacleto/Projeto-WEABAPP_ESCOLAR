import { createContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getUserDoc,
  login as loginService,
  logout as logoutService,
} from '../services/authService';

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

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    login,
    logout,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
