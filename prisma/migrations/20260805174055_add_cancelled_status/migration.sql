-- AlterTable
ALTER TABLE `Invoice` MODIFY `registrationStatus` ENUM('PENDING', 'REGISTERED', 'CANCELLED', 'FAILED') NULL;
