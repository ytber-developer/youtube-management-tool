require('dotenv').config();
const { sequelize } = require('../src/models');

const accounts = [
  { id: 40, email: '41c9f48tg@aaiil.vip', password: 'kmcbs37p', code_authenticators: '', channel_name: 'Tuan Test', channel_link: 'https://studio.youtube.com/channel/UC26P6EAyraY1iRieg3wx0BA', is_authenticator: null, is_create_channel: 1, is_upload_avatar: 1, last_login_at: '2026-03-15 04:21:09', notes: "Setup failed: Failed to create channel: Attempted to use detached Frame 'EEE12577183F450349C988DBC4327819'.", created_at: '2026-02-08 10:38:11', updated_at: '2026-03-15 04:21:09', avatar_url: 'https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3', image_name: 'avatar_41c9f48tg_1770547110136_gjpen.jpg', recovery_email: null },
  { id: 42, email: '41jc2bucg@aaiil.vip', password: 'jOffDmiL', code_authenticators: null, channel_name: 'Tuan Test', channel_link: null, is_authenticator: 0, is_create_channel: 0, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Unknown value for options.waitUntil: networkidle', created_at: '2026-02-08 10:51:58', updated_at: '2026-02-08 10:53:15', avatar_url: 'https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3', image_name: 'avatar_41jc2bucg_1770547934057_w30r0.jpg', recovery_email: 'bt0sy912g@hoanpro.com' },
  { id: 43, email: '41jfxlneg@aaiil.vip', password: 'z3tsi2v9', code_authenticators: 'DDM623X7DCAXYQOVET5YCUYN35WXH7KF', channel_name: 'Tuan Test', channel_link: null, is_authenticator: 0, is_create_channel: 0, is_upload_avatar: 0, last_login_at: '2026-02-08 10:56:01', notes: 'Setup failed: Could not find "Turn on 2-Step Verification" button. Authenticator code is saved. Please retry later.', created_at: '2026-02-08 10:54:25', updated_at: '2026-02-08 10:56:02', avatar_url: 'https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3', image_name: 'avatar_41jfxlneg_1770548081177_ae5sd.jpg', recovery_email: 'bt0sy912g@hoanpro.com' },
  { id: 45, email: 'jumts74@gmail.com', password: 'hgZnBelsiwid', code_authenticators: 'cbe5 sdfl svkp n5w5 nm3x xrr7 r6vh 2iaa', channel_name: 'Tuan Test', channel_link: 'https://www.youtube.com/channel/UC5i7JLQs_8YgGWIeqxSX6UA', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Account không có secret key trong database', created_at: '2026-02-08 11:10:08', updated_at: '2026-02-08 11:10:49', avatar_url: 'https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3', image_name: 'avatar_41s9noewg_1770549023948_9yn8s.jpg', recovery_email: 'bt0sy912g@hoanpro.com' },
  { id: 52, email: 'phetnam2@gmail.com', password: 'hgizAsLjQazw', code_authenticators: 'lftd q5ql ja3i y3aw 6cub m7qw 3lfe rm2w', channel_name: 'nam phet', channel_link: 'https://www.youtube.com/channel/UCOMRlcAjPeU1C2xUv0bwDig', is_authenticator: 1, is_create_channel: 1, is_upload_avatar: 1, last_login_at: null, notes: null, created_at: '2026-03-01 08:44:30', updated_at: '2026-03-01 08:44:30', avatar_url: null, image_name: null, recovery_email: null },
  { id: 53, email: '3pu3sii9g@aaiil.vip', password: 'ig4fro17', code_authenticators: null, channel_name: 'Movie Reviews', channel_link: null, is_authenticator: 0, is_create_channel: 0, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-06 14:17:40', updated_at: '2026-03-06 14:17:40', avatar_url: 'https://www.facebook.com/photo.php?fbid=122155696778838374&set=a.122102188538838374&type=-24', image_name: null, recovery_email: 'msp95ugkg@hoanpro.com' },
  { id: 54, email: '3prrl14eg@aaiil.vip', password: 'fnxw280w', code_authenticators: null, channel_name: 'Education Hub', channel_link: null, is_authenticator: 0, is_create_channel: 0, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-06 14:17:41', updated_at: '2026-03-06 14:17:41', avatar_url: 'https://www.facebook.com/photo.php?fbid=122155696778838374&set=a.122102188538838374&type=-21', image_name: null, recovery_email: 'icu4njvug@hoanpro.com' },
  { id: 55, email: '468lf4xeg@aaiil.vip', password: 'gigthnr5', code_authenticators: null, channel_name: 'TheSweetDelirium', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Could not click Authenticator link', created_at: '2026-03-14 09:04:19', updated_at: '2026-03-14 09:04:54', avatar_url: null, image_name: null, recovery_email: null },
  { id: 56, email: '46a5chqbg@aaiil.vip', password: 'lyaveuem', code_authenticators: null, channel_name: 'UknoEvonne', channel_link: 'http://www.youtube.com/@UknoEvonne', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Could not click Authenticator link', created_at: '2026-03-14 09:04:19', updated_at: '2026-03-14 09:04:54', avatar_url: null, image_name: null, recovery_email: null },
  { id: 57, email: '46c002bkg@aaiil.vip', password: 'dk81waav', code_authenticators: null, channel_name: 'Drewsify', channel_link: 'http://www.youtube.com/@drewsify479', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Could not click Authenticator link', created_at: '2026-03-14 09:04:19', updated_at: '2026-03-14 09:04:54', avatar_url: null, image_name: null, recovery_email: null },
  { id: 59, email: '46fpe7fzg@aaiil.vip', password: 'g5a9xtok', code_authenticators: null, channel_name: 'kanonkun84', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Failed to navigate after clicking passwordNext (context destroyed)', created_at: '2026-03-14 09:13:38', updated_at: '2026-03-14 09:14:09', avatar_url: null, image_name: null, recovery_email: null },
  { id: 60, email: '46fwybk8g@aaiil.vip', password: 'UkJPBpnC', code_authenticators: null, channel_name: 'kanonkun84', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-14 09:15:02', updated_at: '2026-03-14 09:15:02', avatar_url: null, image_name: null, recovery_email: null },
  { id: 61, email: '46k41fudg@aaiil.vip', password: 'wXdaLLId', code_authenticators: null, channel_name: 'kanonkun84', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: 'Setup failed: Could not click Authenticator link', created_at: '2026-03-14 09:18:45', updated_at: '2026-03-14 09:19:19', avatar_url: null, image_name: null, recovery_email: null },
  { id: 62, email: '46jkytwcg@aaiil.vip', password: 'ZglajQHI', code_authenticators: null, channel_name: 'kanonkun84', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: "Setup failed: Attempted to use detached Frame '020E07FCCB45A000A7AE315B6D01842C'.", created_at: '2026-03-14 09:24:41', updated_at: '2026-03-14 09:26:00', avatar_url: null, image_name: null, recovery_email: null },
  { id: 63, email: '46jy34lcg@aaiil.vip', password: 'LxrSvkUN', code_authenticators: null, channel_name: 'kanonkun84', channel_link: 'http://www.youtube.com/@TheSweetDelirium', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-14 09:26:26', updated_at: '2026-03-14 09:26:26', avatar_url: null, image_name: null, recovery_email: null },
  { id: 64, email: '46gzs8qag@aaiil.vip', password: 'o6uiinp7', code_authenticators: null, channel_name: 'MsClaudiaf', channel_link: 'http://www.youtube.com/@MsClaudiaf', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-15 04:18:48', updated_at: '2026-03-15 04:18:48', avatar_url: null, image_name: null, recovery_email: null },
  { id: 65, email: '46hslhccg@aaiil.vip', password: '11zpnvhz', code_authenticators: null, channel_name: 'rennleitung', channel_link: 'http://www.youtube.com/@rennleitung', is_authenticator: 0, is_create_channel: 1, is_upload_avatar: 0, last_login_at: null, notes: null, created_at: '2026-03-15 04:18:48', updated_at: '2026-03-15 04:18:48', avatar_url: null, image_name: null, recovery_email: null },
];

const videos = [
  { id: 25, account_youtube_id: 52, email: 'phetnam2@gmail.com', video_url: 'https://www.youtube.com/watch?v=vcGPNfBKgeU', title: 'test video upload', source_url: 'https://www.facebook.com/watch?v=2336189136865517', created_at: '2026-03-08 11:53:31', updated_at: '2026-03-08 11:53:31', source_url_hash: null, local_file_path: null, video_description: null, video_visibility: 'public', schedule_date: null, status: 'pending', error_message: null, download_attempts: 0, upload_attempts: 0, downloaded_at: null, uploaded_at: null },
  { id: 26, account_youtube_id: 52, email: 'phetnam2@gmail.com', video_url: 'https://www.youtube.com/watch?v=vcGPNfBKgeU', title: '🔥🐲[Review Phim] GODZILLA 2 | ĐẠI CHIẾN TỪ BIỂN CẢ ĐẾN BẦU TRỜI – CUỘC SỐNG CỦA NHỮNG VỊ THẦN🐲🔥#Godzilla2\n#KingOfTheMonsters\n#Godzilla\n#Ghidorah\n#Mothra\n#Rodan\n#MonsterVerse\n#WarnerBros...', source_url: 'https://www.facebook.com/watch?v=1379337943867704', created_at: '2026-03-08 11:54:49', updated_at: '2026-03-08 11:54:49', source_url_hash: null, local_file_path: null, video_description: null, video_visibility: 'public', schedule_date: null, status: 'pending', error_message: null, download_attempts: 0, upload_attempts: 0, downloaded_at: null, uploaded_at: null },
  { id: 27, account_youtube_id: 40, email: '41c9f48tg@aaiil.vip', video_url: 'https://www.youtube.com/watch?v=2NVpFO0ugfM', title: '[Review Phim] VỊ THẦN THỜI GIAN Kẻ có Quyền Năng Tối Thượng thao túng cả Đa Vũ Trụ', source_url: 'https://www.facebook.com/watch?v=1767288927583700', created_at: '2026-03-10 11:08:39', updated_at: '2026-03-10 11:08:39', source_url_hash: null, local_file_path: null, video_description: null, video_visibility: 'public', schedule_date: null, status: 'pending', error_message: null, download_attempts: 0, upload_attempts: 0, downloaded_at: null, uploaded_at: null },
];

const ACCOUNT_COLS = 'id, email, password, code_authenticators, channel_name, channel_link, is_authenticator, is_create_channel, is_upload_avatar, last_login_at, notes, created_at, updated_at, avatar_url, image_name, recovery_email';
const VIDEO_COLS = 'id, account_youtube_id, email, video_url, title, source_url, created_at, updated_at, source_url_hash, local_file_path, video_description, video_visibility, schedule_date, status, error_message, download_attempts, upload_attempts, downloaded_at, uploaded_at';

async function importData() {
  try {
    await sequelize.authenticate();

    let accInserted = 0, accSkipped = 0;
    for (const acc of accounts) {
      const [, created] = await sequelize.query(
        `INSERT OR IGNORE INTO account_youtubes (${ACCOUNT_COLS}) VALUES (:id,:email,:password,:code_authenticators,:channel_name,:channel_link,:is_authenticator,:is_create_channel,:is_upload_avatar,:last_login_at,:notes,:created_at,:updated_at,:avatar_url,:image_name,:recovery_email)`,
        { replacements: acc }
      );
      created ? accInserted++ : accSkipped++;
    }
    console.log(`✅ account_youtubes: ${accInserted} inserted, ${accSkipped} skipped (already exist)`);

    let vidInserted = 0, vidSkipped = 0;
    for (const vid of videos) {
      const [, created] = await sequelize.query(
        `INSERT OR IGNORE INTO uploaded_videos (${VIDEO_COLS}) VALUES (:id,:account_youtube_id,:email,:video_url,:title,:source_url,:created_at,:updated_at,:source_url_hash,:local_file_path,:video_description,:video_visibility,:schedule_date,:status,:error_message,:download_attempts,:upload_attempts,:downloaded_at,:uploaded_at)`,
        { replacements: vid }
      );
      created ? vidInserted++ : vidSkipped++;
    }
    console.log(`✅ uploaded_videos: ${vidInserted} inserted, ${vidSkipped} skipped (already exist)`);

    console.log('\n🎉 Import completed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Import failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

importData();
