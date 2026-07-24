import { Link } from 'react-router-dom';
import { formatDate, daysUntil } from '../../utils/formatDate';
import { SaveButton } from './SaveButton';
import { ROUTES } from '../../constants';

const JOB_TYPE_BADGE = {
  Government: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Private: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  Internship: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

function JobCard({ job, saved, onSaveToggle, showBadge = true }) {
  const jobType = job.jobType || 'Private';
  return (
    <Link
      to={`${ROUTES.JOBS}/${job.slug || job._id}`}
      className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 dark:hover:border-mint/50 transition-all duration-200 ease-out card-hover shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{job.title}</h3>
            {showBadge && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${JOB_TYPE_BADGE[jobType] || JOB_TYPE_BADGE.Private}`}>
                {jobType}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{job.organization || job.company}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {[job.province || job.location, job.city, job.category].filter(Boolean).join(' · ')}
          </p>
          {job.deadline && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Deadline: {formatDate(job.deadline)}</p>
          )}
        </div>
        <div onClick={(e) => e.preventDefault()} className="shrink-0">
          <SaveButton type="job" id={job._id} saved={saved} onToggle={onSaveToggle} />
        </div>
      </div>
    </Link>
  );
}

const COUNTRY_FLAGS = {
  Pakistan: '\uD83C\uDDF5\uD83C\uDDF0',
  Turkey: '\uD83C\uDDF9\uD83C\uDDF7',
  China: '\uD83C\uDDE8\uD83C\uDDF3',
  Germany: '\uD83C\uDDE9\uD83C\uDDEA',
  UK: '\uD83C\uDDEC\uD83C\uDDE7',
  USA: '\uD83C\uDDFA\uD83C\uDDF8',
  Australia: '\uD83C\uDDE6\uD83C\uDDFA',
  Canada: '\uD83C\uDDE8\uD83C\uDDE6',
  Hungary: '\uD83C\uDDED\uD83C\uDDFA',
  Italy: '\uD83C\uDDEE\uD83C\uDDF9',
  Japan: '\uD83C\uDDEF\uD83C\uDDF5',
  Korea: '\uD83C\uDDF0\uD83C\uDDF7',
  Sweden: '\uD83C\uDDF8\uD83C\uDDEA',
  Netherlands: '\uD83C\uDDF3\uD83C\uDDF1',
  Malaysia: '\uD83C\uDDF2\uD83C\uDDFE',
  'New Zealand': '\uD83C\uDDF3\uD83C\uDDFF',
  Multiple: '\uD83C\uDF0D',
};

function ScholarshipCard({ item, saved, onSaveToggle }) {
  const flag = item.country && COUNTRY_FLAGS[item.country] ? COUNTRY_FLAGS[item.country] : '';
  return (
    <Link
      to={`${ROUTES.SCHOLARSHIPS}/${item.slug || item._id}`}
      className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 dark:hover:border-mint/50 transition-all duration-200 ease-out card-hover shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 flex items-center gap-1">
            {flag && <span aria-hidden>{flag}</span>}
            {item.provider}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {[item.degreeLevel || item.level, item.fundingType].filter(Boolean).join(' · ')}
          </p>
          {item.deadline && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Deadline: {formatDate(item.deadline)}</p>
          )}
        </div>
        <div onClick={(e) => e.preventDefault()} className="shrink-0">
          <SaveButton type="scholarship" id={item._id} saved={saved} onToggle={onSaveToggle} />
        </div>
      </div>
    </Link>
  );
}

function AdmissionCard({ item, saved, onSaveToggle }) {
  const days = daysUntil(item.deadline);
  const uni = item.university || item.institution;
  const initial = uni ? uni.charAt(0).toUpperCase() : 'U';
  return (
    <Link
      to={`${ROUTES.ADMISSIONS}/${item.slug || item._id}`}
      className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 dark:hover:border-mint/50 transition-all duration-200 ease-out card-hover shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-mint/10 flex items-center justify-center text-primary dark:text-mint font-bold text-sm shrink-0" aria-hidden>
              {item.logoUrl ? <img src={item.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <span>{initial}</span>}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2">{item.program}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{uni}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{item.city || item.province || item.department}</p>
          {item.deadline && (
            <p className="text-xs mt-1">
              {days != null && days >= 0 ? (
                <span className="text-amber-600 dark:text-amber-400">Last date: {formatDate(item.lastDate || item.deadline)} · {days} days left</span>
              ) : (
                <span className="text-gray-500">Last date: {formatDate(item.lastDate || item.deadline)}</span>
              )}
            </p>
          )}
          {(item.applyLink || item.link) && (
            <span className="text-xs text-primary dark:text-mint mt-1 inline-block">Apply →</span>
          )}
        </div>
        <div onClick={(e) => e.preventDefault()} className="shrink-0">
          <SaveButton type="admission" id={item._id} saved={saved} onToggle={onSaveToggle} />
        </div>
      </div>
    </Link>
  );
}

export function HomeJobCard(props) {
  return <JobCard {...props} />;
}
export function HomeScholarshipCard(props) {
  return <ScholarshipCard {...props} />;
}
export function HomeAdmissionCard(props) {
  return <AdmissionCard {...props} />;
}
