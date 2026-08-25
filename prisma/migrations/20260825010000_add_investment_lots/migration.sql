CREATE TABLE `investment_lot` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `itemId` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unitPricePaid` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `investment_lot_userId_idx`(`userId`),
  INDEX `investment_lot_userId_itemId_idx`(`userId`, `itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `investment_lot`
  ADD CONSTRAINT `investment_lot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
