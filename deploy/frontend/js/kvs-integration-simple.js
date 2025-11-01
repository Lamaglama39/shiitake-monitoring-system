/**
 * KVS Integration - Simple Version
 * Live streaming and time-range playback only
 */

// Configuration
const CONFIG = {
    API_BASE_URL: window.location.origin + '/api',
    KVS_STREAM_NAME: 'dockerStream',
    KVS_REGION: 'ap-northeast-1',
};

window.CONFIG = CONFIG;

// State
const state = {
    kvsPlayer: null,
    streamMode: 'live', // 'live' or 'time-range'
    isPlaying: false,
};

// DOM Elements
const elements = {
    videoElement: document.getElementById('live-stream-video'),
    placeholder: document.getElementById('stream-placeholder'),
    startBtn: document.getElementById('start-stream-btn'),
    streamMessage: document.getElementById('stream-message'),
    statusBadge: document.getElementById('stream-status'),

    // Mode controls
    modeRadios: document.getElementsByName('stream-mode'),
    timeRangeControls: document.getElementById('time-range-controls'),
    startTimeInput: document.getElementById('start-time'),
    endTimeInput: document.getElementById('end-time'),
    applyTimeRangeBtn: document.getElementById('apply-time-range'),

    // Info display
    streamModeDisplay: document.getElementById('stream-mode-display'),
    streamResolution: document.getElementById('stream-resolution'),
    fragmentDuration: document.getElementById('fragment-duration'),
    connectionTime: document.getElementById('connection-time'),
};

/**
 * Initialize KVS player
 */
function initKVSPlayer() {
    if (!elements.videoElement) {
        console.error('Video element not found');
        return;
    }

    state.kvsPlayer = new window.KVSPlayer(elements.videoElement, {
        streamName: CONFIG.KVS_STREAM_NAME,
        region: CONFIG.KVS_REGION,
    });

    console.log('KVS Player initialized');
}

/**
 * Start live stream
 */
async function startLiveStream() {
    try {
        elements.streamMessage.textContent = 'ライブストリームに接続中...';
        elements.startBtn.disabled = true;
        elements.startBtn.textContent = '接続中...';

        if (!state.kvsPlayer) {
            initKVSPlayer();
        }

        await state.kvsPlayer.play();

        // Show video, hide placeholder
        elements.placeholder.style.display = 'none';
        elements.videoElement.style.display = 'block';

        // Update UI
        elements.statusBadge.textContent = 'ライブ';
        elements.statusBadge.className = 'status-badge online';
        elements.streamModeDisplay.textContent = 'ライブ';
        elements.streamResolution.textContent = '1280x720';
        elements.connectionTime.textContent = new Date().toLocaleTimeString('ja-JP');

        state.isPlaying = true;

        // Update button
        elements.startBtn.textContent = 'ストリーム停止';
        elements.startBtn.disabled = false;
        elements.startBtn.onclick = stopStream;

        console.log('Live stream started');

        // Try to unmute after a short delay (for better autoplay support)
        // User can manually unmute if needed
        setTimeout(() => {
            if (elements.videoElement.muted) {
                elements.videoElement.muted = false;
                console.log('Attempted to unmute video');
            }
        }, 1000);

    } catch (error) {
        console.error('Error starting live stream:', error);
        elements.streamMessage.textContent = 'ライブストリーム接続に失敗しました';
        elements.startBtn.disabled = false;
        elements.startBtn.textContent = 'リトライ';
        alert(`ライブストリームの開始に失敗しました: ${error.message}`);
    }
}

/**
 * Start time-range playback
 */
