import React, { useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react"
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from './Pages/Home';
import Settings from './Pages/Settings';
import SitePage from './Pages/SitePage';
import Attendance from "./Pages/Attendance";
import Payments from "./Pages/Payments";
import ChangeTracking from "./Pages/ChangeTracking";
import SiteExpenses from "./Pages/SiteExpenses";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import ProtectedRoute from './components/ProtectedRoute';
import LoginV2 from "./Pages/LoginV2";
import { initGA, trackWebVitals } from './utils/analytics';
import './styles/seo.css';

function App() {


  useEffect(() => {
    initGA();
    trackWebVitals();
  }, []);


  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginV2 />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/loginold" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/site/:siteID" element={
              <ProtectedRoute>
                <SitePage />
              </ProtectedRoute>
            } />
            <Route path="/attendance/:siteID" element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            } />
            <Route path="/payments/:siteID" element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            } />
            <Route path="/site-expenses/:siteID" element={
              <ProtectedRoute>
                <SiteExpenses />
              </ProtectedRoute>
            } />
            <Route path="/change-tracking/:siteID" element={
              <ProtectedRoute>
                <ChangeTracking />
              </ProtectedRoute>
            } />
            <Route path="/settings/:siteID" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            {/* Add more routes as needed */}
          </Routes>
        </BrowserRouter>
        <Analytics />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
