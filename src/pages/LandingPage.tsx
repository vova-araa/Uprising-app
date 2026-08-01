/**
 * Publieke marketing-landing (uitgelogde bezoekers).
 *
 * De landing is een op zichzelf staande, ontworpen pagina (eigen fonts, motion,
 * scroll-reveals, video-logo). Die serveren we statisch vanuit `public/landing/`
 * en tonen we hier chrome-loos (buiten de AppShell) op `/` voor bezoekers die
 * niet ingelogd zijn. De CTA's in de pagina linken met `target="_top"` naar de
 * echte app-routes (/#/book, /#/auth), zodat de boekingsflow gewoon werkt.
 */
const LandingPage = () => {
  return (
    <iframe
      src="/landing/index.html"
      title="Uprising Studio — Muziekstudio's & Creatieve Ruimtes in Amersfoort"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        background: "#0a0810",
      }}
    />
  );
};

export default LandingPage;
