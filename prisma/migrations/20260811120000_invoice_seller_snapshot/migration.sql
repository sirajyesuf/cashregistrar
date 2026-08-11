-- DropTableField
-- Business.vatNumber now lives on MorCredential.vatNumber (single source of
-- truth for the EIMS tax registration). Existing MorCredential rows already
-- carry vatNumber, so no data is lost here.

-- AlterTable
ALTER TABLE `Business` DROP COLUMN `vatNumber`;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `sellerCity` VARCHAR(191) NULL,
    ADD COLUMN `sellerCountry` VARCHAR(191) NULL,
    ADD COLUMN `sellerEmail` VARCHAR(191) NULL,
    ADD COLUMN `sellerHouseNumber` VARCHAR(191) NULL,
    ADD COLUMN `sellerLegalName` VARCHAR(191) NULL,
    ADD COLUMN `sellerLocality` VARCHAR(191) NULL,
    ADD COLUMN `sellerPhone` VARCHAR(191) NULL,
    ADD COLUMN `sellerRegion` VARCHAR(191) NULL,
    ADD COLUMN `sellerSubCity` VARCHAR(191) NULL,
    ADD COLUMN `sellerTin` VARCHAR(191) NULL,
    ADD COLUMN `sellerVatNumber` VARCHAR(191) NULL,
    ADD COLUMN `sellerWereda` VARCHAR(191) NULL;

-- BackfillSellerSnapshot
-- Snapshot the current seller profile (from Business) plus the MOR tax
-- identifiers (from MorCredential) onto each existing invoice, so stored
-- invoices are self-contained and match what EIMS was/will be sent.
UPDATE `Invoice`
LEFT JOIN `Business` ON `Business`.`id` = `Invoice`.`businessId`
LEFT JOIN `MorCredential` ON `MorCredential`.`businessId` = `Invoice`.`businessId`
SET
    `Invoice`.`sellerCity` = COALESCE(`Business`.`city`, ''),
    `Invoice`.`sellerCountry` = COALESCE(`Business`.`country`, ''),
    `Invoice`.`sellerEmail` = `Business`.`email`,
    `Invoice`.`sellerHouseNumber` = `Business`.`houseNumber`,
    `Invoice`.`sellerLegalName` = COALESCE(`Business`.`legalName`, `Business`.`name`),
    `Invoice`.`sellerLocality` = `Business`.`locality`,
    `Invoice`.`sellerPhone` = `Business`.`phone`,
    `Invoice`.`sellerRegion` = `Business`.`region`,
    `Invoice`.`sellerSubCity` = `Business`.`subCity`,
    `Invoice`.`sellerTin` = `MorCredential`.`tin`,
    `Invoice`.`sellerVatNumber` = `MorCredential`.`vatNumber`,
    `Invoice`.`sellerWereda` = `Business`.`wereda`;
