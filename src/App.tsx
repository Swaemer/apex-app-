import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { AnnouncementBanner } from './components/AnnouncementBanner';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const LeadsPage = lazy(() => import('./pages/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const LabPage = lazy(() => import('./pages/LabPage').then((m) => ({ default: m.LabPage })));
const LeavePage = lazy(() => import('./pages/LeavePage').then((m) => ({ default: m.LeavePage })));
const OffersPage = lazy(() => import('./pages/OffersPage').then((m) => ({ default: m.OffersPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const PermissionsPage = lazy(() => import('./pages/PermissionsPage').then((m) => ({ default: m.PermissionsPage })));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage').then((m) => ({ default: m.DoctorsPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const ReturnRequestsPage = lazy(() => import('./pages/ReturnRequestsPage').then((m) => ({ default: m.ReturnRequestsPage })));

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const noSidebar = ['/auth', '/reset-password'].includes(location.pathname);
  return <main className={noSidebar ? '' : 'pr-56'}>{children}</main>;
};

function App() {
  return (
    <DarkModeProvider>
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Navbar />
        <AnnouncementBanner />
        <Layout>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
              <Route path="/lab" element={<ProtectedRoute><LabPage /></ProtectedRoute>} />
              <Route path="/leave" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
              <Route path="/offers" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
              <Route path="/permissions" element={<ProtectedRoute><PermissionsPage /></ProtectedRoute>} />
              <Route path="/doctors" element={<ProtectedRoute><DoctorsPage /></ProtectedRoute>} />
              <Route path="/return-requests" element={<ProtectedRoute><ReturnRequestsPage /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/auth" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
    </DarkModeProvider>
  );
}

export default App;
