const pg = require('pg');
const path = require("path");
const fs = require("fs");
const db_url = process.env.DB_URL;

const pool = new pg.Pool({
    connectionString: db_url
});

const initializeDatbase = async () => {

    try {
        const schemaPath = path.join(__dirname, '../../../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await pool.query(schemaSql);
        console.log("Database initialized successfully (and tables)")
    } catch (e) {
        console.error(e)
    }
}

initializeDatbase();

module.exports = pool; // global access