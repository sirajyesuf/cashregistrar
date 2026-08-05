-- Backfill buyerLegalName from customerName before dropping the column.
UPDATE `Invoice`
SET `buyerLegalName` = `customerName`
WHERE (`buyerLegalName` IS NULL OR `buyerLegalName` = '');

-- Drop the redundant customer name column.
ALTER TABLE `Invoice` DROP COLUMN `customerName`;
