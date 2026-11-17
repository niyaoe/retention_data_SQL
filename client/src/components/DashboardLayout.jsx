
import { useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";
import "./DashboardLayout.css";

function DashboardLayout() {
  const { user } = useOutletContext();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <div
      className={`rd-kit-layout ${
        sidebarCollapsed ? "rd-kit-layout-collapsed" : ""
      } ${mobileSidebarOpen ? "rd-kit-layout-mobile-open" : ""}`}
    >
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onClose={closeMobileSidebar}
        onToggle={toggleSidebar}
      />

      {mobileSidebarOpen && (
        <div
          className="rd-kit-layout-overlay"
          onClick={closeMobileSidebar}
        />
      )}

      <div className="rd-kit-layout-main">
        <Header
          user={user}
          onMenuClick={toggleSidebar}
        />

        <main className="rd-kit-layout-content">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
