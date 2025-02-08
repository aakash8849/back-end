import neo4j from 'neo4j-driver';

let driver;

export async function initNeo4j() {
    try {
        const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
        const user = process.env.NEO4J_USER || 'neo4j';
        const password = process.env.NEO4J_PASSWORD || 'password';

        driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        await driver.verifyConnectivity();
        console.log('Connected to Neo4j');
        return driver;
    } catch (error) {
        console.error('Neo4j Connection Error:', error);
        throw error;
    }
}

export async function getSession() {
    if (!driver) {
        await initNeo4j();
    }
    return driver.session();
}

export async function closeDriver() {
    if (driver) {
        await driver.close();
    }
}