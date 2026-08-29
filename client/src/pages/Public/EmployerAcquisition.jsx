import { EmployerAcquisitionLayout } from '../../components/employer/acquisition/EmployerAcquisitionLayout';
import { ROUTES } from '../../constants';
import { isEmployerWorkspaceLaunched } from '../../config/workspaceLaunchGates';

export default function EmployerAcquisition() {
  const workspaceOpen = isEmployerWorkspaceLaunched();

  return (
    <EmployerAcquisitionLayout
      title="Hire Emerging Talent & Post Jobs | STRIDETO"
      description="Create an employer workspace, publish jobs, choose how candidates apply, and review STRIDETO-submitted applicants where supported."
      canonical={ROUTES.FOR_EMPLOYERS}
      heading="Reach emerging talent and manage hiring in one workspace"
      intro="Publish opportunities, choose how candidates apply, and review applicants submitted through STRIDETO — all from your employer workspace."
      workspaceAvailable={workspaceOpen}
      benefits={[
        {
          title: 'Publish opportunities',
          body: 'Create public job listings from your employer workspace with structured role details, location, and requirements.',
        },
        {
          title: 'Control how candidates apply',
          body: 'Use STRIDETO-supported applications where available, or direct candidates to your external application page or email.',
        },
        {
          title: 'Review STRIDETO-submitted applicants',
          body: 'Keep supported applicant review connected to your employer workspace when candidates apply through STRIDETO.',
        },
        {
          title: 'Public discovery',
          body: 'Published opportunities can appear in STRIDETO public job discovery where candidates browse and search listings.',
        },
      ]}
      steps={[
        {
          title: 'Create your employer account',
          body: 'Build your employer presence and access the employer workspace.',
        },
        {
          title: 'Publish an opportunity',
          body: 'Add the role, requirements, location, application method, and relevant details.',
        },
        {
          title: 'Reach candidates',
          body: 'Your published opportunity can appear in STRIDETO public job discovery.',
        },
        {
          title: 'Manage supported applications',
          body: 'Review applicants submitted through STRIDETO where that application method is used. External applications continue on the employer’s own site.',
        },
      ]}
      applicationMethods={[
        {
          title: 'Apply through STRIDETO',
          body: 'Candidates submit through STRIDETO and supported applicant information can be reviewed within the employer workspace.',
        },
        {
          title: 'External application',
          body: 'Candidates are sent to the employer’s own careers or application page. Those applications are not tracked or managed inside STRIDETO.',
        },
      ]}
      accountBenefits={[
        'Publish and manage job opportunities from your employer workspace',
        'Maintain your organization profile and company information',
        'Choose the supported application method for each listing',
        'Review applicants submitted through STRIDETO where supported',
        'Access your hiring workspace, job history, and listing status',
      ]}
      trustItems={[
        { label: 'Dedicated employer workspace' },
        { label: 'Transparent application-method controls' },
        { label: 'Public opportunity discovery on STRIDETO' },
        { label: 'Employer-controlled job details and branding' },
        { label: 'Contact', href: ROUTES.CONTACT },
        { label: 'Terms of Service', href: ROUTES.TERMS },
        { label: 'Privacy Policy', href: ROUTES.PRIVACY_POLICY },
        { label: 'Editorial Policy', href: ROUTES.EDITORIAL_POLICY },
      ]}
      faqs={[
        {
          question: 'What can employers publish on STRIDETO?',
          answer:
            'Employers can create and manage job listings from the employer workspace, including role details, location, requirements, and how candidates should apply.',
        },
        {
          question: 'How can candidates apply?',
          answer:
            'You choose per listing: candidates can apply through STRIDETO where supported, or you can direct them to an external application URL or email address.',
        },
        {
          question: 'Can I send candidates to my own application page?',
          answer:
            'Yes. You can set an external application link or email for a listing. Candidates complete their application on your site or via your process.',
        },
        {
          question: 'Can I review applications inside STRIDETO?',
          answer:
            'You can review applicants submitted through STRIDETO where that application method is enabled. External applications are handled outside STRIDETO and are not visible in your applicant dashboard.',
        },
        {
          question: 'Where do published jobs appear?',
          answer:
            'Approved listings can appear in STRIDETO public job discovery, where students and job seekers browse opportunities.',
        },
        {
          question: 'Do I need an employer account to post?',
          answer:
            'Yes. Creating an employer account gives you access to the employer workspace where you can publish and manage opportunities.',
        },
      ]}
    />
  );
}
