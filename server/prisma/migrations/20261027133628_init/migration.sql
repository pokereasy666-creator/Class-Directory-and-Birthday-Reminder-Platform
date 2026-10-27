-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `password_hash` VARCHAR(100) NOT NULL,
    `role` ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    `status` ENUM('PENDING', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    `token_version` INTEGER NOT NULL DEFAULT 0,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(20) NOT NULL,
    `student_no` VARCHAR(20) NULL,
    `phone` VARCHAR(11) NULL,
    `qq` VARCHAR(12) NULL,
    `email` VARCHAR(100) NULL,
    `dorm` VARCHAR(50) NULL,
    `remark` VARCHAR(200) NULL,
    `avatar` VARCHAR(255) NULL,
    `group_id` INTEGER NULL,
    `birthday_calendar` ENUM('SOLAR', 'LUNAR') NULL,
    `birth_year` SMALLINT NULL,
    `birth_month` TINYINT NULL,
    `birth_day` TINYINT NULL,
    `birth_is_leap_month` BOOLEAN NOT NULL DEFAULT false,
    `email_notify` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_username_key`(`username`),
    UNIQUE INDEX `user_student_no_key`(`student_no`),
    INDEX `user_status_idx`(`status`),
    INDEX `user_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `class_group_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(100) NOT NULL,
    `content` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `author_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `announcement_pinned_created_at_idx`(`pinned`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('BIRTHDAY_TODAY', 'BIRTHDAY_UPCOMING', 'ANNOUNCEMENT') NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `related_id` INTEGER NOT NULL DEFAULT 0,
    `ref_date` VARCHAR(10) NOT NULL DEFAULT '',
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_user_id_read_at_idx`(`user_id`, `read_at`),
    UNIQUE INDEX `notification_user_id_type_related_id_ref_date_key`(`user_id`, `type`, `related_id`, `ref_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `class_group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
