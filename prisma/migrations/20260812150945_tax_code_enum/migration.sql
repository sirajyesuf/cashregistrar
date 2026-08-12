-- Convert stored taxRate from percentage (15 = 15%) to fraction (0.15)
UPDATE `Invoice` SET `taxRate` = `taxRate` / 100;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `taxCode` ENUM('TOT2', 'VATEX', 'VATWH', 'WHOP2', 'WTHOT', 'TOT10', 'VAT0', 'VAT15') NULL;

-- Backfill taxCode from the converted rate
UPDATE `Invoice` SET `taxCode` = CASE WHEN `taxRate` <= 0 THEN 'VAT0' ELSE 'VAT15' END;

-- AlterTable
ALTER TABLE `Invoice` MODIFY `taxCode` ENUM('TOT2', 'VATEX', 'VATWH', 'WHOP2', 'WTHOT', 'TOT10', 'VAT0', 'VAT15') NOT NULL DEFAULT 'VAT15',
    MODIFY `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.15;
