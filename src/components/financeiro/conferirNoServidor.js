import { conferirSenhaDoFinanceiro } from '../../services/senhaDoFinanceiroService';

/**
 * A resposta do servidor traduzida para o teclado de banco (03/10/2026).
 *
 * O que a callable faz (functions/lib — agente do servidor):
 *   { ok: true }                    senha certa
 *   { ok: false, restam: n }        errada; no 5º erro `restam` é 0 e o
 *                                   servidor grava uma trava de 60 s — ele
 *                                   NÃO lança nesse erro, então o zero é o
 *                                   sinal de travar o teclado aqui também
 *   lança resource-exhausted        tentativa durante a trava
 *   lança unavailable / sem rede    a senha só é conferida com internet
 *
 * A digital não passa por aqui: ela é conferida no aparelho e funciona sem
 * internet — por isso a frase de "sem internet" aponta para ela quando ligada.
 */
const MUITAS = 'Muitas tentativas. Aguarde 1 minuto.';

/**
 * `chamar` é a callable: a de conferir (padrão) ou a de desligar a senha
 * (30/10/2026), que responde no mesmo formato e conta tentativa igual.
 */
export async function conferirNoServidor(pares, { comDigital = false, chamar = conferirSenhaDoFinanceiro } = {}) {
  const semRede = comDigital
    ? 'Sem internet. Use a digital ou o rosto.'
    : 'Sem internet. A senha precisa de internet para ser conferida.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { erro: semRede };
  }
  try {
    const r = await chamar(pares);
    if (r?.ok) return { ok: true };
    if (r?.restam === 0) return { erro: MUITAS, bloquear: true };
    return { erro: 'Senha incorreta.' };
  } catch (err) {
    const code = err?.cause?.code || err?.code || '';
    if (code === 'functions/resource-exhausted') return { erro: MUITAS, bloquear: true };
    if (code === 'functions/unavailable') return { erro: semRede };
    return { erro: err?.message || 'Algo deu errado. Tente de novo.' };
  }
}
