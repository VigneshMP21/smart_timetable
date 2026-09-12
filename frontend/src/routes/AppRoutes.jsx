/**
 * AppRoutes - Application routing with auth integration.
 *
 * - Landing page (/) uses LandingNavbar (no sidebar)
 * - Auth pages use AuthLayout (no navbar/sidebar)
 * - Protected pages require authentication
 * - AuthModal shown for unauthenticated access attempts
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import LandingNavbar from '../components/LandingNavbar/LandingNavbar';
import Loader from '../components/Loader/Loader';
import AuthModal from '../components/Auth/AuthModal';

const Home = lazy(() => import('../pages/Home'));
const Terms = lazy(() => import('../pages/Terms'));
const Privacy = lazy(() => import('../pages/Privacy'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const VerifyEmail = lazy(() => import('../pages/VerifyEmail'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Phase 2 dashboard shell + pages (all logged-in-only pages live here)
const ProtectedLayout = lazy(() => import('../dashboard/ProtectedLayout'));
const DashboardPage = lazy(() => import('../dashboard/Dashboard'));
const AddClass = lazy(() => import('../dashboard/AddClass'));
const AddRoom = lazy(() => import('../dashboard/AddRoom'));
const AddSubjects = lazy(() => import('../dashboard/AddSubjects'));
const AddFaculty = lazy(() => import('../dashboard/AddFaculty'));
const TimetableTemplate = lazy(() => import('../dashboard/TimetableTemplate'));
const ManualTimetable = lazy(() => import('../dashboard/ManualTimetable'));
const About = lazy(() => import('../dashboard/About'));
const Profile = lazy(() => import('../dashboard/Profile'));
const Upload = lazy(() => import('../dashboard/Upload'));
const Generate = lazy(() => import('../dashboard/Generate'));
const Result = lazy(() => import('../dashboard/Result'));
const ClassView = lazy(() => import('../dashboard/ClassView'));
const FacultyView = lazy(() => import('../dashboard/FacultyView'));
const Statistics = lazy(() => import('../dashboard/Statistics'));
const Settings = lazy(() => import('../dashboard/Settings'));
const DeleteAccount = lazy(() => import('../dashboard/DeleteAccount'));

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/add-class',
  '/dashboard/add-room',
  '/dashboard/add-subjects',
  '/dashboard/add-faculty',
  '/dashboard/template',
  '/dashboard/manual',
  '/upload',
  '/generate',
  '/result',
  '/statistics',
  '/settings',
  '/profile',
  '/delete-account',
  '/about',
];

export default function AppRoutes() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isAuthPage = AUTH_ROUTES.includes(location.pathname);
  const isDashboardPage =
    DASHBOARD_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith('/result/class/') ||
    location.pathname.startsWith('/result/faculty/');

  if (isAuthPage) {
    return (
      <Suspense fallback={<Loader message="Loading..." />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
        <AuthModal />
      </Suspense>
    );
  }

  // All logged-in pages render inside the dashboard shell.
  if (isDashboardPage) {
    return (
      <Suspense fallback={<Loader message="Loading dashboard..." />}>
        <Routes>
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/add-class" element={<AddClass />} />
            <Route path="/dashboard/add-room" element={<AddRoom />} />
            <Route path="/dashboard/add-subjects" element={<AddSubjects />} />
            <Route path="/dashboard/add-faculty" element={<AddFaculty />} />
            <Route path="/dashboard/template" element={<TimetableTemplate />} />
            <Route path="/dashboard/manual" element={<ManualTimetable />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/result" element={<Result />} />
            <Route path="/result/class/:className" element={<ClassView />} />
            <Route path="/result/faculty/:facultyName" element={<FacultyView />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/about" element={<About />} />
          </Route>
        </Routes>
        <AuthModal />
      </Suspense>
    );
  }

  // Public shell: landing + legal pages (no nav list, no sidebar).
  return (
    <div className={isHome ? 'landing-layout' : 'app-layout'}>
      {isHome ? <LandingNavbar /> : <Navbar />}
      <main className={isHome ? 'landing-main' : 'app-main'}>
        <Suspense fallback={<Loader message="Loading page..." />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <AuthModal />
    </div>
  );
}
