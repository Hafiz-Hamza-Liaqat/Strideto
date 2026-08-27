import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { DEFAULT_KEYWORDS } from '../../seo/config';
import { blogsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { SAMPLE_BLOGS } from '../../constants/seedData';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { AdHost } from '../../components/ads';
import { listBlogCategoryOptions, blogCategoryFilterValues, canonicalBlogCategoryLabel, displayableBlogCategoryLabel } from '@shared/blog/taxonomy.js';

function readingTime(content) {
  if (!content || typeof content !== 'string') return 5;
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

const isProduction = import.meta.env.PROD;

export default function Blog() {
  const { t } = useTranslation(['blog', 'seo', 'common']);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');

  const categories = useMemo(() => {
    const canonical = listBlogCategoryOptions();
    const legacy = new Set();
    for (const post of posts) {
      const label = canonicalBlogCategoryLabel(post.category);
      if (label && !canonical.some((c) => c.label === label)) legacy.add(label);
    }
    return [
      { labelKey: 'categoryAll', value: '' },
      ...canonical.map((c) => ({ label: c.label, value: c.label })),
      ...[...legacy].map((label) => ({ label, value: label })),
    ];
  }, [posts]);

  useEffect(() => {
    blogsApi.list({ limit: 30, status: 'published' })
      .then(({ data }) => setPosts(data?.data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const list = useMemo(() => {
    if (posts.length > 0) return posts;
    if (isProduction) return [];
    return SAMPLE_BLOGS.map((p) => ({
      _id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.excerpt,
      publishedAt: p.date,
      createdAt: p.date,
      category: 'Career Advice',
    }));
  }, [posts]);

  const filtered = useMemo(() => {
    if (!category) return list;
    const values = blogCategoryFilterValues(category);
    return list.filter((p) => values.includes(canonicalBlogCategoryLabel(p.category || p.tags?.[0] || '')));
  }, [list, category]);

  return (
    <>
      <SeoHead
        title={t('blog:seoFullTitle')}
        description={t('blog:seoFullDescription')}
        canonical={ROUTES.BLOG}
        keywords={`${t('blog:seoKeywords')}, ${DEFAULT_KEYWORDS}`}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('blog:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('blog:breadcrumbBlog'), url: ROUTES.BLOG },
          ]),
          collectionPageSchema({
            name: t('blog:seoFullTitle'),
            description: t('blog:seoFullDescription'),
            url: ROUTES.BLOG,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AdHost placementId="blog-header" className="mb-6" />
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">
        <ScrollReveal>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('blog:pageTitle')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{t('blog:subtitle')}</p>
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map(({ labelKey, label, value }) => (
              <button
                key={value || 'all'}
                type="button"
                onClick={() => setCategory(value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${category === value ? 'bg-edur-steel text-white dark:bg-edur-sky dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {labelKey ? t(`blog:${labelKey}`) : label}
              </button>
            ))}
          </div>
        </ScrollReveal>
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('blog:noPosts', { defaultValue: 'No published articles yet.' })}</p>
        ) : (
          <ScrollReveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((post) => {
                const catLabel = displayableBlogCategoryLabel(post.category);
                const dateStr = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : post.createdAt ? new Date(post.createdAt).toLocaleDateString() : '';
                const mins = readingTime(post.content || post.excerpt);
                return (
                  <Link
                    key={post._id || post.slug}
                    to={`${ROUTES.BLOG}/${post.slug}`}
                    className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-edur-blue/40 dark:hover:border-edur-sky/40 transition-all duration-200 overflow-hidden"
                  >
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="w-full h-40 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-mint/10 dark:via-mint/5 dark:to-transparent flex items-center justify-center">
                        <span className="text-4xl opacity-30 select-none">✦</span>
                      </div>
                    )}
                    <div className="flex flex-col flex-1 p-4">
                      {catLabel && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-edur-steel dark:text-edur-sky mb-1">{catLabel}</span>
                      )}
                      <h2 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-primary dark:group-hover:text-mint transition-colors line-clamp-2 leading-snug">{post.title}</h2>
                      {post.excerpt && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2 flex-1">{post.excerpt}</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                        {mins} min read{dateStr ? ` · ${dateStr}` : ''}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollReveal>
        )}
          </div>
          <aside className="w-full lg:w-64 flex-shrink-0">
            <AdHost placementId="blog-sidebar" variant="sidebar" />
          </aside>
        </div>
      </div>
    </>
  );
}
