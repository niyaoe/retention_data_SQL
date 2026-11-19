
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogIn,
} from "react-icons/fi";

import api from "../services/api";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const { token, user } = response.data;

      sessionStorage.setItem("retention_token", token);
      sessionStorage.setItem("retention_user", JSON.stringify(user));

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rd-login-page">

      <div className="rd-login-overlay" />

      <main className="rd-login-content">

        {/* Title */}
        <div className="rd-login-heading">
          <h1>
            RETENTION <span>DATA</span>
          </h1>

          <div className="rd-login-line" />
        </div>

        {/* Login Form */}
        <form className="rd-login-form" onSubmit={handleLogin}>

          {/* Email */}
          <div className="rd-login-input-wrap">
            <FiUser className="rd-login-input-icon" />

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="rd-login-input-wrap">
            <FiLock className="rd-login-input-icon" />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="rd-login-eye"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rd-login-error" role="alert">
              {error}
            </div>
          )}

          {/* Sign In */}
          <button
            type="submit"
            className="rd-login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="rd-login-spinner" />
                AUTHENTICATING
              </>
            ) : (
              <>
                <FiLogIn />
                SIGN IN
              </>
            )}
          </button>

        </form>

      </main>
    </div>
  );
}

export default Login;
