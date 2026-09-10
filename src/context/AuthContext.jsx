import { useEffect, useMemo, useState, useCallback } from 'react';
import { AuthContext } from './authContextObject';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getUserDoc,
  login as loginService,
  logout as logoutService,
} from '../services/authService';
import { getChildIds, resolveActiveChildId } from '../dominio/identidade/childIds';

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

/**
 * Provê o estado de autenticação para a árvore inteira.
 *
 * Estado exposto:
 *   - user:    objeto FirebaseUser (ou null)
 *   - profile: doc users/{uid} do Firestore (ou null se ainda não criado)
 *   - role:    "admin" | "parent" | null (atalho pra profile?.role)
 *   - loading: true enquanto onAuthStateChanged ainda não disparou pela 1ª vez
 *   - perfilIndisponivel: a leitura FALHOU. Diferente de `profile == null`,
 *     que também é o estado de quem ainda não tem documento — ver o comentário
 *     no estado, e a tela `FalhaAoLerConta`.
 *
 * O profile é carregado SOB DEMANDA quando o user muda — chamadas críticas
 * que dependem do profile devem aguardar `loading === false && profile != null`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // ⚠️ "NÃO CONSEGUI LER" NÃO É "NÃO EXISTE", e por um tempo era a mesma coisa.
  //
  // O `catch` abaixo gravava `profile = null`, exatamente o mesmo valor de
  // quem acabou de criar sessão e ainda não escolheu um lado. O `App` lê esse
  // nulo como conclusivo e manda pra `/comecar` — então uma leitura que
  // falhou (rede caindo no meio-fio, Firestore fora do ar, regra recusando)
  // recebia um motorista de meses com "Falta ligar sua conta / Nada foi criado
  // ainda". Ele não tem o que ligar, e tudo já foi criado.
  //
  // A saída não é insistir em silêncio: é ter um TERCEIRO estado, pra tela
  // poder dizer a verdade e oferecer "tentar de novo". Ele só é verdadeiro
  // quando a leitura LEVANTOU EXCEÇÃO — documento ausente continua sendo
  // ausência, não falha.
  const [perfilIndisponivel, setPerfilIndisponivel] = useState(false);
  const [savedChildId, setSavedChildId] = useState(readSavedChildId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userProfile = await getUserDoc(firebaseUser.uid);
          setProfile(userProfile);
          setPerfilIndisponivel(false);
        } catch (err) {
          console.error('Falha ao carregar perfil:', err);
          setProfile(null);
          setPerfilIndisponivel(true);
        }
      } else {
        setUser(null);
        setProfile(null);
        setPerfilIndisponivel(false);
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
    setPerfilIndisponivel(false);
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
  // Ela também é o botão "tentar de novo" da tela de falha, e por isso mexe
  // no terceiro estado nos dois sentidos. Continua propagando o erro: quem a
  // chama depois de um cadastro precisa saber que não deu.
  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return null;
    try {
      const updated = await getUserDoc(auth.currentUser.uid);
      setProfile(updated);
      setPerfilIndisponivel(false);
      return updated;
    } catch (err) {
      setPerfilIndisponivel(true);
      throw err;
    }
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
    perfilIndisponivel,
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
