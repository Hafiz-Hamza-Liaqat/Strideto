import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { organizationSchema, websiteSchema } from '../../seo/schemas';
import { isPrivateSeoPath } from '../../seo/config';
import { safeJsonLd } from '../../seo/sanitize';

/** Sitewide Organization + WebSite JSON-LD on public routes only */
export default function GlobalSeo() {
  const { pathname } = useLocation();
  const isPrivate = isPrivateSeoPath(pathname);

  if (isPrivate) {
    return (
      <Helmet prioritizeSeoTags>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
    );
  }

  const graph = [organizationSchema(), websiteSchema()].filter(Boolean);

  return (
    <Helmet prioritizeSeoTags>
      <script type="application/ld+json">
        {safeJsonLd({ '@context': 'https://schema.org', '@graph': graph })}
      </script>
    </Helmet>
  );
}
