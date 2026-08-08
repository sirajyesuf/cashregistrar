-- CreateTable
CREATE TABLE `EimsOperation` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `type` ENUM('REGISTER', 'CANCEL') NOT NULL,
    `status` ENUM('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
    `rawResponse` JSON NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EimsOperation_conversationId_key`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EimsOperationItem` (
    `id` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NULL,
    `irn` VARCHAR(191) NULL,
    `status` ENUM('PROCESSING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
    `error` JSON NULL,
    `rawResult` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EimsOperationItem_invoiceId_idx`(`invoiceId`),
    UNIQUE INDEX `EimsOperationItem_operationId_invoiceId_key`(`operationId`, `invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EimsOperationItem` ADD CONSTRAINT `EimsOperationItem_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `EimsOperation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EimsOperationItem` ADD CONSTRAINT `EimsOperationItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
