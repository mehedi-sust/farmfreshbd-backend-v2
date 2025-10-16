const express = require('express');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, toInteger, isValidUUID } = require('../src/utils/helpers');
const DatabaseService = require('../src/services/database.service');

const router = express.Router();

// GET /farms - List all farms
router.get('/', asyncHandler(async (req, res) => {
    try {
        console.log('📋 Fetching all farms...');
        const farms = await DatabaseService.getAllFarms();
        console.log(`✅ Found ${farms.length} farms`);
        
        // Serialize all farms
        const serializedFarms = farms.map(farm => serializeDoc(farm));
        
        res.json({
            success: true,
            count: farms.length,
            farms: serializedFarms
        });
    } catch (error) {
        console.error('❌ Error fetching farms:', error);
        res.status(500).json({ error: 'Failed to fetch farms', details: error.message });
    }
}));

// GET /farms/:farm_id - Get farm details
router.get('/:farm_id', asyncHandler(async (req, res) => {
    const { farm_id } = req.params;

    try {
        console.log('🔍 Fetching farm details for ID:', farm_id);
        
        // Validate farm_id format (should be UUID)
        if (!isValidUUID(farm_id)) {
            console.log('❌ Invalid farm ID format:', farm_id);
            return res.status(400).json({ error: 'Invalid farm ID format' });
        }

        const farm = await DatabaseService.getFarmById(farm_id);

        if (!farm) {
            console.log('❌ Farm not found for ID:', farm_id);
            return res.status(404).json({ error: 'Farm not found' });
        }

        console.log('✅ Found farm:', farm.name);
        res.json(serializeDoc(farm));
    } catch (error) {
        console.error('❌ Error fetching farm:', error);
        res.status(500).json({ error: 'Failed to fetch farm', details: error.message });
    }
}));

// PUT /farms/:farm_id - Update farm details
router.put('/:farm_id', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { 
        name, type, location, description, banner_image, 
        contact_number, address, bio, build_year 
    } = req.body;

    try {
        console.log('🔄 Updating farm with ID:', farm_id);
        
        // Validate farm_id format (should be UUID)
        if (!isValidUUID(farm_id)) {
            console.log('❌ Invalid farm ID format:', farm_id);
            return res.status(400).json({ error: 'Invalid farm ID format' });
        }
        
        // Check if farm exists
        const existingFarm = await DatabaseService.getFarmById(farm_id);
        if (!existingFarm) {
            return res.status(404).json({ error: 'Farm not found' });
        }

        // Construct update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (type !== undefined) updateData.type = type;
        if (location !== undefined) updateData.location = location;
        if (description !== undefined) updateData.description = description;
        if (banner_image !== undefined) updateData.banner_image = banner_image;
        // Map contact_number to phone column in DB
        if (contact_number !== undefined) updateData.phone = contact_number;
        if (address !== undefined) updateData.address = address;
        // Map bio to description column in DB
        if (bio !== undefined) updateData.description = bio;
        if (build_year !== undefined) updateData.build_year = build_year;

        // Update the farm
        const updatedFarm = await DatabaseService.updateFarm(farm_id, updateData);

        res.json({
            message: 'Farm updated successfully',
            farm: serializeDoc(updatedFarm)
        });
    } catch (error) {
        console.error('Error updating farm:', error);
        res.status(500).json({ error: 'Failed to update farm' });
    }
}));

