import { BrowserRouter , Route, Routes } from "react-router-dom";
import Home from './Pages/Home';
import SitePage from './Pages/SitePage';
import Attendance from "./Pages/Attendance";
import Payments from "./Pages/Payments";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element= {<Login/>} />
            <Route path="/signup" element= {<SignUp/>} />
            <Route path="/forgot-password" element= {<ForgotPassword/>} />
            <Route path="/reset-password" element= {<ResetPassword/>} />
            <Route path="/" element= {
              <ProtectedRoute>
                <Home/>
              </ProtectedRoute>
            } />
            <Route path="/site/:siteID" element= {
                <ProtectedRoute>
                  <SitePage/>
                </ProtectedRoute>
              } />
              <Route path="/attendance/:siteID" element= {
                <ProtectedRoute>
                  <Attendance/>
                </ProtectedRoute>
              } />
              <Route path="/payments/:siteID" element= {
                <ProtectedRoute>
                  <Payments/>
                </ProtectedRoute>
              } />
              {/* Add more routes as needed */}
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
  )
}

export default App
