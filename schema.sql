CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`status` enum('present','absent','manual') NOT NULL,
	`method` enum('bluetooth','wifi','code','manual') NOT NULL,
	`markedByAdminId` int,
	`markedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_records_session_student_uq` UNIQUE(`sessionId`,`studentId`)
);

CREATE TABLE `attendance_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectId` int NOT NULL,
	`classDivision` varchar(128) NOT NULL,
	`adminId` int NOT NULL,
	`sessionDate` varchar(10) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`attendanceCodeHash` varchar(128) NOT NULL,
	`codeExpiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_sessions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `faculty_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`department` varchar(128) NOT NULL DEFAULT 'Computer Department',
	`accessRole` enum('admin','superadmin') NOT NULL DEFAULT 'admin',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `faculty_profiles_userId_unique` UNIQUE(`userId`)
);

CREATE TABLE `notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`sentByAdminId` int NOT NULL,
	`targetClass` varchar(128) NOT NULL DEFAULT 'all',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notices_id` PRIMARY KEY(`id`)
);

CREATE TABLE `student_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`enrollmentNumber` varchar(64) NOT NULL,
	`rollNumber` varchar(64) NOT NULL,
	`mobileNumber` varchar(32) NOT NULL,
	`parentMobileNumber` varchar(32) NOT NULL,
	`department` varchar(128) NOT NULL DEFAULT 'Computer Department',
	`classDivision` varchar(128) NOT NULL,
	`deviceTag` varchar(80) NOT NULL,
	`deviceVerified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `student_profiles_enrollmentNumber_unique` UNIQUE(`enrollmentNumber`),
	CONSTRAINT `student_profiles_deviceTag_unique` UNIQUE(`deviceTag`)
);

CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(64) NOT NULL,
	`department` varchar(128) NOT NULL DEFAULT 'Computer Department',
	`classDivision` varchar(128) NOT NULL,
	`assignedAdminId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_code_unique` UNIQUE(`code`)
);

CREATE TABLE `timetable_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectId` int NOT NULL,
	`classDivision` varchar(128) NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`room` varchar(128),
	`reminderEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `timetable_entries_id` PRIMARY KEY(`id`)
);
ALTER TABLE `subjects` ADD `teacherName` varchar(255) DEFAULT '' NOT NULL;
ALTER TABLE `subjects` ADD `room` varchar(128) DEFAULT '' NOT NULL;
ALTER TABLE `subjects` ADD `dayOfWeek` int DEFAULT 1 NOT NULL;
ALTER TABLE `subjects` ADD `startTime` varchar(5) DEFAULT '09:00' NOT NULL;
ALTER TABLE `subjects` ADD `endTime` varchar(5) DEFAULT '10:00' NOT NULL;
CREATE TABLE `local_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`identifier` varchar(128) NOT NULL,
	`accountType` enum('student','admin') NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`mustChangePassword` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_credentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `local_credentials_identifier_unique` UNIQUE(`identifier`)
);
