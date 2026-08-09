-- Invoice numbering is per workspace (businessId, branchId). The number was
-- globally unique, which collided when two branches both produced "INV-0001".
-- Drop the global unique index, renumber invoices sequentially within each
-- workspace, then make the number unique per (businessId, branchId).

-- AlterTable (drop global unique index first so renumbering cannot collide)
ALTER TABLE `Invoice`
    DROP INDEX `Invoice_number_key`;

-- Renumber sequentially within each workspace.
UPDATE `Invoice`
JOIN (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY `businessId`, `branchId`
            ORDER BY `createdAt`, `id`
        ) AS `rn`
    FROM `Invoice`
) `renumbered` ON `Invoice`.`id` = `renumbered`.`id`
SET `Invoice`.`number` = CONCAT('INV-', LPAD(`renumbered`.`rn`, 4, '0'));

-- AlterTable (unique per workspace)
ALTER TABLE `Invoice`
    ADD UNIQUE INDEX `Invoice_businessId_branchId_number_key`(`businessId`, `branchId`, `number`);
