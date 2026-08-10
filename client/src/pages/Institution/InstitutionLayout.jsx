import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SkipLink } from '../../components/a11y/SkipLink';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { ROUTES } from '../../constants';

const links = [
  [ROUTES.INSTITUTION_DASHBOARD, 'Dashboard', true],
  [ROUTES.INSTITUTION_ONBOARDING, 'Verification', false],
  [ROUTES.INSTITUTION_PROFILE, 'Profile', false],
  [ROUTES.INSTITUTION_PROGRAMS, 'Programs', false],
  [ROUTES.INSTITUTION_DATA_QUALITY, 'Data quality', false],
  [ROUTES.INSTITUTION_TEAM, 'Team & settings', false],
];

function PortalNav({ mobile = false }) {
  return (
    <nav aria-label="Institution navigation" className={mobile ? 'flex gap-2 overflow-x-auto pb-1' : 'space-y-1'}>
      {links.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `${mobile ? 'flex min-h-[44px] shrink-0 items-center' : 'block'} rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-200' : 'text-slate-650 hover:bg-slate-100'}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function InstitutionLayout() {
  const { account, membership, logout } = useInstitutionAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate(ROUTES.INSTITUTION_LOGIN, { replace: true }); };

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <SkipLink />
      <header className="border-b border-slate-200 bg-white p-3 md:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link className="font-bold text-slate-900" to={ROUTES.INSTITUTION_DASHBOARD}>Strideto Institution</Link>
          <button onClick={handleLogout} className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50">Log out</button>
        </div>
        <div className="mt-3"><PortalNav mobile /></div>
      </header>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:min-h-screen md:flex-col">
        <div className="border-b border-slate-200 px-5 py-5">
          <Link to={ROUTES.INSTITUTION_DASHBOARD} className="text-lg font-bold text-slate-900">Strideto</Link>
          <p className="text-xs text-slate-500">Verified Institution Portal</p>
        </div>
        <div className="flex-1 px-3 py-4"><PortalNav /></div>
        <div className="border-t border-slate-200 p-4">
          <p className="break-all text-xs text-slate-600">{account?.email}</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">Role: {membership?.role || 'member'}</p>
          <button onClick={handleLogout} className="mt-3 min-h-[44px] w-full rounded-lg px-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Log out</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:px-6 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
