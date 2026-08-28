import { PersonaAcquisitionPage } from '../../components/static/PersonaAcquisitionPage';
import { ROUTES } from '../../constants';
import { isInstitutionWorkspaceLaunched } from '../../config/workspaceLaunchGates';

export default function InstitutionAcquisition() {
  const workspaceOpen = isInstitutionWorkspaceLaunched();

  return (
    <PersonaAcquisitionPage
      title="Education Institutions on Strideto | Strideto"
      description="Explore universities and colleges on Strideto. The private institution workspace for managing programs, scholarships, and admissions data is coming soon — public institution discovery is available now."
      canonical={ROUTES.FOR_INSTITUTIONS}
      breadcrumbLabel="Institutions"
      heading="Education institutions on Strideto"
      intro="Strideto supports education institutions in two ways: public discovery pages where students explore universities and programs, and a private institution workspace for verified providers to manage their presence. Public discovery is live; the private workspace is not yet open."
      workspaceAvailable={workspaceOpen}
      workspaceStatusNote={
        workspaceOpen
          ? null
          : 'The private institution workspace — for managing programs, scholarships, admissions data, and verified institution information — is coming soon. You can explore public institution listings today; registration and sign-in for the institution portal will open when the workspace launches.'
      }
      sections={[
        {
          title: 'Public discovery (available now)',
          body: 'Students and families can browse institution profiles, programs, and related education content through Strideto public directories.',
          items: [
            'Explore universities and institutions in the education directory.',
            'Browse schools and colleges with program and admissions information.',
            'Use the program explorer to compare study options.',
            'Find admissions, scholarships, and international study resources linked to institutions.',
          ],
        },
        {
          title: 'Private institution workspace',
          body: workspaceOpen
            ? 'Verified education providers can register for the institution workspace to manage programs, scholarships, admissions data, and institution profile information.'
            : 'A dedicated institution workspace for verified education providers is in development. It will support managing institution presence, programs, scholarships, and admissions data when launched.',
          subsections: workspaceOpen
            ? [
                {
                  title: 'Workspace capabilities',
                  body: 'Manage your institution profile, programs, intakes, scholarships, applications, and data quality from a single portal.',
                },
              ]
            : undefined,
        },
        {
          title: 'Who this is for',
          body: 'Universities, colleges, and education providers who want students to discover their programs on Strideto and, when the workspace is available, manage verified institution information directly.',
        },
      ]}
      resourceLinks={[
        { to: ROUTES.EDUCATION_INSTITUTIONS, label: 'Explore universities and institutions' },
        { to: ROUTES.SCHOOLS_AND_COLLEGES, label: 'Schools and colleges' },
        { to: ROUTES.PROGRAM_EXPLORER, label: 'Program explorer' },
        { to: ROUTES.ADMISSIONS, label: 'Admissions listings' },
        { to: ROUTES.SCHOLARSHIPS, label: 'Scholarships' },
      ]}
      primaryCtas={
        workspaceOpen
          ? [
              { to: ROUTES.INSTITUTION_REGISTER, label: 'Register institution' },
              { to: ROUTES.INSTITUTION_LOGIN, label: 'Institution sign in' },
            ]
          : [{ to: ROUTES.EDUCATION_INSTITUTIONS, label: 'Explore institutions' }]
      }
      secondaryCtas={
        workspaceOpen
          ? [{ to: ROUTES.EDUCATION_INSTITUTIONS, label: 'Explore institutions' }]
          : []
      }
    />
  );
}
