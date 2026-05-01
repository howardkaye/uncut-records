import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import Nav from './components/Nav'
import Pipeline from './pages/Pipeline'
import TrackPool from './pages/TrackPool'
import Releases from './pages/Releases'
import ReleaseDetail from './pages/ReleaseDetail'
import Reports from './pages/Reports'

function ProtectedRoute({ children, roles }) {
  const { session, profile } = useAuth()

  if (session === undefined) return null // still loading

  if (!session) return <Navigate to="/login" replace />

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/pipeline" replace />
  }

  return children
}

function Shell() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main>
        <Routes>
          <Route path="/pipeline" element={
            <ProtectedRoute roles={['coordinator', 'selector']}>
              <Pipeline />
            </ProtectedRoute>
          } />
          <Route path="/tracks" element={
            <ProtectedRoute roles={['coordinator', 'selector']}>
              <TrackPool />
            </ProtectedRoute>
          } />
          <Route path="/releases" element={
            <ProtectedRoute roles={['coordinator', 'content']}>
              <Releases />
            </ProtectedRoute>
          } />
          <Route path="/releases/:id" element={
            <ProtectedRoute roles={['coordinator', 'content']}>
              <ReleaseDetail />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={['coordinator']}>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/pipeline" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { session } = useAuth()

  if (session === undefined) return null

  return (
    <Routes>
      <Route path="/login" element={
        session ? <Navigate to="/pipeline" replace /> : <Login />
      } />
      <Route path="/*" element={
        session ? <Shell /> : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
