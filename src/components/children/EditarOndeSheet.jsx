import { useState } from 'react';
import { Home, MapPin, School, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import Input from '../common/Input';
import MapPicker from '../map/MapPicker';
import { useEscolas } from '../../hooks/useEscolas';
import { updateChild } from '../../services/childrenService';
import { searchAddress } from '../../services/locationService';

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
  const [ponto, setPonto] = useState(
    child?.lat != null && child?.lng != null
      ? { lat: Number(child.lat), lng: Number(child.lng) }
      : null
  );
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [schoolId, setSchoolId] = useState(child?.schoolId || '');

  const buscar = async () => {
    const termo = endereco.trim();
    if (termo.length < 5) {
      toast.error('Escreva a rua e o número pra buscar.');
      return;
    }
    setBuscando(true);
    try {
      const r = await searchAddress(termo);
      if (!r) {
        toast.error('Não achamos esse endereço. Tente com o número e a cidade.');
        return;
      }
      setEndereco(r.displayName || termo);
      setPonto({ lat: r.lat, lng: r.lng });
    } catch {
      toast.error('A busca falhou. Tente de novo.');
    } finally {
      setBuscando(false);
    }
  };

  const salvar = async () => {
    if (!child?.id) return;
    setSalvando(true);
    try {
      const dados = { address: endereco.trim() };
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
          <Input
            id="editar-endereco"
            placeholder="Rua, número, bairro, cidade"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
          />
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
