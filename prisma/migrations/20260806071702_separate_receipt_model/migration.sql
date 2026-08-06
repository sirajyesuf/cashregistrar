/*
  Warnings:

  - You are about to drop the column `receiptDate` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `receiptError` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `receiptNumber` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `receiptStatus` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `rrn` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Invoice` DROP COLUMN `receiptDate`,
    DROP COLUMN `receiptError`,
    DROP COLUMN `receiptNumber`,
    DROP COLUMN `receiptStatus`,
    DROP COLUMN `rrn`;

-- CreateTable
CREATE TABLE `Receipt` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `rrn` TEXT NULL,
    `date` DATETIME(3) NULL,
    `status` ENUM('ISSUED', 'FAILED') NULL,
    `error` TEXT NULL,
    `collectedAmount` DECIMAL(14, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
