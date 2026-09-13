import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NavigationContextType {
  page: string;
  setPage: (page: string) => void;
  redirectAfterLogin: string | null;
  setRedirectAfterLogin: (page: string | null) => void;
  selectedServiceId: number | string | null;
  setSelectedServiceId: (id: number | string | null) => void;
  resetToken: string | null;
  setResetToken: (token: string | null) => void;
}

const getInitialState = (): { page: string; token: string | null } => {
  if (typeof window === 'undefined') {
    return { page: 'landing', token: null };
  }

  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  const queryPage = searchParams.get('page');

  if (path === 'reset-password' || queryPage === 'reset-password' || token) {
    return { page: 'reset-password', token };
  }
  if (path === 'forgot-password' || queryPage === 'forgot-password') {
    return { page: 'forgot-password', token: null };
  }
  if (path === 'login' || queryPage === 'login') {
    return { page: 'login', token: null };
  }
  if (path === 'register' || queryPage === 'register') {
    return { page: 'register', token: null };
  }

  return { page: 'landing', token: null };
};

const NavigationContext = createContext<NavigationContextType>({
  page: 'landing',
  setPage: () => {},
  redirectAfterLogin: null,
  setRedirectAfterLogin: () => {},
  selectedServiceId: null,
  setSelectedServiceId: () => {},
  resetToken: null,
  setResetToken: () => {},
});

export const useNavigation = () => useContext(NavigationContext);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const initial = getInitialState();
  const [page, setPageState] = useState<string>(initial.page);
  const [resetToken, setResetToken] = useState<string | null>(initial.token);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | string | null>(null);

  const setPage = (newPage: string) => {
    setPageState(newPage);

    // Keep URL clean and synchronized with current view without reloading
    try {
      if (newPage === 'reset-password') {
        const tokenQuery = resetToken ? `?token=${encodeURIComponent(resetToken)}` : window.location.search;
        window.history.pushState({ page: newPage }, '', `/reset-password${tokenQuery}`);
      } else if (newPage === 'forgot-password') {
        window.history.pushState({ page: newPage }, '', '/forgot-password');
      } else if (newPage === 'login') {
        window.history.pushState({ page: newPage }, '', '/login');
      } else if (newPage === 'register') {
        window.history.pushState({ page: newPage }, '', '/register');
      } else if (newPage === 'landing') {
        window.history.pushState({ page: newPage }, '', '/');
      }
    } catch {
      // Ignore if running in non-standard environment
    }
  };

  // Sync state on browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const state = getInitialState();
      setPageState(state.page);
      if (state.token) {
        setResetToken(state.token);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        page,
        setPage,
        redirectAfterLogin,
        setRedirectAfterLogin,
        selectedServiceId,
        setSelectedServiceId,
        resetToken,
        setResetToken,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
