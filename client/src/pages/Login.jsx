
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiDatabase,
  FiUser,
  FiLock,
  FiEye,
  FiEyeOff,
  FiLogIn,
  FiShield,
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
    <div className="rd-kitkat-login-page">

      {/* Background decoration */}
      <div className="rd-kitkat-login-bg-pattern" />

      <main className="rd-kitkat-login-main">

        {/* Brand */}
        <div className="rd-kitkat-login-brand">
          <div className="rd-kitkat-login-logo">
            <FiDatabase />
          </div>

          <div className="rd-kitkat-login-brand-text">
            <h1>RETENTION DATA</h1>
            {/* <span>MANAGEMENT SYSTEM</span> */}
          </div>
        </div>

        {/* Login Card */}
        <section className="rd-kitkat-login-card">

          <div className="rd-kitkat-login-card-header">
            <div>
              <h2>Welcome back</h2>
              <p>Sign in to access your dashboard</p>
            </div>

            <div className="rd-kitkat-login-header-icon">
              <FiShield />
            </div>
          </div>

          <div className="rd-kitkat-login-accent-line" />

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div className="rd-kitkat-login-field">
              <label htmlFor="rd-kitkat-email">
                EMAIL ADDRESS
              </label>

              <div className="rd-kitkat-login-input-wrap">
                <FiUser className="rd-kitkat-login-input-icon" />

                <input
                  id="rd-kitkat-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="rd-kitkat-login-field">
              <label htmlFor="rd-kitkat-password">
                PASSWORD
              </label>

              <div className="rd-kitkat-login-input-wrap">
                <FiLock className="rd-kitkat-login-input-icon" />

                <input
                  id="rd-kitkat-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="rd-kitkat-login-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rd-kitkat-login-error" role="alert">
                <span>!</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="rd-kitkat-login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="rd-kitkat-login-spinner" />
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

          {/* <div className="rd-kitkat-login-security">
            <FiShield />
            <span>SECURE AUTHENTICATED ACCESS</span>
          </div> */}
        </section>

        {/* Footer */}
        <footer className="rd-kitkat-login-footer">
          <span>ERAM RETENTION DATA</span>
          {/* <span>VERSION 1.0</span> */}
        </footer>

      </main>
    </div>
  );
}

export default Login;
