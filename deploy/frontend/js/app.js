// Configuration
const CONFIG = {
    // API_BASE_URL will be set to current domain's /api endpoint
    API_BASE_URL: window.location.origin + '/api',
    REFRESH_INTERVAL: 30000, // 30 seconds
    STREAM_CHECK_INTERVAL: 5000, // 5 seconds
};

// State Management
const state = {
    videos: [],
    filteredVideos: [],
    selectedVideo: null,
    isLoading: false,
    streamStatus: 'offline',
};

// DOM Elements
const elements = {
    videosGrid: document.getElementById('videos-grid'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    emptyState: document.getElementById('empty-state'),
    refreshBtn: document.getElementById('refresh-videos'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),

    // Modal
    videoModal: document.getElementById('video-modal'),
    videoPlayer: document.getElementById('video-player'),
    videoSource: document.getElementById('video-source'),
    closeModal: document.getElementById('close-modal'),
    downloadVideo: document.getElementById('download-video'),

    // Modal Info
    modalTitle: document.getElementById('modal-title'),
    videoFilename: document.getElementById('video-filename'),
    videoSize: document.getElementById('video-size'),
    videoDate: document.getElementById('video-date'),

    // Stats
    totalVideos: document.getElementById('total-videos'),
    totalSize: document.getElementById('total-size'),
    avgDetections: document.getElementById('avg-detections'),
    lastUpdate: document.getElementById('last-update'),

    // Stream
    streamStatus: document.getElementById('stream-status'),
    liveStream: document.getElementById('live-stream'),
    detectionCount: document.getElementById('detection-count'),
    streamFps: document.getElementById('stream-fps'),
    streamResolution: document.getElementById('stream-resolution'),
};

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}時間前`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}日前`;

    return formatDate(dateString);
}

function showError(message) {
    elements.error.textContent = message;
    elements.error.style.display = 'block';
    setTimeout(() => {
        elements.error.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    state.isLoading = show;
    elements.loading.style.display = show ? 'block' : 'none';
}

// API Functions
async function fetchVideos() {
    try {
        showLoading(true);
        elements.error.style.display = 'none';

        const response = await fetch(`${CONFIG.API_BASE_URL}/videos`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        state.videos = data.videos || [];
        filterAndSortVideos();
        updateStatistics();
        renderVideos();

    } catch (error) {
        console.error('Error fetching videos:', error);
        showError('映像の取得に失敗しました: ' + error.message);
        elements.emptyState.style.display = 'block';
    } finally {
        showLoading(false);
    }
}

async function checkStreamStatus() {
    try {
        // Check if stream is active by trying to fetch stream info
        const response = await fetch(`${CONFIG.API_BASE_URL}/stream/status`);

        if (response.ok) {
            const data = await response.json();
            updateStreamStatus(data);
        } else {
            updateStreamStatus({ active: false });
        }
    } catch (error) {
        console.error('Error checking stream status:', error);
        updateStreamStatus({ active: false });
    }
}

function updateStreamStatus(data) {
    const isActive = data.active || false;
    state.streamStatus = isActive ? 'online' : 'offline';

    elements.streamStatus.textContent = isActive ? 'オンライン' : 'オフライン';
    elements.streamStatus.className = 'status-badge ' + (isActive ? 'online' : '');

    if (isActive && data.detections !== undefined) {
        elements.detectionCount.textContent = data.detections;
        elements.streamFps.textContent = data.fps ? data.fps.toFixed(1) : '-';
        elements.streamResolution.textContent = data.resolution || '-';
    } else {
        elements.detectionCount.textContent = '-';
        elements.streamFps.textContent = '-';
        elements.streamResolution.textContent = '-';
    }
}

// Video Management
function filterAndSortVideos() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const sortBy = elements.sortSelect.value;

    // Filter
    state.filteredVideos = state.videos.filter(video => {
        return video.key.toLowerCase().includes(searchTerm);
    });

    // Sort
    state.filteredVideos.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return new Date(b.last_modified) - new Date(a.last_modified);
            case 'oldest':
                return new Date(a.last_modified) - new Date(b.last_modified);
            case 'size-desc':
                return b.size - a.size;
            case 'size-asc':
                return a.size - b.size;
            default:
                return 0;
        }
    });
}

