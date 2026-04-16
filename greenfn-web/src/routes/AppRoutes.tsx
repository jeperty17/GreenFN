import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import AISummaryPage from '../pages/AISummaryPage'
import ContactsHubPage from '../pages/ContactsHubPage'
import InteractionHistoryPage from '../pages/InteractionHistoryPage'
import LeadsPipelinePage from '../pages/LeadsPipelinePage'
import TasksPage from '../pages/TasksPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <ContactsHubPage /> },
      { path: 'pipeline', element: <LeadsPipelinePage /> },
      { path: 'today', element: <TasksPage /> },
      { path: 'interaction-history', element: <InteractionHistoryPage /> },
      { path: 'ai-summary', element: <AISummaryPage /> },
    ],
  },
])

function AppRoutes() {
  return <RouterProvider router={router} />
}

export default AppRoutes