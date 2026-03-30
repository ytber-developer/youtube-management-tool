-- MySQL dump 10.13  Distrib 9.6.0, for macos15.7 (arm64)
--
-- Host: 127.0.0.1    Database: accounts_ytb
-- ------------------------------------------------------
-- Server version	5.7.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account_youtubes`
--

DROP TABLE IF EXISTS `account_youtubes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_youtubes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_authenticators` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '2FA/Authenticator code',
  `channel_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_authenticator` tinyint(1) DEFAULT '0' COMMENT 'Whether 2FA is enabled',
  `is_create_channel` tinyint(1) DEFAULT '0' COMMENT 'Whether YouTube channel has been created',
  `is_upload_avatar` tinyint(1) DEFAULT '0' COMMENT 'Whether avatar has been uploaded',
  `last_login_at` datetime DEFAULT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Facebook avatar URL to download',
  `image_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Downloaded avatar image filename',
  `recovery_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Recovery email for account',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_youtubes`
--

LOCK TABLES `account_youtubes` WRITE;
/*!40000 ALTER TABLE `account_youtubes` DISABLE KEYS */;
INSERT INTO `account_youtubes` VALUES (40,'41c9f48tg@aaiil.vip','kmcbs37p','','Tuan Test','https://studio.youtube.com/channel/UC26P6EAyraY1iRieg3wx0BA',NULL,1,1,'2026-03-15 04:21:09','Setup failed: Failed to create channel: Attempted to use detached Frame \'EEE12577183F450349C988DBC4327819\'.','2026-02-08 10:38:11','2026-03-15 04:21:09','https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3','avatar_41c9f48tg_1770547110136_gjpen.jpg',NULL),(42,'41jc2bucg@aaiil.vip','jOffDmiL',NULL,'Tuan Test',NULL,0,0,0,NULL,'Setup failed: Unknown value for options.waitUntil: networkidle','2026-02-08 10:51:58','2026-02-08 10:53:15','https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3','avatar_41jc2bucg_1770547934057_w30r0.jpg','bt0sy912g@hoanpro.com'),(43,'41jfxlneg@aaiil.vip','z3tsi2v9','DDM623X7DCAXYQOVET5YCUYN35WXH7KF','Tuan Test',NULL,0,0,0,'2026-02-08 10:56:01','Setup failed: Could not find \"Turn on 2-Step Verification\" button. Authenticator code is saved. Please retry later.','2026-02-08 10:54:25','2026-02-08 10:56:02','https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3','avatar_41jfxlneg_1770548081177_ae5sd.jpg','bt0sy912g@hoanpro.com'),(45,'jumts74@gmail.com','hgZnBelsiwid','cbe5 sdfl svkp n5w5 nm3x xrr7 r6vh 2iaa','Tuan Test','https://www.youtube.com/channel/UC5i7JLQs_8YgGWIeqxSX6UA',0,1,0,NULL,'Setup failed: Account không có secret key trong database','2026-02-08 11:10:08','2026-02-08 11:10:49','https://www.facebook.com/photo.php?fbid=2075698772968993&set=pb.100015866709033.-2207520000&type=3','avatar_41s9noewg_1770549023948_9yn8s.jpg','bt0sy912g@hoanpro.com'),(52,'phetnam2@gmail.com','hgizAsLjQazw','lftd q5ql ja3i y3aw 6cub m7qw 3lfe rm2w','nam phet','https://www.youtube.com/channel/UCOMRlcAjPeU1C2xUv0bwDig',1,1,1,NULL,NULL,'2026-03-01 08:44:30','2026-03-01 08:44:30',NULL,NULL,NULL),(53,'3pu3sii9g@aaiil.vip','ig4fro17',NULL,'Movie Reviews',NULL,0,0,0,NULL,NULL,'2026-03-06 14:17:40','2026-03-06 14:17:40','https://www.facebook.com/photo.php?fbid=122155696778838374&set=a.122102188538838374&type=-24',NULL,'msp95ugkg@hoanpro.com'),(54,'3prrl14eg@aaiil.vip','fnxw280w',NULL,'Education Hub',NULL,0,0,0,NULL,NULL,'2026-03-06 14:17:41','2026-03-06 14:17:41','https://www.facebook.com/photo.php?fbid=122155696778838374&set=a.122102188538838374&type=-21',NULL,'icu4njvug@hoanpro.com'),(55,'468lf4xeg@aaiil.vip','gigthnr5',NULL,'TheSweetDelirium','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,'Setup failed: Could not click Authenticator link','2026-03-14 09:04:19','2026-03-14 09:04:54',NULL,NULL,NULL),(56,'46a5chqbg@aaiil.vip','lyaveuem',NULL,'UknoEvonne','http://www.youtube.com/@UknoEvonne',0,1,0,NULL,'Setup failed: Could not click Authenticator link','2026-03-14 09:04:19','2026-03-14 09:04:54',NULL,NULL,NULL),(57,'46c002bkg@aaiil.vip','dk81waav',NULL,'Drewsify','http://www.youtube.com/@drewsify479',0,1,0,NULL,'Setup failed: Could not click Authenticator link','2026-03-14 09:04:19','2026-03-14 09:04:54',NULL,NULL,NULL),(59,'46fpe7fzg@aaiil.vip','g5a9xtok',NULL,'kanonkun84','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,'Setup failed: Failed to navigate after clicking passwordNext (context destroyed)','2026-03-14 09:13:38','2026-03-14 09:14:09',NULL,NULL,NULL),(60,'46fwybk8g@aaiil.vip','UkJPBpnC',NULL,'kanonkun84','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,NULL,'2026-03-14 09:15:02','2026-03-14 09:15:02',NULL,NULL,NULL),(61,'46k41fudg@aaiil.vip','wXdaLLId',NULL,'kanonkun84','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,'Setup failed: Could not click Authenticator link','2026-03-14 09:18:45','2026-03-14 09:19:19',NULL,NULL,NULL),(62,'46jkytwcg@aaiil.vip','ZglajQHI',NULL,'kanonkun84','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,'Setup failed: Attempted to use detached Frame \'020E07FCCB45A000A7AE315B6D01842C\'.','2026-03-14 09:24:41','2026-03-14 09:26:00',NULL,NULL,NULL),(63,'46jy34lcg@aaiil.vip','LxrSvkUN',NULL,'kanonkun84','http://www.youtube.com/@TheSweetDelirium',0,1,0,NULL,NULL,'2026-03-14 09:26:26','2026-03-14 09:26:26',NULL,NULL,NULL),(64,'46gzs8qag@aaiil.vip','o6uiinp7',NULL,'MsClaudiaf','http://www.youtube.com/@MsClaudiaf',0,1,0,NULL,NULL,'2026-03-15 04:18:48','2026-03-15 04:18:48',NULL,NULL,NULL),(65,'46hslhccg@aaiil.vip','11zpnvhz',NULL,'rennleitung','http://www.youtube.com/@rennleitung',0,1,0,NULL,NULL,'2026-03-15 04:18:48','2026-03-15 04:18:48',NULL,NULL,NULL);
/*!40000 ALTER TABLE `account_youtubes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'20240101000001-create-account-youtubes.js','2026-02-03 06:03:24'),(2,'20240101000002-create-uploaded-videos.js','2026-02-03 06:03:24'),(3,'20240101000003-convert-to-utf8mb4.js','2026-02-03 06:03:24'),(4,'20260201_add_avatar_url.js','2026-02-03 06:03:24'),(5,'20260202_add_image_name.js','2026-02-03 06:03:24'),(6,'20260202_add_recovery_email.js','2026-02-03 06:03:24'),(7,'20260202_remove_legacy_avatar_fields.js','2026-02-03 06:03:24'),(8,'20260205000002-add-status-columns-to-uploaded-videos.js','2026-02-05 09:34:47'),(9,'20260205000003-change-video-url-nullable.js','2026-02-05 09:40:31'),(10,'20260206000001-increase-title-length.js','2026-02-06 02:23:32'),(11,'20260206000001-ensure-title-and-description.js','2026-02-06 02:30:12');
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `uploaded_videos`
--

DROP TABLE IF EXISTS `uploaded_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uploaded_videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_youtube_id` int(11) NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'YouTube video URL after upload',
  `title` text COLLATE utf8mb4_unicode_ci COMMENT 'Video title (can be long with hashtags)',
  `source_url` mediumtext COLLATE utf8mb4_unicode_ci COMMENT 'Original video URL (Facebook, TikTok, etc.)',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `source_url_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hash of source_url to prevent duplicates',
  `local_file_path` text COLLATE utf8mb4_unicode_ci COMMENT 'Path to downloaded video file',
  `video_description` text COLLATE utf8mb4_unicode_ci COMMENT 'Video description',
  `video_visibility` enum('public','unlisted','private') COLLATE utf8mb4_unicode_ci DEFAULT 'public' COMMENT 'Video visibility setting',
  `schedule_date` datetime DEFAULT NULL COMMENT 'Scheduled publish date/time',
  `status` enum('pending','downloading','downloaded','uploading','completed','failed','skipped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'Upload status',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'Error message if failed',
  `download_attempts` int(11) NOT NULL DEFAULT '0' COMMENT 'Number of download attempts',
  `upload_attempts` int(11) NOT NULL DEFAULT '0' COMMENT 'Number of upload attempts',
  `downloaded_at` datetime DEFAULT NULL COMMENT 'Timestamp when video was downloaded',
  `uploaded_at` datetime DEFAULT NULL COMMENT 'Timestamp when video was uploaded to YouTube',
  PRIMARY KEY (`id`),
  KEY `uploaded_videos_account_youtube_id` (`account_youtube_id`),
  KEY `uploaded_videos_email` (`email`),
  KEY `idx_uploaded_videos_source_url_hash` (`source_url_hash`),
  KEY `idx_uploaded_videos_status` (`status`),
  KEY `idx_uploaded_videos_account_status` (`account_youtube_id`,`status`),
  CONSTRAINT `uploaded_videos_ibfk_1` FOREIGN KEY (`account_youtube_id`) REFERENCES `account_youtubes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uploaded_videos`
--

LOCK TABLES `uploaded_videos` WRITE;
/*!40000 ALTER TABLE `uploaded_videos` DISABLE KEYS */;
INSERT INTO `uploaded_videos` VALUES (25,52,'phetnam2@gmail.com','https://www.youtube.com/watch?v=vcGPNfBKgeU','test video upload','https://www.facebook.com/watch?v=2336189136865517','2026-03-08 11:53:31','2026-03-08 11:53:31',NULL,NULL,NULL,'public',NULL,'pending',NULL,0,0,NULL,NULL),(26,52,'phetnam2@gmail.com','https://www.youtube.com/watch?v=vcGPNfBKgeU','🔥🐲[Review Phim] GODZILLA 2 | ĐẠI CHIẾN TỪ BIỂN CẢ ĐẾN BẦU TRỜI – CUỘC SỐNG CỦA NHỮNG VỊ THẦN🐲🔥#Godzilla2\n#KingOfTheMonsters\n#Godzilla\n#Ghidorah\n#Mothra\n#Rodan\n#MonsterVerse\n#WarnerBros...','https://www.facebook.com/watch?v=1379337943867704','2026-03-08 11:54:49','2026-03-08 11:54:49',NULL,NULL,NULL,'public',NULL,'pending',NULL,0,0,NULL,NULL),(27,40,'41c9f48tg@aaiil.vip','https://www.youtube.com/watch?v=2NVpFO0ugfM','[Review Phim] VỊ THẦN THỜI GIAN Kẻ có Quyền Năng Tối Thượng thao túng cả Đa Vũ Trụ','https://www.facebook.com/watch?v=1767288927583700','2026-03-10 11:08:39','2026-03-10 11:08:39',NULL,NULL,NULL,'public',NULL,'pending',NULL,0,0,NULL,NULL);
/*!40000 ALTER TABLE `uploaded_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'accounts_ytb'
--
--
-- WARNING: can't read the INFORMATION_SCHEMA.libraries table. It's most probably an old server 5.7.44.
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-29 15:43:58
