/**
 * Farms API endpoints for Vercel serverless deployment
 * Handles farm CRUD operations
 */

const { connectToDatabase, getCollections } = require('../src/config/database');
const { ObjectId } = require('mongodb');
const { serializeDoc } = require('../src/utils/helpers');

// Serverless function handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Connect to database
    await connectToDatabase();
    const { farms } = await getCollections();

    const { method, url } = req;
    const path = url.replace('/api/farms', '').replace('/farms', '');

    // Route handling
    if (method === 'GET' && (path === '' || path === '/')) {
      return await handleGetFarms(req, res, farms);
    }
    
    if (method === 'POST' && (path === '' || path === '/')) {
      return await handleCreateFarm(req, res, farms);
    }

    if (method === 'GET' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleGetFarm(req, res, farms, id);
    }

    if (method === 'PUT' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleUpdateFarm(req, res, farms, id);
    }

    if (method === 'DELETE' && path.startsWith('/')) {
      const id = path.substring(1);
      return await handleDeleteFarm(req, res, farms, id);
    }

    // If no route matches
    return res.status(404).json({ 
      error: 'Farms endpoint not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('Farms API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Get farms handler
async function handleGetFarms(req, res, farms) {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    location = '',
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { owner_name: { $regex: search, $options: 'i' } }
    ];
  }
  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  // Build sort
  const sortObj = {};
  sortObj[sort] = order === 'desc' ? -1 : 1;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const farmsList = await farms.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

  const total = await farms.countDocuments(query);

  return res.status(200).json({
    farms: farmsList.map(serializeDoc),
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalFarms: total,
      farmsPerPage: parseInt(limit)
    }
  });
}

// Create farm handler
async function handleCreateFarm(req, res, farms) {
  const {
    name,
    description,
    owner_name,
    owner_email,
    owner_phone,
    location,
    address,
    farm_size,
    farm_type = 'organic',
    certification = [],
    images = []
  } = req.body;

  if (!name || !owner_name || !owner_email || !location) {
    return res.status(400).json({ 
      error: 'Name, owner name, owner email, and location are required' 
    });
  }

  const newFarm = {
    name,
    description,
    owner_name,
    owner_email,
    owner_phone,
    location,
    address,
    farm_size,
    farm_type,
    certification,
    images,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date()
  };

  const result = await farms.insertOne(newFarm);

  return res.status(201).json({
    message: 'Farm created successfully',
    farmId: result.insertedId,
    farm: serializeDoc({ _id: result.insertedId, ...newFarm })
  });
}

// Get single farm handler
async function handleGetFarm(req, res, farms, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }

  const farm = await farms.findOne({ _id: new ObjectId(id) });
  
  if (!farm) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  return res.status(200).json({
    farm: serializeDoc(farm)
  });
}

// Update farm handler
async function handleUpdateFarm(req, res, farms, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }

  const updateData = { ...req.body };
  delete updateData._id; // Remove _id if present
  updateData.updated_at = new Date();

  const result = await farms.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  return res.status(200).json({
    message: 'Farm updated successfully',
    modifiedCount: result.modifiedCount
  });
}

// Delete farm handler
async function handleDeleteFarm(req, res, farms, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid farm ID' });
  }

  const result = await farms.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Farm not found' });
  }

  return res.status(200).json({
    message: 'Farm deleted successfully'
  });
}