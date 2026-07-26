import { Router } from 'express';
import {
  register,
  login,
  me,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  resendVerification,
} from '../controllers/authController.js';
import { getInvitationByToken, acceptInvitation } from '../controllers/admin/invitationsController.js';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { getSaved } from '../controllers/savedController.js';
import { getDashboard } from '../controllers/dashboardController.js';
import { recordRecentlyViewed } from '../controllers/recentlyViewedController.js';
import { registerFcmToken } from '../controllers/fcmController.js';
import { getMyReferrals } from '../controllers/referralsController.js';
import { requireAuth, requireUserAuth, optionalAuth } from '../middleware/auth.js';
import { authLimiter, forgotPasswordLimiter, refreshLimiter, resendVerificationLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/auth/register', authLimiter, register);
authRouter.post('/auth/login', authLimiter, login);
authRouter.post('/auth/forgot-password', forgotPasswordLimiter, forgotPassword);
authRouter.post('/auth/reset-password', authLimiter, resetPassword);
authRouter.get('/auth/verify-email', verifyEmail);
authRouter.post('/auth/verify-email', verifyEmail);
authRouter.get('/auth/accept-invitation', getInvitationByToken);
authRouter.post('/auth/accept-invitation', acceptInvitation);
authRouter.post('/auth/change-password', requireAuth, requireUserAuth, changePassword);
authRouter.post('/auth/resend-verification', resendVerificationLimiter, optionalAuth, resendVerification);
authRouter.get('/auth/me', requireAuth, requireUserAuth, me);
authRouter.post('/auth/logout', requireAuth, requireUserAuth, logout);
authRouter.post('/auth/refresh-token', refreshLimiter, refreshToken);
authRouter.get('/auth/profile', requireAuth, requireUserAuth, getProfile);
authRouter.patch('/auth/profile', requireAuth, requireUserAuth, updateProfile);
authRouter.get('/auth/saved', requireAuth, requireUserAuth, getSaved);
authRouter.get('/auth/bookmarks', requireAuth, requireUserAuth, getSaved);
authRouter.get('/auth/dashboard', requireAuth, requireUserAuth, getDashboard);
authRouter.get('/auth/referrals', requireAuth, requireUserAuth, getMyReferrals);
authRouter.post('/auth/recently-viewed', requireAuth, requireUserAuth, recordRecentlyViewed);
authRouter.post('/auth/fcm-token', requireAuth, requireUserAuth, registerFcmToken);
