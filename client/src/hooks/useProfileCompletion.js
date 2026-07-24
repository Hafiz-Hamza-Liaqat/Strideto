import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { talentApi } from '../services/talentApi';
import { shouldUseTalentProfileApi } from '../config/careerFeatureFlags';
import {
  buildProfileCompletionSignals,
  evaluateWeightedProfileCompletion,
  findNewMilestones,
  markMilestoneReached,
} from '@shared/profile/profileCompletionWeights.js';
import {
  loadCareerPreferencesLocal,
  normalizeCareerPreferences,
} from '../preferences/careerPreferences.js';
import { useToast } from '../context/ToastContext';

/**
 * Loads profile completion signals and returns weighted evaluation.
 */
export function useProfileCompletion({ enabled = true } = {}) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [talent, setTalent] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled && isAuthenticated));

  const userId = user?._id ? String(user._id) : null;

  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let nextTalent = null;
      let resume = false;
      if (shouldUseTalentProfileApi()) {
        try {
          const [{ data: me }, versionsRes, summaryRes] = await Promise.all([
            talentApi.getMe().catch(() => ({ data: null })),
            talentApi.listResumeVersions().catch(() => ({ data: null })),
            talentApi.getSummary().catch(() => ({ data: null })),
          ]);
          nextTalent = me || null;
          const versions = versionsRes?.data?.data
            || versionsRes?.data?.resumeVersions
            || (Array.isArray(versionsRes?.data) ? versionsRes.data : [])
            || summaryRes?.data?.resumeVersions
            || [];
          const legacy = summaryRes?.data?.legacyResumes || [];
          resume = (Array.isArray(versions) && versions.length > 0)
            || (Array.isArray(legacy) && legacy.length > 0);
        } catch {
          /* soft-fail */
        }
      }
      if (!cancelled) {
        setTalent(nextTalent);
        setHasResume(resume);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, isAuthenticated, userId]);

  const prefs = useMemo(() => {
    const fromUser = user?.careerPreferences
      ? normalizeCareerPreferences(user.careerPreferences)
      : null;
    return fromUser || loadCareerPreferencesLocal(userId);
  }, [user?.careerPreferences, userId]);

  const evaluation = useMemo(() => {
    const signals = buildProfileCompletionSignals({
      user,
      talent,
      hasResume,
      careerPreferences: prefs,
    });
    return evaluateWeightedProfileCompletion(signals);
  }, [user, talent, hasResume, prefs]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || loading) return;
    const news = findNewMilestones(evaluation.percent, userId);
    news.forEach((m) => {
      if (markMilestoneReached(m, userId)) {
        toast.success(
          `🎉 Your profile is now ${m}% complete. Better recommendations unlocked.`
        );
      }
    });
  }, [enabled, isAuthenticated, loading, evaluation.percent, userId, toast]);

  return {
    loading,
    percent: evaluation.percent,
    items: evaluation.items,
    missing: evaluation.missing,
    completed: evaluation.completed,
    hasResume,
    evaluation,
  };
}

export default useProfileCompletion;
