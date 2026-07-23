import { useI18n } from "@/lib/i18n";

/**
 * Single source of truth for the membership contract terms.
 * Previously this legal text was duplicated (and had drifted) across
 * BookingPage, ServicesPage and MembershipsDetailPage. Keep the canonical
 * wording here so all three surfaces always show the exact same terms.
 */
const MembershipTermsBody = ({ yearly }: { yearly: boolean }) => {
  const { t, lang } = useI18n();
  const nl = lang === "nl";

  return (
    <div className="text-[10px] text-muted-foreground leading-relaxed space-y-2 max-h-48 overflow-y-auto pr-1">
      <p className="font-semibold text-foreground/80">{t("article1Title")}</p>
      <p>
        {nl
          ? yearly
            ? "1.1 Door het afsluiten van een jaarabonnement gaat de klant (hierna: \"Abonnee\") een bindende overeenkomst aan met Uprising Studio, gevestigd te Amersfoort, Spaceshuttle 6e (hierna: \"Uprising Studio\"), voor een vaste periode van twaalf (12) opeenvolgende kalendermaanden, ingaande op de datum van eerste betaling."
            : "1.1 Door het afsluiten van een 3-maanden membership gaat de klant (hierna: \"Abonnee\") een bindende overeenkomst aan met Uprising Studio, gevestigd te Amersfoort, Spaceshuttle 6e (hierna: \"Uprising Studio\"), voor een vaste periode van drie (3) opeenvolgende kalendermaanden, ingaande op de datum van eerste betaling."
          : yearly
            ? "1.1 By subscribing to an annual plan, the customer (\"Subscriber\") enters into a binding agreement with Uprising Studio, located at Spaceshuttle 6e, Amersfoort (\"Uprising Studio\"), for a fixed period of twelve (12) consecutive calendar months, commencing on the date of first payment."
            : "1.1 By subscribing to a 3-month plan, the customer (\"Subscriber\") enters into a binding agreement with Uprising Studio, located at Spaceshuttle 6e, Amersfoort (\"Uprising Studio\"), for a fixed period of three (3) consecutive calendar months, commencing on the date of first payment."}
      </p>
      <p>
        {nl
          ? "1.2 Het abonnement wordt na afloop van de initiële periode stilzwijgend verlengd met perioden van telkens één (1) maand, tenzij schriftelijk opgezegd met inachtneming van een opzegtermijn van dertig (30) dagen vóór het einde van de lopende periode."
          : "1.2 After the initial period, the subscription will be tacitly renewed for periods of one (1) month, unless cancelled in writing with thirty (30) days notice before the end of the current period."}
      </p>
      <p className="font-semibold text-foreground/80">{t("article2Title")}</p>
      <p>
        {nl
          ? yearly
            ? "2.1 De Abonnee verplicht zich tot maandelijkse betaling van het overeengekomen abonnementstarief gedurende de volledige contractperiode van twaalf (12) maanden."
            : "2.1 De Abonnee verplicht zich tot maandelijkse betaling van het overeengekomen abonnementstarief gedurende de volledige contractperiode van drie (3) maanden."
          : yearly
            ? "2.1 The Subscriber commits to monthly payment of the agreed subscription fee for the full contract period of twelve (12) months."
            : "2.1 The Subscriber commits to monthly payment of the agreed subscription fee for the full contract period of three (3) months."}
      </p>
      <p>
        {nl
          ? "2.2 Tussentijdse opzegging ontslaat de Abonnee niet van de betalingsverplichting over de resterende maanden van de contractperiode."
          : "2.2 Early termination does not release the Subscriber from payment obligations for the remaining months of the contract period."}
      </p>
      <p className="font-semibold text-foreground/80">{t("article3Title")}</p>
      <p>
        {nl
          ? "3.1 Bij wanbetaling worden incassokosten (conform WIK), administratiekosten en wettelijke rente (art. 6:119a BW) in rekening gebracht. 3.2 Uprising Studio behoudt zich het recht voor gerechtelijke stappen te nemen; proceskosten komen voor rekening van de Abonnee."
          : "3.1 In case of default, collection costs, administrative fees and statutory interest (art. 6:119a Dutch Civil Code) will be charged. 3.2 Uprising Studio reserves the right to take legal action; legal costs are borne by the Subscriber."}
      </p>
      <p className="font-semibold text-foreground/80">
        {nl ? "Artikel 4 — Toepasselijk Recht" : "Article 4 — Applicable Law"}
      </p>
      <p>
        {nl
          ? "Op deze overeenkomst is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement Midden-Nederland."
          : "This agreement is governed by Dutch law. Disputes shall be submitted to the competent court in the Central Netherlands district."}
      </p>
    </div>
  );
};

export default MembershipTermsBody;
