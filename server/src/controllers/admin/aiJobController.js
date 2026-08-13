import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';

const WORK_MODE_LABEL = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  on_site: 'On-site',
};

/**
 * Template-assisted job description generator.
 * Deterministic output only — paid AI providers are not configured (AI budget policy).
 */
export const generateJobDescription = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = sanitizeString(body.title || '');
  const organization = sanitizeString(body.organization || body.company || '');
  const location = sanitizeString(body.location || body.province || '');
  const jobFamily = sanitizeString(body.jobFamily || '');
  const specialization = sanitizeString(body.specialization || '');
  const workMode = sanitizeString(body.workMode || '');
  const skills = Array.isArray(body.skills) ? body.skills.filter((s) => typeof s === 'string').slice(0, 15).map(sanitizeString) : [];

  if (!title) return res.status(400).json({ error: 'Job title is required' });

  const locPart = location ? ` based in ${location}` : '';
  const orgPart = organization || 'the hiring organization';
  const familyPart = [jobFamily, specialization].filter(Boolean).join(' / ');
  const modePart = workMode ? WORK_MODE_LABEL[workMode] || workMode : '';

  const summary = `${title} at ${orgPart}${locPart}${modePart ? ` (${modePart})` : ''}.`.slice(0, 220);
  const about = `${orgPart} is hiring a ${title}${locPart}. This draft is template-assisted. An AI provider is not configured. Edit before use. Never auto-published.`;
  const responsibilities = [
    `Deliver the core work of the ${title} role.`,
    'Collaborate with the team and stakeholders.',
    'Meet agreed quality and timeline standards.',
  ];
  const requirements = [
    familyPart ? `Background aligned with ${familyPart}.` : 'Relevant experience or education in the field.',
    'Clear written and verbal communication.',
    'Ability to work independently and with others.',
  ];
  const skillsList = skills.length ? skills : [];
  const other = [
    modePart ? `Work mode: ${modePart}.` : null,
    location ? `Location: ${location}.` : null,
    'Application and verification rules follow the live job form, not this draft.',
  ].filter(Boolean);

  const description = [
    `SUMMARY\n${summary}`,
    `ABOUT THE ROLE\n${about}`,
    `RESPONSIBILITIES\n${responsibilities.map((item) => `• ${item}`).join('\n')}`,
    `REQUIREMENTS\n${requirements.map((item) => `• ${item}`).join('\n')}`,
    skillsList.length ? `SKILLS\n${skillsList.map((item) => `• ${item}`).join('\n')}` : null,
    `OTHER DETAILS\n${other.map((item) => `• ${item}`).join('\n')}`,
  ].filter(Boolean).join('\n\n');

  res.json({
    provider: 'template',
    aiConfigured: false,
    description,
    summary,
    sections: {
      summary,
      about,
      responsibilities: responsibilities.join('\n'),
      requirements: requirements.join('\n'),
      skills: skillsList.join('\n'),
      other: other.join('\n'),
    },
    suggested: {
      title: title || undefined,
      organization: organization || undefined,
      location: location || undefined,
      jobFamily: jobFamily || undefined,
      specialization: specialization || undefined,
      workMode: workMode || undefined,
      requirements: skillsList.length ? skillsList : ['Relevant experience', 'Good communication skills'],
    },
  });
});
