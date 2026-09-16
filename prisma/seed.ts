import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const seedPath = path.join(__dirname, 'seed_data.json');
  if (!fs.existsSync(seedPath)) {
    console.log('No seed_data.json found. Skipping seed.');
    return;
  }

  console.log('Seeding database from seed_data.json...');
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  if (Array.isArray(data.tasks)) {
    for (const task of data.tasks) {
      const { reminders, ...taskData } = task;
      await prisma.task.upsert({
        where: { id: task.id },
        update: taskData,
        create: taskData,
      });

      if (Array.isArray(reminders)) {
        for (const rem of reminders) {
          await prisma.reminder.upsert({
            where: { id: rem.id },
            update: rem,
            create: rem,
          });
        }
      }
    }
  }

  if (Array.isArray(data.calendarEvents)) {
    for (const event of data.calendarEvents) {
      await prisma.calendarEvent.upsert({
        where: { id: event.id },
        update: event,
        create: event,
      });
    }
  }

  if (Array.isArray(data.emailDrafts)) {
    for (const draft of data.emailDrafts) {
      await prisma.emailDraft.upsert({
        where: { id: draft.id },
        update: draft,
        create: draft,
      });
    }
  }

  if (Array.isArray(data.memories)) {
    for (const mem of data.memories) {
      await prisma.memory.upsert({
        where: { id: mem.id },
        update: mem,
        create: mem,
      });
    }
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
