const { runMigrations, getStatus } = require('../services/migrate.service');
const { successResponse, errorResponse } = require('../helpers/response.helper');

exports.getStatus = async (req, res) => {
  try {
    const status = await getStatus();
    res.json(successResponse(status));
  } catch (err) {
    res.status(500).json(errorResponse('Failed to get status', err));
  }
};

exports.migrate = async (req, res) => {
  try {
    const result = await runMigrations();
    res.json(successResponse(result, result.message));
  } catch (err) {
    res.status(500).json(errorResponse('Migration failed', err));
  }
};
