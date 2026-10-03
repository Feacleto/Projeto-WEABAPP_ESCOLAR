import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import MolduraDoFinanceiro from './MolduraDoFinanceiro';
import TecladoDeBanco from './TecladoDeBanco';
import { useAuth } from '../../hooks/useAuth';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { conferePares, DIGITOS_DA_SENHA, senhaFacil } from '../../dominio/identidade/tecladoDeBanco.js';
import { criarSenhaDoFinanceiro } from '../../services/senhaDoFinanceiroService';
import {
  biometriaDisponivel,
  biometriaLigada,
  ligarBiometria,
} from '../../services/biometriaService';

/**
 * CRIAR A SENHA DO FINANCEIRO (03/10/2026) — a primeira vez, e a troca.
 *
 * Quatro passos, os textos do protótipo aprovado pelo dono:
 *   apresentação  "Proteja o seu Financeiro" (só na primeira vez)
 *   criar         teclado COMUM — a senha nova é digitada uma vez à vista,
 *                 recusando a fácil demais (`senhaFacil`)
 *   confirmar     já no TECLADO DE BANCO, conferido aqui mesmo contra a
 *                 senha digitada, que só vive na memória deste componente.
 *                 É o teclado que ele vai usar todo dia: confirmar nele é a
 *                 primeira aula
 *   pronto        "Senha criada", e a oferta da digital — só se o aparelho
 *                 tiver uma e ela ainda não estiver ligada
 *
 * A senha vai ao servidor UMA vez, na criação (`criarSenhaDoFinanceiro`), e
 * nunca é guardada no aparelho. Na troca, o servidor exige login recente —
 * quem chega aqui pela troca passou antes pelo `EsqueciASenhaDoFinanceiro`.
 */
