import { NavLink } from "react-router-dom";
import {
  FiDatabase,
  FiBarChart2,
  FiTool,
  FiTruck,
  FiLayers,
  FiUsers,
  FiGitBranch,
  FiFile,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiPhoneCall,
} from "react-icons/fi";

import "./Sidebar.css";

function Sidebar({ user, collapsed, mobileOpen, onClose, onToggle }) {
  const menuItems = [
    {
      title: "Sales Data",
      path: "/sales-data",
      icon: <FiBarChart2 />,
      roles: ["admin", "user"],
    },
    {
      title: "Service Data",
      path: "/service-data",
      icon: <FiTool />,
      roles: ["admin", "user"],
    },
    {
      title: "Service Action",
      path: "/service-action",
      icon: <FiTool />,
      roles: ["admin", "user"],
    },
    {
      title: "DMS Retail",
      icon: <FiDatabase />,
      path: "/dms-retail",
      roles: ["admin", "user"],
    },
    {
      title: "Chassis Master",
      path: "/chassis-master",
      icon: <FiLayers />,
      roles: ["admin", "user"],
    },
    {
      title: "Follow-up Dashboard",
      path: "/followups",
      icon: <FiPhoneCall />,
      roles: ["admin", "user"],
    },
    {
      title: "Sales Excel Import",
      path: "/sales-import",
      icon: <FiFile />,
      roles: ["admin"],
    },
    {
      title: "Service Excel Import",
      path: "/service-import",
      icon: <FiFile />,
      roles: ["admin"],
    },
    {
      title: "Service Action Import",
      path: "/service-action-import",
      icon: <FiFile />,
      roles: ["admin"],
    },
    {
      title: "Case Status Management",
      path: "/case-status-management",
      icon: <FiPhoneCall />,
      roles: ["admin"],
    },
    {
      title: "Model Management",
      path: "/model-management",
      icon: <FiTruck />,
      roles: ["admin"],
    },
    {
      title: "User Management",
      path: "/users",
      icon: <FiUsers />,
      roles: ["admin"],
    },
    {
      title: "Branch Management",
      path: "/branches",
      icon: <FiGitBranch />,
      roles: ["admin"],
    },
  ];

  const visibleItems = menuItems.filter((item) =>
    item.roles.includes(user?.role),
  );

  const sidebarClasses = [
    "rd-kit-sidebar",
    collapsed ? "rd-kit-sidebar-collapsed" : "",
    mobileOpen ? "rd-kit-sidebar-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClasses}>
      {/* BRAND */}

      <div className="rd-kit-sidebar-brand">
        <div className="rd-kit-brand-icon">
          <FiDatabase />
        </div>

        <div className="rd-kit-brand-text">
          <strong>RETENTION</strong>
          <span>DATA MANAGEMENT</span>
        </div>

        <button
          type="button"
          className="rd-kit-sidebar-collapse"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>

        <button
          type="button"
          className="rd-kit-sidebar-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <FiX />
        </button>
      </div>

      {/* MENU */}

      <div className="rd-kit-sidebar-menu">
        <div className="rd-kit-sidebar-label">NAVIGATION</div>

        <nav className="rd-kit-sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.title : ""}
              onClick={onClose}
              className={({ isActive }) =>
                `rd-kit-sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="rd-kit-sidebar-icon">{item.icon}</span>
              <span className="rd-kit-sidebar-link-text">{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* BOTTOM USER */}

      <div className="rd-kit-sidebar-bottom">
        <div className="rd-kit-sidebar-user">
          <div className="rd-kit-user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="rd-kit-user-info">
            <strong>{user?.name || "User"}</strong>
            <span>{user?.role?.toUpperCase()}</span>
          </div>
        </div>

        <div className="rd-kit-sidebar-version">RETENTION DATA SYSTEM</div>
      </div>
    </aside>
  );
}

export default Sidebar;