function renderVideos() {
    elements.videosGrid.innerHTML = '';

    if (state.filteredVideos.length === 0) {
        elements.emptyState.style.display = 'block';
        return;
    }

    elements.emptyState.style.display = 'none';

    state.filteredVideos.forEach(video => {
        const card = createVideoCard(video);
        elements.videosGrid.appendChild(card);
    });
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => openVideoModal(video);

    const filename = video.key.split('/').pop();

    card.innerHTML = `
        <div class="video-thumbnail">
            🎥
        </div>
        <div class="video-card-body">
            <div class="video-title">${filename}</div>
            <div class="video-meta">
                <span>📏 ${formatBytes(video.size)}</span>
                <span>🕒 ${formatTime(video.last_modified)}</span>
            </div>
        </div>
    `;

    return card;
}

function openVideoModal(video) {
    state.selectedVideo = video;

    const filename = video.key.split('/').pop();
    const videoUrl = `${CONFIG.API_BASE_URL}/video?source=s3&key=${encodeURIComponent(video.key)}`;

    elements.modalTitle.textContent = filename;
    elements.videoFilename.textContent = filename;
    elements.videoSize.textContent = formatBytes(video.size);
    elements.videoDate.textContent = formatDate(video.last_modified);

    elements.videoSource.src = videoUrl;
    elements.videoPlayer.load();

    elements.videoModal.classList.add('active');
}

function closeVideoModal() {
    elements.videoModal.classList.remove('active');
    elements.videoPlayer.pause();
    elements.videoSource.src = '';
    state.selectedVideo = null;
}

function downloadCurrentVideo() {
    if (!state.selectedVideo) return;

    const filename = state.selectedVideo.key.split('/').pop();
    const videoUrl = `${CONFIG.API_BASE_URL}/video?source=s3&key=${encodeURIComponent(state.selectedVideo.key)}`;

    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Statistics
function updateStatistics() {
    // Total videos
    elements.totalVideos.textContent = state.videos.length;

    // Total size
    const totalSize = state.videos.reduce((sum, video) => sum + video.size, 0);
    elements.totalSize.textContent = formatBytes(totalSize);

    // Average detections (placeholder)
    elements.avgDetections.textContent = '-';

    // Last update
    if (state.videos.length > 0) {
        const latestVideo = state.videos.reduce((latest, video) => {
            return new Date(video.last_modified) > new Date(latest.last_modified) ? video : latest;
        });
        elements.lastUpdate.textContent = formatTime(latestVideo.last_modified);
    } else {
        elements.lastUpdate.textContent = '-';
    }
}

// Event Listeners
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchVideos();
    });

    // Search input
    elements.searchInput.addEventListener('input', () => {
        filterAndSortVideos();
        renderVideos();
    });

    // Sort select
    elements.sortSelect.addEventListener('change', () => {
        filterAndSortVideos();
        renderVideos();
    });

    // Modal close
    elements.closeModal.addEventListener('click', closeVideoModal);

    // Modal background click
    elements.videoModal.addEventListener('click', (e) => {
        if (e.target === elements.videoModal) {
            closeVideoModal();
        }
    });

    // Download button
    elements.downloadVideo.addEventListener('click', downloadCurrentVideo);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.videoModal.classList.contains('active')) {
            closeVideoModal();
        }
    });
}

// Auto-refresh
function startAutoRefresh() {
    setInterval(() => {
        if (!state.isLoading) {
            fetchVideos();
        }
    }, CONFIG.REFRESH_INTERVAL);

    // Stream status check
    setInterval(() => {
        checkStreamStatus();
    }, CONFIG.STREAM_CHECK_INTERVAL);
}

// Initialize
async function init() {
    console.log('Initializing Shiitake Monitoring System...');
    console.log('API Base URL:', CONFIG.API_BASE_URL);

    setupEventListeners();
    await fetchVideos();
    checkStreamStatus();
    startAutoRefresh();

    console.log('Initialization complete');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
