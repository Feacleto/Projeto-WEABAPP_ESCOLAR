import { useCallback, useRef, useState } from 'react';
import { Key } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import PixForm from './PixForm';
import { useAuth } from '../../hooks/useAuth';

/**
 * "QUER CADASTRAR SUA CHAVE PIX?" — a pergunta no MOMENTO DO USO (02/10/2026).
 *
 * A chave só era pedida em três lugares que ele precisava ir procurar (perfil,
 * banner e bloco de pendências do financeiro). Quem nunca abria o financeiro
 * cobrava a família pelo WhatsApp sem chave nenhuma na mensagem, e a família
 * não tinha pra onde mandar o dinheiro.
 *
 * Agora a pergunta aparece onde a falta da chave COMEÇA a custar: ao cobrar
 * pelo WhatsApp, ao combinar uma mensalidade no cadastro da criança e ao gerar
 * as cobranças do mês. "Sim" abre o formulário ali mesmo — que, sem chave,
 * começa perguntando se o celular dele é a chave. "Agora não" segue o que ele
 * ia fazer.
 *
 * ⚠️ "AGORA NÃO" VALE ATÉ ELE FECHAR O APP, por motivo. Tem motorista que
 * prefere receber em dinheiro; perguntar a cada cobrança viraria um pedágio
 * que ele aprende a pular sem ler. Uma vez por sessão, por motivo.
 *
 * Uso:
 *   const { perguntarPix, folhaDoPix } = usePerguntaDaChavePix();
 *   perguntarPix({ motivo: 'cobrar', texto: '…', depois: () => enviar() });
 *   …
 *   {folhaDoPix}
 */

const CHAVE_DA_SESSAO = 'alobuzinou:pix-agora-nao';

function jaDisseAgoraNao(motivo) {
  try {
    return (sessionStorage.getItem(CHAVE_DA_SESSAO) || '').split(',').includes(motivo);
  } catch {
    return false;
  }
}

function lembrarAgoraNao(motivo) {
  try {
    const atuais = (sessionStorage.getItem(CHAVE_DA_SESSAO) || '').split(',').filter(Boolean);
    if (!atuais.includes(motivo)) atuais.push(motivo);
    sessionStorage.setItem(CHAVE_DA_SESSAO, atuais.join(','));
  } catch {
    /* sem armazenamento: pergunta de novo da próxima vez, e tudo bem */
  }
}

export function usePerguntaDaChavePix() {
  const { profile } = useAuth();
  const [pedido, setPedido] = useState(null); // { motivo, texto }
  const [preenchendo, setPreenchendo] = useState(false);
  // A chave que acabou de ser salva. Entre salvar e seguir há um toque de
  // propósito ("Continuar"): seguir pode abrir o WhatsApp, e o navegador
  // bloqueia janela aberta depois de um `await` — só deixa a que nasce de um
  // toque.
  const [salva, setSalva] = useState(null);
  const depoisRef = useRef(null);

  /**
   * Garante a chave antes de seguir. Com chave, ou já tendo ouvido "agora não"
   * nesta sessão, segue direto. Sem chave, pergunta — e segue depois de ele
   * responder, qualquer que seja a resposta.
   */
  const perguntarPix = useCallback(
    ({ motivo, texto, depois }) => {
      if (profile?.pixKey || jaDisseAgoraNao(motivo)) {
        depois?.();
        return;
      }
      depoisRef.current = depois || null;
      setPreenchendo(false);
      setSalva(null);
      setPedido({ motivo, texto });
    },
    [profile?.pixKey]
  );

  /** `chave` é o que o PixForm acabou de salvar — `null` em "agora não". */
  const seguir = (chave = null) => {
    const depois = depoisRef.current;
    depoisRef.current = null;
    setPedido(null);
    setPreenchendo(false);
    setSalva(null);
    depois?.(chave);
  };

  const agoraNao = () => {
    if (pedido?.motivo) lembrarAgoraNao(pedido.motivo);
    seguir(null);
  };

  const folhaDoPix = (
    <AppSheet
      open={!!pedido}
      // Fechar depois de salvar segue COM a chave; antes, é um "agora não".
      onClose={salva ? () => seguir(salva) : agoraNao}
      title={salva ? 'Chave salva' : preenchendo ? 'Chave PIX' : 'Quer cadastrar sua chave PIX?'}
      subtitle={
        preenchendo && !salva
          ? 'É a chave que as famílias copiam com um toque pra pagar a mensalidade.'
          : null
      }
      icon={Key}
    >
      {salva ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text">
            Pronto. A partir de agora a sua chave vai junto em toda cobrança.
          </p>
          <Button onClick={() => seguir(salva)}>Continuar</Button>
        </div>
      ) : preenchendo ? (
        <PixForm onDone={(chave) => setSalva(chave || { pixKey: profile?.pixKey })} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text">{pedido?.texto}</p>
          <p className="text-xs leading-relaxed text-textMuted">
            Leva um minuto, e depois a chave vai sozinha em toda cobrança.
          </p>
          <Button onClick={() => setPreenchendo(true)}>Sim, cadastrar agora</Button>
          <Button variant="secondary" onClick={agoraNao}>
            Agora não
          </Button>
        </div>
      )}
    </AppSheet>
  );

  return { perguntarPix, folhaDoPix };
}
