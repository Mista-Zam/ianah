import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WallProvider } from "./store/WallStore";
import PublicLayout from "./components/public/PublicLayout";
import AdminLayout from "./components/admin/AdminLayout";
import Toaster from "./components/ui/Toaster";
import HomePage from "./pages/HomePage";
import WallPage from "./pages/WallPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminLogin from "./pages/admin/AdminLogin";
import SignUp from "./pages/admin/SignUp";
import AdminDashboard from "./pages/admin/AdminDashboard";
import PendingPosts from "./pages/admin/PendingPosts";
import PublishedPosts from "./pages/admin/PublishedPosts";
import RejectedPosts from "./pages/admin/RejectedPosts";
import ReportedPosts from "./pages/admin/ReportedPosts";
import ModerationLogs from "./pages/admin/ModerationLogs";
import AdminSettings from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <WallProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — the Kindness Wall itself is the focus */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/wall" element={<WallPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Moderation console — never linked from the public navigation */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/signup" element={<SignUp />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="pending" element={<PendingPosts />} />
            <Route path="published" element={<PublishedPosts />} />
            <Route path="rejected" element={<RejectedPosts />} />
            <Route path="reported" element={<ReportedPosts />} />
            <Route path="logs" element={<ModerationLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </WallProvider>
  );
}