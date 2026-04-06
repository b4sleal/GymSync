const pg = require("pg");
const path = require("path");
const fs = require("fs");

const dbUrl = process.env.DB_URL || "postgresql://root:1234@db:5432/gymsync";

const pool = new pg.Pool({
    connectionString: dbUrl,
});

async function initializeDatabase() {
    try {
        const schemaPath = path.join(__dirname, "../../database/schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf8");

        await pool.query(schemaSql);
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Database initialization failed.", error);
    }
}

initializeDatabase();
module.exports = pool;
