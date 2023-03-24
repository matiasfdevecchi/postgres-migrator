// index.js
const dotenv = require('dotenv')
const { sourcePool, destPool } = require("./config");
var format = require('pg-format');

dotenv.config();

const migrateTable = async (tableName) => {
    try {
        console.log(`Migrating ${tableName}...`);
        const data = await sourcePool.query(
            `SELECT * FROM ${tableName}`
        );
        if (data.rows.length === 0) {
            console.log(`No data to migrate for ${tableName}!`);
            return;
        }
        const keys = Object.keys(data.rows[0]);
        const values = data.rows.map((row) => {
            return keys.map((key) => {
                const value = row[key];
                if (value instanceof Array) {
                    return `{${value.join(`,`)}}`;
                }
                return row[key];
            });
        });
        console.log(`Inserting data into dest...`)
        const query = format(
            `INSERT INTO ${tableName}(${keys.map(k => `"${k}"`).join(`,`)}) VALUES %L`,
            values
        );
        await destPool.query(query);
        console.log(`Migrated ${tableName} successfully!`);
    } catch (error) {
        console.log(error);
    }
}

const getTableRelations = async (pool) => {
    const query = `
      SELECT conrelid::regclass::text AS table_name,
             confrelid::regclass::text AS dep_table_name
      FROM pg_constraint
      WHERE contype = 'f'
    `;
    const { rows } = await pool.query(query);
    const tableRelations = {};
    rows.forEach(row => {
        const { table_name, dep_table_name } = row;
        if (!tableRelations[table_name]) {
            tableRelations[table_name] = { name: table_name, dependencies: [] };
        }
        if (!tableRelations[dep_table_name]) {
            tableRelations[dep_table_name] = { name: dep_table_name, dependencies: [] };
        }
        tableRelations[table_name].dependencies.push(tableRelations[dep_table_name]);
    });
    return Object.values(tableRelations);
};

const migrateTablesWithoutDependencies = async (tableRelations) => {
    const tablesWithoutDependencies = tableRelations.filter(
        (table) => table.dependencies.length === 0
    );
    for (const table of tablesWithoutDependencies) {
        await migrateTable(table.name);
    }
    return tablesWithoutDependencies;
}

const deleteAllData = async () => {
    var tableRelations = await getTableRelations(destPool);
    // get tables where no other table depends on it
    while (tableRelations.length > 0) {
        const tablesWithoutDependencies = tableRelations.filter(
            (table) => tableRelations.filter(
                (table2) => table2.dependencies.includes(table)
            ).length === 0
        );
        for (const table of tablesWithoutDependencies) {
            console.log(`Deleting all data from ${table.name}...`);
            await destPool.query(`DELETE FROM ${table.name}`);
        }
        tableRelations = tableRelations.filter(
            (table) => !tablesWithoutDependencies.includes(table)
        );
        tableRelations.forEach(table => {
            table.dependencies = table.dependencies.filter(
                (dependency) => !tablesWithoutDependencies.includes(dependency)
            );
        });
    }
}

const migrateAllTables = async () => {
    var tableRelations = await getTableRelations(destPool);

    while (tableRelations.length > 0) {
        const migratedTables = await migrateTablesWithoutDependencies(tableRelations);
        tableRelations = tableRelations.filter(
            (table) => !migratedTables.includes(table)
        );
        tableRelations.forEach(table => {
            table.dependencies = table.dependencies.filter(
                (dependency) => !migratedTables.includes(dependency)
            );
        });
    }
}

deleteAllData();
migrateAllTables();