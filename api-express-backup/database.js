/**
 * @api {post} /api/database/export Export Database
 * @apiName ExportDatabase
 * @apiGroup Database
 * @apiVersion 1.0.0
 * @apiPermission authenticated
 * 
 * @apiHeader {String} Authorization Bearer token
 * 
 * @apiBody {String} farm_id Farm ID to export data for
 * 
 * @apiSuccess {Object} data Complete farm data export
 */

const express = require('express');
const cors = require('cors');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Export farm database
app.post('/export', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.body;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { 
    farms, 
    products, 
    expenses, 
    investments, 
    sales, 
    productBatches, 
    expenseTypes,
    storeProducts,
    orders,
    cartItems
  } = getCollections(db);

  const farmIdObj = toObjectId(farm_id);

  try {
    console.log('Starting export for farm:', farm_id);

    // Get store products first for cart items query
    const farmStoreProducts = await storeProducts.find({ farm_id: farmIdObj }).toArray();
    const storeProductIds = farmStoreProducts.map(sp => sp._id);

    // Export all farm-related data
    const exportData = {
      metadata: {
        export_date: new Date().toISOString(),
        farm_id: farm_id,
        version: '2.0.0',
        exported_by: req.user.userId
      },
      farm: await farms.findOne({ _id: farmIdObj }),
      products: await products.find({ farm_id: farmIdObj }).toArray(),
      expenses: await expenses.find({ farm_id: farmIdObj }).toArray(),
      investments: await investments.find({ farm_id: farmIdObj }).toArray(),
      sales: await sales.find({ farm_id: farmIdObj }).toArray(),
      productBatches: await productBatches.find({ farm_id: farmIdObj }).toArray(),
      expenseTypes: await expenseTypes.find({ farm_id: farmIdObj }).toArray(),
      storeProducts: farmStoreProducts,
      orders: await orders.find({ farm_id: farmIdObj }).toArray(),
      cartItems: storeProductIds.length > 0 ? await cartItems.find({ 
        store_product_id: { $in: storeProductIds } 
      }).toArray() : []
    };

    console.log('Export data collected:', {
      products: exportData.products.length,
      expenses: exportData.expenses.length,
      investments: exportData.investments.length,
      sales: exportData.sales.length,
      productBatches: exportData.productBatches.length,
      expenseTypes: exportData.expenseTypes.length,
      storeProducts: exportData.storeProducts.length,
      orders: exportData.orders.length,
      cartItems: exportData.cartItems.length
    });

    // Helper function to serialize MongoDB documents
    const serializeDocument = (doc) => {
      if (!doc) return doc;
      if (Array.isArray(doc)) {
        return doc.map(serializeDocument);
      }
      if (typeof doc === 'object' && doc !== null) {
        const serialized = {};
        for (const [key, value] of Object.entries(doc)) {
          if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
            serialized[key] = value.toString();
          } else if (value instanceof Date) {
            serialized[key] = value.toISOString();
          } else if (typeof value === 'object') {
            serialized[key] = serializeDocument(value);
          } else {
            serialized[key] = value;
          }
        }
        return serialized;
      }
      return doc;
    };

    // Serialize the data properly
    const serializedData = serializeDocument(exportData);

    res.json({
      success: true,
      message: 'Database exported successfully',
      data: serializedData,
      stats: {
        products: exportData.products.length,
        expenses: exportData.expenses.length,
        investments: exportData.investments.length,
        sales: exportData.sales.length,
        productBatches: exportData.productBatches.length,
        expenseTypes: exportData.expenseTypes.length,
        storeProducts: exportData.storeProducts.length,
        orders: exportData.orders.length,
        cartItems: exportData.cartItems.length,
        total: exportData.products.length + exportData.expenses.length + 
               exportData.investments.length + exportData.sales.length +
               exportData.productBatches.length + exportData.expenseTypes.length +
               exportData.storeProducts.length + exportData.orders.length +
               exportData.cartItems.length
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Failed to export database', 
      details: error.message 
    });
  }
}));

