import { Link, useOutletContext } from "react-router-dom";
import {
  FiDatabase,
  FiBarChart2,
  FiTool,
  FiLayers,
  FiUsers,
  FiGitBranch,
  FiArrowUpRight,
} from "react-icons/fi";

import "./Dashboard.css";

function Dashboard() {
  const { user } = useOutletContext();

  const sections = [
    {
      title: "Sales Data",
      description: "Sales source records",
      icon: <FiBarChart2 />,
      path: "/sales-data",
      roles: ["admin", "user"],
      code: "01",
    },
    {
      title: "Service Data",
      description: "Service source records",
      icon: <FiTool />,
      path: "/service-data",
      roles: ["admin", "user"],
      code: "02",
    },
    {
      title: "Chassis Master",
      description: "Combined chassis and service records",
      icon: <FiLayers />,
      path: "/chassis-master",
      roles: ["admin", "user"],
      code: "03",
    },
    {
      title: "User Management",
      description: "Manage user accounts",
      icon: <FiUsers />,
      path: "/users",
      roles: ["admin"],
      code: "04",
    },
    {
      title: "Branch Management",
      description: "Manage branch directory",
      icon: <FiGitBranch />,
      path: "/branches",
      roles: ["admin"],
      code: "05",
    },
    {
      title: "DMS Retail",
      description: "Retail customer and vehicle records",
      icon: <FiDatabase />,
      path: "/dms-retail",
      roles: ["admin", "user"],
      code: "06",
    },
    {
      title: "Service Action",
      description: "Pending service action records",
      icon: <FiTool />,
      path: "/service-action",
      roles: ["admin", "user"],
      code: "07",
    },
  ];

  const visibleSections = sections.filter((section) =>
    section.roles.includes(user?.role),
  );

  return (
    <div className="rd-kitkat-dashboard">
      {/* Welcome Header */}
      <section className="rd-kitkat-dashboard-welcome">
        <div className="rd-kitkat-dashboard-welcome-main">
          <span className="rd-kitkat-dashboard-kicker">RETENTION DATA</span>

          <h2>{user?.name || "Dashboard"}</h2>

          <div className="rd-kitkat-dashboard-user-meta">
            <span>{user?.role?.toUpperCase()} ACCESS</span>
            <span className="rd-kitkat-dashboard-meta-dot" />
            <span>{user?.branch?.branchName || "ALL BRANCHES"}</span>
          </div>
        </div>

        <div className="rd-kitkat-dashboard-welcome-mark">
          <FiDatabase />
        </div>
      </section>

      {/* Modules */}
      <section className="rd-kitkat-dashboard-modules">
        <div className="rd-kitkat-dashboard-section-heading">
          <div>
            <h3>Modules</h3>
            <span>Select a module to continue</span>
          </div>

          <span className="rd-kitkat-dashboard-section-count">
            {String(visibleSections.length).padStart(2, "0")}
          </span>
        </div>

        <div className="rd-kitkat-dashboard-grid">
          {visibleSections.map((section) => (
            <Link
              to={section.path}
              key={section.path}
              className="rd-kitkat-dashboard-card"
            >
              <span className="rd-kitkat-dashboard-card-code">
                {section.code}
              </span>

              <div className="rd-kitkat-dashboard-card-icon">
                {section.icon}
              </div>

              <div className="rd-kitkat-dashboard-card-content">
                <h4>{section.title}</h4>
                <p>{section.description}</p>
              </div>

              <span className="rd-kitkat-dashboard-card-arrow">
                <FiArrowUpRight />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="rd-kitkat-dashboard-footer">
        <span>RETENTION DATA</span>
        <span>V 1.0</span>
      </footer>
    </div>
  );
}

export default Dashboard;
