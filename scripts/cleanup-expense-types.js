const { query } = require('../src/config/database');

async function cleanupExpenseTypes() {
  console.log('🧹 Starting cleanup of expense types: remove Food, keep Feed');
  try {
    // Fetch Feed and Food
    const typesResult = await query(
      `SELECT id, name, is_default, is_global FROM expense_types WHERE LOWER(name) IN ('feed','food') ORDER BY name`
    );
    const feed = typesResult.rows.find(r => r.name.toLowerCase() === 'feed');
    const food = typesResult.rows.find(r => r.name.toLowerCase() === 'food');

    if (!feed && !food) {
      console.log('ℹ️ Neither Feed nor Food exists; inserting Feed as default/global');
      const inserted = await query(
        `INSERT INTO expense_types (name, description, is_default, is_global, created_at, updated_at)
         VALUES ('Feed', 'Animal feed and nutrition costs', true, true, NOW(), NOW()) RETURNING id, name`
      );
      console.log(`✅ Inserted default type: ${inserted.rows[0].name}`);
      return;
    }

    if (feed && food) {
      console.log(`Found both Feed (${feed.id}) and Food (${food.id}); reassigning expenses to Feed and removing Food.`);
      // Reassign existing expenses from Food to Feed
      const reassigned = await query(
        `UPDATE expenses SET expense_type_id = $1 WHERE expense_type_id = $2 RETURNING id`,
        [feed.id, food.id]
      );
      console.log(`🔁 Reassigned ${reassigned.rowCount} expense(s) from Food to Feed.`);

      // Remove Food type
      await query('DELETE FROM expense_types WHERE id = $1', [food.id]);
      console.log('🗑️ Removed Food expense type.');
      return;
    }

    if (!feed && food) {
      console.log(`Only Food exists (${food.id}); renaming to Feed.`);
      await query(
        `UPDATE expense_types SET name = 'Feed', description = 'Animal feed and nutrition costs', updated_at = NOW() WHERE id = $1`,
        [food.id]
      );
      console.log('✏️ Renamed Food to Feed.');
    } else {
      console.log('✅ Feed exists and Food does not; nothing to clean.');
    }

    // Normalize Others -> Other, if present
    const othersResult = await query(
      `SELECT id, name FROM expense_types WHERE LOWER(name) = 'others'`
    );
    if (othersResult.rows.length > 0) {
      const othersId = othersResult.rows[0].id;
      await query(
        `UPDATE expense_types SET name = 'Other', updated_at = NOW() WHERE id = $1`,
        [othersId]
      );
      console.log('✏️ Renamed Others to Other.');
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  }
}

cleanupExpenseTypes()
  .then(() => {
    console.log('🎉 Cleanup completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Cleanup script error:', err.message);
    process.exit(1);
  });