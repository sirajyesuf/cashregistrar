-- Old values were plain-text EIMS error strings that are not valid JSON.
-- Clear them before changing the column type so the cast succeeds.
UPDATE `Invoice` SET `registrationError` = NULL WHERE `registrationError` IS NOT NULL;

-- AlterTable
ALTER TABLE `Invoice` MODIFY `registrationError` JSON NULL;
