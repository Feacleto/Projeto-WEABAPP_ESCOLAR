import { useState } from 'react';
import { ImagePlus, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { completarCadastro } from '../../services/associadoService';
import { lugarDaPosicaoAtual } from '../../services/locationService';
import { uploadMarcaLogo, deleteMarcaLogo } from '../../services/photoService';
import { setMarca } from '../../services/userService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';
import {
  camposQueFaltam,
  passosQueFaltam,
} from '../../dominio/identidade/cadastroDoMotorista.js';

/**
 * PRIMEIRO ACESSO DO MOTORISTA — um card por cima do app.
 *
 * ── POR QUE VIROU CARD (02/10/2026)
 * Era uma tela cheia que substituía o `/tio`: a pessoa criava a conta e, em
 * vez do app, via um formulário de seis campos. Agora o app abre de verdade
 * por baixo (inerte, ver `PrimeiroAcessoGate` no App.jsx) e o card sobe por
 * cima — ela vê o que está liberando.
 *
 * ── ⚠️ O CARD É CURTO DE PROPÓSITO, e o dono pediu assim
 * Título, campos vazios e um botão. Sem placeholder de exemplo (um "Tio
 * Marcos" escrito dentro do campo confundia), sem pré-preencher o nome do
 * Google (ele quase nunca é o do documento), sem "confira se está como no seu
 * documento" (assusta), sem "já temos seu e-mail", sem "fazer depois". Quem
 * chega aqui só quer terminar. A ÚNICA linha de explicação é a da
 * localização, porque é a única pergunta que pede uma permissão do aparelho.
 *
 * ── SÓ O QUE FALTA
 * Os passos vêm de `passosQueFaltam`, congelados na abertura — senão a lista
 * encolheria a cada passo gravado e os pontinhos de progresso andariam para
 * trás. Dentro de cada passo, só os campos vazios aparecem.
 *
 * ── CIDADE PELA LOCALIZAÇÃO
 * O último passo pede a permissão e grava só os NOMES de cidade e bairro
 * (`lugarDaPosicaoAtual` nunca devolve a coordenada). A cidade é contrato,
 * então quem nega — ou quem está sem sinal — digita a cidade. Travar ali sem
 * campo seria prender alguém que o navegador não vai perguntar de novo.
 *
 * ── NENHUMA RULE MUDOU
 * Tudo é `update` do próprio documento, e a política de `users` para o
 * próprio dono é lista de PROIBIDOS. Nenhum campo daqui está nela.
 */
export default function PrimeiroAcesso() {
  const { user, profile, refreshProfile } = useAuth();
  const [passos] = useState(() => passosQueFaltam(profile));
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  const [form, setForm] = useState({ name: '', phone: '', gender: '', marcaNome: '', city: '' });
  const [errors, setErrors] = useState({});
  const [salvando, setSalvando] = useState(false);
  // A localização falhou (negada, sem sinal, sem cidade): aparece o campo.
  const [digitarCidade, setDigitarCidade] = useState(false);

  const [logoURL, setLogoURL] = useState(profile?.marcaLogoURL || null);
  const [subindoLogo, setSubindoLogo] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const faltando = (campo) => camposQueFaltam(profile, passo).includes(campo);

  const gravar = async (dados) => {
    setSalvando(true);
    try {
      await completarCadastro(user.uid, dados, { ultimo });
      if (ultimo) {
        // O card some sozinho quando o perfil volta completo: quem decide é
        // o gate, não esta tela.
        await refreshProfile();
      } else {
        setErrors({});
        setIndice((i) => i + 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const continuar = (e) => {
    e.preventDefault();
    const errs = {};
    if (passo === 'voce') {
      if (faltando('name') && !form.name.trim()) errs.name = 'Escreva seu nome.';
      if (faltando('phone') && !isValidPhone(form.phone)) errs.phone = 'WhatsApp com DDD.';
      if (faltando('gender') && !form.gender) errs.gender = 'Escolha uma opção.';
    }
    if (passo === 'marca' && !form.marcaNome.trim()) {
      errs.marcaNome = 'Escreva como as famílias te chamam.';
    }
    if (passo === 'local' && !form.city.trim()) errs.city = 'Escreva sua cidade.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    gravar({
      ...(passo === 'voce'
        ? { name: form.name, phone: unmaskPhone(form.phone), gender: form.gender }
        : {}),
      ...(passo === 'marca' ? { marcaNome: form.marcaNome } : {}),
      ...(passo === 'local' ? { city: form.city } : {}),
    });
  };

  const permitirLocalizacao = async () => {
    setSalvando(true);
    try {
      const lugar = await lugarDaPosicaoAtual();
      await gravar(lugar);
    } catch (err) {
      setSalvando(false);
      setDigitarCidade(true);
      if (err?.code !== 'negado') {
        toast.error('Não deu pra achar sua cidade. Escreva aqui.');
      }
    }
  };

  /* O logo é gravado na hora, como antes: o arquivo vai pro Storage e volta
   * uma URL, e segurar isso até o "Continuar" esconderia o upload atrás do
   * botão. Ele não trava o passo — exigir um arquivo trava quem está na rua
   * sem imagem pronta. */
  const escolherLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.uid) return;
    setSubindoLogo(true);
    try {
      const url = await uploadMarcaLogo(user.uid, file);
      await setMarca(user.uid, { logoURL: url });
      setLogoURL(url);
    } catch (err) {
      console.error('Upload do logo falhou:', err);
      toast.error('Não deu pra enviar a imagem.');
    } finally {
      setSubindoLogo(false);
    }
  };
  const removerLogo = async () => {
    if (!user?.uid) return;
    setSubindoLogo(true);
    try {
      await deleteMarcaLogo(user.uid);
      await setMarca(user.uid, { logoURL: null });
      setLogoURL(null);
    } catch (err) {
      console.error('Falha ao remover o logo:', err);
      toast.error('Não deu pra remover agora.');
    } finally {
      setSubindoLogo(false);
    }
  };

  if (!passo) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="primeiro-acesso-titulo"
    >
      <form
        onSubmit={continuar}
        className="w-full max-w-[420px] rounded-3xl bg-card p-5 shadow-float"
      >
        {passos.length > 1 && (
          <div className="mb-4 flex gap-1.5" aria-hidden>
            {passos.map((p, i) => (
              <span
                key={p}
                className={`h-1 flex-1 rounded-full ${i <= indice ? 'bg-primary' : 'bg-border'}`}
              />
            ))}
          </div>
        )}

        {passo === 'voce' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Seus dados
            </h2>
            <div className="mt-4 space-y-3">
              {faltando('name') && (
                <Input
                  label="Seu nome completo"
                  value={form.name}
                  onChange={set('name')}
                  error={errors.name}
                  autoComplete="name"
                  required
                />
              )}
              {faltando('phone') && (
                <Input
                  label="WhatsApp"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                  error={errors.phone}
                  autoComplete="tel"
                  required
                />
              )}
              {faltando('gender') && (
                <div>
                  {/* O AVATAR SEGUE ESTA RESPOSTA: homem ganha cabelo curto,
                    * mulher cabelo comprido. Sem ela o desenho era sorteado. */}
                  <p className="mb-2 text-sm font-semibold text-text">Você é</p>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Você é">
                    {[
                      { value: 'male', label: 'Homem' },
                      { value: 'female', label: 'Mulher' },
                    ].map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        role="radio"
                        aria-checked={form.gender === g.value}
                        onClick={() => setForm((p) => ({ ...p, gender: g.value }))}
                        className={`tap min-h-12 rounded-xl border-2 px-2 text-sm font-semibold transition-colors duration-estado ${
                          form.gender === g.value
                            ? 'border-primary bg-primarySoft text-text'
                            : 'border-border bg-card text-textMuted'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p className="mt-1.5 text-xs text-dangerText">{errors.gender}</p>}
                </div>
              )}
            </div>
          </>
        )}

        {passo === 'marca' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Sua marca
            </h2>
            <div className="mt-4 space-y-3">
              <Input
                label="Como as famílias te chamam"
                value={form.marcaNome}
                onChange={set('marcaNome')}
                error={errors.marcaNome}
                required
              />
              {/* Escondido sem Cloud Storage, e não desabilitado — a regra de
                * `capabilities.js`. */}
              {STORAGE_ENABLED && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-text">Logo (opcional)</p>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-sunken px-3 py-2.5">
                    {subindoLogo ? (
                      <Spinner size={22} className="text-primary" />
                    ) : logoURL ? (
                      <img src={logoURL} alt="" className="h-9 w-auto max-w-[96px] shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
                        <ImagePlus size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                      {form.marcaNome.trim()}
                    </span>
                    {logoURL ? (
                      <button
                        type="button"
                        onClick={removerLogo}
                        disabled={subindoLogo}
                        aria-label="Remover o logo"
                        className="tap shrink-0 rounded-lg p-1.5 text-textMuted hover:text-text disabled:opacity-50"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <label className="tap shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary">
                        Escolher imagem
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={subindoLogo}
                          onChange={escolherLogo}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {passo === 'local' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Localização
            </h2>
            {/* A única linha de explicação do card, e ela tem duas metades: para
              * que serve, e que ele desliga quando quiser — a chave existe no
              * início de cada rota (ControleDeRota). */}
            <p className="mt-1.5 text-sm text-textMuted">
              Para as famílias verem a perua chegando. Você desliga no app
              quando quiser.
            </p>
            {digitarCidade && (
              <div className="mt-4">
                <Input
                  label="Sua cidade"
                  value={form.city}
                  onChange={set('city')}
                  error={errors.city}
                  autoComplete="address-level2"
                  required
                />
              </div>
            )}
          </>
        )}

        <div className="mt-5">
          {passo === 'local' && !digitarCidade ? (
            <Button type="button" icon={MapPin} loading={salvando} onClick={permitirLocalizacao}>
              Permitir localização
            </Button>
          ) : (
            <Button type="submit" loading={salvando || subindoLogo}>
              {ultimo ? 'Entrar no app' : 'Continuar'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
