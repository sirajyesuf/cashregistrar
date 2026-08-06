-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `receiptDate` DATETIME(3) NULL,
    ADD COLUMN `receiptError` TEXT NULL,
    ADD COLUMN `receiptNumber` VARCHAR(191) NULL,
    ADD COLUMN `receiptStatus` ENUM('ISSUED', 'FAILED') NULL,
    ADD COLUMN `rrn` TEXT NULL;
