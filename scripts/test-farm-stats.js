const DatabaseService = require('../src/services/database.service');
const { testConnection, ensureBaseSchema, ensureSchemaUpgrades, closePool } = require('../src/config/database');

(async () => {
  try {
    await testConnection();
    await ensureBaseSchema();
    await ensureSchemaUpgrades();

    const farms = await DatabaseService.getAllFarms();
    if (!farms || farms.length === 0) {
      console.log(JSON.stringify({ message: 'No farms found. Create a farm and retry.' }));
      return;
    }

    const farmId = farms[0].id;
    const stats = await DatabaseService.getFarmStats(farmId);

    console.log(JSON.stringify({ farmId, stats }, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    try { await closePool(); } catch (_) {}
  }
})();