import { create } from 'zustand';

interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'AIRPORT_MGR' | 'STAFF' | 'REQUESTER' | 'AUDITOR';
  airportId: string | null;
  airport: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

const storedAccessToken = localStorage.getItem('aerostock_access_token');
const storedRefreshToken = localStorage.getItem('aerostock_refresh_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('aerostock_user') || 'null'),
  accessToken: storedAccessToken,
  refreshToken: storedRefreshToken,
  isAuthenticated: false,
  isLoading: !!(storedAccessToken || storedRefreshToken),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('aerostock_user', JSON.stringify(user));
    localStorage.setItem('aerostock_access_token', accessToken);
    localStorage.setItem('aerostock_refresh_token', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  setAccessToken: (accessToken) => {
    localStorage.setItem('aerostock_access_token', accessToken);
    set({ accessToken });
  },

  setUser: (user) => {
    localStorage.setItem('aerostock_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('aerostock_user');
    localStorage.removeItem('aerostock_access_token');
    localStorage.removeItem('aerostock_refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
