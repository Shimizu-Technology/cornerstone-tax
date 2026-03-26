import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"

// Analytics
import { PostHogPageView } from "./providers/PostHogProvider"

// Layouts
import PublicLayout from "./components/layouts/PublicLayout"
import AdminLayout from "./components/layouts/AdminLayout"
import PortalLayout from "./components/layouts/PortalLayout"

// Auth
import ProtectedRoute from "./components/auth/ProtectedRoute"

// Public Pages (not lazy — needed on first paint)
import Home from "./pages/public/Home"
import About from "./pages/public/About"
import Services from "./pages/public/Services"
import Contact from "./pages/public/Contact"
import Form2848 from "./pages/public/Form2848"

// Intake (not lazy — public-facing)
import IntakeForm from "./pages/intake/IntakeForm"

// Admin Pages — lazy loaded (CST-12: code splitting)
const Dashboard = lazy(() => import("./pages/admin/Dashboard"))
const ClientList = lazy(() => import("./pages/admin/ClientList"))
const ClientDetail = lazy(() => import("./pages/admin/ClientDetail"))
const TaxReturns = lazy(() => import("./pages/admin/TaxReturns"))
const TaxReturnDetail = lazy(() => import("./pages/admin/TaxReturnDetail"))
const Activity = lazy(() => import("./pages/admin/Activity"))
const Users = lazy(() => import("./pages/admin/Users"))
const Settings = lazy(() => import("./pages/admin/Settings"))
const TimeTracking = lazy(() => import("./pages/admin/TimeTracking"))
const Schedule = lazy(() => import("./pages/admin/Schedule"))
const Operations = lazy(() => import("./pages/admin/Operations"))
const DailyTaskBoard = lazy(() => import("./pages/admin/DailyTaskBoard"))

// Portal Pages — lazy loaded
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"))
const PortalReturns = lazy(() => import("./pages/portal/PortalReturns"))
const PortalReturnDetail = lazy(() => import("./pages/portal/PortalReturnDetail"))
const PortalDocuments = lazy(() => import("./pages/portal/PortalDocuments"))
const PortalSettings = lazy(() => import("./pages/portal/PortalSettings"))
const PortalNotes = lazy(() => import("./pages/portal/PortalNotes"))

// Loading fallback for lazy routes
function AdminLoadingFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <PostHogPageView />
      <Routes>
        {/* Public Marketing Pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/form-2848" element={<Form2848 />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        {/* Client Intake Form - CST-19: Support /intake/personal and /intake/business */}
        <Route path="/intake" element={<IntakeForm />} />
        <Route path="/intake/personal" element={<IntakeForm />} />
        <Route path="/intake/business" element={<IntakeForm />} />

        {/* Admin Dashboard - Protected (staff = admin or employee) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<AdminLoadingFallback />}><Dashboard /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={<AdminLoadingFallback />}><ClientList /></Suspense>} />
          <Route path="clients/:id" element={<Suspense fallback={<AdminLoadingFallback />}><ClientDetail /></Suspense>} />
          <Route path="returns" element={<Suspense fallback={<AdminLoadingFallback />}><TaxReturns /></Suspense>} />
          <Route path="returns/:id" element={<Suspense fallback={<AdminLoadingFallback />}><TaxReturnDetail /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={<AdminLoadingFallback />}><Activity /></Suspense>} />
          {/* CST-27: Admin-only routes require admin role */}
          <Route path="users" element={
            <ProtectedRoute requiredRole="admin">
              <Suspense fallback={<AdminLoadingFallback />}><Users /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute requiredRole="admin">
              <Suspense fallback={<AdminLoadingFallback />}><Settings /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="time" element={<Suspense fallback={<AdminLoadingFallback />}><TimeTracking /></Suspense>} />
          <Route path="operations" element={<Suspense fallback={<AdminLoadingFallback />}><Operations /></Suspense>} />
          <Route path="tasks" element={<Suspense fallback={<AdminLoadingFallback />}><DailyTaskBoard /></Suspense>} />
          <Route path="schedule" element={<Suspense fallback={<AdminLoadingFallback />}><Schedule /></Suspense>} />
        </Route>

        {/* Client Portal - Protected (client role only) */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute requiredRole="client">
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Suspense fallback={<AdminLoadingFallback />}><PortalDashboard /></Suspense>} />
          <Route path="returns" element={<Suspense fallback={<AdminLoadingFallback />}><PortalReturns /></Suspense>} />
          <Route path="returns/:id" element={<Suspense fallback={<AdminLoadingFallback />}><PortalReturnDetail /></Suspense>} />
          <Route path="documents" element={<Suspense fallback={<AdminLoadingFallback />}><PortalDocuments /></Suspense>} />
          <Route path="notes" element={<Suspense fallback={<AdminLoadingFallback />}><PortalNotes /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<AdminLoadingFallback />}><PortalSettings /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
