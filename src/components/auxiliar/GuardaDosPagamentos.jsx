import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Fingerprint, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../layout/Header';
import Button from '../common/Button';
import PontosDeEspera from '../common/PontosDeEspera';
import TecladoDeBanco from '../financeiro/TecladoDeBanco';
import { TecladoComum } from '../financeiro/PrimeiraSenhaDoFinanceiro';
import { conferirNoServidor } from '../financeiro/conferirNoServidor';
import { useAuth } from '../../hooks/useAuth';
import { watchConfigFinanceiro } from '../../services/configFinanceiroService';
import { criarSenhaDoFinanceiro } from '../../services/senhaDoFinanceiroService';
import { metodoDeReautenticacao, reautenticarConta } from '../../services/authService';
import {
  biometriaDisponivel,
  biometriaLigada,
  conferirBiometria,
  ligarBiometria,
} from '../../services/biometriaService';
import { conferePares, DIGITOS_DA_SENHA, senhaFacil } from '../../dominio/identidade/tecladoDeBanco.js';
import { mensagemDeAuth } from '../../dominio/identidade/authErrors.js';

/**
 * A SENHA DOS PAGAMENTOS DA AUXILIAR (fase 4, 05/10/2026).
 *
 * Os pagamentos dela são o salário dela — e o celular dela anda na mão da
 * filha, fica no banco da perua, é emprestado. A aba abre com 4 números no
 * MESMO teclado de banco do motorista, e o servidor é o mesmo: as callables
 * `criarSenhaDoFinanceiro`/`conferirSenhaDoFinanceiro` aceitam a auxiliar, e
 * a senha dela mora em `senhasDoFinanceiro/{uidDela}`. O `temSenha` vem de
 * `configFinanceiro/{uidDela}` (as rules deixam ela ler o próprio).
 *
 * ⚠️ POR QUE NÃO O `GuardaDoFinanceiro`: aquele decide pelo CAMINHO do
 * `/tio/finance` e mora no provedor da tranca, que só assina para motorista.
 * Aqui a tranca é mais simples, e é de propósito: o estado "aberto" vive
 * neste componente, então sair da aba (ou recarregar) tranca. Não há
 * preferência de "5 minutos" — ela abre isto uma vez por mês.
 *
 * A digital, quando o aparelho tem e ela ligou, é conferida no aparelho
 * (`biometriaService`), como a do motorista.
 *
 * "Trocar a senha" do Perfil chega aqui com `state.trocar`: antes de criar a
 * nova, ela prova que é a dona da CONTA (o servidor exige login recente).
 */
export default function GuardaDosPagamentos({ children }) {
  const { user, profile } = useAuth();
  const uid = user?.uid || null;
  const location = useLocation();
  const [config, setConfig] = useState({ chave: null, dados: null });
  useEffect(() => {
    if (!uid) return undefined;
    return watchConfigFinanceiro(uid, (dados) => setConfig({ chave: uid, dados }));
  }, [uid]);
  const temSenha = uid && config.chave === uid ? config.dados?.temSenha === true : undefined;

  const [aberto, setAberto] = useState(false);
  // null | 'criar' | 'esqueci'. Pedir a troca no Perfil começa provando a conta.
  const [fluxo, setFluxo] = useState(location.state?.trocar ? 'esqueci' : null);
  // O pedido de troca vale UMA vez: limpo do histórico, recarregar a página
  // não reabre a tela de "Nova senha".
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.trocar) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  if (fluxo === 'esqueci') {
    return (
      <Moldura>
        <ProvarAConta onPronto={() => setFluxo('criar')} onVoltar={() => setFluxo(null)} />
      </Moldura>
    );
  }
  if (fluxo === 'criar' || (temSenha === false && !aberto)) {
    return (
      <Moldura>
        <CriarSenha
          troca={fluxo === 'criar' && temSenha === true}
          nome={profile?.name || user?.email}
          uid={uid}
          onComecar={() => setFluxo('criar')}
          onVoltar={() => setFluxo(null)}
          onPronta={() => {
            setFluxo(null);
            setAberto(true);
          }}
        />
      </Moldura>
    );
  }
  if (aberto) return children;
  if (temSenha === undefined) return <PontosDeEspera titulo="Pagamentos" rotulo="Abrindo" />;
  return (
    <Moldura>
      <DigiteASenha uid={uid} onAbrir={() => setAberto(true)} onEsqueci={() => setFluxo('esqueci')} />
    </Moldura>
  );
}

function Moldura({ children }) {
  return (
    <>
      <Header
        title="Pagamentos"
        action={
          <span className="flex min-h-12 items-center gap-1.5 pr-1 text-sm font-semibold text-textMuted" aria-label="Protegido">
            <Lock size={18} className="text-primary" aria-hidden="true" />
            <span>Protegido</span>
          </span>
        }
      />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-5 pb-6 pt-5">{children}</main>
    </>
  );
}

function DigiteASenha({ uid, onAbrir, onEsqueci }) {
  const comDigital = biometriaLigada(uid);
  const aoCompletar = async (pares) => {
    const r = await conferirNoServidor(pares, { comDigital });
    if (r.ok) onAbrir();
    return r;
  };
  return (
    <>
      {comDigital && (
        <button
          type="button"
          onClick={async () => {
            if (await conferirBiometria(uid)) onAbrir();
          }}
          className="tap flex h-14 items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca shadow-focus"
        >
          <Fingerprint size={22} aria-hidden="true" />
          Usar a digital ou o rosto
        </button>
      )}
      <TecladoDeBanco
        titulo="Digite sua senha"
        dica="Toque no botão que tem o seu número"
        aoCompletar={aoCompletar}
      >
        <button type="button" onClick={onEsqueci} className="tap h-12 text-base font-bold text-primary underline">
          Esqueci a senha
        </button>
      </TecladoDeBanco>
    </>
  );
}

