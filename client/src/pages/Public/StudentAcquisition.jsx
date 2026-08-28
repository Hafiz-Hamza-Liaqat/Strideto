import { PersonaAcquisitionPage } from '../../components/static/PersonaAcquisitionPage';
import { ROUTES } from '../../constants';

export default function StudentAcquisition() {
  return (
    <PersonaAcquisitionPage
      title="Career, Internship & Study Opportunities for Students | Strideto"
      description="Discover jobs, internships, scholarships, admissions, study abroad guidance, and career tools on Strideto. Create a free student account to save opportunities and build your resume."
      canonical={ROUTES.FOR_STUDENTS}
      breadcrumbLabel="Students"
      heading="Career and education opportunities for students"
      intro="Strideto helps students explore real career and education opportunities in one place — from job and internship listings to scholarships, admissions, international study resources, and practical career preparation tools."
      sections={[
        {
          title: 'What you can do on Strideto',
          items: [
            'Browse jobs and internships from employers and curated listings.',
            'Search scholarships and admissions opportunities with clear eligibility details.',
            'Explore international study programs and country-specific guidance.',
            'Discover universities, colleges, and programs through public institution directories.',
            'Build a structured resume with the Strideto resume builder.',
            'Read career guidance articles and follow the Strideto career blog.',
            'Create a student account to save opportunities and track applications where supported.',
          ],
        },
        {
          title: 'How Strideto works',
          body: 'Start by exploring public listings — no account required. When you are ready to save jobs, build your resume, or apply through supported flows, create a free student account. Strideto connects discovery tools with your personal dashboard so you can move from research to action.',
        },
        {
          title: 'Who this is for',
          body: 'Students and early-career learners looking for jobs, internships, funding, admissions information, study abroad options, and practical tools to prepare applications. Whether you are finishing school, in university, or planning your next step, Strideto brings relevant resources together.',
        },
      ]}
      resourceLinks={[
        { to: ROUTES.JOBS, label: 'Explore jobs' },
        { to: ROUTES.INTERNSHIPS, label: 'Find internships' },
        { to: ROUTES.SCHOLARSHIPS, label: 'Browse scholarships' },
        { to: ROUTES.ADMISSIONS, label: 'View admissions' },
        { to: ROUTES.FOREIGN_STUDIES, label: 'Explore study abroad' },
        { to: ROUTES.INTL_SCHOLARSHIPS, label: 'International scholarships' },
        { to: ROUTES.EDUCATION_INSTITUTIONS, label: 'Universities and institutions' },
        { to: ROUTES.PROGRAM_EXPLORER, label: 'Program explorer' },
        { to: ROUTES.RESUME_BUILDER, label: 'Build your resume' },
        { to: ROUTES.CAREER_GUIDANCE, label: 'Career guidance' },
        { to: ROUTES.BLOG, label: 'Career blog' },
      ]}
      primaryCtas={[
        { to: ROUTES.JOBS, label: 'Explore jobs' },
        { to: ROUTES.REGISTER, label: 'Create account' },
      ]}
      secondaryCtas={[
        { to: ROUTES.INTERNSHIPS, label: 'Find internships' },
        { to: ROUTES.RESUME_BUILDER, label: 'Build your resume' },
      ]}
    />
  );
}