// Import farm database
app.post('/import', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, data, replace_existing = false } = req.body;

  if (!farm_id || !data) {
    return res.status(400).json({ error: 'farm_id and data are required' });
  }

  // Validate data structure
  if (!data.metadata || !data.metadata.farm_id) {
    return res.status(400).json({ error: 'Invalid export data format' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { 
    products, 
    expenses, 
    investments, 
    sales, 
    productBatches, 
    expenseTypes,
    storeProducts,
    orders,
    cartItems
  } = getCollections(db);

  const farmIdObj = toObjectId(farm_id);

  // Start transaction
  const session = db.client.startSession();

  try {
    let importStats = {
      products: 0,
      expenses: 0,
      investments: 0,
      sales: 0,
      productBatches: 0,
      expenseTypes: 0,
      storeProducts: 0,
      orders: 0,
      cartItems: 0
    };

    await session.withTransaction(async () => {
      console.log('Starting import for farm:', farm_id, 'replace_existing:', replace_existing);

      // If replace_existing is true, remove all existing data first
      if (replace_existing) {
        console.log('Removing existing data...');
        
        // Get existing store products for cart cleanup
        const existingStoreProducts = await storeProducts.find({ farm_id: farmIdObj }).toArray();
        const existingStoreProductIds = existingStoreProducts.map(sp => sp._id);

        // Delete all farm data
        await Promise.all([
          products.deleteMany({ farm_id: farmIdObj }, { session }),
          expenses.deleteMany({ farm_id: farmIdObj }, { session }),
          investments.deleteMany({ farm_id: farmIdObj }, { session }),
          sales.deleteMany({ farm_id: farmIdObj }, { session }),
          productBatches.deleteMany({ farm_id: farmIdObj }, { session }),
          expenseTypes.deleteMany({ farm_id: farmIdObj }, { session }),
          storeProducts.deleteMany({ farm_id: farmIdObj }, { session }),
          orders.deleteMany({ farm_id: farmIdObj }, { session }),
          // Remove cart items for this farm's store products
          existingStoreProductIds.length > 0 ? cartItems.deleteMany({ 
            store_product_id: { $in: existingStoreProductIds } 
          }, { session }) : Promise.resolve()
        ]);

        console.log('Existing data removed');
      }

      // Helper function to safely convert string IDs to ObjectIds
      const safeObjectId = (id) => {
        if (!id) return undefined;
        try {
          return toObjectId(id);
        } catch (error) {
          console.warn('Invalid ObjectId:', id);
          return undefined;
        }
      };

      // Helper function to safely convert date strings
      const safeDate = (dateStr) => {
        if (!dateStr) return new Date();
        try {
          return new Date(dateStr);
        } catch (error) {
          console.warn('Invalid date:', dateStr);
          return new Date();
        }
      };

      // Import product batches first (they might be referenced by products)
      if (data.productBatches && data.productBatches.length > 0) {
        console.log('Importing product batches...');
        const batchesToImport = data.productBatches.map(b => ({
          ...b,
          _id: undefined,
          farm_id: farmIdObj,
          created_at: safeDate(b.created_at)
        }));
        const result = await productBatches.insertMany(batchesToImport, { session });
        importStats.productBatches = result.insertedCount;
        console.log('Product batches imported:', importStats.productBatches);
      }

      // Import expense types (they might be referenced by expenses)
      if (data.expenseTypes && data.expenseTypes.length > 0) {
        console.log('Importing expense types...');
        const expenseTypesToImport = data.expenseTypes.map(et => ({
          ...et,
          _id: undefined,
          farm_id: farmIdObj,
          created_at: safeDate(et.created_at)
        }));
        const result = await expenseTypes.insertMany(expenseTypesToImport, { session });
        importStats.expenseTypes = result.insertedCount;
        console.log('Expense types imported:', importStats.expenseTypes);
      }

      // Import products
      if (data.products && data.products.length > 0) {
        console.log('Importing products...');
        const productsToImport = data.products.map(p => ({
          ...p,
          _id: undefined,
          farm_id: farmIdObj,
          created_at: safeDate(p.created_at),
          updated_at: new Date()
        }));
        const result = await products.insertMany(productsToImport, { session });
        importStats.products = result.insertedCount;
        console.log('Products imported:', importStats.products);
      }

      // Import expenses
      if (data.expenses && data.expenses.length > 0) {
        console.log('Importing expenses...');
        const expensesToImport = data.expenses.map(e => ({
          ...e,
          _id: undefined,
          farm_id: farmIdObj,
          date: safeDate(e.date),
          created_at: safeDate(e.created_at)
        }));
        const result = await expenses.insertMany(expensesToImport, { session });
        importStats.expenses = result.insertedCount;
        console.log('Expenses imported:', importStats.expenses);
      }

      // Import investments
      if (data.investments && data.investments.length > 0) {
        console.log('Importing investments...');
        const investmentsToImport = data.investments.map(i => ({
          ...i,
          _id: undefined,
          farm_id: farmIdObj,
          date: safeDate(i.date),
          created_at: safeDate(i.created_at)
        }));
        const result = await investments.insertMany(investmentsToImport, { session });
        importStats.investments = result.insertedCount;
        console.log('Investments imported:', importStats.investments);
      }

      // Import sales (need products to exist first)
      if (data.sales && data.sales.length > 0) {
        console.log('Importing sales...');
        const salesToImport = data.sales.filter(s => s.product_id).map(s => ({
          ...s,
          _id: undefined,
          farm_id: farmIdObj,
          product_id: safeObjectId(s.product_id),
          sale_date: safeDate(s.sale_date),
          created_at: safeDate(s.created_at)
        })).filter(s => s.product_id); // Remove sales with invalid product_id
        
        if (salesToImport.length > 0) {
          const result = await sales.insertMany(salesToImport, { session });
          importStats.sales = result.insertedCount;
        }
        console.log('Sales imported:', importStats.sales);
      }

      // Import store products (need products to exist first)
      if (data.storeProducts && data.storeProducts.length > 0) {
        console.log('Importing store products...');
        const storeProductsToImport = data.storeProducts.filter(sp => sp.product_id).map(sp => ({
          ...sp,
          _id: undefined,
          farm_id: farmIdObj,
          product_id: safeObjectId(sp.product_id),
          created_at: safeDate(sp.created_at),
          updated_at: new Date()
        })).filter(sp => sp.product_id); // Remove store products with invalid product_id
        
        if (storeProductsToImport.length > 0) {
          const result = await storeProducts.insertMany(storeProductsToImport, { session });
          importStats.storeProducts = result.insertedCount;
        }
        console.log('Store products imported:', importStats.storeProducts);
      }

      // Import orders (need store products to exist first)
      if (data.orders && data.orders.length > 0) {
        console.log('Importing orders...');
        const ordersToImport = data.orders.filter(o => o.customer_id).map(o => ({
          ...o,
          _id: undefined,
          farm_id: farmIdObj,
          customer_id: safeObjectId(o.customer_id),
          items: (o.items || []).filter(item => item.store_product_id).map(item => ({
            ...item,
            store_product_id: safeObjectId(item.store_product_id)
          })).filter(item => item.store_product_id),
          created_at: safeDate(o.created_at),
          updated_at: new Date()
        })).filter(o => o.customer_id && o.items.length > 0);
        
        if (ordersToImport.length > 0) {
          const result = await orders.insertMany(ordersToImport, { session });
          importStats.orders = result.insertedCount;
        }
        console.log('Orders imported:', importStats.orders);
      }

      // Skip cart items import as they are user-specific and temporary
      console.log('Skipping cart items (user-specific data)');

      console.log('Import completed successfully');
    });

    res.json({
      success: true,
      message: 'Database imported successfully',
      stats: importStats,
      total_imported: Object.values(importStats).reduce((sum, count) => sum + count, 0)
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Failed to import database', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    await session.endSession();
  }
}));

// Remove all farm data (Danger Zone)
app.delete('/remove-all-data', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, confirmation } = req.body;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  if (confirmation !== 'DELETE_ALL_DATA') {
    return res.status(400).json({ 
      error: 'Invalid confirmation. Please type "DELETE_ALL_DATA" to confirm.' 
    });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { 
    products, 
    expenses, 
    investments, 
    sales, 
    productBatches, 
    expenseTypes,
    storeProducts,
    orders,
    cartItems
  } = getCollections(db);

  const farmIdObj = toObjectId(farm_id);

  // Start transaction
  const session = db.client.startSession();

  try {
    await session.withTransaction(async () => {
      // Get store products before deletion for cart cleanup
      const farmStoreProducts = await storeProducts.find({ farm_id: farmIdObj }).toArray();
      const storeProductIds = farmStoreProducts.map(sp => sp._id);

      // Delete all farm-related data
      const deletionResults = await Promise.all([
        products.deleteMany({ farm_id: farmIdObj }, { session }),
        expenses.deleteMany({ farm_id: farmIdObj }, { session }),
        investments.deleteMany({ farm_id: farmIdObj }, { session }),
        sales.deleteMany({ farm_id: farmIdObj }, { session }),
        productBatches.deleteMany({ farm_id: farmIdObj }, { session }),
        expenseTypes.deleteMany({ farm_id: farmIdObj }, { session }),
        storeProducts.deleteMany({ farm_id: farmIdObj }, { session }),
        orders.deleteMany({ farm_id: farmIdObj }, { session }),
        // Remove cart items for this farm's store products
        storeProductIds.length > 0 ? cartItems.deleteMany({ 
          store_product_id: { $in: storeProductIds } 
        }, { session }) : Promise.resolve({ deletedCount: 0 })
      ]);

      const deletionStats = {
        products: deletionResults[0].deletedCount,
        expenses: deletionResults[1].deletedCount,
        investments: deletionResults[2].deletedCount,
        sales: deletionResults[3].deletedCount,
        productBatches: deletionResults[4].deletedCount,
        expenseTypes: deletionResults[5].deletedCount,
        storeProducts: deletionResults[6].deletedCount,
        orders: deletionResults[7].deletedCount,
        cartItems: deletionResults[8].deletedCount
      };

      res.json({
        success: true,
        message: 'All farm data removed successfully',
        stats: deletionStats,
        warning: 'This action cannot be undone. All data has been permanently deleted.'
      });
    });

  } catch (error) {
    console.error('Data removal error:', error);
    res.status(500).json({ 
      error: 'Failed to remove data', 
      details: error.message 
    });
  } finally {
    await session.endSession();
  }
}));

