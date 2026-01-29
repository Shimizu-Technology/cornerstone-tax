import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Analytics
import { PostHogPageView } from './providers/PostHogProvider'

// Layouts
import PublicLayout from './components/layouts/PublicLayout'
import AdminLayout from './components/layouts/AdminLayout'

// Auth
import ProtectedRoute from './components/auth/ProtectedRoute'

// Public Pages
import Home from './pages/public/Home'
import About from './pages/public/About'
import Services from './pages/public/Services'
import Contact from './pages/public/Contact'

// Intake
import IntakeForm from './pages/intake/IntakeForm'

// Admin Pages
import Dashboard from './pages/admin/Dashboard'
import ClientList from './pages/admin/ClientList'
import ClientDetail from './pages/admin/ClientDetail'
import TaxReturns from './pages/admin/TaxReturns'
import TaxReturnDetail from './pages/admin/TaxReturnDetail'
import Activity from './pages/admin/Activity'
import Users from './pages/admin/Users'
import Settings from './pages/admin/Settings'
import TimeTracking from './pages/admin/TimeTracking'
import Schedule from './pages/admin/Schedule'

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
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<ClientList />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="returns" element={<TaxReturns />} />
          <Route path="returns/:id" element={<TaxReturnDetail />} />
          <Route path="activity" element={<Activity />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route path="time" element={<TimeTracking />} />
          <Route path="schedule" element={<Schedule />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
