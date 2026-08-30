import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * QUANTAS VAGAS ELE CONTRATOU, E QUANTAS JÁ USOU.
 *
 * O limite é cláusula de contrato: `users.limiteCriancas`, escrito só pelo
 * dono no orçamento (as rules garantem — o parceiro não alcança o campo). O
 * uso é `users.criancasAtivas`, o contador que sobe junto com o cadastro.
 *
 * POR QUE O CONTADOR, E NÃO UM `count()` DAS CRIANÇAS
 * Não é preguiça de consulta: rules do Firestore não sabem contar documentos,
 * então o limite só é verificável no servidor se a contagem estiver
 * materializada num campo. A tela lê o mesmo número que a regra lê — se ela
 * lesse a contagem real e a regra lesse o contador, os dois discordariam
 * exatamente no caso que importa, e o motorista veria "3 de 10" enquanto o
 * cadastro era recusado.
 *
 * LIMITE AUSENTE = SEM LIMITE, e isso é decisão de produto, não descuido:
 * parceiro que ainda não negociou não pode ficar impedido de trabalhar por
 * uma cláusula que ninguém combinou com ele. `temLimite` é o que a tela usa
 * pra decidir se mostra contagem — mostrar "3 de ∞" não ajuda ninguém.
 *
 * IMPORTA A LEITURA DIRETA, e não `useAuth().profile`: o contador muda a cada
 * cadastro, e o perfil do contexto é buscado em momentos pontuais. Uma tela
 * que decide bloquear precisa do número de agora.
 */
export function useLimiteCriancas(uid) {
  const [dados, setDados] = useState({ chave: null, limite: null, usadas: 0 });

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const d = snap.data() || {};
        setDados({
          chave: uid,
          limite:
            typeof d.limiteCriancas === 'number' ? d.limiteCriancas : null,
          usadas: Number(d.criancasAtivas) || 0,
        });
      },
      (err) => {
        // Falha de leitura NÃO bloqueia o cadastro.
        //
        // Quem impede de verdade são as rules; esta tela só explica. Tratar
        // erro de rede como "limite atingido" travaria o trabalho dele por
        // uma consulta que falhou — e a rule deixaria passar assim mesmo.
        console.error('[limite] não deu pra ler o contrato:', err);
        setDados({ chave: uid, limite: null, usadas: 0 });
      }
    );
  }, [uid]);

  const naChave = !!uid && dados.chave === uid;

  return useMemo(() => {
    const limite = naChave ? dados.limite : null;
    const usadas = naChave ? dados.usadas : 0;
    const temLimite = typeof limite === 'number' && limite >= 0;
    return {
      limite,
      usadas,
      temLimite,
      restantes: temLimite ? Math.max(0, limite - usadas) : null,
      lotado: temLimite && usadas >= limite,
      carregando: uid ? !naChave : false,
    };
  }, [naChave, dados.limite, dados.usadas, uid]);
}
