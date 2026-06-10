import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { LeadsPage } from './pages/LeadsPage';
import { LabPage } from './pages/LabPage';
import { LeavePage } from './pages/LeavePage';
import { OffersPage } from './pages/OffersPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ReturnRequestsPage } from './pages/ReturnRequestsPage';
import { AnnouncementBanner } from './components/AnnouncementBanner';

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
        </Layout>
      </BrowserRouter>
    </AuthProvider>
    </DarkModeProvider>
  );
}

export default App;
