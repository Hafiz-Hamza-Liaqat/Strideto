import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { ROUTES } from '../../constants';

const navItems = [
  { to: ROUTES.AGENT_DASHBOARD, label: 'Dashboard', end: true },
  { to: ROUTES.AGENT_PROFILE, label: 'Profile' },
  { to: ROUTES.AGENT_SERVICES, label: 'Services' },
  { to: ROUTES.AGENT_MARKETPLACE, label: 'Marketplace' },
  { to: ROUTES.AGENT_CONSULTATIONS, label: 'Consultations' },
  { to: ROUTES.AGENT_CASES, label: 'Cases' },
  { to: ROUTES.AGENT_TRUST, label: 'Trust' },
  { to: ROUTES.AGENT_COMMERCE, label: 'Commerce' },
  { to: ROUTES.AGENT_AVAILABILITY, label: 'Availability' },
  { to: ROUTES.AGENT_VERIFICATION, label: 'Verification' },
  { to: ROUTES.AGENT_TEAM, label: 'Team' },
  { to: ROUTES.AGENT_LEADS, label: 'Leads' },
  { to: ROUTES.AGENT_CLIENTS, label: 'Clients' },
  { to: ROUTES.AGENT_SETTINGS, label: 'Settings' },
];

export default function AgentLayout() {
  const { agent, logout } = useAgentAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.AGENT_LOGIN, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] md:flex">
      <header className="border-b bg-white p-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to={ROUTES.AGENT_DASHBOARD} className="font-semibold">Strideto Agent</Link>
          <button onClick={handleLogout} className="text-xs text-red-600">Log out</button>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>{item.label}</NavLink>)}
        </nav>
      </header>
      {/* Sidebar */}
      <aside className="hidden w-60 bg-white border-r border-[#E5E7EB] md:flex md:min-h-screen md:flex-col">
        <div className="px-6 py-5 border-b border-[#E5E7EB]">
          <Link to={ROUTES.AGENT_DASHBOARD} className="text-[#0F172A] font-semibold text-lg">
            Strideto
          </Link>
          <p className="text-xs text-slate-500 mt-0.5">Agent Portal</p>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F172A]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#E5E7EB]">
          <p className="text-xs text-slate-500 truncate mb-2">{agent?.email || ''}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-red-600 hover:text-red-700 px-3 py-1.5 rounded hover:bg-red-50"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 overflow-auto">
        <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
