import { useState } from 'react';
import { Home, MapPin, School, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import MapPicker from '../map/MapPicker';
import { useEscolas } from '../../hooks/useEscolas';
import { updateChild } from '../../services/childrenService';
import { searchAddress, buscarCep } from '../../services/locationService';
import { maskCep, unmaskCep, isValidCep } from '../../compartilhado/masks';
import { montarEndereco } from '../../compartilhado/formatters';

/**
 * EDITAR ONDE A CRIANÇA MORA E ONDE ESTUDA — sem desencontrar do mapa.
 *
 * POR QUE ISTO NÃO EXISTIA, E POR QUE FALTAVA
 * O endereço só era escrito no cadastro. Depois disso não havia caminho
 * nenhum: família que muda de casa — o que acontece o tempo todo — obrigava o
 * motorista a apagar a criança e refazer tudo, perdendo o vínculo com o
 * responsável e o histórico de pagamento junto.
 *
 * O CAMPO DE TEXTO SOZINHO SERIA PIOR QUE NADA
 * A criança guarda `address` E `lat`/`lng`, e quem usa a coordenada é a rota
 * no mapa. Um editor que trocasse só o texto deixaria a ficha dizendo a rua
 * nova enquanto a perua continuaria indo pra antiga — e ninguém desconfia de
 * um endereço que está escrito certo. Por isso aqui a busca é obrigatória
 * para mudar de lugar: o texto e o ponto viajam sempre juntos.
 *
 * O CEP ENTROU AQUI PELO MESMO MOTIVO QUE ENTROU NO CADASTRO: o número.
 * Mudança de casa é reescrita à mão num campo livre, e o número é o pedaço que
 * se perde na pressa — sem ele o Nominatim devolve o meio da RUA, e a tela
 * mostra um pino que parece certo. Com o CEP preenchendo rua, bairro e cidade,
 * o número fica sozinho num campo próprio e não passa em branco.
 *
 * A ESCOLA É ESCOLHIDA DA LISTA, e não digitada, pelo mesmo motivo. As
 * escolas do motorista já têm endereço e coordenada conferidos; deixar
 * digitar livre criaria uma segunda escola com o mesmo nome e ponto nenhum.
 * Nome, endereço e coordenada são COPIADOS pra dentro da criança — como no
 * cadastro —, porque escola apagada por engano não pode apagar o destino de
 * entrega de ninguém no meio da rota.
 */
export default function EditarOndeSheet({ open, child, onClose }) {
  const { escolas } = useEscolas();

  const [endereco, setEndereco] = useState(child?.address || '');
  const [cep, setCep] = useState(maskCep(child?.cep || ''));
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  // O que o ViaCEP devolveu. `null` = o endereço é digitado à mão, e nada o
  // reescreve — a mesma regra do cadastro (`Step2Home` no ChildForm).
  const [cepPartes, setCepPartes] = useState(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  // null = nunca consultou · 'ok' · 'notFound' · 'offline'
  const [cepState, setCepState] = useState(null);
  const [cepConsultado, setCepConsultado] = useState('');
  const [ponto, setPonto] = useState(
    child?.lat != null && child?.lng != null
      ? { lat: Number(child.lat), lng: Number(child.lng) }
      : null
  );
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [schoolId, setSchoolId] = useState(child?.schoolId || '');

  const remontar = (partes, num, compl) =>
    montarEndereco({ ...partes, numero: num, complemento: compl });

  const consultarCep = async (digitos) => {
    setBuscandoCep(true);
    setCepConsultado(digitos);
    setCepState(null);
    try {
      const partes = await buscarCep(digitos);
      setCepPartes(partes);
      setEndereco(remontar(partes, numero, complemento));
      // ENDEREÇO NOVO ZERA O PONTO VELHO. É a razão de esta folha existir: o
      // texto e a coordenada não podem se separar, e um pino do endereço
      // ANTERIOR sob uma rua nova é justamente o desencontro que o cabeçalho
      // deste arquivo descreve.
      setPonto(null);
      setCepState('ok');
    } catch (err) {
      setCepState(/consultar/.test(err?.message || '') ? 'offline' : 'notFound');
    } finally {
      setBuscandoCep(false);
    }
  };

  // Consulta sozinha no oitavo dígito — CEP tem tamanho fixo, então dá pra
  // saber que a pessoa terminou sem precisar de botão. `cepConsultado` evita
  // uma requisição por tecla depois disso.
  const onCepChange = (e) => {
    const valor = maskCep(e.target.value);
    setCep(valor);
    const digitos = unmaskCep(valor);
    if (digitos.length < 8) {
      setCepState(null);
      setCepConsultado('');
      return;
    }
    if (!isValidCep(valor) || digitos === cepConsultado) return;
    consultarCep(digitos);
  };

  const setNumeroDoEndereco = (valor) => {
    setNumero(valor);
    if (cepPartes) setEndereco(remontar(cepPartes, valor, complemento));
  };

  const setComplementoDoEndereco = (valor) => {
    setComplemento(valor);
    if (cepPartes) setEndereco(remontar(cepPartes, numero, valor));
  };

  // Digitar no campo livre torna a pessoa dona do texto: as partes do CEP são
  // soltas e a remontagem para de acontecer.
  const onEnderecoDigitado = (valor) => {
    setEndereco(valor);
    setCepPartes(null);
  };

  const buscar = async () => {
    const termo = endereco.trim();
    if (termo.length < 5) {
      toast.error('Escreva a rua e o número pra buscar.');
      return;
    }
    setBuscando(true);
    try {
      // Com as partes do CEP, a consulta vai montada (número na frente, sem o
      // complemento) — ver `consultaDoEndereco` no locationService.
      const r = await searchAddress(
        termo,
        cepPartes ? { ...cepPartes, numero } : null
      );
      if (!r) {
        toast.error('Não achamos esse endereço. Tente com o número e a cidade.');
        return;
      }
      // Vindo do CEP o texto NÃO é trocado pelo `display_name`: ele é verboso e
      // costuma perder o número, que é o dado que o campo próprio acabou de
      // garantir.
      if (!cepPartes) setEndereco(r.displayName || termo);
      setPonto({ lat: r.lat, lng: r.lng });
    } catch {
      toast.error('A busca falhou. Tente de novo.');
    } finally {
      setBuscando(false);
    }
  };

  const salvar = async () => {
    if (!child?.id) return;
    // Quem usou o CEP tem a rua preenchida e o número num campo próprio —
    // então salvar sem ele é salvar uma rua sem casa. Quem digitou tudo à mão
    // não passa por aqui: o número dele está dentro do texto.
    if (cepPartes && !numero.trim()) {
      toast.error('Falta o número da casa.');
      return;
    }
    setSalvando(true);
    try {
      const dados = { address: endereco.trim() };
      // O CEP é a CHAVE do endereço, não um pedaço dele: guardado, permite
      // reconsultar a rua e recalcular a coordenada depois. Só escreve quando
      // há um — `''` por cima de um CEP válido seria perder dado numa edição
      // que nem tocou nele.
      if (unmaskCep(cep)) dados.cep = maskCep(cep);
      // A coordenada só entra se existir. Gravar `null` por cima de um ponto
      // válido tiraria a criança do mapa pra "salvar" uma correção de texto.
      if (ponto) {
        dados.lat = ponto.lat;
        dados.lng = ponto.lng;
      }

      const escola = escolas.find((e) => e.id === schoolId);
      if (escola) {
        dados.schoolId = escola.id;
        dados.school = escola.nome || '';
        dados.schoolAddress = escola.endereco || '';
        dados.schoolLat = escola.lat ?? null;
        dados.schoolLng = escola.lng ?? null;
      }

      await updateChild(child.id, dados);
      toast.success('Pronto.');
      onClose?.();
    } catch (err) {
      console.error('Falha ao salvar onde:', err);
      toast.error('Não deu pra salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet
      open={open}
      onClose={salvando ? () => {} : onClose}
      title="Onde pegar e entregar"
      icon={MapPin}
      size="full"
    >
      <div className="space-y-5 px-5 pb-6">
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Home size={16} className="text-primary" />
            Endereço de casa
          </h3>
          {/* O CEP É ATALHO, NUNCA REQUISITO — quem não tem digita tudo no
            * campo de baixo, como antes. */}
          <Input
            id="editar-cep"
            label="CEP"
            placeholder="00000-000"
            value={cep}
            onChange={onCepChange}
            inputMode="numeric"
            maxLength={9}
            hint="Opcional — preenche a rua sozinho."
          />

          {buscandoCep && (
            <p className="text-[11px] text-textMuted">Consultando o CEP…</p>
          )}

          {/* "Não achamos" e "está fora do ar" dizem coisas diferentes: a
            * primeira pede pra reconferir, a segunda avisa que não é ela. */}
          {cepState === 'notFound' && (
            <p className="rounded-xl bg-warningSoft px-3 py-2 text-[11px] leading-relaxed text-warningText">
              Não achamos esse CEP. Confira os números — ou escreva o endereço
              completo abaixo.
            </p>
          )}

          {cepState === 'offline' && (
            <p className="rounded-xl bg-warningSoft px-3 py-2 text-[11px] leading-relaxed text-warningText">
              A consulta de CEP está fora do ar. Escreva o endereço completo
              abaixo.
            </p>
          )}

          <Input
            id="editar-endereco"
            label="Endereço completo"
            placeholder="Rua, número, bairro, cidade"
            value={endereco}
            onChange={(e) => onEnderecoDigitado(e.target.value)}
            hint={
              cepPartes
                ? 'Preenchido pelo CEP. Se editar aqui, o texto passa a ser seu.'
                : undefined
            }
          />

          {/* Número e complemento só existem depois do CEP: sem a rua
            * preenchida, "123" sozinho não é endereço. */}
          {cepPartes?.logradouro && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="editar-numero"
                label="Número"
                placeholder="123"
                value={numero}
                onChange={(e) => setNumeroDoEndereco(e.target.value)}
                inputMode="numeric"
                required
              />
              <Input
                id="editar-complemento"
                label="Complemento"
                placeholder="apto 42"
                value={complemento}
                onChange={(e) => setComplementoDoEndereco(e.target.value)}
              />
            </div>
          )}

          <Button
            variant="secondary"
            size="md"
            icon={Search}
            loading={buscando}
            onClick={buscar}
          >
            Buscar no mapa
          </Button>

          {ponto ? (
            <>
              <MapPicker point={ponto} onChange={setPonto} />
              <p className="text-[11px] leading-relaxed text-textMuted">
                Arraste o pino se a porta ficar do outro lado da rua — é este
                ponto que a rota usa.
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-warningSoft px-3 py-2 text-[11px] leading-relaxed text-warningText">
              Sem ponto no mapa esta criança não entra no traçado da rota.
              Busque o endereço pra marcar.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <School size={16} className="text-primary" />
            Escola
          </h3>
          {escolas.length === 0 ? (
            <p className="text-xs leading-relaxed text-textMuted">
              Você ainda não cadastrou escolas. Cadastre em Início → Escolas e
              volte aqui.
            </p>
          ) : (
            <div className="space-y-1.5">
              {escolas.map((e) => {
                const ativa = schoolId === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSchoolId(e.id)}
                    className={`tap w-full rounded-xl border px-3 py-2.5 text-left ${
                      ativa
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-text">
                      {e.nome}
                    </span>
                    {e.endereco && (
                      <span className="mt-0.5 block truncate text-[11px] text-textMuted">
                        {e.endereco}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Button loading={salvando} onClick={salvar}>
          Salvar
        </Button>
      </div>
    </AppSheet>
  );
}
