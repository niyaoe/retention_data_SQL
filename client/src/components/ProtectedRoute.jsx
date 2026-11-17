
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "../services/api";

function ProtectedRoute() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const verifySession = async () => {
      const token = sessionStorage.getItem("retention_token");

      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");

        setUser(response.data.user);
        setAuthenticated(true);
      } catch (error) {
        sessionStorage.removeItem("retention_token");
        sessionStorage.removeItem("retention_user");
        setAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    verifySession();
  }, []);

  if (checking) {
    return (
      <div className="rd-app-loading">
        VERIFYING SESSION...
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={{ user }} />;
}

export default ProtectedRoute;
