import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function toSafeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
}

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: toSafeUser(user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { province, interests, notifications } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (province !== undefined) user.province = String(province).trim();
  if (Array.isArray(interests))
    user.interests = interests
      .filter((i) => typeof i === 'string')
      .slice(0, 50);
  if (notifications && typeof notifications === 'object') {
    if (typeof notifications.email === 'boolean')
      user.notifications.email = notifications.email;
    if (typeof notifications.push === 'boolean')
      user.notifications.push = notifications.push;
    if (typeof notifications.whatsapp === 'boolean')
      user.notifications.whatsapp = notifications.whatsapp;
    if (typeof notifications.telegram === 'boolean')
      user.notifications.telegram = notifications.telegram;
  }
  if (req.body.name !== undefined) user.name = String(req.body.name).trim();
  if (
    req.body.preferredLanguage !== undefined &&
    ['en', 'ur', 'ar'].includes(req.body.preferredLanguage)
  )
    user.preferredLanguage = req.body.preferredLanguage;
  if (typeof req.body.onboardingCompleted === 'boolean')
    user.onboardingCompleted = req.body.onboardingCompleted;
  if (req.body.onboardingGoal !== undefined) {
    user.onboardingGoal = String(req.body.onboardingGoal || '')
      .trim()
      .slice(0, 64);
  }
  if (
    req.body.careerPreferences !== undefined &&
    req.body.careerPreferences !== null
  ) {
    if (
      typeof req.body.careerPreferences === 'object' &&
      !Array.isArray(req.body.careerPreferences)
    ) {
      const cp = req.body.careerPreferences;
      user.careerPreferences = {
        version: Number(cp.version) || 1,
        persona: String(cp.persona || '')
          .trim()
          .slice(0, 64),
        lookingFor: Array.isArray(cp.lookingFor)
          ? cp.lookingFor.filter((x) => typeof x === 'string').slice(0, 20)
          : [],
        educationLevel: String(cp.educationLevel || '')
          .trim()
          .slice(0, 64),
        fieldsOfInterest: Array.isArray(cp.fieldsOfInterest)
          ? cp.fieldsOfInterest
              .filter((x) => typeof x === 'string')
              .slice(0, 30)
          : [],
        preferredLocations: Array.isArray(cp.preferredLocations)
          ? cp.preferredLocations
              .filter((x) => typeof x === 'string')
              .slice(0, 20)
          : [],
        experience: String(cp.experience || '')
          .trim()
          .slice(0, 64),
        careerGoal: String(cp.careerGoal || '')
          .trim()
          .slice(0, 64),
        notificationPrefs:
          cp.notificationPrefs && typeof cp.notificationPrefs === 'object'
            ? {
                jobs: !!cp.notificationPrefs.jobs,
                scholarships: !!cp.notificationPrefs.scholarships,
                admissions: !!cp.notificationPrefs.admissions,
                internships: !!cp.notificationPrefs.internships,
                careerArticles: !!cp.notificationPrefs.careerArticles,
                deadlineReminders: !!cp.notificationPrefs.deadlineReminders,
              }
            : {},
        profilingCompleted: !!cp.profilingCompleted,
        profilingSkipped: !!cp.profilingSkipped,
        updatedAt: cp.updatedAt || new Date().toISOString(),
      };
      // Mirror looking-for into legacy interests for existing filters
      if (user.careerPreferences.lookingFor.length) {
        user.interests = user.careerPreferences.lookingFor.slice(0, 50);
      }
      if (
        user.careerPreferences.preferredLocations?.includes('Punjab') ||
        user.careerPreferences.preferredLocations?.includes('Sindh') ||
        user.careerPreferences.preferredLocations?.includes(
          'Khyber Pakhtunkhwa'
        ) ||
        user.careerPreferences.preferredLocations?.includes('Balochistan') ||
        user.careerPreferences.preferredLocations?.includes('Islamabad')
      ) {
        const province = user.careerPreferences.preferredLocations.find((loc) =>
          [
            'Punjab',
            'Sindh',
            'Khyber Pakhtunkhwa',
            'Balochistan',
            'Islamabad',
          ].includes(loc)
        );
        if (province && !user.province) user.province = province;
      }
    }
  }
  await user.save();
  res.json({ user: toSafeUser(user) });
});
