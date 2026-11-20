
function normalizeDealerLocation(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}

async function loadDealerBranchMap(connection) {
    const [rows] = await connection.query(`
        SELECT id, dms_name, branch_name
        FROM branch_master
        WHERE is_active = 1
    `);

    const map = new Map();

    for (const branch of rows) {
        const dmsKey = normalizeDealerLocation(branch.dms_name);
        const branchKey = normalizeDealerLocation(branch.branch_name);

        if (dmsKey) map.set(dmsKey, branch.id);
        if (branchKey) map.set(branchKey, branch.id);
    }

    return map;
}

function getDealerBranchId(dealerLocation, branchMap) {
    const key = normalizeDealerLocation(dealerLocation);
    return key ? branchMap.get(key) || null : null;
}

module.exports = {
    loadDealerBranchMap,
    getDealerBranchId,
};
