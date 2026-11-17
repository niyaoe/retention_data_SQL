
import { useEffect, useMemo, useState } from "react";
import {
  FiUsers,
  FiUserPlus,
  FiSearch,
  FiEdit2,
  FiPower,
  FiRefreshCw,
  FiX,
  FiMail,
  FiMapPin,
  FiShield,
  FiCheckCircle,
  FiAlertCircle
} from "react-icons/fi";

import api from "../services/api";
import "./UserManagement.css";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  branchId: ""
};

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [userRes, branchRes] = await Promise.all([
        api.get("/users"),
        api.get("/branches")
      ]);

      setUsers(userRes.data.users || []);
      setBranches(branchRes.data.branches || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load user management data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        user.name?.toLowerCase().includes(searchText) ||
        user.email?.toLowerCase().includes(searchText) ||
        user.branchId?.branchName?.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const activeCount = users.filter(
    (user) => user.status === "active"
  ).length;

  const inactiveCount = users.filter(
    (user) => user.status === "inactive"
  ).length;

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      branchId: user.branchId?._id || user.branchId || ""
    });

    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingUser) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          branchId: form.branchId
        };

        await api.put(`/users/${editingUser._id}`, payload);
        setSuccess("User updated successfully.");
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          branchId: form.branchId
        };

        await api.post("/users", payload);
        setSuccess("User created successfully.");
      }

      await loadData();

      setShowModal(false);
      setEditingUser(null);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to save user details."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus =
      user.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} ${user.name}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await api.patch(`/users/${user._id}/status`, {
        status: nextStatus
      });

      setSuccess(
        `${user.name} ${nextStatus === "active" ? "activated" : "deactivated"}.`
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to update user status."
      );
    }
  };

  return (
    <div className="rd-kit-users-page">
      <div className="rd-kit-users-heading">
        <div className="rd-kit-users-heading-left">
          <div className="rd-kit-users-heading-icon">
            <FiUsers />
          </div>
          <h2>User Management</h2>
        </div>

        <div className="rd-kit-users-heading-actions">
          <button
            type="button"
            className="rd-kit-users-refresh"
            onClick={loadData}
            disabled={loading}
            title="Refresh"
          >
            <FiRefreshCw className={loading ? "rd-kit-users-spin" : ""} />
          </button>

          <button
            type="button"
            className="rd-kit-users-add"
            onClick={openCreateModal}
          >
            <FiUserPlus />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {(error && !showModal) && (
        <div className="rd-kit-users-alert rd-kit-users-alert-error">
          <FiAlertCircle />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="rd-kit-users-alert rd-kit-users-alert-success">
          <FiCheckCircle />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <FiX />
          </button>
        </div>
      )}

      <div className="rd-kit-users-summary">
        <div className="rd-kit-users-stat">
          <span className="rd-kit-users-stat-icon total">
            <FiUsers />
          </span>
          <div>
            <small>Total Users</small>
            <strong>{users.length}</strong>
          </div>
        </div>

        <div className="rd-kit-users-stat">
          <span className="rd-kit-users-stat-icon active">
            <FiCheckCircle />
          </span>
          <div>
            <small>Active</small>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="rd-kit-users-stat">
          <span className="rd-kit-users-stat-icon inactive">
            <FiPower />
          </span>
          <div>
            <small>Inactive</small>
            <strong>{inactiveCount}</strong>
          </div>
        </div>

        <div className="rd-kit-users-stat">
          <span className="rd-kit-users-stat-icon branches">
            <FiMapPin />
          </span>
          <div>
            <small>Branches</small>
            <strong>{branches.length}</strong>
          </div>
        </div>
      </div>

      <div className="rd-kit-users-toolbar">
        <div className="rd-kit-users-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Search users or branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>

        <select
          className="rd-kit-users-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span className="rd-kit-users-count">
          {filteredUsers.length} / {users.length}
        </span>
      </div>

      <div className="rd-kit-users-table-container">
        <table className="rd-kit-users-table">
          <thead>
            <tr>
              <th className="rd-kit-users-number-col">#</th>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th className="rd-kit-users-action-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="rd-kit-users-empty">
                  <FiRefreshCw className="rd-kit-users-spin" />
                  Loading users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="rd-kit-users-empty">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <tr key={user._id}>
                  <td className="rd-kit-users-number">
                    {index + 1}
                  </td>

                  <td>
                    <div className="rd-kit-users-person">
                      <span className="rd-kit-users-avatar">
                        {user.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                      <strong>{user.name}</strong>
                    </div>
                  </td>

                  <td>
                    <span className="rd-kit-users-email">
                      <FiMail />
                      {user.email}
                    </span>
                  </td>

                  <td>
                    <span className={`rd-kit-users-role ${user.role}`}>
                      <FiShield />
                      {user.role}
                    </span>
                  </td>

                  <td>
                    <span className="rd-kit-users-branch">
                      <FiMapPin />
                      {user.branchId?.branchName || "Not assigned"}
                    </span>
                  </td>

                  <td>
                    <span className={`rd-kit-users-status ${user.status}`}>
                      <i />
                      {user.status}
                    </span>
                  </td>

                  <td>
                    <div className="rd-kit-users-actions">
                      <button
                        type="button"
                        className="rd-kit-users-edit"
                        onClick={() => openEditModal(user)}
                        title="Edit user"
                      >
                        <FiEdit2 />
                      </button>

                      <button
                        type="button"
                        className={`rd-kit-users-power ${
                          user.status === "active" ? "deactivate" : "activate"
                        }`}
                        onClick={() => toggleStatus(user)}
                        title={
                          user.status === "active"
                            ? "Deactivate user"
                            : "Activate user"
                        }
                      >
                        <FiPower />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div
          className="rd-kit-users-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <section
            className="rd-kit-users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rd-kit-users-modal-title"
          >
            <div className="rd-kit-users-modal-header">
              <div className="rd-kit-users-modal-heading">
                <span className="rd-kit-users-modal-icon">
                  {editingUser ? <FiEdit2 /> : <FiUserPlus />}
                </span>
                <h3 id="rd-kit-users-modal-title">
                  {editingUser ? "Edit User" : "Create User"}
                </h3>
              </div>

              <button
                type="button"
                className="rd-kit-users-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="rd-kit-users-form">
              {error && (
                <div className="rd-kit-users-alert rd-kit-users-alert-error">
                  <FiAlertCircle />
                  <span>{error}</span>
                </div>
              )}

              <div className="rd-kit-users-form-grid">
                <div className="rd-kit-users-field">
                  <label htmlFor="rd-user-name">Full Name</label>
                  <input
                    id="rd-user-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="rd-kit-users-field">
                  <label htmlFor="rd-user-email">Email Address</label>
                  <input
                    id="rd-user-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    required
                  />
                </div>

                {!editingUser && (
                  <div className="rd-kit-users-field">
                    <label htmlFor="rd-user-password">Password</label>
                    <input
                      id="rd-user-password"
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Enter password"
                      minLength="6"
                      required
                    />
                  </div>
                )}

                <div className="rd-kit-users-field">
                  <label htmlFor="rd-user-branch">Assign Branch</label>
                  <select
                    id="rd-user-branch"
                    name="branchId"
                    value={form.branchId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.branchName} ({branch.locationCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rd-kit-users-form-note">
                <FiShield />
                Standard user role
              </div>

              <div className="rd-kit-users-modal-footer">
                <button
                  type="button"
                  className="rd-kit-users-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rd-kit-users-save"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingUser
                      ? "Update User"
                      : "Create User"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
