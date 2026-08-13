/*
  Warnings:

  - The values [DATA_ENTRY_MISTAKE,ORDER_CANCELLED] on the enum `Invoice_cancellationReason` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Invoice` MODIFY `cancellationReason` ENUM('DUPLICATE', 'dataEntryMistake', 'orderCancelled', 'OTHERS') NULL;
