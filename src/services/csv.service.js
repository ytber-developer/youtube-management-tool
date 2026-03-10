const fs = require('fs');

class CsvService {
  
  loadAccountsFromCSV(csvPath) {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const accounts = [];
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header to detect columns
    const header = lines[0].toLowerCase();
    console.log(`📋 CSV Header: ${lines[0]}`);
    
    // Detect delimiter (tab or comma)
    const delimiter = header.includes('\t') ? '\t' : ',';
    console.log(`🔍 Delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`);
    
    const headerParts = header.split(delimiter);
    const emailIndex = headerParts.findIndex(h => h.includes('email') && !h.includes('recovery'));
    const passwordIndex = headerParts.findIndex(h => h.includes('password'));
    const channelNameIndex = headerParts.findIndex(h => h.includes('channel_name') || (h.includes('channel') && !h.includes('is_create') && !h.includes('link')));
    const channelLinkIndex = headerParts.findIndex(h => h.includes('channel_link'));
    const avatarUrlIndex = headerParts.findIndex(h => h.includes('avatar') && !h.includes('is_upload'));
    const recoveryEmailIndex = headerParts.findIndex(h => h.includes('recovery'));
    const isCreateChannelIndex = headerParts.findIndex(h => h.includes('is_create_channel'));
    const codeAuthenticatorsIndex = headerParts.findIndex(h => h.includes('code_authenticators'));
    const isAuthenticatorIndex = headerParts.findIndex(h => h.includes('is_authenticator'));
    const isUploadAvatarIndex = headerParts.findIndex(h => h.includes('is_upload_avatar'));
    
    console.log(`📊 Column indices:`);
    console.log(`   email=${emailIndex}, password=${passwordIndex}, channel_name=${channelNameIndex}, channel_link=${channelLinkIndex}`);
    console.log(`   avatar_url=${avatarUrlIndex}, recovery_email=${recoveryEmailIndex}`);
    console.log(`   is_create_channel=${isCreateChannelIndex}, code_authenticators=${codeAuthenticatorsIndex}`);
    console.log(`   is_authenticator=${isAuthenticatorIndex}, is_upload_avatar=${isUploadAvatarIndex}\n`);
    
    let totalCount = 0;
    let validCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter);
      
      if (parts.length >= 2) {
        const email = parts[emailIndex]?.trim();
        const password = parts[passwordIndex]?.trim();
        const channelName = channelNameIndex >= 0 ? parts[channelNameIndex]?.trim() : '';
        const channelLink = channelLinkIndex >= 0 ? parts[channelLinkIndex]?.trim() : '';
        const avatarUrl = avatarUrlIndex >= 0 ? parts[avatarUrlIndex]?.trim() : '';
        const recoveryEmail = recoveryEmailIndex >= 0 ? parts[recoveryEmailIndex]?.trim() : '';
        const isCreateChannelValue = isCreateChannelIndex >= 0 ? parts[isCreateChannelIndex]?.trim() : '';
        const codeAuthenticatorsValue = codeAuthenticatorsIndex >= 0 ? parts[codeAuthenticatorsIndex]?.trim() : '';
        const isAuthenticatorValue = isAuthenticatorIndex >= 0 ? parts[isAuthenticatorIndex]?.trim() : '';
        const isUploadAvatarValue = isUploadAvatarIndex >= 0 ? parts[isUploadAvatarIndex]?.trim() : '';
        
        if (email && password) {
          totalCount++;
          validCount++;
          
          accounts.push({ 
            email, 
            password, 
            channel_name: channelName || '',
            channel_link: channelLink || '',
            avatar_url: avatarUrl || null,
            recovery_email: recoveryEmail || null,
            is_create_channel: isCreateChannelValue || '',
            code_authenticators: codeAuthenticatorsValue || '',
            is_authenticator: isAuthenticatorValue || '',
            is_upload_avatar: isUploadAvatarValue || '',
            authenticator: '' // Legacy field, will be filled after setup
          });
        }
      }
    }
    
    console.log(`📊 Tổng kết:`);
    console.log(`   📧 Tổng số records: ${totalCount}`);
    console.log(`   ✅ Hợp lệ: ${validCount}\n`);
    
    return accounts;
  }

  saveResults(results, filePath = 'results.json') {
    try {
      fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
      console.log(`💾 Đã lưu kết quả: ${filePath}`);
    } catch (error) {
      console.error('❌ Lỗi khi lưu kết quả:', error);
    }
  }

  // Save results back to CSV with authenticator codes
  saveResultsToCSV(results, filePath = 'accounts-updated.csv') {
    try {
      const header = 'Email,Password,Channel Name,Authenticator,Status\n';
      const rows = results.map(r => {
        return `${r.email},${r.password || ''},${r.channel_name || ''},${r.secretKey || ''},${r.success ? 'Success' : 'Failed'}`;
      }).join('\n');
      
      fs.writeFileSync(filePath, header + rows, 'utf-8');
      console.log(`💾 Đã lưu CSV cập nhật: ${filePath}`);
    } catch (error) {
      console.error('❌ Lỗi khi lưu CSV:', error);
    }
  }
}

module.exports = new CsvService();
