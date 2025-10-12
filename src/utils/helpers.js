const { ObjectId } = require('mongodb');

/**
 * Check if string is valid MongoDB ObjectId
 */
function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

/**
 * Convert string to ObjectId safely
 */
function toObjectId(id) {
  if (!id) {
    throw new Error('Invalid ObjectId format');
  }
  
  // If it's already an ObjectId, return it
  if (id instanceof ObjectId) {
    return id;
  }
  
  // Convert to string and check if it's a valid ObjectId format
  const idStr = id.toString();
  if (idStr.length === 24 && /^[0-9a-fA-F]{24}$/.test(idStr)) {
    return new ObjectId(idStr);
  }
  
  // Try to create ObjectId anyway (for cases where MongoDB generated it)
  try {
    return new ObjectId(idStr);
  } catch (error) {
    throw new Error('Invalid ObjectId format');
  }
}

/**
 * Convert ObjectId to string in object
 */
function serializeDoc(doc) {
  if (!doc) return null;
  
  const serialized = { ...doc };
  if (serialized._id) {
    serialized._id = serialized._id.toString();
  }
  
  // Convert other ObjectId fields
  Object.keys(serialized).forEach(key => {
    if (serialized[key] instanceof ObjectId) {
      serialized[key] = serialized[key].toString();
    }
  });
  
  return serialized;
}

/**
 * Serialize array of documents
 */
function serializeDocs(docs) {
  return docs.map(serializeDoc);
}

/**
 * Handle async route errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Verify user has access to farm
 */
async function verifyFarmAccess(farmId, userId, db) {
  const user = await db.collection('users').findOne({ _id: toObjectId(userId) });
  
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.farm_id && user.farm_id.toString() === farmId) {
    return true;
  }

  throw new Error('Access denied to this farm');
}

module.exports = {
  isValidObjectId,
  toObjectId,
  serializeDoc,
  serializeDocs,
  asyncHandler,
  verifyFarmAccess,
};
