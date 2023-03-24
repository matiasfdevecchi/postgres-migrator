//config.js
const Pool = require("pg").Pool;
const dotenv = require("dotenv");
dotenv.config();

const sourcePool = new Pool({
    connectionString: process.env.SOURCE_DATABASE_URL,
    ssl: process.env.SOURCE_DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized: false,
        }
        : undefined

});

const destPool = new Pool({
    connectionString: process.env.DEST_DATABASE_URL,
    ssl: process.env.DEST_DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized: false,
        }
        : undefined

});

sourcePool.on("connect", () => {
    console.log("connected to the source db");
});

destPool.on("connect", () => {
    console.log("connected to the dest db");
});

module.exports = {
    sourcePool,
    destPool
};