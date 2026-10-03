import { useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { useActiveChild } from '../../hooks/useActiveChild';
import { updateChild } from '../../services/childrenService';
import { searchAddress } from '../../services/locationService';
import { notifyNumeroDaCasa } from '../../services/notificationsService';
import { montarEndereco } from '../../compartilhado/formatters';
import { salvarPrimeiroAcessoDoResponsavel } from '../../services/userService';
import { enablePush, permissionState } from '../../services/pushService';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';
import {
  passosDoResponsavel,
  camposDoResponsavelQueFaltam,
} from '../../dominio/identidade/cadastroDoResponsavel.js';

/**
 * PRIMEIRO ACESSO DO RESPONSÁVEL — um card por cima do app (02/10/2026).
 *
 * O mesmo desenho do motorista (`pages/tio/PrimeiroAcesso.jsx`), pedido pelo
 * dono: o `/pai` abre de verdade por baixo, inerte, e o card pergunta só o
 * que falta, em até três passos — seus dados, o aniversário do filho e a
 * permissão de avisos. Título, campos vazios e um botão; a única linha de
 * explicação é a dos avisos, porque é a única que pede algo do aparelho.
 *
 * Quem decide os passos é `passosDoResponsavel`, pura. Eles são congelados
 * na abertura, como no motorista, para os pontinhos não andarem para trás.
 */
export default function PrimeiroAcessoDoPai() {
  const { user, profile, refreshProfile } = useAuth();
  const { child } = useActiveChild();
  const [passos] = useState(() =>
    passosDoResponsavel({ profile, child, permissao: permissionState() })
  );
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    numero: '',
    complemento: '',
    birthDate: '',
    turma: '',
    sala: '',
  });
  const [errors, setErrors] = useState({});
  const [salvando, setSalvando] = useState(false);

  const faltam = camposDoResponsavelQueFaltam(profile);
  const nome = String(child?.name || '').trim().split(/\s+/)[0] || 'seu filho';
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const seguir = async (gravar) => {
    setSalvando(true);
    try {
      await gravar();
      if (ultimo) await refreshProfile();
      else {
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
      if (faltam.includes('name') && !form.name.trim()) errs.name = 'Escreva seu nome.';
      if (faltam.includes('phone') && !isValidPhone(form.phone)) errs.phone = 'WhatsApp com DDD.';
    }
    if (passo === 'casa' && !form.numero.trim()) errs.numero = 'Escreva o número.';
    if (passo === 'filho' && !form.birthDate) errs.birthDate = 'Escolha a data.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (passo === 'voce') {
      seguir(() =>
        salvarPrimeiroAcessoDoResponsavel(user.uid, {
          name: form.name,
          phone: unmaskPhone(form.phone),
        })
      );
    }
    if (passo === 'casa') {
      // A rua veio do cadastro do motorista; ela só acrescenta o número. O
      // ponto no mapa é refeito com ele — sem achar, fica o do meio da rua.
      seguir(async () => {
        const partes = { ...(child.enderecoPartes || {}), numero: form.numero.trim(), complemento: form.complemento.trim() };
        const address = montarEndereco(partes);
        let coord = {};
        try {
          const r = await searchAddress(address, partes);
          coord = { lat: r.lat, lng: r.lng, geoPending: false };
        } catch {
          // mantém o ponto que havia
        }
        await updateChild(child.id, {
          address,
          ...coord,
          numeroPendente: false,
          enderecoPartes: null,
        });
        await notifyNumeroDaCasa({ adminUid: child.adminUid, childName: child.name, endereco: address });
      });
    }
    if (passo === 'filho') {
      // Só o que veio preenchido: as rules liberam a ela exatamente estes
      // três campos da criança, e string vazia apagaria o que já houvesse.
      seguir(() =>
        updateChild(child.id, {
          birthDate: form.birthDate,
          ...(form.turma.trim() ? { turma: form.turma.trim() } : {}),
          ...(form.sala.trim() ? { sala: form.sala.trim() } : {}),
        })
      );
    }
  };

  // A permissão é pedida e a resposta não importa: negar não prende ninguém.
  // O carimbo é o que impede o passo de voltar.
  const permitirAvisos = () =>
    seguir(async () => {
      await enablePush(user.uid).catch(() => null);
      await salvarPrimeiroAcessoDoResponsavel(user.uid, { avisosPerguntados: true });
    });

  if (!passo) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="primeiro-acesso-pai-titulo"
    >
      <form onSubmit={continuar} className="w-full max-w-[420px] rounded-3xl bg-card p-5 shadow-float">
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
            <h2 id="primeiro-acesso-pai-titulo" className="text-xl font-extrabold text-text">
              Seus dados
            </h2>
            <div className="mt-4 space-y-3">
              {faltam.includes('name') && (
                <Input
                  label="Seu nome completo"
                  value={form.name}
                  onChange={set('name')}
                  error={errors.name}
                  autoComplete="name"
                  required
                />
              )}
              {faltam.includes('phone') && (
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
            </div>
          </>
        )}

        {passo === 'casa' && (
          <>
            <h2 id="primeiro-acesso-pai-titulo" className="text-xl font-extrabold text-text">
              Número da sua casa
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-sunken px-3.5 py-3">
              <p className="text-sm font-semibold text-text">
                {child?.enderecoPartes?.logradouro || child?.address}
              </p>
              <p className="text-xs text-textMuted">
                {[child?.enderecoPartes?.bairro, child?.enderecoPartes?.localidade]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input
                label="Número"
                inputMode="numeric"
                value={form.numero}
                onChange={set('numero')}
                error={errors.numero}
                required
              />
              <Input label="Complemento" value={form.complemento} onChange={set('complemento')} />
            </div>
            <p className="mt-2 text-xs text-textMuted">
              Não é a sua rua? Fale com o motorista.
            </p>
          </>
        )}

        {passo === 'filho' && (
          <>
            <h2 id="primeiro-acesso-pai-titulo" className="text-xl font-extrabold text-text">
              Sobre {nome}
            </h2>
            <div className="mt-4 space-y-3">
              <Input
                label="Aniversário"
                type="date"
                value={form.birthDate}
                onChange={set('birthDate')}
                error={errors.birthDate}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Turma (opcional)" value={form.turma} onChange={set('turma')} />
                <Input label="Sala (opcional)" value={form.sala} onChange={set('sala')} />
              </div>
            </div>
          </>
        )}

        {passo === 'avisos' && (
          <>
            <h2 id="primeiro-acesso-pai-titulo" className="text-xl font-extrabold text-text">
              Avisos
            </h2>
            {/* A única linha de explicação do card: para que serve, e que dá
              * para desligar. */}
            <p className="mt-1.5 text-sm text-textMuted">
              Para saber quando a perua está chegando. Você desliga quando
              quiser.
            </p>
          </>
        )}

        <div className="mt-5">
          {passo === 'avisos' ? (
            <Button type="button" icon={Bell} loading={salvando} onClick={permitirAvisos}>
              Permitir avisos
            </Button>
          ) : (
            <Button type="submit" loading={salvando}>
              {ultimo ? 'Entrar no app' : 'Continuar'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
