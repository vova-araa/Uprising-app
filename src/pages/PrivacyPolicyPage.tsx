import { useI18n } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicyPage = () => {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-full px-5 pt-6 pb-10 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-4 active:scale-95 transition-transform">
        <ArrowLeft size={18} />
        <span className="text-sm">{lang === "nl" ? "Terug" : "Back"}</span>
      </button>

      <h1 className="text-2xl font-bold font-display mb-6">{t("privacy")}</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
        {lang === "nl" ? (
          <>
            <p className="text-foreground font-medium">Laatst bijgewerkt: 20 april 2026</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">1. Wie zijn wij?</h2>
            <p>Uprising Studio is gevestigd aan de Spaceshuttle 6e, Amersfoort. Wij bieden muziekstudio's, contentruimtes en creatieve diensten aan. Voor vragen over dit privacybeleid kun je contact opnemen via <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">2. Welke gegevens verzamelen wij?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Naam, e-mailadres en telefoonnummer bij registratie</li>
              <li>Adresgegevens (optioneel, voor facturatie)</li>
              <li>Boekingsgegevens en sessie-informatie</li>
              <li>Betalingsgegevens (verwerkt via Stripe, wij slaan geen creditcardnummers op)</li>
              <li>Communicatievoorkeuren en taalinstelling</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">3. Waarvoor gebruiken wij je gegevens?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Het verwerken en beheren van boekingen</li>
              <li>Het versturen van bevestigingen en herinneringen</li>
              <li>Het beheren van je lidmaatschap en facturatie</li>
              <li>Het verbeteren van onze dienstverlening</li>
              <li>Het voldoen aan wettelijke verplichtingen</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">4. Delen van gegevens</h2>
            <p>Wij delen je gegevens alleen met derden die noodzakelijk zijn voor onze dienstverlening:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Stripe</strong> — voor het verwerken van betalingen</li>
              <li><strong>E-maildiensten</strong> — voor het versturen van transactionele berichten</li>
            </ul>
            <p>Wij verkopen je gegevens nooit aan derden.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">5. Beveiliging</h2>
            <p>Wij nemen passende technische en organisatorische maatregelen om je persoonsgegevens te beschermen tegen ongeautoriseerde toegang, verlies of misbruik.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">6. Je rechten</h2>
            <p>Je hebt het recht om:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Inzage te vragen in je persoonsgegevens</li>
              <li>Correctie of verwijdering van je gegevens te verzoeken</li>
              <li>Bezwaar te maken tegen verwerking van je gegevens</li>
              <li>Je gegevens over te dragen (dataportabiliteit)</li>
            </ul>
            <p>Neem hiervoor contact met ons op via <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">7. Cookies</h2>
            <p>Deze app maakt gebruik van essentiële cookies en lokale opslag voor authenticatie en gebruikersvoorkeuren. Wij gebruiken geen tracking cookies van derden.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">8. Wijzigingen</h2>
            <p>Wij behouden ons het recht voor om dit privacybeleid te wijzigen. Wijzigingen worden via de app gecommuniceerd.</p>
          </>
        ) : (
          <>
            <p className="text-foreground font-medium">Last updated: April 20, 2026</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">1. Who are we?</h2>
            <p>Uprising Studio is located at Spaceshuttle 6e, Amersfoort, The Netherlands. We offer music studios, content spaces and creative services. For questions about this privacy policy, contact us at <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">2. What data do we collect?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name, email address and phone number upon registration</li>
              <li>Address details (optional, for billing)</li>
              <li>Booking details and session information</li>
              <li>Payment data (processed via Stripe — we do not store credit card numbers)</li>
              <li>Communication preferences and language settings</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">3. How do we use your data?</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processing and managing bookings</li>
              <li>Sending confirmations and reminders</li>
              <li>Managing your membership and billing</li>
              <li>Improving our services</li>
              <li>Complying with legal obligations</li>
            </ul>

            <h2 className="text-lg font-semibold text-foreground mt-6">4. Data sharing</h2>
            <p>We only share your data with third parties necessary for our services:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Stripe</strong> — for payment processing</li>
              <li><strong>Email services</strong> — for transactional messages</li>
            </ul>
            <p>We never sell your data to third parties.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">5. Security</h2>
            <p>We take appropriate technical and organizational measures to protect your personal data against unauthorized access, loss or misuse.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">6. Your rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access your personal data</li>
              <li>Request correction or deletion of your data</li>
              <li>Object to the processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p>Contact us at <a href="mailto:info@uprisingstudio.nl" className="text-primary underline">info@uprisingstudio.nl</a>.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">7. Cookies</h2>
            <p>This app uses essential cookies and local storage for authentication and user preferences. We do not use third-party tracking cookies.</p>

            <h2 className="text-lg font-semibold text-foreground mt-6">8. Changes</h2>
            <p>We reserve the right to modify this privacy policy. Changes will be communicated through the app.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
