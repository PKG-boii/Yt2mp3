const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');

// Make sure downloads folder exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function sanitizeTitle(title) {
    return title.replace(/[^a-zA-Z0-9\-_\s]/g, '').trim().replace(/\s+/g, '_');
}

function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const command = `"${YTDLP_PATH}" --dump-json --no-playlist "${url}"`;

        exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('Could not fetch video info. Check the URL and try again.'));
                return;
            }

            try {
                const info = JSON.parse(stdout);
                resolve({
                    title: info.title || 'Unknown Title',
                    duration: info.duration || 0,
                    thumbnail: info.thumbnail || null,
                    channel: info.uploader || 'Unknown',
                });
            } catch (e) {
                reject(new Error('Failed to parse video information.'));
            }
        });
    });
}

function convertToMp3(url, jobId) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(DOWNLOADS_DIR, `${jobId}.mp3`);
        const command = `"${YTDLP_PATH}" -x --audio-format mp3 --audio-quality 0 --ffmpeg-location "${process.env.FFMPEG_PATH}" -o "${outputPath}" --no-playlist "${url}"`;

        exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('Conversion failed. The video may be unavailable or restricted.'));
                return;
            }

            if (!fs.existsSync(outputPath)) {
                reject(new Error('Conversion completed but file was not found.'));
                return;
            }

            const stats = fs.statSync(outputPath);
            resolve({
                filePath: outputPath,
                fileName: `${jobId}.mp3`,
                fileSize: stats.size,
            });
        });
    });
}

module.exports = { getVideoInfo, convertToMp3, sanitizeTitle };