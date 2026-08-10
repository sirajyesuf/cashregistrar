-- Orphaned operations (no items, cannot be attributed to a business) are removed.
DELETE FROM `EimsOperation`
WHERE `id` NOT IN (
    SELECT DISTINCT `operationId` FROM `EimsOperationItem`
);

-- Backfill EimsOperation.businessId from its items' invoices before enforcing NOT NULL.
ALTER TABLE `EimsOperation` ADD COLUMN `businessId` VARCHAR(191) NULL;

UPDATE `EimsOperation` AS `op`
SET `op`.`businessId` = (
    SELECT `i`.`businessId`
    FROM `EimsOperationItem` AS `item`
    INNER JOIN `Invoice` AS `i` ON `i`.`id` = `item`.`invoiceId`
    WHERE `item`.`operationId` = `op`.`id`
    LIMIT 1
);

ALTER TABLE `EimsOperation` MODIFY `businessId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `EimsOperation_businessId_idx` ON `EimsOperation`(`businessId`);

-- CreateIndex
CREATE INDEX `SellerProfile_businessId_idx` ON `SellerProfile`(`businessId`);
