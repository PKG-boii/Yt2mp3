const urlInput = document.getElementById('urlInput');
const convertBtn = document.getElementById('convertBtn');
const inputSection = document.getElementById('inputSection');
const videoInfo = document.getElementById('videoInfo');
const progressSection = document.getElementById('progressSection');
const downloadSection = document.getElementById('downloadSection');
const errorSection = document.getElementById('errorSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const errorText = document.getElementById('errorText');
const downloadBtn = document.getElementById('downloadBtn');

let pollInterval = null;

// --- State Management ---
function showSection(section) {
    [videoInfo, progressSection, downloadSection, errorSection].forEach(s => {
        s.style.display = 'none';
    });
    if (section) section.style.display = section === videoInfo ? 'flex' : 'block';
}

function setProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = text;
}

function showError(message) {
    showSection(errorSection);
    errorText.textContent = message;
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Main Convert Flow ---
async function startConversion() {
    const url = urlInput.value.trim();

    if (!url) {
        showError('Please paste a YouTube URL first');
        return;
    }

    convertBtn.disabled = true;
    convertBtn.textContent = 'Fetching...';
    showSection(null);

    try {
        // Step 1 — Get video info
        const infoRes = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        const infoData = await infoRes.json();

        if (!infoRes.ok) {
            showError(infoData.error || 'Failed to fetch video info');
            return;
        }

        // Show video info to user
        document.getElementById('thumbnail').src = infoData.info.thumbnail;
        document.getElementById('videoTitle').textContent = infoData.info.title;
        document.getElementById('videoChannel').textContent = infoData.info.channel;
        document.getElementById('videoDuration').textContent = `Duration: ${formatDuration(infoData.info.duration)}`;
        showSection(videoInfo);

        convertBtn.textContent = 'Converting...';

        // Step 2 — Start conversion
        const convertRes = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        const convertData = await convertRes.json();

        if (!convertRes.ok) {
            showError(convertData.error || 'Failed to start conversion');
            return;
        }

        // Step 3 — Show progress and start polling
        showSection(progressSection);
        setProgress(10, 'Starting conversion...');
        pollJobStatus(convertData.jobId);

    } catch (err) {
        showError('Something went wrong. Please try again.');
    }
}

// --- Poll Job Status ---
function pollJobStatus(jobId) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/status/${jobId}`);
            const data = await res.json();

            if (data.status === 'completed') {
                clearInterval(pollInterval);
                setProgress(100, 'Done!');

                setTimeout(() => {
                    showSection(downloadSection);
                    downloadBtn.href = `/api/download/${jobId}`;
                    convertBtn.disabled = false;
                    convertBtn.textContent = 'Convert';
                }, 500);
            }

            else if (data.status === 'failed') {
                clearInterval(pollInterval);
                showError(data.error || 'Conversion failed. Please try again.');
            }

            else if (data.status === 'active') {
                const progress = data.progress || 10;
                if (progress < 30) setProgress(progress, 'Fetching video...');
                else if (progress < 80) setProgress(progress, 'Converting to MP3...');
                else setProgress(progress, 'Almost done...');
            }

            else if (data.status === 'waiting') {
                setProgress(5, 'Waiting in queue...');
            }

        } catch (err) {
            clearInterval(pollInterval);
            showError('Lost connection. Please try again.');
        }
    }, 2000);
}

// --- Event Listeners ---
convertBtn.addEventListener('click', startConversion);

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startConversion();
});

document.getElementById('convertAnother').addEventListener('click', () => {
    urlInput.value = '';
    showSection(null);
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
});

document.getElementById('tryAgainBtn').addEventListener('click', () => {
    showSection(null);
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
});