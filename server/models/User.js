
const { pool } = require("../config/db");

const mapUser = (row, includePassword = false) => {
  if (!row) return null;

  const branch = row.branch_id
    ? {
      id: row.branch_id,
      _id: row.branch_id,
      branchName: row.branch_name,
      locationCode: row.location_code,
      branchShort: row.branch_short,
    }
    : null;

  return {
    id: row.id,
    _id: row.id,
    username: row.username,
    name: row.full_name,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    branchId: branch,
    status: Number(row.is_active) === 1 ? "active" : "inactive",
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(includePassword && {
      password: row.password_hash,
    }),
  };
};

const USER_SELECT = `
  SELECT
    u.id,
    u.username,
    u.email,
    u.password_hash,
    u.full_name,
    u.phone,
    u.role,
    u.branch_id,
    u.is_active,
    u.created_at,
    u.updated_at,
    b.branch_name,
    b.location_code,
    b.branch_short
  FROM users u
  LEFT JOIN branch_master b
    ON b.id = u.branch_id
`;

const findByEmail = async (email) => {
  const [rows] = await pool.query(
    `${USER_SELECT} WHERE LOWER(u.email) = ? LIMIT 1`,
    [email.trim().toLowerCase()]
  );

  // Include password hash for login only
  return mapUser(rows[0], true);
};

const findById = async (id) => {
  const [rows] = await pool.query(
    `${USER_SELECT} WHERE u.id = ? LIMIT 1`,
    [id]
  );

  return mapUser(rows[0]);
};

module.exports = {
  findByEmail,
  findById,
};
