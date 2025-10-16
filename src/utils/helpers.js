/**
 * Check if string is valid UUID format (PostgreSQL primary key)
 */
function isValidUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate UUID format and return the UUID string
 * All IDs in this database are UUIDs, not integers
 */
function validateUUID(id) {
  if (!id) {
    throw new Error('Invalid ID format: null or undefined');
  }
  
  if (!isValidUUID(id)) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  
  return id;
}

/**
 * Convert to integer safely for pagination parameters (skip, limit, etc.)
 */
function toInteger(value) {
  if (!value && value !== 0) {
    return null;
  }
  
  const intValue = parseInt(value, 10);
  if (isNaN(intValue)) {
    throw new Error(`Invalid integer format: ${value}`);
  }
  
  return intValue;
}

/**
 * Serialize document for API response
 */
function serializeDoc(doc) {
  if (!doc) return null;
  
  const serialized = { ...doc };
  
  // Convert dates to ISO strings
  Object.keys(serialized).forEach(key => {
    if (serialized[key] instanceof Date) {
      serialized[key] = serialized[key].toISOString();
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

module.exports = {
  isValidUUID,
  validateUUID,
  toInteger,
  serializeDoc,
  serializeDocs,
  asyncHandler,
};
