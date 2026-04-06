/**
 * Media Manager Module
 * 
 * Отвечает за управление медиапотоками:
 * - Камера
 * - Микрофон
 * - Демонстрация экрана
 * 
 * Инкапсулирует работу с getUserMedia и getDisplayMedia.
 */
export class MediaManager {
    constructor(eventBus, store) {
        this.eventBus = eventBus;
        this.store = store;
        this.localStream = null;
        this.screenStream = null;
    }
    
    /**
     * Инициализация камеры и микрофона
     * @returns {Promise<MediaStream>}
     */
    async initCamera() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const videoElement = document.getElementById('local-video');
            if (videoElement) {
                videoElement.srcObject = this.localStream;
            }
            
            this.store.set('media.camera.stream', this.localStream);
            this.store.set('media.camera.enabled', true);
            this.store.set('media.microphone.enabled', true);
            
            this.eventBus.emit('log:success', 'Камера и микрофон успешно подключены');
            this.eventBus.emit('media:ready', this.localStream);
            
            return this.localStream;
        } catch (error) {
            this.eventBus.emit('log:error', `Ошибка доступа к камере: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Включение/выключение камеры
     */
    toggleCamera() {
        if (!this.localStream) {
            this.eventBus.emit('log:error', 'Медиапоток не инициализирован');
            return;
        }
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            const enabled = !videoTrack.enabled;
            videoTrack.enabled = enabled;
            this.store.set('media.camera.enabled', enabled);
            this.eventBus.emit('log:info', `Камера ${enabled ? 'включена' : 'выключена'}`);
        }
    }
    
    /**
     * Включение/выключение микрофона
     */
    toggleMicrophone() {
        if (!this.localStream) {
            this.eventBus.emit('log:error', 'Медиапоток не инициализирован');
            return;
        }
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            const enabled = !audioTrack.enabled;
            audioTrack.enabled = enabled;
            this.store.set('media.microphone.enabled', enabled);
            this.eventBus.emit('log:info', `Микрофон ${enabled ? 'включен' : 'выключен'}`);
        }
    }
    
    /**
     * Включение/выключение демонстрации экрана
     * @returns {Promise<void>}
     */
    async toggleScreenShare() {
        if (this.screenStream) {
            // Остановка демонстрации экрана
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
            this.store.set('media.screen.enabled', false);
            this.eventBus.emit('log:info', 'Демонстрация экрана остановлена');
            this.eventBus.emit('media:screen-stopped');
        } else {
            try {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });
                
                // Обработка остановки демонстрации через системный UI
                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.toggleScreenShare();
                };
                
                this.store.set('media.screen.enabled', true);
                this.eventBus.emit('log:success', 'Демонстрация экрана запущена');
                this.eventBus.emit('media:screen-started', this.screenStream);
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    this.eventBus.emit('log:error', 'Пользователь отменил демонстрацию экрана');
                } else {
                    this.eventBus.emit('log:error', `Ошибка демонстрации экрана: ${error.message}`);
                }
            }
        }
    }
    
    /**
     * Получение локального потока
     * @returns {MediaStream|null}
     */
    getLocalStream() {
        return this.localStream;
    }
    
    /**
     * Получение потока демонстрации экрана
     * @returns {MediaStream|null}
     */
    getScreenStream() {
        return this.screenStream;
    }
    
    /**
     * Замена видеотрека (например, на поток экрана)
     * @param {RTCPeerConnection} peerConnection - PeerConnection для обновления
     */
    replaceVideoTrack(peerConnection) {
        const newStream = this.screenStream || this.localStream;
        if (!newStream) return;
        
        const videoTrack = newStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        const senders = peerConnection.getSenders();
        const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
        
        if (videoSender) {
            videoSender.replaceTrack(videoTrack);
        }
    }
    
    /**
     * Остановка всех медиапотоков
     */
    stopAllTracks() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        const videoElement = document.getElementById('local-video');
        if (videoElement) {
            videoElement.srcObject = null;
        }
        
        this.store.set('media.camera.stream', null);
        this.store.set('media.screen.enabled', false);
    }
}