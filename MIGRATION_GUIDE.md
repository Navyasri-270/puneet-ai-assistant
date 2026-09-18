# PostgreSQL Migration Guide - Puneet AI Executive Assistant

This document outlines the step-by-step procedure to convert and deploy the Puneet AI Executive Assistant database from local SQLite (`dev.db`) to a production-grade PostgreSQL database.

---

## 1. Prerequisites & Backup Strategy

Before running any database migration:
1. **Back up existing SQLite database**:
   ```bash
   cp prisma/dev.db prisma/dev.db.backup
   ```
2. **Export current SQLite records to JSON migration dump**:
   ```bash
   npx tsx scratch/export_sqlite_data.ts
   ```
   This generates `prisma/production_migration_dump.json` containing 100% of existing tasks, reminders, calendar events, memories, connections, and push subscriptions.

---

## 2. PostgreSQL Provisioning & Configuration

1. **Create PostgreSQL Database & User**:
   ```sql
   CREATE DATABASE puneet_assistant_prod;
   CREATE USER puneet_user WITH ENCRYPTED PASSWORD 'SECURE_PASSWORD';
   GRANT ALL PRIVILEGES ON DATABASE puneet_assistant_prod TO puneet_user;
   ```
2. **Update Environment Variable (`.env`)**:
   ```env
   DATABASE_URL="postgresql://puneet_user:SECURE_PASSWORD@localhost:5432/puneet_assistant_prod?schema=public"
   ```

---

## 3. Schema & Migration Execution

1. **Swap Schema Provider to PostgreSQL**:
   Replace `prisma/schema.prisma` with `prisma/schema.postgresql.prisma`:
   ```bash
   cp prisma/schema.postgresql.prisma prisma/schema.prisma
   ```
2. **Generate Prisma Client & Run Migration**:
   ```bash
   npx prisma migrate dev --name init_postgres
   ```
3. **In Production Environments**:
   ```bash
   npx prisma migrate deploy
   ```

---

## 4. Verification & Validation

Run the verification script to compare target database row counts against the migration dump:
```bash
npx tsx scratch/verify_db_migration.ts
```

---

## 5. Rollback Instructions

If a rollback to SQLite is required:
1. Revert `.env` `DATABASE_URL`:
   ```env
   DATABASE_URL="file:./dev.db"
   ```
2. Revert `prisma/schema.prisma` to SQLite provider.
3. Re-generate Prisma Client:
   ```bash
   npx prisma generate
   ```
