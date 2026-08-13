-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `cancellationError` JSON NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL;
