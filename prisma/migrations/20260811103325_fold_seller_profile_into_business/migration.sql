/*
  Warnings:

  - You are about to drop the `SellerProfile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `SellerProfile` DROP FOREIGN KEY `SellerProfile_businessId_fkey`;

-- AlterTable
ALTER TABLE `Business` ADD COLUMN `city` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `country` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `houseNumber` VARCHAR(191) NULL,
    ADD COLUMN `legalName` VARCHAR(191) NULL,
    ADD COLUMN `locality` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `region` VARCHAR(191) NULL,
    ADD COLUMN `street` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `subCity` VARCHAR(191) NULL,
    ADD COLUMN `vatNumber` VARCHAR(191) NULL,
    ADD COLUMN `wereda` VARCHAR(191) NULL;

-- CopySellerProfile
UPDATE `Business`
LEFT JOIN `SellerProfile` ON `SellerProfile`.`businessId` = `Business`.`id`
SET
    `Business`.`street` = COALESCE(`SellerProfile`.`street`, `Business`.`street`),
    `Business`.`city` = COALESCE(`SellerProfile`.`city`, `Business`.`city`),
    `Business`.`country` = COALESCE(`SellerProfile`.`country`, `Business`.`country`),
    `Business`.`legalName` = `SellerProfile`.`legalName`,
    `Business`.`vatNumber` = `SellerProfile`.`vatNumber`,
    `Business`.`email` = `SellerProfile`.`email`,
    `Business`.`phone` = `SellerProfile`.`phone`,
    `Business`.`region` = `SellerProfile`.`region`,
    `Business`.`subCity` = `SellerProfile`.`subCity`,
    `Business`.`wereda` = `SellerProfile`.`wereda`,
    `Business`.`houseNumber` = `SellerProfile`.`houseNumber`,
    `Business`.`locality` = `SellerProfile`.`locality`;

-- DropTable
DROP TABLE `SellerProfile`;
