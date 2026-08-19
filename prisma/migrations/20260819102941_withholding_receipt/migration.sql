-- CreateTable
CREATE TABLE `WithholdingReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `rrn` TEXT NULL,
    `qr` LONGTEXT NULL,
    `eimsStatus` VARCHAR(191) NULL,
    `date` DATETIME(3) NULL,
    `status` ENUM('ISSUED', 'FAILED') NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WithholdingReceipt_invoiceId_key`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WithholdingReceipt` ADD CONSTRAINT `WithholdingReceipt_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
