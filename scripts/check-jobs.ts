import { db, generationJobs, sentences } from '../src/backend/db/index.js';
import { desc } from 'drizzle-orm';

async function main() {
  console.log('=== Recent Generation Jobs ===');
  const jobs = await db.select().from(generationJobs).orderBy(desc(generationJobs.createdAt)).limit(5);
  console.log(JSON.stringify(jobs, null, 2));
  
  console.log('\n=== Recent Test Sentences (audio status) ===');
  const testSentences = await db.select({
    id: sentences.id,
    text: sentences.text,
    status: sentences.status,
    audioFile: sentences.audioFile,
    audioDuration: sentences.audioDuration,
    createdAt: sentences.createdAt
  }).from(sentences)
    .orderBy(desc(sentences.createdAt))
    .limit(5);
  console.log(JSON.stringify(testSentences, null, 2));
}
main().catch(console.error);
