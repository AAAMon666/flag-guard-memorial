import type { ReactNode } from 'react'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { HomePage } from './pages/public/HomePage'
import { GenerationsPage } from './pages/public/GenerationsPage'
import { GenerationDetailPage } from './pages/public/GenerationDetailPage'
import { MembersPage } from './pages/public/MembersPage'
import { MemberDetailPage } from './pages/public/MemberDetailPage'
import { MediaPage } from './pages/public/MediaPage'
import { MediaDetailPage } from './pages/public/MediaDetailPage'
import { MessagesPage } from './pages/public/MessagesPage'
import { GeneratePage } from './pages/public/GeneratePage'
import { LoginPage } from './pages/public/LoginPage'
import { AdminImageProvidersPage } from './pages/admin/AdminImageProvidersPage'
import { AdminGeneratedGalleryPage } from './pages/admin/AdminGeneratedGalleryPage'
import { hasSupabaseConfig } from './lib/supabase'
import { useAuth } from './lib/AuthContext'
import {
  AdminDashboardPage,
  AdminGenerationsPage,
  AdminImportExportPage,
  AdminMediaPage,
  AdminMembersPage,
  AdminMessagesPage,
  AdminPermissionsPage,
  AdminSettingsPage,
  AdminTagsPage,
  AdminTaxonomyPage,
} from './pages/admin/AdminPages'

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'generations', element: <GenerationsPage /> },
      { path: 'generations/:id', element: <GenerationDetailPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'members/:id', element: <MemberDetailPage /> },
      { path: 'media', element: <MediaPage /> },
      { path: 'media/:id', element: <MediaDetailPage /> },
      { path: 'generate', element: <GeneratePage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'admin',
        element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'generations', element: <AdminGenerationsPage /> },
          { path: 'members', element: <AdminMembersPage /> },
          { path: 'taxonomy', element: <AdminTaxonomyPage /> },
          { path: 'tags', element: <AdminTagsPage /> },
          { path: 'media', element: <AdminMediaPage /> },
          { path: 'generated-gallery', element: <AdminGeneratedGalleryPage /> },
          { path: 'image-providers', element: <AdminImageProvidersPage /> },
          { path: 'messages', element: <AdminMessagesPage /> },
          { path: 'permissions', element: <AdminPermissionsPage /> },
          { path: 'import-export', element: <AdminImportExportPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
])

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()

  if (!hasSupabaseConfig) return <Navigate to="/login" replace />
  if (loading) return <div className="page-stack narrow"><section className="section-card">姝ｅ湪妫€鏌ョ櫥褰曠姸鎬?..</section></div>
  if (!session) return <Navigate to="/login" replace />

  return children
}

export default function App() {
  return <RouterProvider router={router} />
}
