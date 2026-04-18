import { createBrowserRouter, RouterProvider } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ContactDetailsPage from "../pages/ContactDetailsPage";
import ContactsHubPage from "../pages/ContactsHubPage";
import InteractionHistoryPage from "../pages/InteractionHistoryPage";
import LeadsPipelinePage from "../pages/LeadsPipelinePage";
import LoginPage from "../pages/LoginPage";
import TasksPage from "../pages/TasksPage";
import RequireAuth from "./RequireAuth";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <ContactsHubPage /> },
      { path: "contacts/:contactId", element: <ContactDetailsPage /> },
      { path: "pipeline", element: <LeadsPipelinePage /> },
      { path: "today", element: <TasksPage /> },
      { path: "interaction-history", element: <InteractionHistoryPage /> },
    ],
  },
]);

function AppRoutes() {
  return <RouterProvider router={router} />;
}

export default AppRoutes;
