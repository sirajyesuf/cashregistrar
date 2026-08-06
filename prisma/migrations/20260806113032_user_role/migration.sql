-- AlterTable
ALTER TABLE `User` ADD COLUMN `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user';
