import { Helmet } from "react-helmet-async";

const SITE = "https://uprisingstudio.nl";
const DEFAULT_IMAGE = `${SITE}/og-uprising.png`;

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}

/**
 * Per-route SEO/social-preview tags. Helmet replaces the static tags
 * in index.html for JS-executing crawlers (Google) on a per-route basis.
 */
const SEO = ({ title, description, path, image = DEFAULT_IMAGE, type = "website" }: SEOProps) => {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Uprising Studio" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};

export default SEO;
