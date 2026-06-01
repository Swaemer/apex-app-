import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { LeadsPage } from './pages/LeadsPage';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Navbar />
        <main className="pt-24">
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/" element={<Navigate to="/auth" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
