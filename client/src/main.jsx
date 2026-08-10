import React, { Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { initI18n } from './i18n/index.js';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { BrandProvider } from './design-system/BrandProvider';
import { AuthProvider } from './context/AuthContext';
import { EmployerAuthProvider } from './context/EmployerAuthContext';
import { AgentAuthProvider } from './context/AgentAuthContext';
import { InstitutionAuthProvider } from './context/InstitutionAuthContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import { LANG_STORAGE_KEY } from './i18n/config.js';
import { OnboardingProvider } from './onboarding';
import './index.css';

const BOOTSTRAP_LOADING = {
  en: 'Loading...',
  ur: 'لوڈ ہو رہا ہے...',
  ar: 'جاري التحميل...',
};

function getBootstrapLoadingText() {
  try {
    const lang = localStorage.getItem(LANG_STORAGE_KEY) || 'en';
    return BOOTSTRAP_LOADING[lang] || BOOTSTRAP_LOADING.en;
  } catch {
    return BOOTSTRAP_LOADING.en;
  }
}

function PageLoading() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 bg-bg-main dark:bg-secondary">
      {t('loading')}
    </div>
  );
}

function Bootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-bg-main dark:bg-secondary">
        {getBootstrapLoadingText()}
      </div>
    );
  }

  return (
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <BrandProvider>
            <AuthProvider>
              <EmployerAuthProvider>
                <AgentAuthProvider>
                  <InstitutionAuthProvider>
                  <LanguageProvider>
                  <ToastProvider>
                    <NotificationProvider>
                      <OnboardingProvider>
                        <Suspense fallback={<PageLoading />}>
                          <App />
                        </Suspense>
                      </OnboardingProvider>
                    </NotificationProvider>
                  </ToastProvider>
                  </LanguageProvider>
                  </InstitutionAuthProvider>
                </AgentAuthProvider>
              </EmployerAuthProvider>
            </AuthProvider>
          </BrandProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>
);
