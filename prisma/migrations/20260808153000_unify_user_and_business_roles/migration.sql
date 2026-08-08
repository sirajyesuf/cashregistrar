-- Preserve existing platform users while replacing the old lowercase role enum.
ALTER TABLE `User` MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'OWNER';

UPDATE `User`
SET `role` = CASE
    WHEN `role` = 'admin' THEN 'ADMIN'
    ELSE 'OWNER'
END;

ALTER TABLE `User`
    MODIFY `role` ENUM('ADMIN', 'OWNER', 'MANAGER', 'CASHIER') NOT NULL DEFAULT 'OWNER';

-- MySQL stores enum values, not Prisma enum names, so this updates the
-- membership column to the shared Role vocabulary without changing data.
ALTER TABLE `BusinessMember`
    MODIFY `role` ENUM('ADMIN', 'OWNER', 'MANAGER', 'CASHIER') NOT NULL DEFAULT 'CASHIER';