// Create farm (for new farmers/farm managers after registration)
router.post('/create-farm', authenticate, asyncHandler(async (req, res) => {
    console.log('🚀 CREATE FARM REQUEST RECEIVED');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User from auth:', req.user);
    
    const { 
        farm_name, farm_type, contact_number, address, 
        location, bio, build_year, banner_image, website, user_id 
    } = req.body;

    console.log('🔍 Extracted fields:', {
        farm_name, farm_type, contact_number, address, 
        location, bio, build_year, banner_image, website, user_id
    });

    if (!farm_name || !farm_type || !user_id) {
        console.log('❌ Missing required fields:', { farm_name, farm_type, user_id });
        return res.status(400).json({ 
            error: 'Farm name, type, and user_id are required' 
        });
    }

    const validTypes = ['dairy', 'poultry', 'fish', 'goat', 'mixed'];
    if (!validTypes.includes(farm_type)) {
        console.log('❌ Invalid farm type:', farm_type);
        return res.status(400).json({ error: 'Invalid farm type' });
    }

    try {
        console.log('🔄 Processing user_id:', user_id);
        console.log('✅ Using user_id as UUID:', user_id);
        
        // Check if user exists
        console.log('🔍 Checking if user exists...');
        const user = await DatabaseService.getUserById(user_id);
        console.log('👤 User found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('👤 User details:', { id: user.id, email: user.email, farm_id: user.farm_id });
        }
        
        if (!user) {
            console.log('❌ User not found for ID:', userIdInt);
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user already owns a farm
        console.log('🔍 Checking if user already owns a farm...');
        const existingFarm = await DatabaseService.getFarmByOwnerId(user_id);
        if (existingFarm) {
            console.log('🏠 User already owns a farm:', existingFarm.name);
            return res.status(409).json({
                message: 'User already has a farm',
                farm_id: existingFarm.id,
                farm: serializeDoc(existingFarm)
            });
        }
        console.log('✅ User does not own a farm yet, proceeding with creation...');

        const farmData = {
            name: farm_name,
            type: farm_type,
            description: bio || null,
            location: location || null,
            address: address || null,
            phone: contact_number || null,
            email: user.email, // Auto-populate from logged-in user
            website: website || null,
            banner_image: banner_image || null,
            build_year: build_year || null,
            owner_id: user_id,
            manager_id: user_id // Auto-populate from logged-in user
        };

        console.log('🏗️ Creating farm with data:', JSON.stringify(farmData, null, 2));
        const createdFarm = await DatabaseService.createFarm(farmData);
        console.log('✅ Farm created successfully:', createdFarm);

        console.log('📤 Sending response:', serializeDoc(createdFarm));
        res.status(201).json(serializeDoc(createdFarm));
    } catch (error) {
        console.error('❌ Error creating farm:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to create farm', details: error.message });
    }
}));

// GET /farms/user/:user_id - Get farm by user ID
router.get('/user/:user_id', authenticate, asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    try {
        console.log('🔍 Fetching farm for user:', user_id);
        
        // Validate user_id format
        if (!isValidUUID(user_id)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        const farm = await DatabaseService.getFarmByOwnerId(user_id);

        if (!farm) {
            console.log('❌ No farm found for user:', user_id);
            return res.status(404).json({ error: 'No farm found for this user' });
        }

        console.log('✅ Found farm for user:', farm.name);
        res.json(serializeDoc(farm));
    } catch (error) {
        console.error('❌ Error fetching farm by user ID:', error);
        res.status(500).json({ error: 'Failed to fetch farm', details: error.message });
    }
}));

module.exports = router;
/**
 * Farm Orders - for manager dashboard
 */

// GET /farms/:farm_id/orders - List orders for a farm
router.get('/:farm_id/orders', authenticate, asyncHandler(async (req, res) => {
    const { farm_id } = req.params;
    const { status = 'all', page = 1, limit = 10 } = req.query;

    try {
        if (!isValidUUID(farm_id)) {
            return res.status(400).json({ error: 'Invalid farm ID format' });
        }

        // Verify farm ownership
        const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this farm' });
        }

        const result = await DatabaseService.getFarmOrders(farm_id, { status, page, limit });
        res.json(result);
    } catch (error) {
        console.error('❌ Error fetching farm orders:', error);
        res.status(500).json({ error: 'Failed to fetch farm orders', details: error.message });
    }
}));