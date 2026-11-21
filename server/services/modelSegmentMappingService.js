
function normalizeModel(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}

async function loadModelSegmentMap(connection) {
    const [rows] = await connection.query(`
        SELECT model_group, sub_segment
        FROM model_master
        WHERE is_active = 1
    `);

    const map = new Map();

    for (const row of rows) {
        const key = normalizeModel(row.model_group);

        if (key && row.sub_segment) {
            map.set(key, row.sub_segment);
        }
    }

    return map;
}

function getModelSegment(productName, segmentMap) {
    const key = normalizeModel(productName);
    return key ? segmentMap.get(key) || null : null;
}

module.exports = {
    loadModelSegmentMap,
    getModelSegment,
};
