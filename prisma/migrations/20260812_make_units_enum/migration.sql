-- AlterTable
ALTER TABLE `InvoiceLine` MODIFY `unit` ENUM('MTR', 'LTR', 'KLG', 'PCS', 'ROL') NOT NULL DEFAULT 'PCS';

-- AlterTable
ALTER TABLE `Product` MODIFY `unit` ENUM('MTR', 'LTR', 'KLG', 'PCS', 'ROL') NOT NULL DEFAULT 'PCS';