// Get database statistics
app.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { 
    products, 
    expenses, 
    investments, 
    sales, 
    productBatches, 
    expenseTypes,
    storeProducts,
    orders,
    cartItems
  } = getCollections(db);

  const farmIdObj = toObjectId(farm_id);

  try {
    // Get store products for cart count
    const farmStoreProducts = await storeProducts.find({ farm_id: farmIdObj }).toArray();
    const storeProductIds = farmStoreProducts.map(sp => sp._id);

    const stats = {
      products: await products.countDocuments({ farm_id: farmIdObj }),
      expenses: await expenses.countDocuments({ farm_id: farmIdObj }),
      investments: await investments.countDocuments({ farm_id: farmIdObj }),
      sales: await sales.countDocuments({ farm_id: farmIdObj }),
      productBatches: await productBatches.countDocuments({ farm_id: farmIdObj }),
      expenseTypes: await expenseTypes.countDocuments({ farm_id: farmIdObj }),
      storeProducts: await storeProducts.countDocuments({ farm_id: farmIdObj }),
      orders: await orders.countDocuments({ farm_id: farmIdObj }),
      cartItems: storeProductIds.length > 0 ? await cartItems.countDocuments({ 
        store_product_id: { $in: storeProductIds } 
      }) : 0
    };

    res.json({
      success: true,
      farm_id: farm_id,
      stats: stats,
      total_records: Object.values(stats).reduce((sum, count) => sum + count, 0)
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get database stats', 
      details: error.message 
    });
  }
}));

module.exports = app;