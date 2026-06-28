import { readFileSync } from 'fs';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const csvFiles = process.argv.slice(2);
if (csvFiles.length === 0) {
    console.error('Usage: bun run scripts/backfill.ts file1.csv file2.csv ...');
    process.exit(1);
}

function parseCSV(content: string): Record<string, string>[] {
    const lines = content.split('\n').filter(Boolean);
    const headers = parseRow(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseRow(line);
        return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]));
    });
}

function parseRow(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    fields.push(current);
    return fields;
}

function parseDate(value: string): Date | null {
    if (!value.trim()) return null;
    const d = new Date(value.trim());
    return isNaN(d.getTime()) ? null : d;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const seen = new Set<string>();
const rows: { userId: string; joinedAt: Date; messageCount: number }[] = [];

for (const file of csvFiles) {
    const records = parseCSV(readFileSync(file, 'utf8'));
    for (const row of records) {
        const userId = row['User ID']?.trim();
        if (!userId || seen.has(userId)) continue;
        seen.add(userId);

        const claimedAt = parseDate(row['Claimed Date (UTC)']);
        const createdAt = parseDate(row['Account created (UTC)']);
        const joinedAt = claimedAt ?? createdAt;
        if (!joinedAt) continue;

        const messageCount = parseInt(row['Messages posted'] ?? '0', 10) || 0;
        rows.push({ userId, joinedAt, messageCount });
    }
}

console.log(`Parsed ${rows.length} unique members from ${csvFiles.length} file(s). Upserting...`);

const BATCH = 500;
for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(
        batch.map(r =>
            prisma.memberJoinDate.upsert({
                where: { userId: r.userId },
                update: { joinedAt: r.joinedAt, messageCount: r.messageCount },
                create: r,
            })
        )
    );
    console.log(`Upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}

await prisma.$disconnect();
console.log('Done.');