async function startTimeRangePlayback() {
    try {
        const startTime = elements.startTimeInput.value;
        const endTime = elements.endTimeInput.value;

        if (!startTime || !endTime) {
            alert('開始時刻と終了時刻を両方指定してください');
            return;
        }

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        if (startDate >= endDate) {
            alert('終了時刻は開始時刻よりも後に設定してください');
            return;
        }

        // Check if time range is valid (not in the future)
        const now = new Date();
        if (startDate > now) {
            alert('開始時刻が未来の時刻です。過去の時刻を指定してください。');
            return;
        }

        console.log('Starting time-range playback:', {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        });

        elements.streamMessage.textContent = '時間指定ストリームに接続中...';
        elements.applyTimeRangeBtn.disabled = true;
        elements.applyTimeRangeBtn.textContent = '接続中...';

        if (!state.kvsPlayer) {
            initKVSPlayer();
        }

        // Get HLS URL for time range
        const apiUrl = `${CONFIG.API_BASE_URL}/kvs/hls-url?stream=${CONFIG.KVS_STREAM_NAME}&mode=on_demand&start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
        console.log('Fetching HLS URL:', apiUrl);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('API Error:', errorData);
            throw new Error(`API Error: ${response.status} - ${errorData.error || errorData.message || 'Unknown'}`);
        }

        const data = await response.json();
        console.log('HLS URL response:', data);

        if (!data.hlsUrl) {
            throw new Error('HLS URLが取得できませんでした');
        }

        // Stop current player if playing
        if (state.isPlaying && state.kvsPlayer) {
            state.kvsPlayer.stop();
        }

        // Play with custom HLS URL
        console.log('Loading HLS URL:', data.hlsUrl);

        if (window.Hls && window.Hls.isSupported()) {
            // Use HLS.js
            if (!state.kvsPlayer.hls) {
                state.kvsPlayer.hls = new window.Hls({
                    enableWorker: true,
                    lowLatencyMode: false, // Disable for VOD
                    backBufferLength: 90
                });
                state.kvsPlayer.hls.attachMedia(elements.videoElement);
            }

            state.kvsPlayer.hls.loadSource(data.hlsUrl);

            state.kvsPlayer.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed for time-range playback');
                elements.videoElement.play().catch(e => {
                    console.error('Play error:', e);
                    alert('動画の再生に失敗しました: ' + e.message);
                });
            });

            state.kvsPlayer.hls.on(window.Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                if (data.fatal) {
                    alert('HLS再生エラー: ' + (data.details || 'Unknown error'));
                }
            });

        } else if (elements.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            elements.videoElement.src = data.hlsUrl;
            elements.videoElement.play().catch(e => {
                console.error('Play error:', e);
                alert('動画の再生に失敗しました: ' + e.message);
            });
        } else {
            throw new Error('このブラウザはHLS再生をサポートしていません');
        }

        // Show video, hide placeholder
        elements.placeholder.style.display = 'none';
        elements.videoElement.style.display = 'block';

        // Update UI
        elements.statusBadge.textContent = '再生中';
        elements.statusBadge.className = 'status-badge online';
        elements.streamModeDisplay.textContent = `時間指定 (${startDate.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })})`;
        elements.streamResolution.textContent = '1280x720';
        elements.connectionTime.textContent = new Date().toLocaleTimeString('ja-JP');

        state.isPlaying = true;

        // Update button
        elements.applyTimeRangeBtn.disabled = false;
        elements.applyTimeRangeBtn.textContent = '適用';

        console.log('Time-range playback started successfully');

    } catch (error) {
        console.error('Error starting time-range playback:', error);
        elements.streamMessage.textContent = '時間指定ストリーム接続に失敗しました';
        elements.applyTimeRangeBtn.disabled = false;
        elements.applyTimeRangeBtn.textContent = '適用';

        // Show detailed error message
        let errorMessage = error.message;
        if (error.message.includes('ResourceNotFoundException') || error.message.includes('not found')) {
            errorMessage = '指定した時間帯に録画データが存在しません。別の時間帯を試してください。';
        }

        alert(`時間指定ストリームの開始に失敗しました:\n${errorMessage}`);
    }
}

/**
 * Stop stream
 */
function stopStream() {
    try {
        if (state.kvsPlayer) {
            state.kvsPlayer.stop();
        }

        // Hide video, show placeholder
        elements.videoElement.style.display = 'none';
        elements.placeholder.style.display = 'flex';

        // Update UI
        elements.statusBadge.textContent = 'オフライン';
        elements.statusBadge.className = 'status-badge';
        elements.streamMessage.textContent = 'ストリーム停止';
        elements.streamModeDisplay.textContent = '-';
        elements.streamResolution.textContent = '-';
        elements.connectionTime.textContent = '-';

        state.isPlaying = false;

        // Update button
        if (state.streamMode === 'live') {
            elements.startBtn.textContent = 'ライブストリーム開始';
            elements.startBtn.disabled = false;
            elements.startBtn.onclick = startLiveStream;
        }

        console.log('Stream stopped');

    } catch (error) {
        console.error('Error stopping stream:', error);
    }
}

/**
 * Handle stream mode change
 */
function handleStreamModeChange(event) {
    state.streamMode = event.target.value;

    if (state.streamMode === 'live') {
        elements.timeRangeControls.style.display = 'none';
        elements.startBtn.style.display = 'inline-block';
    } else {
        elements.timeRangeControls.style.display = 'flex';
        elements.startBtn.style.display = 'none';

        // Set default time range (last 10 minutes)
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

        elements.endTimeInput.value = formatDateTimeLocal(now);
        elements.startTimeInput.value = formatDateTimeLocal(tenMinutesAgo);
    }

    // Stop current stream if playing
    if (state.isPlaying) {
        stopStream();
    }
}

/**
 * Format date for datetime-local input
 */
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Check stream availability
 */
async function checkStreamAvailability() {
    try {
        const response = await fetch(
            `${CONFIG.API_BASE_URL}/kvs/stream-status?stream=${CONFIG.KVS_STREAM_NAME}`
        );

        if (response.ok) {
            const data = await response.json();

            if (data.active && state.streamMode === 'live') {
                elements.streamMessage.textContent = 'ライブストリームが利用可能です';
                elements.startBtn.style.display = 'inline-block';
            } else if (!data.active && state.streamMode === 'live') {
                elements.streamMessage.textContent = 'ライブストリーム準備中...';
                elements.startBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error checking stream availability:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Live stream button
    if (elements.startBtn) {
        elements.startBtn.addEventListener('click', startLiveStream);
    }

    // Time range apply button
    if (elements.applyTimeRangeBtn) {
        elements.applyTimeRangeBtn.addEventListener('click', startTimeRangePlayback);
    }

    // Stream mode radio buttons
    elements.modeRadios.forEach(radio => {
        radio.addEventListener('change', handleStreamModeChange);
    });

    // Video element events
    if (elements.videoElement) {
        elements.videoElement.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded');
            const duration = elements.videoElement.duration;
            if (duration && !isNaN(duration) && duration !== Infinity) {
                elements.fragmentDuration.textContent = `${duration.toFixed(1)}秒`;
            }
        });

        elements.videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
        });
    }
}

/**
 * Initialize
 */
function init() {
    console.log('Initializing KVS Integration (Simple)...');
    console.log('API Base URL:', CONFIG.API_BASE_URL);

    setupEventListeners();
    checkStreamAvailability();

    // Periodic stream availability check
    setInterval(checkStreamAvailability, 10000);

    console.log('Initialization complete');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
