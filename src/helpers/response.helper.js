/**
 * Success response helper for paginated list
 * @param {Object} data - Response data
 * @param {Array} data.items - Array of items
 * @param {Number} data.total - Total count
 * @param {Number} data.page - Current page
 * @param {Number} data.limit - Items per page
 * @returns {Object} Formatted response
 */
exports.successListResponse = ({ items, total, page, limit }) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

/**
 * Success response helper for single item
 * @param {Object} data - Response data
 * @param {String} message - Success message
 * @returns {Object} Formatted response
 */
exports.successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

/**
 * Error response helper
 * @param {String} message - Error message
 * @param {Object} error - Error object
 * @returns {Object} Formatted error response
 */
exports.errorResponse = (message, error = null) => {
  const response = {
    success: false,
    message
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.error = error.message;
    response.stack = error.stack;
  }

  return response;
};
