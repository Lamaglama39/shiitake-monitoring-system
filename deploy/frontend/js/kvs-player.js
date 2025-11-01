/**
 * KVS HLS Player
 * Kinesis Video Streams HLS playback functionality
 */

class KVSPlayer {
    constructor(videoElement, config = {}) {
        this.videoElement = videoElement;
        this.config = {
            streamName: config.streamName || 'dockerStream',
            region: config.region || 'ap-northeast-1',
            refreshInterval: config.refreshInterval || 60000, // 60 seconds
            ...config
        };

        this.hlsUrl = null;
        this.refreshTimer = null;
        this.isPlaying = false;
    }

    /**
     * Get HLS streaming endpoint from KVS
     */
    async getHLSStreamingEndpoint() {
        try {
            // Call API to get HLS URL
            const response = await fetch(`${window.CONFIG.API_BASE_URL}/kvs/hls-url?stream=${this.config.streamName}`);

            if (!response.ok) {
                throw new Error(`Failed to get HLS URL: ${response.status}`);
            }

            const data = await response.json();
            return data.hlsUrl;
        } catch (error) {
            console.error('Error getting HLS endpoint:', error);
            throw error;
        }
    }

    /**
     * Start playing KVS stream
     */
    async play() {
        try {
            console.log(`Starting KVS stream: ${this.config.streamName}`);

            // Get HLS URL
            this.hlsUrl = await this.getHLSStreamingEndpoint();
            console.log('HLS URL:', this.hlsUrl);

            // Check if HLS.js is needed (for browsers that don't support HLS natively)
            if (window.Hls && window.Hls.isSupported()) {
                // Use HLS.js for browsers that support it
                console.log('Using HLS.js for playback');
                this.hls = new window.Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90
                });

                this.hls.loadSource(this.hlsUrl);
                this.hls.attachMedia(this.videoElement);

                this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    console.log('HLS manifest parsed, starting playback');
                    this.videoElement.play().catch(e => {
                        console.error('Autoplay error:', e);
                        // Autoplay might be blocked, user needs to interact
                    });
                });

                this.hls.on(window.Hls.Events.ERROR, (event, data) => {
                    console.error('HLS error:', data);
                    if (data.fatal) {
                        this.handleError(data);
                    }
                });
            } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari/iOS)
                console.log('Using native HLS playback (Safari/iOS)');
                this.videoElement.src = this.hlsUrl;

                // Try to play, but handle autoplay restrictions
                try {
                    await this.videoElement.play();
                    console.log('Native HLS playback started');
                } catch (error) {
                    console.warn('Autoplay blocked, user interaction required:', error);
                    // On iOS, user needs to interact with the page first
                    // The video will start when user taps play button
                }
            } else {
                throw new Error('HLS is not supported in this browser');
            }

            this.isPlaying = true;

            // Setup refresh timer to get new HLS URL periodically
            this.setupRefreshTimer();

            return true;
        } catch (error) {
            console.error('Error starting stream:', error);
            throw error;
        }
    }

    /**
     * Stop playing stream
     */
    stop() {
        console.log('Stopping KVS stream');

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        this.videoElement.pause();
        this.videoElement.src = '';

        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }

        this.isPlaying = false;
    }

    /**
     * Setup timer to refresh HLS URL
     * KVS HLS URLs expire after some time
     */
    setupRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        this.refreshTimer = setInterval(async () => {
            try {
                console.log('Refreshing HLS URL...');
                const newHlsUrl = await this.getHLSStreamingEndpoint();

                if (newHlsUrl !== this.hlsUrl) {
                    this.hlsUrl = newHlsUrl;

                    if (this.hls) {
                        this.hls.loadSource(newHlsUrl);
                    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                        this.videoElement.src = newHlsUrl;
                    }
                }
            } catch (error) {
                console.error('Error refreshing HLS URL:', error);
            }
        }, this.config.refreshInterval);
    }

    /**
     * Handle playback errors
     */
    handleError(data) {
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
            console.log('Network error, trying to recover...');
            this.hls.startLoad();
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('Media error, trying to recover...');
            this.hls.recoverMediaError();
        } else {
            console.error('Fatal error, cannot recover');
            this.stop();
        }
    }

    /**
     * Check if stream is currently playing
     */
    get playing() {
        return this.isPlaying;
    }
}

// Export for use in app.js
window.KVSPlayer = KVSPlayer;
