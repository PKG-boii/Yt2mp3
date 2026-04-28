const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { conversionQueue } = require('../workers/conversionWorker');
const { getVideoInfo } = require('../services/converter');
const path = require('path');
const fs = require('fs');

// Route 1 — Validate URL and get video info before converting
router.post('/info', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Basic YouTube URL validation
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!ytRegex.test(url)) {
        return res.status(400).json({ error: 'Please enter a valid YouTube URL' });
    }

    try {
        const info = await getVideoInfo(url);

        // Block videos longer than 15 minutes (protect your server)
        if (info.duration > 900) {
            return res.status(400).json({
                error: 'Video is too long. Maximum length is 15 minutes.'
            });
        }

        res.json({ success: true, info });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route 2 — Add conversion job to queue
router.post('/convert', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const jobId = uuidv4();

        // Add job to queue
        await conversionQueue.add(
            'convert',
            { url, jobId },
            {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: { age: 3600 }, // remove after 1 hour
                removeOnFail: { age: 3600 },
            }
        );

        res.json({ success: true, jobId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to queue conversion' });
    }
});

// Route 3 — Check job status (frontend polls this)
router.get('/status/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        const job = await conversionQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        const progress = job.progress;

        if (state === 'completed') {
            return res.json({
                status: 'completed',
                progress: 100,
                result: job.returnvalue,
            });
        }

        if (state === 'failed') {
            return res.json({
                status: 'failed',
                error: job.failedReason || 'Conversion failed',
            });
        }

        res.json({ status: state, progress });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// Route 4 — Download the MP3 file
router.get('/download/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        const job = await conversionQueue.getJob(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        if (state !== 'completed') {
            return res.status(400).json({ error: 'File not ready yet' });
        }

        const filePath = job.returnvalue?.filePath;
        const title = job.returnvalue?.title || 'audio';

        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File no longer available' });
        }

        // Set headers so browser downloads it as an MP3
        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        res.download(filePath, `${title}.mp3`);
    } catch (err) {
        res.status(500).json({ error: 'Download failed' });
    }
});

module.exports = router;