export default function PrimeiraSenhaDoFinanceiro({ troca = false, destino, voltarPara }) {
  const { user, profile } = useAuth();
  const tranca = useTrancaDoFinanceiro();
  // Congelado na montagem: o servidor grava `temSenha` no meio do fluxo.
  const [ehTroca] = useState(troca);
  const [etapa, setEtapa] = useState(troca ? 'criar' : 'apresentacao');
  const [digitos, setDigitos] = useState('');
  const [primeira, setPrimeira] = useState('');
  const [erro, setErro] = useState('');
  const [oferecerDigital, setOferecerDigital] = useState(false);
  const [ligando, setLigando] = useState(false);

  useEffect(() => {
    let vivo = true;
    biometriaDisponivel().then((sim) => {
      if (vivo) setOferecerDigital(sim && !biometriaLigada(user?.uid));
    });
    return () => {
      vivo = false;
    };
  }, [user?.uid]);

  const comecar = () => {
    tranca.iniciarCriacao();
    setEtapa('criar');
    setErro('');
  };

  const digitar = (d) => {
    const nova = digitos + d;
    setErro('');
    if (nova.length < DIGITOS_DA_SENHA) {
      setDigitos(nova);
      return;
    }
    if (senhaFacil(nova)) {
      setDigitos('');
      setErro('Senha fácil demais. Tente outra.');
      return;
    }
    setPrimeira(nova);
    setDigitos('');
    setEtapa('confirmar');
  };

  const confirmar = async (pares) => {
    if (!conferePares(primeira, pares)) {
      setPrimeira('');
      setEtapa('criar');
      setErro('As senhas não bateram. Crie de novo.');
      return { ok: true };
    }
    try {
      await criarSenhaDoFinanceiro(primeira);
    } catch (err) {
      return { erro: err.message };
    }
    setPrimeira('');
    setEtapa('pronto');
    return { ok: true };
  };

  const entrar = () => tranca.abrirCom(destino);

  const ligar = async () => {
    setLigando(true);
    const ligou = await ligarBiometria(user?.uid, profile?.name || user?.email);
    setLigando(false);
    if (!ligou) toast('Não deu para ligar agora. Você pode ligar depois nos ajustes.');
    entrar();
  };

  return (
    <MolduraDoFinanceiro voltarPara={voltarPara}>
      {etapa === 'apresentacao' && (
        <>
          <section className="bg-card rounded-2xl shadow-rest px-5 py-6 flex flex-col gap-3">
            <span className="w-14 h-14 rounded-2xl bg-primaryChip flex items-center justify-center">
              <Lock size={28} className="text-primary" aria-hidden="true" />
            </span>
            <h2 className="font-display text-[26px] leading-tight font-extrabold text-text">
              Proteja o seu Financeiro
            </h2>
            <p className="text-lg leading-snug text-textBody">
              Crie uma senha de 4 números. Só quem tem a senha entra aqui.
            </p>
          </section>
          <Button onClick={comecar} className="h-[60px] text-lg">
            Criar senha
          </Button>
        </>
      )}

      {etapa === 'criar' && (
        <TecladoComum
          digitados={digitos.length}
          erro={erro}
          aoDigitar={digitar}
          aoApagar={() => {
            setDigitos((d) => d.slice(0, -1));
            setErro('');
          }}
        />
      )}

      {etapa === 'confirmar' && (
        <TecladoDeBanco titulo="Confirme a senha" aoCompletar={confirmar} />
      )}

      {(etapa === 'criar' || etapa === 'confirmar') && ehTroca && (
        <button
          type="button"
          onClick={tranca.cancelarFluxo}
          className="tap h-12 text-base font-bold text-textBody"
        >
          Voltar
        </button>
      )}

      {etapa === 'pronto' && (
        <>
          <section className="bg-card rounded-2xl shadow-rest px-5 py-6 flex flex-col items-center gap-3 text-center">
            <span className="w-16 h-16 rounded-full bg-primaryChip flex items-center justify-center">
              <Check size={32} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
            </span>
            <h2 className="font-display text-[26px] font-extrabold text-text">Senha criada</h2>
            {oferecerDigital && (
              <p className="text-lg text-textBody">Entrar também com digital ou rosto?</p>
            )}
          </section>
          {oferecerDigital ? (
            <>
              <Button onClick={ligar} loading={ligando} className="h-[60px] text-lg">
                Sim, ligar
              </Button>
              <Button variant="secondary" onClick={entrar} disabled={ligando} className="border-2 text-[17px]">
                Agora não
              </Button>
            </>
          ) : (
            <Button onClick={entrar} className="h-[60px] text-lg">
              Entrar no Financeiro
            </Button>
          )}
        </>
      )}
    </MolduraDoFinanceiro>
  );
}

/** O teclado de todo dia: 1–9, 0 e Apagar. Só para criar a senha nova. */
function TecladoComum({ digitados, erro, aoDigitar, aoApagar }) {
  const teclas = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'apagar'];
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-2 pt-2">
        <h2 className="font-display text-[26px] font-extrabold text-text">Crie sua senha</h2>
        <p className="text-[17px] text-textBody">4 números. Não use a do celular.</p>
        <div
          role="img"
          aria-label={`${digitados} de ${DIGITOS_DA_SENHA} números digitados`}
          className="flex gap-[18px] pt-5 pb-1.5"
        >
          {Array.from({ length: DIGITOS_DA_SENHA }, (_, i) => (
            <span
              key={i}
              className={`w-5 h-5 rounded-full border-2 ${
                i < digitados ? 'bg-primary border-primary' : 'border-textMuted'
              }`}
            />
          ))}
        </div>
        {erro && (
          <p
            role="alert"
            className="px-3.5 py-2.5 rounded-xl bg-dangerSoft text-dangerText text-base font-semibold text-center"
          >
            {erro}
          </p>
        )}
      </section>
      <div className="grid grid-cols-3 gap-2.5">
        {teclas.map((t, i) => {
          if (t === null) return <span key={i} />;
          if (t === 'apagar') {
            return (
              <button
                key={i}
                type="button"
                onClick={aoApagar}
                disabled={digitados === 0}
                className="tap h-16 rounded-xl text-base font-bold text-textBody disabled:opacity-50"
              >
                Apagar
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => aoDigitar(String(t))}
              className="tap h-16 rounded-xl bg-card shadow-rest text-[28px] font-bold text-text tabular-nums"
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
