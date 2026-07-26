/**
 * Branded hero placeholder sized to approximate the final CMS hero (reduces CLS).
 * Shown only during the initial SiteContent CMS load — never the i18n fallback copy.
 */
export function HomeHeroSkeleton() {
  return (
    <section
      className="relative bg-gradient-to-br from-primary via-primary-hover to-secondary dark:from-secondary dark:via-primary dark:to-secondary py-12 sm:py-14 md:py-24 px-4 sm:px-6 overflow-hidden"
      style={{ minHeight: '28rem' }}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading homepage content"
    >
      <div className="absolute inset-0 bg-primary/10 dark:bg-black/20" aria-hidden />
      <div className="relative max-w-4xl mx-auto text-center animate-pulse">
        <div className="mx-auto mb-4 h-9 sm:h-11 md:h-14 max-w-[18rem] sm:max-w-xl rounded-lg bg-white/25" />
        <div className="mx-auto mb-2 h-4 max-w-md rounded bg-white/20" />
        <div className="mx-auto mb-8 h-4 max-w-sm rounded bg-white/15" />
        <div className="mx-auto mb-6 h-12 sm:h-14 max-w-3xl rounded-xl bg-white/20" />
        <div className="mb-8 flex flex-wrap justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 sm:w-28 rounded-xl bg-white/20" />
          ))}
        </div>
        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-16 rounded-xl bg-white/10 border border-white/15 ${i === 2 ? 'hidden sm:block' : ''}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
