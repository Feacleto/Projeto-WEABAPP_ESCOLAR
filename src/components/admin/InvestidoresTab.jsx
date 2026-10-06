import { useEffect, useState } from 'react';
import { ExternalLink, Mail, MessageCircle, TrendingUp } from 'lucide-react';
import Spinner from '../common/Spinner';
import { watchLeadsInvestidor } from '../../services/leadsInvestidorService';
import { formatPhone } from '../../compartilhado/formatters';

/**
 * INVESTIDORES — quem pediu o material pelo site (02/10/2026).
 *
 * A página alobuzinou.com.br/investidores capta o contato (nome, e-mail,
 * WhatsApp opcional), e o dono recebe um aviso no sino a cada um. Aqui fica a
 * lista, do mais novo para o mais antigo, com um toque para responder — e-mail
 * ou WhatsApp. Ninguém precisa copiar endereço de um lugar para outro.
 *
 * ── MANDAR O DECK (05/10/2026, pedido do dono: "algo simples")
 * O botão abre o programa de e-mail DO DONO com o endereço, o assunto e o texto
 * já escritos; ele anexa o PDF do deck e manda. Foi a escolha simples de
 * propósito: anexar pelo servidor pediria guardar o deck no Storage, uma
 * função nova e o domínio verificado no Resend (no sandbox, o e-mail só chega
 * à caixa do próprio dono). O link do deck também não pode morar em
 * `platformConfig`, que qualquer pessoa lê.
 */
const ASSUNTO_DO_DECK = 'Alô Buzinou — o deck que você pediu';

function textoDoDeck(nome) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return [
    `Olá${primeiro ? `, ${primeiro}` : ''}!`,
    '',
    'Obrigado pelo interesse no Alô Buzinou. Segue em anexo o nosso deck, com o modelo, ' +
      'os números da base e o que ainda estamos provando.',
    '',
    'Se quiser conversar, é só responder este e-mail.',
    '',
    'Abraço,',
  ].join('\n');
}

export default function InvestidoresTab() {
  const [leads, setLeads] = useState(null);
  useEffect(() => watchLeadsInvestidor(setLeads), []);

  if (!leads) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <TrendingUp className="mx-auto text-textMuted" size={28} />
        <p className="mt-3 font-semibold text-text">Nenhum investidor deixou contato ainda</p>
        <p className="mt-1 text-sm text-textMuted">
          Quem preencher o formulário de alobuzinou.com.br/investidores aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-textMuted">
        {leads.length} {leads.length === 1 ? 'contato' : 'contatos'} pelo site, do mais novo para o mais antigo.
      </p>
      <p className="rounded-xl border border-border bg-sunken p-3 text-xs leading-relaxed text-textMuted">
        "Mandar o deck" abre o seu e-mail com o texto pronto. <strong>Anexe o PDF do deck</strong>{' '}
        antes de enviar. O relatório acima também vira PDF em "Baixar PDF", se quiser mandar junto.
      </p>
      {leads.map((l) => {
        const quando = l.criadoEm?.toDate ? l.criadoEm.toDate().toLocaleDateString('pt-BR') : '';
        return (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold text-text">{l.nome}</p>
              <p className="text-xs text-textMuted">{quando}</p>
            </div>
            <p className="mt-0.5 break-all text-sm text-textMuted">
              {[l.email, l.whatsapp && formatPhone(l.whatsapp)].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`mailto:${l.email}?subject=${encodeURIComponent(ASSUNTO_DO_DECK)}&body=${encodeURIComponent(textoDoDeck(l.nome))}`}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white"
              >
                <Mail size={15} /> Mandar o deck por e-mail
              </a>
              {l.linkedin && (
                <a
                  href={l.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="tap inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold text-text"
                >
                  <ExternalLink size={15} /> LinkedIn
                </a>
              )}
              {l.whatsapp && (
                <a
                  href={`https://wa.me/55${l.whatsapp.replace(/^55/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tap inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-semibold text-text"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
