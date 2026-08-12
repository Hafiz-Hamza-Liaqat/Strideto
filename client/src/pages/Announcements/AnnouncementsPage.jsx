import { SeoHead } from '../../components/seo';
import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed';

export default function AnnouncementsPage() {
  return (
    <>
      <SeoHead title="Announcements | Strideto" description="Platform announcements for your account." noindex />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Announcements</h1>
        <AnnouncementFeed title="All announcements" limit={20} />
      </div>
    </>
  );
}
