import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import { api } from './lib/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import Requisitions from './pages/Requisitions';
import Reports from './pages/Reports';
import Admin from './pages/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken, setAccessToken, setUser, logout, setLoading, isLoading } =
    useAuthStore();

  useEffect(() => {
    const restoreSession = async () => {
      if (!accessToken && !refreshToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data.data);
      } catch {
        if (refreshToken) {
          try {
            const response = await axios.post('/api/v1/auth/refresh', { refreshToken });
            const newAccessToken = response.data.data.accessToken;
            setAccessToken(newAccessToken);

            const meResponse = await api.get('/auth/me');
            setUser(meResponse.data.data);
          } catch {
            logout();
          }
        } else {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-aai-dark text-aai-muted text-sm font-medium" role="status" aria-live="polite">
        Restoring session…
      </div>
    );
  }

  return <>{children}</>;
}

// Guard component for authenticated private routes
interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Guard component for public login route
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <BrowserRouter>
          <Routes>
          {/* Public Authentication */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Secure Workspace Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            {/* Dashboard */}
            <Route index element={<Dashboard />} />

            {/* Inventory catalog */}
            <Route path="inventory" element={<Inventory />} />

            {/* Procurement PO workflows */}
            <Route
              path="purchase-orders"
              element={
                <PrivateRoute allowedRoles={['SUPER_ADMIN', 'AIRPORT_MGR', 'STAFF', 'AUDITOR']}>
                  <PurchaseOrders />
                </PrivateRoute>
              }
            />

            {/* Internal requisitions workflows */}
            <Route path="requisitions" element={<Requisitions />} />

            {/* Audit reports & analytics */}
            <Route
              path="reports"
              element={
                <PrivateRoute allowedRoles={['SUPER_ADMIN', 'AIRPORT_MGR', 'STAFF', 'AUDITOR']}>
                  <Reports />
                </PrivateRoute>
              }
            />

            {/* Central Administration RBAC panel */}
            <Route
              path="admin"
              element={
                <PrivateRoute allowedRoles={['SUPER_ADMIN', 'AUDITOR']}>
                  <Admin />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Fallback wildcard */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
