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
import { displayableBlogCategoryLabel } from '@shared/blog/taxonomy.js';

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

function MobileToc({ toc, label }) {
  const [open, setOpen] = useState(false);
  if (!toc || toc.length < 2) return null;
  return (
    <div className="lg:hidden my-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        <span className="text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <nav className="px-4 pb-3 space-y-1 text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
          {toc.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={() => setOpen(false)}
              className="block text-edur-steel dark:text-edur-sky hover:underline py-0.5"
              style={{ paddingLeft: h.level > 2 ? `${(h.level - 2) * 0.75}rem` : 0 }}
            >
              {h.text}
            </a>
          ))}
        </nav>
      )}
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
      <article className={`${showToc ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-4 py-8`}>
        <Link to={ROUTES.BLOG} className="text-sm text-edur-steel dark:text-edur-sky hover:underline mb-6 inline-block">← {t('blog:backToBlog')}</Link>

        {/* Article header */}
        <header className="max-w-3xl">
          {displayableBlogCategoryLabel(post.category) && (
            <span className="inline-block text-xs font-semibold uppercase tracking-wide text-edur-steel dark:text-edur-sky mb-3">
              {displayableBlogCategoryLabel(post.category)}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">{post.title}</h1>
          {post.excerpt && (
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{post.excerpt}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-4">
            <span className="font-medium text-gray-700 dark:text-gray-300">{authorLabel}</span>
            {post.publishedAt && <span>{new Date(post.publishedAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
            <span>{readingMin} min read</span>
          </div>
        </header>

        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.title} className="w-full rounded-xl mt-6 object-cover max-h-80" loading="lazy" />
        ) : null}

        <AdHost placementId="blog-inline" index={1} variant="inline" className="my-6" />

        {/* Mobile TOC — collapsible */}
        {showToc && (
          <MobileToc toc={body.toc} label={t('blog:tableOfContents')} />
        )}

        <div className={`mt-8 ${showToc ? 'flex flex-col lg:flex-row gap-10' : ''}`}>
          {/* Body */}
          <div className="flex-1 min-w-0 max-w-[820px]">
            <div
              className="prose prose-gray dark:prose-invert prose-p:leading-7 prose-h2:mt-8 prose-h3:mt-6 prose-li:my-1 text-gray-800 dark:text-gray-200 max-w-none blog-body"
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

          {/* Desktop sticky TOC */}
          {showToc ? (
            <aside className="hidden lg:block lg:w-72 xl:w-80 shrink-0">
              <div className="sticky top-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{t('blog:tableOfContents')}</h3>
                <nav className="space-y-1 text-sm border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                  {body.toc.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="block text-gray-600 dark:text-gray-400 hover:text-edur-steel dark:hover:text-edur-sky hover:underline transition-colors py-0.5"
                      style={{ paddingLeft: h.level > 2 ? `${(h.level - 2) * 0.75}rem` : 0 }}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
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
