/**
 * KVS Integration
 * Integrates KVS player with the main application
 */

// Extend CONFIG to include KVS settings
window.CONFIG = window.CONFIG || {};
window.CONFIG.KVS_STREAM_NAME = 'dockerStream';
window.CONFIG.KVS_REGION = 'ap-northeast-1';

// KVS Player instance
let kvsPlayer = null;

// DOM Elements for KVS
const kvsElements = {
    videoElement: document.getElementById('live-stream-video'),
    placeholder: document.getElementById('stream-placeholder'),
    startBtn: document.getElementById('start-stream-btn'),
    streamMessage: document.getElementById('stream-message'),
    statusBadge: document.getElementById('stream-status'),
};

/**
 * Initialize KVS player
 */
function initKVSPlayer() {
    if (!kvsElements.videoElement) {
        console.error('Video element not found');
        return;
    }

    kvsPlayer = new window.KVSPlayer(kvsElements.videoElement, {
        streamName: window.CONFIG.KVS_STREAM_NAME,
        region: window.CONFIG.KVS_REGION,
    });

    console.log('KVS Player initialized');
}

/**
 * Start KVS stream playback
 */
async function startKVSStream() {
    try {
        kvsElements.streamMessage.textContent = 'ストリームに接続中...';
        kvsElements.startBtn.disabled = true;
        kvsElements.startBtn.textContent = '接続中...';

        if (!kvsPlayer) {
            initKVSPlayer();
        }

        await kvsPlayer.play();

        // Hide placeholder, show video
        kvsElements.placeholder.style.display = 'none';
        kvsElements.videoElement.style.display = 'block';

        // Update status
        kvsElements.statusBadge.textContent = 'ライブ';
        kvsElements.statusBadge.className = 'status-badge online';

        console.log('KVS stream started successfully');

        // Update button to stop
        kvsElements.startBtn.textContent = 'ストリーム停止';
        kvsElements.startBtn.disabled = false;
        kvsElements.startBtn.onclick = stopKVSStream;

    } catch (error) {
        console.error('Error starting KVS stream:', error);
        kvsElements.streamMessage.textContent = 'ストリーム接続に失敗しました';
        kvsElements.startBtn.disabled = false;
        kvsElements.startBtn.textContent = 'リトライ';

        // Show error to user
        alert(`ライブストリームの開始に失敗しました: ${error.message}\n\nKVSストリームが有効であることを確認してください。`);
    }
}

/**
 * Stop KVS stream playback
 */
function stopKVSStream() {
    try {
        if (kvsPlayer) {
            kvsPlayer.stop();
        }

        // Show placeholder, hide video
        kvsElements.videoElement.style.display = 'none';
        kvsElements.placeholder.style.display = 'flex';

        // Update status
        kvsElements.statusBadge.textContent = 'オフライン';
        kvsElements.statusBadge.className = 'status-badge';

        // Update button to start
        kvsElements.streamMessage.textContent = 'ストリーム停止';
        kvsElements.startBtn.textContent = 'ライブストリーム開始';
        kvsElements.startBtn.disabled = false;
        kvsElements.startBtn.onclick = startKVSStream;

        console.log('KVS stream stopped');

    } catch (error) {
        console.error('Error stopping KVS stream:', error);
    }
}

/**
 * Check if KVS stream is available
 */
async function checkKVSStreamAvailability() {
    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/kvs/stream-status?stream=${window.CONFIG.KVS_STREAM_NAME}`);

        if (response.ok) {
            const data = await response.json();
            return data.active || false;
        }

        return false;
    } catch (error) {
        console.error('Error checking KVS stream availability:', error);
        return false;
    }
}

/**
 * Auto-check stream availability
 */
async function autoCheckStreamAvailability() {
    const isAvailable = await checkKVSStreamAvailability();

    if (isAvailable) {
        kvsElements.streamMessage.textContent = 'ストリームが利用可能です';
        kvsElements.startBtn.style.display = 'inline-block';
    } else {
        kvsElements.streamMessage.textContent = 'ストリーム準備中...';
        kvsElements.startBtn.style.display = 'none';
    }
}

/**
 * Setup KVS event listeners
 */
function setupKVSEventListeners() {
    if (kvsElements.startBtn) {
        kvsElements.startBtn.addEventListener('click', startKVSStream);
    }

    // Video element event listeners
    if (kvsElements.videoElement) {
        kvsElements.videoElement.addEventListener('loadeddata', () => {
            console.log('Video loaded');
        });

        kvsElements.videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
        });

        kvsElements.videoElement.addEventListener('playing', () => {
            console.log('Video playing');
        });
    }
}

/**
 * Initialize KVS integration
 */
function initKVSIntegration() {
    console.log('Initializing KVS integration...');

    setupKVSEventListeners();

    // Check stream availability periodically
    autoCheckStreamAvailability();
    setInterval(autoCheckStreamAvailability, 10000); // Check every 10 seconds

    console.log('KVS integration initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKVSIntegration);
} else {
    initKVSIntegration();
}
