import LegalDocument from './LegalDocument';
import {
  PRIVACY_SECTIONS,
  LEGAL_VERSION,
  LEGAL_DATE,
  COMPANY_INFO,
} from './legalContent';

export default function Privacy() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      version={LEGAL_VERSION}
      date={LEGAL_DATE}
      sections={PRIVACY_SECTIONS}
      headerExtra={
        <p className="text-sm text-textMuted leading-relaxed">
          Conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD —
          Lei nº 13.709/2018). Saiba como o {COMPANY_INFO.name} trata seus
          dados pessoais.
        </p>
      }
    />
  );
}
