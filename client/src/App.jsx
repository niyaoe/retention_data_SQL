import { Navigate, Route, Routes, useOutletContext } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";

import SalesData from "./pages/SalesData";
import ServiceData from "./pages/ServiceData";
import ChassisMaster from "./pages/ChassisMaster";
import UserManagement from "./pages/UserManagement";
import BranchManagement from "./pages/BranchManagement";
import SalesExcelImport from "./pages/SalesExcelImport";
import ModelManagement from "./pages/ModelManagement";
import ServiceExcelImport from "./pages/ServiceExcelImport";
import DmsRetail from "./pages/DmsRetail";
import ServiceAction from "./pages/ServiceAction";
import ServiceActionExcelImport from "./pages/ServiceActionExcelImport";
import CaseStatusManagement from "./pages/CaseStatusManagement";
import FollowupDashboard from "./pages/FollowupDashboard";

function AdminOnly({ children }) {
  const { user } = useOutletContext();

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function SectionPlaceholder({ title, description }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #cbd7df",
        padding: "20px",
        borderRadius: "3px",
      }}
    >
      <h2 style={{ fontSize: "17px", color: "#263746" }}>{title}</h2>
      <p style={{ fontSize: "11px", color: "#81919c" }}>{description}</p>
      <p style={{ fontSize: "11px", color: "#008dbb" }}>
        Module development is coming next.
      </p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/sales-data" element={<SalesData />} />

          <Route path="/service-data" element={<ServiceData />} />

          <Route path="/chassis-master" element={<ChassisMaster />} />

          <Route path="/dms-retail" element={<DmsRetail />} />

          <Route path="service-action" element={<ServiceAction />} />

          <Route
            path="/sales-import"
            element={
              <AdminOnly>
                <SalesExcelImport />
              </AdminOnly>
            }
          />
          <Route
            path="/service-import"
            element={
              <AdminOnly>
                <ServiceExcelImport />
              </AdminOnly>
            }
          />

          <Route
            path="service-action-import"
            element={
              <AdminOnly>
                <ServiceActionExcelImport />
              </AdminOnly>
            }
          />
          <Route
            path="/case-status-management"
            element={
              <AdminOnly>
                <CaseStatusManagement />
              </AdminOnly>
            }
          />
          <Route path="/followups" element={<FollowupDashboard />} />

          <Route path="/users" element={<UserManagement />} />

          <Route path="/branches" element={<BranchManagement />} />

          <Route
            path="/model-management"
            element={
              <AdminOnly>
                <ModelManagement />
              </AdminOnly>
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
