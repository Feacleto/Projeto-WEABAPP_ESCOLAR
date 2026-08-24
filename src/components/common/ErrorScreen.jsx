import { useNavigate } from 'react-router-dom';
import { ArrowLeft, House, RefreshCw } from 'lucide-react';
import Logo from './Logo';
import Button from './Button';
import { APP_VERSION } from '../../version';

/**
 * A TELA QUE APARECE NO LUGAR DA TELA BRANCA.
 *
 * Quando um erro de render escapa, o React desmonta a árvore inteira e o
 * #root fica vazio. Pro responsável isso não lê como "deu erro", lê como
 * "o app sumiu": não há texto, não há botão, não há nem o nome do produto
 * na tela. A única saída é fechar e abrir de novo — e quem está no ponto
 * de ônibus esperando ver onde a perua está simplesmente desiste.
 *
 * Esta tela existe pra garantir três coisas, nessa ordem:
 *   1. o usuário reconhece ONDE está (a marca, em cinza);
 *   2. ele entende que o problema é nosso e não dele;
 *   3. ele tem PARA ONDE IR sem fechar o app.
 *
 * POR QUE O LOGO EM MONO, E NÃO NO VERDE DE SEMPRE
 * O verde da marca é a cor do app funcionando — é o que ele vê no cabeçalho,
 * no botão de confirmar, no status "a caminho". Usar o mesmo verde numa tela
 * de erro mistura os dois sinais. Em `tone="mono"` o desenho é o mesmo, herda
 * a cor do texto ao redor e sai cinza: a marca continua ali dizendo "você
 * está no Alô Buzinou", sem fingir que está tudo bem.
 *
 * ESTA TELA NÃO PODE DEPENDER DE NADA.
 * Nada de useAuth, nada de serviço, nada de dado carregado. Ela é a rede que
 * pega o erro dos outros — inclusive erro que venha do próprio AuthProvider.
 * Por isso "Ir para o início" vai pra `/` e deixa a Home decidir o painel de
 * cada papel, em vez de perguntar o papel aqui.
 */
export default function ErrorScreen({ error, chunk = false }) {
  const navigate = useNavigate();

  // VOLTAR SÓ APARECE SE HOUVER PARA ONDE VOLTAR.
  //
  // Quem abre o app pelo link do WhatsApp cai direto na tela quebrada sem
  // nada atrás: um "Voltar" ali joga ele pra FORA do app — pior que não ter
  // botão nenhum.
  //
  // `history.length` não serve pra decidir isso: ele conta a aba inteira,
  // inclusive as páginas que a pessoa visitou ANTES de chegar no app. O
  // router mantém `history.state.idx`, que é a posição dentro da navegação
  // dele — `idx > 0` quer dizer que existe uma tela NOSSA atrás. O length
  // fica só de reserva, pra quando o state ainda não foi carimbado.
  const idx = typeof window === 'undefined' ? undefined : window.history.state?.idx;
  const temParaOndeVoltar =
    typeof window !== 'undefined' &&
    (typeof idx === 'number' ? idx > 0 : window.history.length > 1);

  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="text-textMuted">
        <Logo variant="stacked" tone="mono" height={88} className="mx-auto" />
      </div>

      <h1 className="mt-8 text-xl font-semibold text-text">
        {chunk ? 'Saiu uma versão nova do app' : 'Alguma coisa não carregou'}
      </h1>

      <p className="mt-2 text-sm text-textMuted max-w-xs leading-relaxed">
        {chunk
          ? 'Esta tela ficou pra trás na versão anterior. Atualize pra continuar de onde parou — nada do que você fez se perdeu.'
          : 'O erro é nosso, não é nada que você tenha feito. Você pode voltar pra tela anterior ou recomeçar do início.'}
      </p>

      <div className="mt-8 w-full max-w-xs flex flex-col gap-3">
        {chunk ? (
          // Num chunk que sumiu, voltar não resolve: a navegação por dentro do
          // app continua pedindo o mesmo arquivo que não existe mais no
          // servidor. Só o recarregamento busca o index.html novo, com os
          // hashes novos. Por isso aqui a ação principal é OUTRA.
          <>
            <Button icon={RefreshCw} onClick={() => window.location.reload()}>
              Atualizar
            </Button>
            <Button
              variant="secondary"
              icon={House}
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Ir para o início
            </Button>
          </>
        ) : (
          <>
            {temParaOndeVoltar && (
              <Button icon={ArrowLeft} onClick={() => navigate(-1)}>
                Voltar
              </Button>
            )}
            <Button
              variant={temParaOndeVoltar ? 'secondary' : 'primary'}
              icon={House}
              onClick={() => navigate('/')}
            >
              Ir para o início
            </Button>
          </>
        )}
      </div>

      {/* Pro suporte. O usuário não vai entender a mensagem, mas consegue
        * LER ela no WhatsApp pra gente — e sem a versão do build a gente
        * fica adivinhando qual código estava no celular dele. */}
      <p className="mt-10 text-[11px] leading-relaxed text-textMuted/70 max-w-xs break-words">
        {error?.message ? `${error.message} · ` : ''}v{APP_VERSION}
      </p>
    </div>
  );
}
