/**
 * Management API - Consolidated endpoint for admin, finance, stats, and reports
 * This consolidation reduces serverless function count for Vercel Hobby plan
 * 
 * @swagger
 * tags:
 *   - name: Finance
 *     description: Financial management endpoints
 *   - name: Stats
 *     description: Farm statistics and analytics
 *   - name: Farms
 *     description: Farm management
 *   - name: Investments
 *     description: Investment tracking
 */

const express = require('express');
const { authenticate, optionalAuth, requireAdmin } = require('../config/auth');
const { asyncHandler, serializeDoc, serializeDocs } = require('../utils/helpers');
const DatabaseService = require('../services/database.service');

const router = express.Router();

// Export the router
module.exports = router;

// Basic admin endpoint
router.get('/admin/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin API is running' });
});

// Basic finance endpoint
router.get('/finance/health', (req, res) => {
  res.json({ status: 'ok', message: 'Finance API is running' });
});

// Basic stats endpoint
router.get('/stats/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stats API is running' });
});



// Basic reports endpoint
// ===== FINANCE ENDPOINTS =====

/**
 * @swagger
 * /finance/investments:
 *   post:
 *     summary: Create a new investment
 *     tags: [Investments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - description
 *               - amount
 *               - farm_id
 *             properties:
 *               type:
 *                 type: string
 *                 description: Type of investment
 *               description:
 *                 type: string
 *                 description: Investment description
 *               amount:
 *                 type: number
 *                 description: Investment amount
 *               farm_id:
 *                 type: string
 *                 description: ID of the farm
 *     responses:
 *       201:
 *         description: Investment created successfully
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: Get investments for a farm
 *     tags: [Investments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: farm_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Farm ID to get investments for
 *     responses:
 *       200:
 *         description: List of investments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized
 */
router.post('/finance/investments', authenticate, asyncHandler(async (req, res) => {
  const { type, description, amount, farm_id, title, investment_date } = req.body;

  if (!type || !description || !amount || !farm_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validTypesFrontend = ['infrastructure', 'tools', 'others'];
  if (!validTypesFrontend.includes(String(type).toLowerCase())) {
    return res.status(400).json({ error: 'Invalid investment type' });
  }

  // Normalize frontend types to DB enum
  const normalizeType = (t) => {
    const s = String(t).toLowerCase();
    if (s === 'tools') return 'equipment';
    if (s === 'others') return 'other';
    return s; // 'infrastructure' maps as-is
  };

  try {
    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    const invType = normalizeType(type);
    const created = await DatabaseService.createInvestment({
      investment_type: invType,
      description: String(description),
      amount: parseFloat(amount),
      farm_id: String(farm_id),
      investment_date: investment_date ? new Date(investment_date) : new Date(),
      title: title ? String(title) : `${invType} investment`,
      created_by: req.user.userId,
    });
    res.status(201).json(serializeDoc(created));
  } catch (error) {
    console.error('Error creating investment:', error);
    res.status(500).json({ error: 'Failed to create investment' });
  }
}));

// Get investments - GET /finance/investments?farm_id=xxx
router.get('/finance/investments', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  try {
    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    const investmentsList = await DatabaseService.getInvestmentsByFarm(farm_id);
    res.json(investmentsList.map(serializeDoc));
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
}));

// Alias: Get investments by farm via path param - GET /farms/:farm_id/investments
router.get('/farms/:farm_id/investments', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;
  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }
  try {
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }
    const investmentsList = await DatabaseService.getInvestmentsByFarm(farm_id);
    res.json(investmentsList.map(serializeDoc));
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
}));

// Delete investment - DELETE /investments/:id
router.delete('/finance/investments/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const investment = await DatabaseService.getInvestmentById(id);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(investment.farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    const deleted = await DatabaseService.deleteInvestment(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    res.json({ message: 'Investment deleted successfully' });
  } catch (error) {
    console.error('Error deleting investment:', error);
    res.status(500).json({ error: 'Failed to delete investment' });
  }
}));

