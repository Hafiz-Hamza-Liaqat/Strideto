import i18n from '../../i18n/index.js';
import { displayName } from './resumeRenderUtils';
import './resume-document.css';

const L = (key) => i18n.t(key, { ns: 'resume' });

const SKIN_CLASS = {
  'modern-professional': 'resume-skin-modern',
  'minimal-ats': 'resume-skin-minimal',
  'creative-portfolio': 'resume-skin-creative',
  'academic-cv': 'resume-skin-academic',
};

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">{title}</h2>
      <div className="resume-section-body">{children}</div>
    </section>
  );
}

function SkillList({ skills }) {
  if (!skills?.length) return null;
  return (
    <ul className="resume-skill-list">
      {skills.map((skill, i) => (
        <li key={`${skill}-${i}`} className="resume-skill-item">{skill}</li>
      ))}
    </ul>
  );
}

function ResumeHeader({ vm, template, showPhoto }) {
  const { personal: p } = vm;
  const name = displayName(p);
  const contact = [p.email, p.phone, p.location].filter(Boolean).join(' · ');
  const socialParts = [];
  if (p.linkedInUrl) socialParts.push('LinkedIn');
  if (p.githubUrl) socialParts.push('GitHub');
  if (p.portfolioUrl) socialParts.push('Portfolio');

  if (template === 'creative-portfolio' && showPhoto) {
    return (
      <header className="resume-header flex items-start gap-3">
        {p.profilePhotoUrl ? (
          <img
            src={p.profilePhotoUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover border-2 border-emerald-200 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 text-lg font-bold shrink-0" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="resume-name">{name}</p>
          {p.professionalTitle && <p className="resume-title">{p.professionalTitle}</p>}
          {contact && <p className="resume-contact">{contact}</p>}
          {socialParts.length > 0 && <p className="resume-social">{socialParts.join(' · ')}</p>}
        </div>
      </header>
    );
  }

  return (
    <header className="resume-header">
      <p className="resume-name">{name}</p>
      {p.professionalTitle && <p className="resume-title">{p.professionalTitle}</p>}
      {contact && <p className="resume-contact">{contact}</p>}
      {socialParts.length > 0 && <p className="resume-social">{socialParts.join(' · ')}</p>}
    </header>
  );
}

/**
 * Single presentation component used by live preview and PDF export.
 * Pass a pre-built view-model from buildResumeViewModel(resume).
 */
export function ResumeDocument({ viewModel, template = 'modern-professional' }) {
  const vm = viewModel;
  const skin = SKIN_CLASS[template] || SKIN_CLASS['modern-professional'];
  const projectsTitle = template === 'academic-cv' ? L('researchProjects') : L('projects');
  const objectiveTitle = template === 'academic-cv' ? L('objective') : L('careerObjective');

  return (
    <div
      className={`resume-preview bg-white font-sans p-[15mm] ${skin}`}
      style={{ width: '210mm', maxWidth: '210mm', minHeight: '297mm' }}
      data-resume-template={template}
      data-print-width="210mm"
    >
      <ResumeHeader vm={vm} template={template} showPhoto />

      {vm.careerObjective && (
        <Section title={objectiveTitle}>
          <p className="resume-entry-text m-0">{vm.careerObjective}</p>
        </Section>
      )}

      {vm.education.length > 0 && (
        <Section title={L('education')}>
          {vm.education.map((e, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">
                {e.degree}{e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : ''}
              </p>
              <p className="resume-entry-meta">
                {[e.university, e.graduationYear, e.gpa ? `GPA ${e.gpa}` : ''].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </Section>
      )}

      {vm.technicalSkills.length > 0 && (
        <Section title={L('technicalSkills')}>
          <SkillList skills={vm.technicalSkills} />
        </Section>
      )}

      {vm.softSkills.length > 0 && (
        <Section title={L('softSkills')}>
          <SkillList skills={vm.softSkills} />
        </Section>
      )}

      {vm.experience.length > 0 && (
        <Section title={L('experience')}>
          {vm.experience.map((e, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">
                {e.role}{e.company ? ` — ${e.company}` : ''}
              </p>
              {e.duration && <p className="resume-entry-meta">{e.duration}</p>}
              {e.description && <p className="resume-entry-text">{e.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {vm.projects.length > 0 && (
        <Section title={projectsTitle}>
          {vm.projects.map((pr, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{pr.title}</p>
              {pr.technologies && <p className="resume-entry-meta">{pr.technologies}</p>}
              {pr.description && <p className="resume-entry-text">{pr.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {vm.certifications.length > 0 && (
        <Section title={L('certifications')}>
          <p className="resume-inline-list">{vm.certifications.join(' · ')}</p>
        </Section>
      )}

      {vm.languages.length > 0 && (
        <Section title={L('languages')}>
          <p className="resume-inline-list">{vm.languages.join(' · ')}</p>
        </Section>
      )}

      {vm.references.length > 0 && (
        <Section title={L('references')}>
          {vm.references.map((r, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{r.name}{r.title ? ` — ${r.title}` : ''}</p>
              <p className="resume-entry-meta">{[r.company, r.email, r.phone].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </Section>
      )}

      {vm.awards.length > 0 && (
        <Section title={L('awards')}>
          {vm.awards.map((a, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{a.title}{a.year ? ` (${a.year})` : ''}</p>
              {a.issuer && <p className="resume-entry-meta">{a.issuer}</p>}
              {a.description && <p className="resume-entry-text">{a.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {vm.volunteerExperience.length > 0 && (
        <Section title={L('volunteerExperience')}>
          {vm.volunteerExperience.map((v, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{v.role}{v.organization ? ` @ ${v.organization}` : ''}</p>
              {v.duration && <p className="resume-entry-meta">{v.duration}</p>}
              {v.description && <p className="resume-entry-text">{v.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {vm.publications.length > 0 && (
        <Section title={L('publications')}>
          {vm.publications.map((pub, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{pub.title}{pub.year ? ` (${pub.year})` : ''}</p>
              {pub.publisher && <p className="resume-entry-meta">{pub.publisher}</p>}
              {pub.description && <p className="resume-entry-text">{pub.description}</p>}
              {pub.url && <p className="resume-entry-meta break-all">{pub.url}</p>}
            </div>
          ))}
        </Section>
      )}

      {vm.interests.length > 0 && (
        <Section title={L('interests')}>
          <p className="resume-inline-list">{vm.interests.join(' · ')}</p>
        </Section>
      )}

      {vm.professionalMemberships.length > 0 && (
        <Section title={L('professionalMemberships')}>
          {vm.professionalMemberships.map((m, i) => (
            <div key={i} className="resume-entry">
              <p className="resume-entry-title">{m.organization}{m.role ? ` — ${m.role}` : ''}</p>
              {m.since && <p className="resume-entry-meta">{m.since}</p>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
