/**
 * TalentProfile ↔ Resume Builder view bridge (C.8.0.2B.2).
 * Resume Builder is a view/export — not a separate source of truth.
 */

function splitName(displayName = '') {
  const parts = String(displayName).trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function talentProfileToResumeView(profile, resumeVersion = null) {
  if (!profile) return null;
  const personal = profile.personal || {};
  const fromName = splitName(profile.displayName);
  const displayName = profile.displayName
    || [personal.firstName, personal.lastName].filter(Boolean).join(' ');

  const technical = (profile.skills || []).filter((s) => (s.category || 'technical') === 'technical').map((s) => s.name);
  const soft = (profile.skills || []).filter((s) => s.category === 'soft').map((s) => s.name);

  return {
    source: 'talent-profile',
    talentProfileId: String(profile._id),
    resumeVersionId: resumeVersion?._id ? String(resumeVersion._id) : null,
    legacyResumeId: profile.legacyResumeId ? String(profile.legacyResumeId) : null,
    title: resumeVersion?.title || 'My Resume',
    template: resumeVersion?.template || 'modern-professional',
    personalInfo: {
      fullName: displayName,
      professionalTitle: profile.headline || '',
      email: '',
      phone: personal.phone || '',
      city: personal.city || '',
      province: personal.region || profile.market || '',
      linkedInUrl: profile.socialProfile?.linkedInUrl || '',
      githubUrl: profile.socialProfile?.githubUrl || '',
      portfolioUrl: profile.socialProfile?.portfolioUrl || '',
      profilePhotoUrl: profile.avatarUrl || '',
    },
    careerObjective: profile.summary || '',
    education: (profile.education || []).map((e) => ({
      degree: e.degree || '',
      university: e.institution || '',
      fieldOfStudy: e.fieldOfStudy || '',
      graduationYear: e.endYear || e.startYear || '',
      gpa: e.gpa || '',
    })),
    skills: { technical, soft },
    experience: (profile.experience || []).map((e) => ({
      company: e.company || '',
      role: e.role || '',
      duration: e.isCurrent ? `${e.startDate || ''} – Present` : [e.startDate, e.endDate].filter(Boolean).join(' – '),
      description: e.description || '',
    })),
    projects: (profile.portfolioReferences || []).map((p) => ({
      title: p.title || '',
      description: p.description || '',
      technologies: (p.technologies || []).join(', '),
    })),
    certifications: (profile.certificationReferences || []).map((c) => c.name).filter(Boolean),
    languages: (profile.languages || []).map((l) => l.language).filter(Boolean),
    // Additional sections: prefer ResumeVersion snapshot (user-edited) over canonical profile.
    // Backward-compatible: old ResumeVersion records without these fields return [].
    references: resumeVersion?.snapshot?.references || [],
    awards: resumeVersion?.snapshot?.awards || [],
    volunteerExperience: resumeVersion?.snapshot?.volunteerExperience || [],
    publications: resumeVersion?.snapshot?.publications || [],
    interests: resumeVersion?.snapshot?.interests || profile.interests || [],
    professionalMemberships: resumeVersion?.snapshot?.professionalMemberships || [],
  };
}

export function legacyResumeToResumeView(resume) {
  if (!resume) return null;
  return {
    source: 'legacy-resume',
    talentProfileId: null,
    resumeVersionId: null,
    legacyResumeId: String(resume._id),
    title: resume.title || 'My Resume',
    template: resume.template || 'modern-professional',
    personalInfo: resume.personalInfo || {},
    careerObjective: resume.careerObjective || '',
    education: resume.education || [],
    skills: resume.skills || { technical: [], soft: [] },
    experience: resume.experience || [],
    projects: resume.projects || [],
    certifications: resume.certifications || [],
    languages: resume.languages || [],
    references: resume.references || [],
    awards: resume.awards || [],
    volunteerExperience: resume.volunteerExperience || [],
    publications: resume.publications || [],
    interests: resume.interests || [],
    professionalMemberships: resume.professionalMemberships || [],
  };
}

export function resumeViewToTalentProfilePayload(view = {}) {
  const pi = view.personalInfo || {};
  const names = splitName(pi.fullName);

  return {
    displayName: pi.fullName || '',
    headline: pi.professionalTitle || '',
    summary: view.careerObjective || '',
    avatarUrl: pi.profilePhotoUrl || '',
    market: pi.province || '',
    personal: {
      firstName: names.firstName,
      lastName: names.lastName,
      phone: pi.phone || '',
      city: pi.city || '',
      region: pi.province || '',
      country: '',
    },
    socialProfile: {
      linkedInUrl: pi.linkedInUrl || '',
      githubUrl: pi.githubUrl || '',
      portfolioUrl: pi.portfolioUrl || '',
      websiteUrl: '',
      twitterUrl: '',
    },
    education: (view.education || []).map((e) => ({
      degree: e.degree || '',
      institution: e.university || '',
      fieldOfStudy: e.fieldOfStudy || '',
      startYear: '',
      endYear: e.graduationYear || '',
      gpa: e.gpa || '',
      description: '',
    })),
    experience: (view.experience || []).map((e) => ({
      company: e.company || '',
      role: e.role || '',
      location: '',
      startDate: '',
      endDate: e.duration || '',
      isCurrent: /present/i.test(e.duration || ''),
      description: e.description || '',
      achievements: [],
    })),
    skills: [
      ...(view.skills?.technical || []).map((name) => ({ name, level: 'intermediate', category: 'technical', source: 'self_reported' })),
      ...(view.skills?.soft || []).map((name) => ({ name, level: 'intermediate', category: 'soft', source: 'self_reported' })),
    ],
    languages: (view.languages || []).map((language) => ({ language, proficiency: 'conversational' })),
    certificationReferences: (view.certifications || []).map((name) => ({ name, issuer: '' })),
    portfolioReferences: (view.projects || []).map((p) => ({
      title: p.title || '',
      description: p.description || '',
      url: '',
      technologies: String(p.technologies || '').split(',').map((s) => s.trim()).filter(Boolean),
    })),
    interests: view.interests || [],
  };
}

export function resumeViewToLegacyResumePayload(view = {}, userId) {
  const payload = resumeViewToTalentProfilePayload(view);
  return {
    userId,
    title: view.title || 'My Resume',
    template: view.template || 'modern-professional',
    personalInfo: view.personalInfo || {},
    careerObjective: view.careerObjective || '',
    education: view.education || [],
    skills: view.skills || { technical: [], soft: [] },
    experience: view.experience || [],
    projects: view.projects || [],
    certifications: view.certifications || [],
    languages: view.languages || [],
    references: view.references || [],
    awards: view.awards || [],
    volunteerExperience: view.volunteerExperience || [],
    publications: view.publications || [],
    interests: view.interests || [],
    professionalMemberships: view.professionalMemberships || [],
    // keep userId linkage
    _derivedFromTalent: Boolean(payload.displayName),
  };
}

export function talentProfileToCandidateCard(profile, primaryResumeVersion = null) {
  if (!profile) return null;
  const personal = profile.personal || {};
  return {
    talentProfileId: String(profile._id),
    displayName: profile.displayName || [personal.firstName, personal.lastName].filter(Boolean).join(' '),
    headline: profile.headline || '',
    location: [personal.city, personal.region, personal.country].filter(Boolean).join(', '),
    skills: (profile.skills || []).slice(0, 8).map((s) => s.name),
    experienceSummary: (profile.experience || []).slice(0, 2).map((e) => `${e.role} @ ${e.company}`).filter(Boolean),
    primaryResumeVersionId: primaryResumeVersion?._id ? String(primaryResumeVersion._id) : null,
    resumeTitle: primaryResumeVersion?.title || null,
    visibility: profile.visibility,
  };
}

export function talentProfileToPrefill(profile, authEmail = '') {
  if (!profile) return {};
  const personal = profile.personal || {};
  const name = profile.displayName || [personal.firstName, personal.lastName].filter(Boolean).join(' ');
  return {
    name,
    fullName: name,
    firstName: personal.firstName || '',
    lastName: personal.lastName || '',
    email: authEmail,
    phone: personal.phone || '',
    city: personal.city || '',
    region: personal.region || profile.market || '',
    country: personal.country || '',
    province: personal.region || profile.market || '',
    headline: profile.headline || '',
    summary: profile.summary || '',
    linkedIn: profile.socialProfile?.linkedInUrl || '',
    github: profile.socialProfile?.githubUrl || '',
    website: profile.socialProfile?.websiteUrl || '',
  };
}
