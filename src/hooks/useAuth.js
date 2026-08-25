import { useContext } from 'react';
import { AuthContext } from '../context/authContextObject';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}
