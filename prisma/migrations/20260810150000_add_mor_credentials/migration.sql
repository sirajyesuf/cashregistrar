-- Per-business MOR credentials: the old global env-var config, token and
-- seller profile become tenant-scoped. Existing tokens (ephemeral) and the
-- global seller profile (re-created per business via the UI) are removed.

-- CreateTable
CREATE TABLE `MorCredential` (
    `id` VARCHAR(191) NOT NULL,
    `businessId` VARCHAR(191) NOT NULL,
    `tin` VARCHAR(191) NOT NULL,
    `vatNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `systemNumber` VARCHAR(191) NOT NULL,
    `systemType` VARCHAR(191) NOT NULL DEFAULT 'ERP',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MorCredential_businessId_key`(`businessId`),
    INDEX `MorCredential_businessId_idx`(`businessId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MorCredential`
    ADD CONSTRAINT `MorCredential_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing EimsToken cannot be attributed to a business; tokens are ephemeral.
DELETE FROM `EimsToken`;

-- AlterTable
ALTER TABLE `EimsToken`
    DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `EimsToken_businessId_key`(`businessId`),
    ADD PRIMARY KEY (`id`);

-- Existing global seller profile cannot be attributed to a business; it is
-- re-created per business via the settings UI.
DELETE FROM `SellerProfile`;

-- AlterTable
ALTER TABLE `SellerProfile`
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `SellerProfile_businessId_key`(`businessId`);

-- AddForeignKey
ALTER TABLE `SellerProfile`
    ADD CONSTRAINT `SellerProfile_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Business`
    DROP COLUMN `tin`,
    DROP COLUMN `vatNumber`;