// Get expense types - GET /finance/expense-types/farm/:farm_id
router.get('/finance/expense-types/farm/:farm_id', authenticate, asyncHandler(async (req, res) => {
  const { farm_id } = req.params;

  try {
    // Ensure default expense types exist
    try {
      await DatabaseService.ensureDefaultExpenseTypes();
    } catch (initErr) {
      console.warn('⚠️  Failed to ensure default expense types:', initErr?.message || initErr);
    }

    // Verify farm access; if not, gracefully return default/global types
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      const fallbackTypes = await DatabaseService.getExpenseTypes();
      return res.json(fallbackTypes.map(serializeDoc));
    }

    // Try fetching farm-specific + default/global types; on DB error, fallback gracefully
    try {
      const types = await DatabaseService.getExpenseTypesByFarm(farm_id);
      return res.json(types.map(serializeDoc));
    } catch (dbErr) {
      console.error('Error fetching expense types:', dbErr);
      const fallbackTypes = await DatabaseService.getExpenseTypes();
      return res.json(fallbackTypes.map(serializeDoc));
    }
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
}));

// Get expenses by farm - GET /finance/expenses
router.get('/finance/expenses', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, expense_type, start_date, end_date, skip = 0, limit = 100 } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  try {
    // Verify farm access
    const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this farm' });
    }

    const filters = {
      expense_type,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      skip: parseInt(skip),
      limit: parseInt(limit)
    };

    const expensesList = await DatabaseService.getExpensesByFarmWithFilters(farm_id, filters);
    res.json(serializeDocs(expensesList));
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
}));

router.get('/reports/health', (req, res) => {
  res.json({ status: 'ok', message: 'Reports API is running' });
});

// ===== EXPENSES ROUTES =====

