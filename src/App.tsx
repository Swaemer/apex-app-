import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { AnnouncementBanner } from './components/AnnouncementBanner';

function App() {
  return (
    <DarkModeProvider>
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Navbar />
        <AnnouncementBanner />
        <main className="pt-24">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
            <Route path="/lab" element={<ProtectedRoute><LabPage /></ProtectedRoute>} />
            <Route path="/leave" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
            <Route path="/offers" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute><PermissionsPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/auth" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
    </DarkModeProvider>
  );
}

export default App;
