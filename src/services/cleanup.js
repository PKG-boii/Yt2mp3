const fs = require('fs');
const path = require('path');

const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');
const FILE_EXPIRY_MINUTES = parseInt(process.env.FILE_EXPIRY_MINUTES) || 30;

function getFileAgeMinutes(filePath) {
    const stats = fs.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs / 1000 / 60;
}

function cleanupOldFiles() {
    if (!fs.existsSync(DOWNLOADS_DIR)) return;

    const files = fs.readdirSync(DOWNLOADS_DIR);
    let deletedCount = 0;

    files.forEach((file) => {
        const filePath = path.join(DOWNLOADS_DIR, file);

        try {
            const ageMinutes = getFileAgeMinutes(filePath);

            if (ageMinutes > FILE_EXPIRY_MINUTES) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`🗑️  Deleted expired file: ${file}`);
            }
        } catch (err) {
            console.error(`Failed to delete file ${file}:`, err.message);
        }
    });

    if (deletedCount > 0) {
        console.log(`🧹 Cleanup complete — deleted ${deletedCount} file(s)`);
    }
}

function startCleanupService() {
    console.log(`🧹 Cleanup service started — files expire after ${FILE_EXPIRY_MINUTES} minutes`);

    // Run immediately on startup
    cleanupOldFiles();

    // Then run every 10 minutes
    setInterval(cleanupOldFiles, 10 * 60 * 1000);
}

module.exports = { startCleanupService };