/**
 * Criar (ou trocar) a senha: apresentação, teclado comum, confirmação no
 * teclado de banco e a oferta da digital — os passos do motorista
 * (`PrimeiraSenhaDoFinanceiro`), com o texto dela.
 */
function CriarSenha({ troca, nome, uid, onComecar, onVoltar, onPronta }) {
  // Congelado na montagem: o servidor grava `temSenha` no meio da criação, e
  // a primeira vez não pode virar "troca" (nem ganhar o Voltar) no caminho.
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
      if (vivo) setOferecerDigital(sim && !biometriaLigada(uid));
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  const digitar = (d) => {
    const nova = digitos + d;
    setErro('');
    if (nova.length < DIGITOS_DA_SENHA) return setDigitos(nova);
    if (senhaFacil(nova)) {
      setDigitos('');
      return setErro('Senha fácil demais. Tente outra.');
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

  const ligar = async () => {
    setLigando(true);
    const ligou = await ligarBiometria(uid, nome);
    setLigando(false);
    if (!ligou) toast('Não deu para ligar agora.');
    onPronta();
  };

  if (etapa === 'apresentacao') {
    return (
      <>
        <section className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-6 shadow-rest">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primaryChip">
            <Lock size={28} className="text-primary" aria-hidden="true" />
          </span>
          <h2 className="font-display text-[26px] font-extrabold leading-tight text-text">Proteja os seus pagamentos</h2>
          <p className="text-lg leading-snug text-textBody">Crie uma senha de 4 números. Só quem tem a senha vê.</p>
        </section>
        <Button
          onClick={() => {
            // Segura esta tela quando o servidor gravar `temSenha` no meio.
            onComecar();
            setEtapa('criar');
          }}
          className="h-[60px] text-lg"
        >
          Criar senha
        </Button>
      </>
    );
  }

  if (etapa === 'pronto') {
    return (
      <>
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-card px-5 py-6 text-center shadow-rest">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primaryChip">
            <Check size={32} strokeWidth={2.5} className="text-primary" aria-hidden="true" />
          </span>
          <h2 className="font-display text-[26px] font-extrabold text-text">Senha criada</h2>
          {oferecerDigital && <p className="text-lg text-textBody">Usar a digital também?</p>}
        </section>
        {oferecerDigital ? (
          <>
            <Button onClick={ligar} loading={ligando} className="h-[60px] text-lg">
              Usar a digital também
            </Button>
            <Button variant="secondary" onClick={onPronta} disabled={ligando} className="border-2 text-[17px]">
              Agora não
            </Button>
          </>
        ) : (
          <Button onClick={onPronta} className="h-[60px] text-lg">
            Ver os pagamentos
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      {etapa === 'criar' ? (
        <TecladoComum
          digitados={digitos.length}
          erro={erro}
          aoDigitar={digitar}
          aoApagar={() => {
            setDigitos((d) => d.slice(0, -1));
            setErro('');
          }}
        />
      ) : (
        <TecladoDeBanco titulo="Confirme a senha" aoCompletar={confirmar} />
      )}
      {ehTroca && (
        <button type="button" onClick={onVoltar} className="tap h-12 text-base font-bold text-textBody">
          Voltar
        </button>
      )}
    </>
  );
}

/** Antes de trocar a senha, provar que é a dona da conta (login recente). */
function ProvarAConta({ onPronto, onVoltar }) {
  const metodo = metodoDeReautenticacao();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const continuar = async (e) => {
    e?.preventDefault();
    if (metodo === 'senha' && !senha) return setErro('Digite a senha da sua conta.');
    setEnviando(true);
    setErro('');
    try {
      await reautenticarConta(senha);
      onPronto();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErro(mensagemDeAuth(err, 'entrar'));
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={continuar} className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-6 shadow-rest">
        <h2 className="font-display text-[26px] font-extrabold text-text">Nova senha</h2>
        {metodo === 'senha' ? (
          <>
            <p className="text-[17px] text-textBody">Confirme com a senha da sua conta.</p>
            <input
              type="password"
              autoComplete="current-password"
              aria-label="Senha da conta"
              placeholder="Digite aqui"
              value={senha}
              onChange={(ev) => {
                setSenha(ev.target.value);
                setErro('');
              }}
              className="h-14 rounded-xl border-2 border-border bg-card px-4 text-lg text-text focus:border-primary focus:outline-none"
            />
          </>
        ) : (
          <p className="text-[17px] text-textBody">Confirme entrando de novo com a sua conta do Google.</p>
        )}
        {erro && (
          <p role="alert" className="rounded-xl bg-dangerSoft px-3.5 py-2.5 text-base font-semibold text-dangerText">
            {erro}
          </p>
        )}
      </section>
      <Button type="submit" loading={enviando} className="h-[60px] text-lg">
        Continuar
      </Button>
      <button type="button" onClick={onVoltar} className="tap h-12 text-base font-bold text-textBody">
        Voltar
      </button>
    </form>
  );
}
