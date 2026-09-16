-- AlterTable Task
ALTER TABLE "Task" ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Task" ADD COLUMN "notificationSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "notificationBefore" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Task" ADD COLUMN "beforeNotifiedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "dueNotifiedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "overdueNotifiedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "lastNotifiedAt" DATETIME;

-- AlterTable Reminder
ALTER TABLE "Reminder" ADD COLUMN "notificationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Reminder" ADD COLUMN "notificationSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reminder" ADD COLUMN "notificationBefore" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Reminder" ADD COLUMN "beforeNotifiedAt" DATETIME;
ALTER TABLE "Reminder" ADD COLUMN "dueNotifiedAt" DATETIME;
ALTER TABLE "Reminder" ADD COLUMN "overdueNotifiedAt" DATETIME;
ALTER TABLE "Reminder" ADD COLUMN "lastNotifiedAt" DATETIME;

-- AlterTable PushSubscription
ALTER TABLE "PushSubscription" ADD COLUMN "taskNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PushSubscription" ADD COLUMN "reminderNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PushSubscription" ADD COLUMN "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PushSubscription" ADD COLUMN "quietHoursStart" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "PushSubscription" ADD COLUMN "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00';
ALTER TABLE "PushSubscription" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "PushSubscription" ADD COLUMN "lastSummaryNotifiedAt" DATETIME;
