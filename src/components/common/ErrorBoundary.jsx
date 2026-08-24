import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorScreen from './ErrorScreen';

/**
 * A REDE QUE IMPEDE A TELA BRANCA.
 *
 * Sem um boundary, um erro de render em QUALQUER uma das telas desmonta a
 * árvore inteira: o React limpa o #root e vai embora. O usuário não recebe
 * mensagem nenhuma, e a gente não recebe nem o log — o erro morre no console
 * de um celular que a gente nunca vai abrir.
 *
 * DOIS ERROS DIFERENTES CAEM AQUI, E SÓ UM DELES SE RESOLVE VOLTANDO.
 *
 * O primeiro é o erro de render comum: um campo que veio undefined, um .map
 * em algo que não é lista. É local àquela tela — sair dela resolve.
 *
 * O segundo é o chunk que sumiu. O App carrega quase tudo com lazy(), e o PWA
 * está em registerType 'autoUpdate': quem estava com o app ABERTO durante um
 * deploy fica com um index.html que aponta pra arquivos com hash antigo. Na
 * próxima navegação o import() toma 404, rejeita dentro do <Suspense> e a tela
 * apaga. Esse é o mais comum em produção e o que a gente nunca vê no dev,
 * porque em desenvolvimento não existe deploy no meio da sessão. Aqui ele
 * ganha texto próprio e botão de Atualizar, porque navegar por dentro do app
 * continuaria pedindo o mesmo arquivo que não existe mais.
 *
 * ONDE FICA
 * Em dois lugares, de propósito: em volta do <App/> no main.jsx (pega até
 * erro do AuthProvider) e em volta das <Routes> no App.jsx (pega o erro de
 * tela, mais perto de onde ele nasce). O de fora só entra em ação quando o
 * de dentro não existe mais.
 *
 * O QUE ELE NÃO PEGA
 * Erro em handler de clique e Promise rejeitada solta — o React não roteia
 * esses pro boundary. Também não apagam a tela, então não são o caso aqui.
 */

// A mensagem varia por navegador (o Chrome fala 'Failed to fetch dynamically
// imported module', o Firefox 'error loading', o Safari 'Importing a module
// script failed'), e o Vite ainda marca o erro com name 'ChunkLoadError' em
// parte dos casos. Testar os quatro é mais barato que errar o texto da tela.
const CHUNK_SUMIU =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;

function ehChunkQueSumiu(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  return CHUNK_SUMIU.test(error.message || '');
}

class Boundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Sem isto o erro fica só no state e some do console em produção — e o
    // componentStack é a única pista de QUAL tela quebrou.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // SEM ISTO OS BOTÕES SÃO ENFEITE.
    //
    // Boundary do React não se cura sozinho: uma vez com erro no state, ele
    // renderiza o fallback pra sempre. O "Voltar" mudaria a URL e a tela de
    // erro continuaria na frente — o usuário clicaria e nada aconteceria,
    // que é pior do que não ter botão.
    //
    // Comparar por `location.key` e não pelo objeto: o router dá uma chave
    // nova a cada entrada do histórico, então isto cobre tanto o navigate('/')
    // (empilha) quanto o navigate(-1) (volta pra chave antiga). Se a tela
    // nova quebrar também, o erro é capturado de novo — não há laço, porque
    // só uma mudança de rota limpa o state.
    if (this.state.error && prevProps.location?.key !== this.props.location?.key) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return <ErrorScreen error={error} chunk={ehChunkQueSumiu(error)} />;
    }
    return this.props.children;
  }
}

/**
 * O boundary tem que ser classe (só classe recebe o erro), mas precisa saber
 * a rota atual pra se destravar. Esta casca lê a rota com hook e passa como
 * prop — é o jeito de ter as duas coisas sem reescrever o boundary em cima de
 * uma lib.
 *
 * Precisa estar DENTRO do <BrowserRouter>.
 */
export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return <Boundary location={location}>{children}</Boundary>;
}
