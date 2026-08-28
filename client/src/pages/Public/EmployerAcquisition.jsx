import { PersonaAcquisitionPage } from '../../components/static/PersonaAcquisitionPage';
import { ROUTES } from '../../constants';
import { isEmployerWorkspaceLaunched } from '../../config/workspaceLaunchGates';

export default function EmployerAcquisition() {
  const workspaceOpen = isEmployerWorkspaceLaunched();

  return (
    <PersonaAcquisitionPage
      title="Post Jobs & Connect With Candidates | Strideto"
      description="Use the Strideto employer workspace to post jobs, manage listings, review applications, and reach candidates through public job discovery on Strideto."
      canonical={ROUTES.FOR_EMPLOYERS}
      breadcrumbLabel="Employers"
      heading="Hire through the Strideto employer workspace"
      intro="Strideto gives employers a dedicated workspace to publish job openings, manage applications, and maintain an organization profile — while candidates discover your roles through Strideto's public jobs directory."
      workspaceAvailable={workspaceOpen}
      sections={[
        {
          title: 'What employers can do today',
          items: [
            'Create an employer account and access the employer workspace.',
            'Post and manage job listings with structured job details.',
            'Choose how candidates apply — through Strideto or an external application link.',
            'Review and manage applications submitted through supported flows.',
            'Maintain your organization profile for hiring on Strideto.',
            'Reach candidates browsing the public jobs directory.',
          ],
        },
        {
          title: 'How Strideto works for employers',
          body: 'Register for an employer account, complete your organization profile, and publish your first job. Approved listings appear in Strideto job search where students and job seekers can discover and apply. You manage postings and applications from your employer dashboard.',
        },
        {
          title: 'Who this is for',
          body: 'Companies, startups, NGOs, and hiring teams who want to post openings and connect with candidates through Strideto. Whether you hire occasionally or run an ongoing recruitment process, the employer workspace supports structured job posting and application management.',
        },
      ]}
      resourceLinks={[
        { to: ROUTES.JOBS, label: 'Browse public jobs directory', note: 'See how candidates discover listings.' },
      ]}
      primaryCtas={
        workspaceOpen
          ? [
              { to: ROUTES.EMPLOYER_REGISTER, label: 'Employer sign up' },
              { to: ROUTES.EMPLOYER_POST_JOB, label: 'Post a job' },
            ]
          : []
      }
      secondaryCtas={
        workspaceOpen
          ? [
              { to: ROUTES.EMPLOYER_LOGIN, label: 'Employer sign in' },
              { to: ROUTES.JOBS, label: 'Explore jobs' },
            ]
          : []
      }
    />
  );
}
