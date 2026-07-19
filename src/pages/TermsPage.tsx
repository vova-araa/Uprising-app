import { useI18n } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsPage = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-full px-5 pt-6 pb-10 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-4 active:scale-95 transition-transform">
        <ArrowLeft size={18} />
        <span className="text-sm">{lang === "nl" ? "Terug" : "Back"}</span>
      </button>

      <h1 className="text-2xl font-bold font-display mb-6">{t("terms")}</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
        {lang === "nl" ? (
          <>
            <p className="text-foreground font-medium">Laatst bijgewerkt: 20 april 2026</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">1. Algemeen</h2>
            <p>Deze algemene voorwaarden zijn van toepassing op alle diensten van Uprising Studio, gevestigd aan de Spaceshuttle 6e, Amersfoort. Door gebruik te maken van onze diensten ga je akkoord met deze voorwaarden.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">2. Boekingen</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Boekingen zijn persoonlijk en niet overdraagbaar</li>
              <li>Annulering is kosteloos mogelijk tot 24 uur voor aanvang van de sessie</li>
              <li>Bij annulering binnen 24 uur wordt het volledige bedrag in rekening gebracht</li>
              <li>Uprising Studio behoudt het recht om boekingen te weigeren of te annuleren</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">3. Lidmaatschappen</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lidmaatschappen hebben een minimale looptijd van 3 maanden</li>
              <li>Opzegging dient schriftelijk te gebeuren met inachtneming van 1 maand opzegtermijn</li>
              <li>Niet-gebruikte uren worden niet overgedragen naar de volgende maand</li>
              <li>Tarieven kunnen worden aangepast met een kennisgeving van 30 dagen</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">4. Gebruik van de studio</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gebruikers dienen zorgvuldig om te gaan met alle apparatuur en faciliteiten</li>
              <li>Schade aan apparatuur door nalatigheid wordt op de gebruiker verhaald</li>
              <li>Roken, drugs en overmatig alcoholgebruik zijn niet toegestaan in de studio</li>
              <li>De studio dient na gebruik netjes te worden achtergelaten</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">5. Betalingen</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Betalingen worden verwerkt via Stripe (iDEAL, creditcard, Apple Pay, Google Pay, Klarna)</li>
              <li>Facturen worden digitaal beschikbaar gesteld via je account</li>
              <li>Bij niet-tijdige betaling behouden wij het recht om toegang te weigeren</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">6. Intellectueel eigendom</h2>
            <p>Alle rechten op muziek en content die in onze studio's worden geproduceerd, blijven eigendom van de maker, tenzij schriftelijk anders overeengekomen.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">7. Aansprakelijkheid</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Uprising Studio is niet aansprakelijk voor verlies of diefstal van persoonlijke eigendommen</li>
              <li>De aansprakelijkheid is beperkt tot het bedrag van de betreffende boeking</li>
              <li>Uprising Studio is niet aansprakelijk voor technische storingen buiten onze controle</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">8. Huisregels</h2>
            <p>Gebruikers dienen zich te houden aan de huisregels van Uprising Studio. Bij herhaaldelijke overtredingen kan de toegang worden ontzegd.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">9. Wijzigingen</h2>
            <p>Uprising Studio behoudt het recht om deze voorwaarden te wijzigen. Wijzigingen worden via de app gecommuniceerd.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">10. Contact</h2>
            <p>Voor vragen over deze voorwaarden kun je contact opnemen via <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>
          </>
        ) : (
          <>
            <p className="text-foreground font-medium">Last updated: April 20, 2026</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">1. General</h2>
            <p>These terms and conditions apply to all services of Uprising Studio, located at Spaceshuttle 6e, Amersfoort, The Netherlands. By using our services, you agree to these terms.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">2. Bookings</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bookings are personal and non-transferable</li>
              <li>Free cancellation is possible up to 24 hours before the session</li>
              <li>Cancellations within 24 hours will be charged in full</li>
              <li>Uprising Studio reserves the right to refuse or cancel bookings</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">3. Memberships</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Memberships have a minimum term of 3 months</li>
              <li>Cancellation must be submitted in writing with 1 month notice</li>
              <li>Unused hours do not carry over to the next month</li>
              <li>Rates may be adjusted with 30 days notice</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">4. Studio usage</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Users must handle all equipment and facilities with care</li>
              <li>Damage to equipment due to negligence will be charged to the user</li>
              <li>Smoking, drugs and excessive alcohol use are not permitted in the studio</li>
              <li>The studio must be left clean after use</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">5. Payments</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Payments are processed via Stripe (iDEAL, credit card, Apple Pay, Google Pay, Klarna)</li>
              <li>Invoices are made available digitally through your account</li>
              <li>We reserve the right to deny access in case of non-payment</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">6. Intellectual property</h2>
            <p>All rights to music and content produced in our studios remain the property of the creator, unless otherwise agreed in writing.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">7. Liability</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Uprising Studio is not liable for loss or theft of personal belongings</li>
              <li>Liability is limited to the amount of the relevant booking</li>
              <li>Uprising Studio is not liable for technical failures beyond our control</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">8. House rules</h2>
            <p>Users must comply with the house rules of Uprising Studio. Repeated violations may result in denied access.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">9. Changes</h2>
            <p>Uprising Studio reserves the right to modify these terms. Changes will be communicated through the app.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">10. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default TermsPage;
