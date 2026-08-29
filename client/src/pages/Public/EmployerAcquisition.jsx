import { PersonaAcquisitionPage } from '../../components/static/PersonaAcquisitionPage';
import { ROUTES } from '../../constants';
import { isEmployerWorkspaceLaunched } from '../../config/workspaceLaunchGates';

export default function EmployerAcquisition() {
  const workspaceOpen = isEmployerWorkspaceLaunched();

  return (
    <PersonaAcquisitionPage
      title="Reach Emerging Talent & Manage Hiring | Strideto"
      description="Post jobs, choose how candidates apply, and review applicants submitted through STRIDETO — while your listings appear in public job discovery."
      canonical={ROUTES.FOR_EMPLOYERS}
      breadcrumbLabel="Employers"
      heading="Reach emerging talent and manage hiring in one workspace"
      intro="Post jobs, choose how candidates apply, and review applicants submitted through STRIDETO — while your listings appear in public job discovery."
      workspaceAvailable={workspaceOpen}
      steps={[
        { title: 'Create employer profile', body: 'Register and set up your organization profile in the employer workspace.' },
        { title: 'Publish an opportunity', body: 'Post structured job listings and choose whether candidates apply on STRIDETO or via an external link.' },
        { title: 'Reach candidates through public discovery', body: 'Approved listings appear in STRIDETO job search where students and job seekers browse opportunities.' },
        { title: 'Review STRIDETO-submitted applications where supported', body: 'Manage applicants who apply through STRIDETO. External applications are completed on the employer’s own site.' },
      ]}
      sections={[
        {
          title: 'What employers can do today',
          items: [
            'Create an employer account and access the employer workspace.',
            'Post and manage job listings with structured job details.',
            'Choose how candidates apply — through STRIDETO or an external application link.',
            'Review and manage applications submitted through STRIDETO where supported.',
            'Maintain your organization profile for hiring on STRIDETO.',
            'Reach candidates browsing the public jobs directory.',
          ],
        },
        {
          title: 'Who this is for',
          body: 'Companies, startups, NGOs, and hiring teams who want to post openings and connect with candidates through STRIDETO. Whether you hire occasionally or run an ongoing recruitment process, the employer workspace supports structured job posting and applicant management where applications are submitted through STRIDETO.',
        },
      ]}
      resourceLinks={[
        { to: ROUTES.JOBS, label: 'Browse jobs as candidates see them', note: 'See how candidates discover listings.' },
      ]}
      primaryCtas={
        workspaceOpen
          ? [
              { to: ROUTES.EMPLOYER_REGISTER, label: 'Create Employer Account' },
              { to: ROUTES.EMPLOYER_POST_JOB, label: 'Post a Job' },
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
