import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { blogPostingSchema, breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { buildCanonicalUrl } from '../../seo/config';
import { blogsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { AdHost } from '../../components/ads';
import { useContentView } from '../../hooks/usePageView';
import { sanitizeHtmlForRender } from '../../utils/sanitizeHtml';
import { normalizeBlogContent, shouldShowBlogToc } from '@shared/blog/blogContent.js';

function readingTimeMinutes(content) {
  if (!content || typeof content !== 'string') return 5;
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

function ShareButtons({ title, url, t }) {
  const encodedUrl = encodeURIComponent(url || window.location.href);
  const encodedTitle = encodeURIComponent(title || '');
  const text = encodeURIComponent(`${title} – ${t('common:appName')}`);

  return (
    <div className="flex flex-wrap gap-2 mt-6">
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
      >
        {t('blog:shareOnX')}
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
      >
        {t('blog:facebook')}
      </a>
      <a
        href={`https://wa.me/?text=${text}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
      >
        {t('blog:whatsapp')}
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url || window.location.href);
        }}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
      >
        {t('blog:copyLink')}
      </button>
    </div>
  );
}

export default function BlogPost() {
  const { t } = useTranslation(['blog', 'common', 'seo']);
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useContentView('blog', post?._id, 'blog_view');

  useEffect(() => {
    if (!slug) return;
    blogsApi.get(slug)
      .then(({ data }) => setPost(data))
      .catch(() => {
        setPost(null);
        setError('Not found');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!post?.slug) return;
    blogsApi.list({ limit: 10, status: 'published' })
      .then(({ data }) => {
        const list = data?.data || data || [];
        setRelated(list.filter((p) => (p.slug || p._id) !== post.slug).slice(0, 3));
      })
      .catch(() => setRelated([]));
  }, [post?.slug]);

  const body = useMemo(() => {
    if (!post?.content && !post?.excerpt) return { html: '', toc: [] };
    return normalizeBlogContent(post.content || post.excerpt);
  }, [post?.content, post?.excerpt]);

  const renderedHtml = useMemo(() => sanitizeHtmlForRender(body.html), [body.html]);
  const showToc = shouldShowBlogToc(body.toc);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
        <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
        <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('blog:postNotFound')}</h1>
        <Link to={ROUTES.BLOG} className="text-edur-steel dark:text-edur-sky mt-4 inline-block hover:underline">← {t('blog:backToBlog')}</Link>
      </div>
    );
  }

  const canonicalPath = post.canonicalUrl || `${ROUTES.BLOG}/${post.slug}`;
  const seoTitle = post.seoTitle || post.title;
  const seoDescription = post.metaDescription || post.excerpt || post.title;
  const ogImage = post.ogImageUrl || post.imageUrl || undefined;
  const readingMin = post.readingTime || readingTimeMinutes(post.content || post.excerpt);
  const authorLabel = post.authorDisplay || post.authorName || t('blog:defaultAuthor');
  const gallery = (post.gallery || []).filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim()));

  return (
    <>
      <SeoHead
        title={`${seoTitle} ${t('blog:postSeoSuffix')}`}
        description={seoDescription}
        canonical={canonicalPath.startsWith('http') ? canonicalPath : canonicalPath}
        ogType="article"
        ogImage={ogImage}
        ogImageAlt={post.title}
        jsonLd={combineSchemas(
          blogPostingSchema({ ...post, author: authorLabel }, { readingMinutes: readingMin }),
          breadcrumbSchema([
            { name: t('blog:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('blog:breadcrumbBlog'), url: ROUTES.BLOG },
            { name: post.title, url: `${ROUTES.BLOG}/${post.slug}` },
          ]),
        )}
      />
      <article className="max-w-4xl mx-auto px-4 py-8">
        <Link to={ROUTES.BLOG} className="text-sm text-edur-steel dark:text-edur-sky hover:underline mb-6 inline-block">← {t('blog:backToBlog')}</Link>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{authorLabel}</span>
          {post.category ? <span className="text-edur-steel dark:text-edur-sky">{post.category}</span> : null}
          {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString()}</span>}
          <span>{t('blog:minRead', { count: readingMin })}</span>
        </div>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded bg-edur-sky/20 dark:bg-edur-sky/10 text-edur-steel dark:text-edur-sky">{tag}</span>
            ))}
          </div>
        )}

        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.title} className="w-full rounded-xl mt-6 object-cover max-h-64" loading="lazy" />
        ) : null}

        <AdHost placementId="blog-inline" index={1} variant="inline" className="my-6" />

        <div className={`mt-8 ${showToc ? 'flex flex-col lg:flex-row gap-8' : ''}`}>
          <div className="flex-1 min-w-0">
            <div
              className="prose dark:prose-invert text-gray-700 dark:text-gray-300 max-w-none blog-body"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
            {gallery.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((url) => (
                  <img key={url} src={url} alt="" className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700" loading="lazy" />
                ))}
              </div>
            ) : null}
            <ShareButtons title={post.title} url={buildCanonicalUrl(`${ROUTES.BLOG}/${post.slug}`)} t={t} />
          </div>
          {showToc ? (
            <aside className="lg:w-56 shrink-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('blog:tableOfContents')}</h3>
              <nav className="space-y-1 text-sm">
                {body.toc.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className="block text-edur-steel dark:text-edur-sky hover:underline"
                    style={{ paddingLeft: h.level > 2 ? `${(h.level - 2) * 0.75}rem` : 0 }}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}
        </div>

        {related.length > 0 && (
          <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('blog:relatedPosts')}</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map((p) => (
                <Link key={p._id || p.slug} to={`${ROUTES.BLOG}/${p.slug}`} className="block p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-edur-blue/50 card-hover">
                  <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
