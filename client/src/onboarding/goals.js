import { ROUTES } from '../constants';

export const ONBOARDING_GOALS = [
  { id: 'job', label: 'Find a Job', emoji: '💼', route: ROUTES.JOBS },
  { id: 'scholarship', label: 'Find Scholarships', emoji: '🎓', route: ROUTES.SCHOLARSHIPS },
  { id: 'admissions', label: 'Admissions', emoji: '🏛', route: ROUTES.ADMISSIONS },
  { id: 'resume', label: 'Build My Resume', emoji: '📄', route: ROUTES.RESUME_BUILDER },
  { id: 'abroad', label: 'Study Abroad', emoji: '🌍', route: ROUTES.FOREIGN_STUDIES },
  { id: 'career', label: 'Grow My Career', emoji: '📈', route: ROUTES.CAREER_GUIDANCE },
  { id: 'employer', label: "I'm an Employer", emoji: '🏢', route: ROUTES.EMPLOYER_DASHBOARD },
];

export function routeForGoal(goalId) {
  return ONBOARDING_GOALS.find((g) => g.id === goalId)?.route || ROUTES.JOBS;
}
