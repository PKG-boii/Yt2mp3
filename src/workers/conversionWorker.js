const { Worker, Queue, QueueEvents } = require('bullmq');
const { convertToMp3, getVideoInfo } = require('../services/converter');

const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
};

// The queue — this is where jobs sit and wait
const conversionQueue = new Queue('conversions', { connection });

// Queue events — lets us listen to what's happening
const queueEvents = new QueueEvents('conversions', { connection });

// The worker — this is what actually processes jobs
const worker = new Worker(
    'conversions',
    async (job) => {
        const { url, jobId } = job.data;

        // Step 1 — Update progress so frontend knows what's happening
        await job.updateProgress(10);

        // Step 2 — Fetch video info first
        const videoInfo = await getVideoInfo(url);
        await job.updateProgress(30);

        // Step 3 — Do the actual conversion
        const result = await convertToMp3(url, jobId);
        await job.updateProgress(100);

        // Step 4 — Return the result (stored in Redis automatically)
        return {
            ...result,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            channel: videoInfo.channel,
            duration: videoInfo.duration,
        };
    },
    {
        connection,
        concurrency: parseInt(process.env.MAX_CONCURRENT_JOBS) || 3,
    }
);

// Log worker activity (helpful for debugging)
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed — ${job.returnvalue?.title}`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed — ${err.message}`);
});

worker.on('progress', (job, progress) => {
    console.log(`⏳ Job ${job.id} progress — ${progress}%`);
});

module.exports = { conversionQueue };