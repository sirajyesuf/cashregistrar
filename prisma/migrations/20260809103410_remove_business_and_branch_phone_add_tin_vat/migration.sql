/*
  Warnings:

  - You are about to drop the column `phone` on the `Branch` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Business` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Business` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Branch` DROP COLUMN `phone`;

-- AlterTable
ALTER TABLE `Business` DROP COLUMN `email`,
    DROP COLUMN `phone`,
    ADD COLUMN `tin` VARCHAR(191) NULL,
    ADD COLUMN `vatNumber` VARCHAR(191) NULL;
