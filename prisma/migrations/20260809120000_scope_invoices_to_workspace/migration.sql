-- Wipe existing invoices and counters: numbering becomes per-workspace and
-- existing invoices cannot be attributed to a tenant/workspace.
DELETE FROM `Receipt`;
DELETE FROM `EimsOperationItem`;
DELETE FROM `InvoiceLine`;
DELETE FROM `Invoice`;
DELETE FROM `EimsOperation`;
DELETE FROM `Counter`;

-- AlterTable
ALTER TABLE `Counter`
    DROP INDEX `Counter_name_key`,
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `Counter_businessId_branchId_name_key`(`businessId`, `branchId`, `name`);

-- AlterTable
ALTER TABLE `Invoice`
    ADD COLUMN `businessId` VARCHAR(191) NOT NULL,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD INDEX `Invoice_businessId_branchId_createdAt_idx`(`businessId`, `branchId`, `createdAt`),
    ADD INDEX `Invoice_businessId_idx`(`businessId`),
    ADD INDEX `Invoice_branchId_idx`(`branchId`);

-- AddForeignKey
ALTER TABLE `Invoice`
    ADD CONSTRAINT `Invoice_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice`
    ADD CONSTRAINT `Invoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
