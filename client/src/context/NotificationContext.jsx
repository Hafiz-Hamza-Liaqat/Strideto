import { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fcmApi } from '../services/listingsService';
import { useAuth } from './AuthContext';
import { shouldSkipUserAuthBootstrap } from '../auth/authRealm';

const NotificationContext = createContext(null);

const FCM_TOKEN_KEY = 'edurozgaar-fcm-token';

function getOrCreatePlaceholderToken() {
  let t = localStorage.getItem(FCM_TOKEN_KEY);
  if (!t) {
    t = `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(FCM_TOKEN_KEY, t);
  }
  return t;
}

export function NotificationProvider({ children }) {
  const registered = useRef(false);
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const userRealmActive = !shouldSkipUserAuthBootstrap(pathname);

  useEffect(() => {
    if (!userRealmActive || !isAuthenticated || registered.current || !('Notification' in window)) return;
    registered.current = true;
    const token = getOrCreatePlaceholderToken();
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted' && token) {
        fcmApi.registerToken(token).catch(() => {});
      }
    }).catch(() => {});
  }, [isAuthenticated, userRealmActive]);

  const registerToken = (token) => {
    if (token) {
      localStorage.setItem(FCM_TOKEN_KEY, token);
      fcmApi.registerToken(token).catch(() => {});
    }
  };

  return (
    <NotificationContext.Provider value={{ registerToken }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext) || {};
}
