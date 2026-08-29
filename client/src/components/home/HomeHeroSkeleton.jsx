/**
 * Branded hero placeholder sized to approximate the final CMS hero (reduces CLS).
 * Shown only during the initial SiteContent CMS load — never the i18n fallback copy.
 */
export function HomeHeroSkeleton() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-secondary px-4 py-12 sm:px-6 sm:py-14 md:py-20 dark:from-secondary dark:via-primary dark:to-secondary"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading homepage content"
    >
      <div className="absolute inset-0 bg-primary/10 dark:bg-black/20" aria-hidden />
      <div className="relative mx-auto max-w-6xl animate-pulse">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          <div className="min-w-0 text-center lg:text-start">
            <div className="mx-auto mb-4 h-4 w-40 rounded bg-white/20 lg:mx-0" />
            <div className="mx-auto mb-4 h-10 max-w-lg rounded-lg bg-white/25 sm:h-12 lg:mx-0" />
            <div className="mx-auto mb-2 h-4 max-w-md rounded bg-white/20 lg:mx-0" />
            <div className="mx-auto mb-8 h-4 max-w-sm rounded bg-white/15 lg:mx-0" />
            <div className="mx-auto mb-6 h-12 max-w-xl rounded-xl bg-white/20 lg:mx-0" />
            <div className="mb-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <div className="h-12 w-40 rounded-xl bg-white/25" />
              <div className="h-12 w-36 rounded-xl bg-white/15" />
            </div>
            <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 w-24 rounded bg-white/15" />
              ))}
            </div>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 h-24 rounded-2xl bg-white/10 sm:col-span-1" />
              <div className="h-24 rounded-2xl bg-white/10" />
              <div className="h-24 rounded-2xl bg-white/10" />
              <div className="col-span-2 h-20 rounded-2xl bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