// Create expense - POST /api/expenses
router.post('/expenses', authenticate, asyncHandler(async (req, res) => {
    const { type, expense_type_id, description, amount, farm_id, product_batch, expense_date, date } = req.body;

    // Enforce required fields: type (or expense_type_id), description, amount, farm_id, product_batch
    const hasTypeInput = (typeof type === 'string' && type.trim().length > 0) || (typeof expense_type_id === 'string' && expense_type_id.trim().length > 0);
    if (!hasTypeInput || !description || amount === undefined || !farm_id || !product_batch || String(product_batch).trim().length === 0) {
        return res.status(400).json({ error: 'type (or expense_type_id), description, amount, farm_id, and product_batch are required' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        // Resolve expense_type_id from name when only type is provided
        let resolvedTypeId = expense_type_id || null;
        if (!resolvedTypeId && type) {
            let lookupName = String(type).trim();
            if (lookupName.toLowerCase() === 'food') {
                lookupName = 'Feed';
            }
            if (lookupName.toLowerCase() === 'others') {
                lookupName = 'Other';
            }

            const existingType = await DatabaseService.getExpenseTypeByName(lookupName);
            if (existingType) {
                resolvedTypeId = existingType.id;
            } else {
                // Fallback strictly to 'Other' instead of creating new types
                // Ensure defaults exist to avoid null resolution
                try { await DatabaseService.ensureDefaultExpenseTypes(); } catch (e) {}
                const fallback = await DatabaseService.getExpenseTypeByName('Other');
                if (fallback) {
                    resolvedTypeId = fallback.id;
                }
            }
        }

        if (!resolvedTypeId) {
            return res.status(400).json({ error: 'Invalid expense type: unable to resolve expense_type_id' });
        }

        // Validate product_batch exists (batch name) for the farm
        const batch = await DatabaseService.getBatchNameById(String(product_batch).trim());
        if (!batch || batch.farm_id !== farm_id) {
            return res.status(400).json({ error: 'Invalid product_batch: batch not found for this farm' });
        }

        const expenseData = {
            expense_type_id: resolvedTypeId,
            description,
            amount: parseFloat(amount),
            farm_id,
            expense_date: expense_date ? new Date(expense_date) : (date ? new Date(date) : new Date()),
            created_by: req.user.userId,
            batch_id: String(product_batch).trim(),
        };

        const expense = await DatabaseService.createExpense(expenseData);

        // Map response to include `type` and `date`, and remove redundant fields
        let typeName = null;
        try {
            const typeRow = await DatabaseService.getExpenseTypeById(expense.expense_type_id);
            typeName = typeRow?.name || null;
        } catch (e) {
            // ignore type lookup error and keep null
        }

        const shaped = {
            id: expense.id,
            farm_id: expense.farm_id,
            expense_type_id: expense.expense_type_id,
            type: typeName,
            description: expense.description,
            amount: typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount,
            date: expense.expense_date,
            expense_date: expense.expense_date,
            product_batch: expense.batch_id ?? null,
            receipt_number: expense.receipt_number ?? null,
            vendor: expense.vendor ?? null,
            payment_method: expense.payment_method ?? null,
            is_recurring: expense.is_recurring ?? false,
            recurring_frequency: expense.recurring_frequency ?? null,
            created_by: expense.created_by,
            created_at: expense.created_at,
            updated_at: expense.updated_at,
        };

        res.status(201).json(shaped);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
}));

// Get expenses by farm - GET /api/farms/:farm_id/expenses
router.get('/farms/:farm_id/expenses', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { product_batch } = req.query;

    if (!farm_id) {
        return res.status(400).json({ error: 'farm_id is required' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const expenses = await DatabaseService.getExpensesByFarm(farm_id, product_batch);

        // Shape expenses to include `type` and `date` for frontend, remove `expense_type_name`
        const shaped = expenses.map((e) => ({
            id: e.id,
            farm_id: e.farm_id,
            expense_type_id: e.expense_type_id,
            type: e.expense_type_name || null,
            description: e.description,
            amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount,
            date: e.expense_date,
            expense_date: e.expense_date,
            product_batch: e.batch_id ?? null,
            product_batch_name: e.product_batch_name ?? null,
            receipt_number: e.receipt_number ?? null,
            vendor: e.vendor ?? null,
            payment_method: e.payment_method ?? null,
            is_recurring: e.is_recurring ?? false,
            recurring_frequency: e.recurring_frequency ?? null,
            created_by: e.created_by,
            created_at: e.created_at,
            updated_at: e.updated_at,
        }));

        res.json(shaped);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
}));

// Update an expense - PUT /api/expenses/:expense_id
router.put('/expenses/:expense_id', authenticate, asyncHandler(async (req, res) => {
    const { expense_id } = req.params;
    const { type, description, amount, product_batch } = req.body;

    try {
        const existingExpense = await DatabaseService.getExpenseById(expense_id);
        if (!existingExpense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(existingExpense.farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const updateData = {};
        // Map type -> expense_type_id; do NOT create new types. Fallback to 'Other'.
        if (type !== undefined) {
            const providedType = String(type).trim();
            if (!providedType) {
                return res.status(400).json({ error: 'type cannot be empty' });
            }
            let lookupName = providedType;
            if (lookupName.toLowerCase() === 'food') lookupName = 'Feed';
            if (lookupName.toLowerCase() === 'others') lookupName = 'Other';

            let resolvedType = null;
            try {
                resolvedType = await DatabaseService.getExpenseTypeByName(lookupName);
            } catch (e) {}

            if (!resolvedType) {
                try { await DatabaseService.ensureDefaultExpenseTypes(); } catch (e) {}
                resolvedType = await DatabaseService.getExpenseTypeByName('Other');
            }

            if (!resolvedType) {
                return res.status(400).json({ error: 'Invalid expense type: unable to resolve expense_type_id' });
            }
            updateData.expense_type_id = resolvedType.id;
        }
        if (description !== undefined) updateData.description = description;
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        // Update batch_id if product_batch provided
        if (product_batch !== undefined) {
            const batchId = String(product_batch).trim();
            if (batchId.length === 0) {
                return res.status(400).json({ error: 'product_batch cannot be empty' });
            }
            const batch = await DatabaseService.getBatchNameById(batchId);
            if (!batch || batch.farm_id !== existingExpense.farm_id) {
                return res.status(400).json({ error: 'Invalid product_batch: batch not found for this farm' });
            }
            updateData.batch_id = batchId;
        }

        // Ensure at least one field is provided to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided to update' });
        }

        const updatedExpense = await DatabaseService.updateExpense(expense_id, updateData);

        // Map response to include `type` and `date`
        let typeName = null;
        try {
            const typeRow = await DatabaseService.getExpenseTypeById(updatedExpense.expense_type_id);
            typeName = typeRow?.name || null;
        } catch (e) {
            // ignore type lookup error
        }

        const shaped = {
            id: updatedExpense.id,
            farm_id: updatedExpense.farm_id,
            expense_type_id: updatedExpense.expense_type_id,
            type: typeName,
            description: updatedExpense.description,
            amount: typeof updatedExpense.amount === 'string' ? parseFloat(updatedExpense.amount) : updatedExpense.amount,
            date: updatedExpense.expense_date,
            expense_date: updatedExpense.expense_date,
            product_batch: updatedExpense.batch_id ?? null,
            receipt_number: updatedExpense.receipt_number ?? null,
            vendor: updatedExpense.vendor ?? null,
            payment_method: updatedExpense.payment_method ?? null,
            is_recurring: updatedExpense.is_recurring ?? false,
            recurring_frequency: updatedExpense.recurring_frequency ?? null,
            created_by: updatedExpense.created_by,
            created_at: updatedExpense.created_at,
            updated_at: updatedExpense.updated_at,
        };

        res.json(shaped);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
}));

// Delete an expense - DELETE /api/expenses/:expense_id
router.delete('/expenses/:expense_id', authenticate, asyncHandler(async (req, res) => {
    const { expense_id } = req.params;

    try {
        const existingExpense = await DatabaseService.getExpenseById(expense_id);
        if (!existingExpense) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(existingExpense.farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        await DatabaseService.deleteExpense(expense_id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
}));

// ===== INVESTMENTS ROUTES =====

// Create investment - POST /api/investments
router.post('/investments', authenticate, asyncHandler(async (req, res) => {
    const { type, investment_type, description, amount, farm_id, date, investment_date, title } = req.body;

    // Normalize type
    const providedType = investment_type ?? type;
    const typeMap = { tools: 'equipment', others: 'other' };
    const normalizedType = (providedType && typeMap[providedType]) ? typeMap[providedType] : providedType;
    const validTypes = ['equipment', 'infrastructure', 'land', 'livestock', 'technology', 'other'];

    if (!normalizedType || !description || amount === undefined || !farm_id) {
        return res.status(400).json({ error: 'Required fields: investment_type, description, amount, farm_id' });
    }

    if (!validTypes.includes(normalizedType)) {
        return res.status(400).json({ error: 'Invalid investment type' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const invDate = investment_date ?? date ?? new Date();
        const invTitle = title ?? (description || `${normalizedType} investment`);

        const investmentData = {
            investment_type: normalizedType,
            description,
            amount: parseFloat(amount),
            farm_id,
            investment_date: new Date(invDate),
            title: invTitle,
            created_by: req.user.userId,
        };

        const investment = await DatabaseService.createInvestment(investmentData);
        res.status(201).json(investment);
    } catch (error) {
        console.error('Error creating investment:', error);
        res.status(500).json({ error: 'Failed to create investment' });
    }
}));

// Get investments by farm - GET /api/farms/:farm_id/investments
router.get('/farms/:farm_id/investments', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    if (!farm_id) {
        return res.status(400).json({ error: 'farm_id is required' });
    }

    try {
        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const investments = await DatabaseService.getInvestmentsByFarm(farm_id);
        res.json(investments);
    } catch (error) {
        console.error('Error fetching investments:', error);
        res.status(500).json({ error: 'Failed to fetch investments' });
    }
}));

// Update investment - PUT /api/investments/:id
router.put('/investments/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type, investment_type, description, amount, date, investment_date, title, status, expected_roi_percentage, actual_roi_percentage } = req.body;

    try {
        const investment = await DatabaseService.getInvestmentById(id);
        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(investment.farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const updateData = {};
        const providedType = investment_type ?? type;
        const typeMap = { tools: 'equipment', others: 'other' };
        const normalizedType = (providedType && typeMap[providedType]) ? typeMap[providedType] : providedType;
        const validTypes = ['equipment', 'infrastructure', 'land', 'livestock', 'technology', 'other'];

        if (normalizedType !== undefined) {
            if (!validTypes.includes(normalizedType)) {
                return res.status(400).json({ error: 'Invalid investment type' });
            }
            updateData.investment_type = normalizedType;
        }
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        if ((investment_date ?? date) !== undefined) updateData.investment_date = new Date(investment_date ?? date);
        if (status !== undefined) updateData.status = status;
        if (expected_roi_percentage !== undefined) updateData.expected_roi_percentage = parseFloat(expected_roi_percentage);
        if (actual_roi_percentage !== undefined) updateData.actual_roi_percentage = parseFloat(actual_roi_percentage);

        const updatedInvestment = await DatabaseService.updateInvestment(id, updateData);
        res.json(updatedInvestment);
    } catch (error) {
        console.error('Error updating investment:', error);
        res.status(500).json({ error: 'Failed to update investment' });
    }
}));

// Delete investment - DELETE /api/investments/:id
router.delete('/investments/:id', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const investment = await DatabaseService.getInvestmentById(id);
        if (!investment) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        // Verify farm access
        const hasAccess = await DatabaseService.verifyFarmOwnership(investment.farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        await DatabaseService.deleteInvestment(id);
        res.json({ message: 'Investment deleted successfully' });
    } catch (error) {
        console.error('Error deleting investment:', error);
        res.status(500).json({ error: 'Failed to delete investment' });
    }
}));

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Management API is running',
    endpoints: ['admin', 'finance', 'stats', 'reports', 'expenses', 'investments']
  });
});