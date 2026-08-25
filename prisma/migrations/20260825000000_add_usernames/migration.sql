-- Existing accounts keep a NULL username and use the legacy email sign-in fallback.
-- MySQL unique indexes permit multiple NULL values, while all new registrations provide one.
ALTER TABLE `user`
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `displayUsername` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `user_username_key` ON `user`(`username`);
