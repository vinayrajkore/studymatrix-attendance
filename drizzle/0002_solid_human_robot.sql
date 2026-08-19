ALTER TABLE `subjects` ADD `teacherName` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `room` varchar(128) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `dayOfWeek` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `startTime` varchar(5) DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `subjects` ADD `endTime` varchar(5) DEFAULT '10:00' NOT NULL;