
import { useNavigate } from "react-router-dom";
import {
  FiMenu,
  FiLogOut,
  FiUser,
} from "react-icons/fi";

import "./Header.css";

function Header({ user, onMenuClick }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem("retention_token");
    sessionStorage.removeItem("retention_user");

    navigate("/login", { replace: true });
    window.location.reload();
  };

  return (
    <header className="rd-kit-header">
      <div className="rd-kit-header-left">
        <button
          type="button"
          className="rd-kit-menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation"
          title="Menu"
        >
          <FiMenu />
        </button>

        <div className="rd-kit-header-title">
          <h1>Retention Data</h1>
          <span>Management System</span>
        </div>
      </div>

      <div className="rd-kit-header-right">
        <div className="rd-kit-profile">
          <div className="rd-kit-profile-avatar">
            <FiUser />
          </div>

          <div className="rd-kit-profile-info">
            <strong>{user?.name || "User"}</strong>
            <span>{user?.role?.toUpperCase()}</span>
          </div>
        </div>

        <div className="rd-kit-header-divider" />

        <button
          type="button"
          className="rd-kit-logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
