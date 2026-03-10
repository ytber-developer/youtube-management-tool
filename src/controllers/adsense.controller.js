const csvService = require('../services/csv.service');
const adsenseService = require('../services/adsense.service');
const fs = require('fs');

/**
 * POST /api/v1/accounts/adsense/check
 * Accepts a CSV upload with headers: email,password,2fa (2fa optional)
 * Returns JSON array of results: { email, success, status, message, screenshotBase64 }
 */
exports.checkAdsense = async (req, res) => {
  try {
    if (!req.files || !req.files.file || req.files.file.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV file is required' });
    }

    const csvPath = req.files.file[0].path;
    // Load accounts using existing CSV parser which expects headers including email,password
    const accounts = csvService.loadAccountsFromCSV(csvPath);

    if (!accounts || accounts.length === 0) {
      // cleanup
      try { if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath); } catch (e) {}
      return res.status(400).json({ success: false, message: 'No valid accounts found in CSV' });
    }

    // Prepare simplified account list: email,password,2fa
    const simplified = accounts.map(a => ({
      email: a.email,
      password: a.password,
      twofa: a.code_authenticators || ''
    }));

    // Run checks (no DB writes) - default concurrency 3
    const results = await adsenseService.checkAccounts(simplified, { concurrency: 3, timeoutMs: 60000 });

    // Save results back to CSV and return file path (temporary)
    try {
      const path = require('path');
      const os = require('os');
      const outFile = path.join(os.tmpdir(), `adsense-results-${Date.now()}.csv`);

      // Build CSV header
      const headers = ['email','status','success','message'];
      const rows = results.map(r => {
        const safeMsg = (r.message || '').replace(/"/g, '""');
        return `"${r.email}","${r.status}","${r.success ? 'true' : 'false'}","${safeMsg}"`;
      });
      const csvContent = headers.join(',') + '\n' + rows.join('\n');
      require('fs').writeFileSync(outFile, csvContent, 'utf-8');

      // Attach file for download: send as file stream
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="adsense-results.csv"`);
      const stream = require('fs').createReadStream(outFile);
      stream.pipe(res);
      // Cleanup file after streaming
      stream.on('end', () => { try { require('fs').unlinkSync(outFile); } catch (e) {} });
      return;
    } catch (e) {
      // Fall back to returning JSON if file writing fails
      console.error('❌ Failed to write results CSV:', e.message);
    }

    // Cleanup uploaded CSV
    try { if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath); } catch (e) {}

    return res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('❌ Adsence check error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
