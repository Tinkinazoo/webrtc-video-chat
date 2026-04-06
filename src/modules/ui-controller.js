/**
 * UI Controller Module
 * 
 * Отвечает за:
 * - Обработку пользовательских действий
 * - Переключение экранов
 * - Интеграцию с другими модулями
 * - Подписку на изменения Store
 * 
 * Это "оркестратор", который связывает UI с бизнес-логикой.
 */
export class UIController {
    constructor(eventBus, store, mediaManager, webrtcManager) {
        this.eventBus = eventBus;
        this.store = store;
        this.mediaManager = mediaManager;
        this.webrtcManager = webrtcManager;
        this.socket = null;
        this.currentRoomId = null;
        this.currentUserId = null;
        this.unsubscribeFunctions = [];
    }
    
    /**
     * Инициализация UI контроллера
     */
    init() {
        this.setupEventListeners();
        this.subscribeToStore();
    }
    
    /**
     * Настройка обработчиков UI
     * @private
     */
    setupEventListeners() {
        // Экран подключения
        const joinBtn = document.getElementById('join-btn');
        const createRoomBtn = document.getElementById('create-room-btn');
        const copyLinkBtn = document.getElementById('copy-link-btn');
        const leaveBtn = document.getElementById('leave-call');
        const roomInput = document.getElementById('room-id');
        
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinRoom());
        }
        
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => this.createRoom());
        }
        
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.copyRoomLink());
        }
        
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveCall());
        }
        
        if (roomInput) {
            roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }
        
        // Медиа контролы
        const toggleCamera = document.getElementById('toggle-camera');
        const toggleMicrophone = document.getElementById('toggle-microphone');
        const toggleScreen = document.getElementById('toggle-screen');
        
        if (toggleCamera) {
            toggleCamera.addEventListener('click', () => this.mediaManager.toggleCamera());
        }
        
        if (toggleMicrophone) {
            toggleMicrophone.addEventListener('click', () => this.mediaManager.toggleMicrophone());
        }
        
        if (toggleScreen) {
            toggleScreen.addEventListener('click', () => this.mediaManager.toggleScreenShare());
        }
    }
    
    /**
     * Подписка на изменения в Store
     * @private
     */
    subscribeToStore() {
        this.unsubscribeFunctions.push(
            this.store.subscribe('media.camera.enabled', (enabled) => {
                const btn = document.getElementById('toggle-camera');
                if (btn) {
                    btn.style.opacity = enabled ? '1' : '0.5';
                }
            })
        );
        
        this.unsubscribeFunctions.push(
            this.store.subscribe('media.microphone.enabled', (enabled) => {
                const btn = document.getElementById('toggle-microphone');
                if (btn) {
                    btn.style.opacity = enabled ? '1' : '0.5';
                }
            })
        );
        
        this.unsubscribeFunctions.push(
            this.store.subscribe('media.screen.enabled', (enabled) => {
                const btn = document.getElementById('toggle-screen');
                if (btn) {
                    btn.style.backgroundColor = enabled ? '#48bb78' : '#f7fafc';
                }
            })
        );
    }
    
    /**
     * Подключение к комнате
     * @returns {Promise<void>}
     */
    async joinRoom() {
        const roomInput = document.getElementById('room-id');
        const roomId = roomInput.value.trim();
        
        if (!roomId) {
            this.eventBus.emit('log:error', 'Введите ID комнаты');
            return;
        }
        
        await this.startCall(roomId);
    }
    
    /**
     * Создание новой комнаты
     * @returns {Promise<void>}
     */
    async createRoom() {
        const roomId = Math.random().toString(36).substring(2, 10);
        const roomInput = document.getElementById('room-id');
        if (roomInput) roomInput.value = roomId;
        
        await this.startCall(roomId);
        this.eventBus.emit('log:success', `Создана комната: ${roomId}`);
    }
    
    /**
     * Начало звонка
     * @param {string} roomId - ID комнаты
     * @returns {Promise<void>}
     * @private
     */
    async startCall(roomId) {
        try {
            // Инициализация медиа
            await this.mediaManager.initCamera();
            
            // Подключение к сокету
            this.socket = io();
            this.currentUserId = Math.random().toString(36).substring(2, 10);
            this.currentRoomId = roomId;
            
            this.webrtcManager.setSocket(this.socket, roomId, this.currentUserId);
            
            this.socket.emit('join-room', roomId, this.currentUserId);
            
            // Переключение UI
            document.getElementById('join-screen').classList.add('hidden');
            document.getElementById('call-screen').classList.remove('hidden');
            document.getElementById('room-id-display').textContent = roomId;
            
            this.store.set('call.status', 'connecting');
            this.store.set('call.roomId', roomId);
            
            this.eventBus.emit('log:success', `Подключение к комнате ${roomId}`);
        } catch (error) {
            this.eventBus.emit('log:error', `Не удалось начать звонок: ${error.message}`);
        }
    }
    
    /**
     * Копирование ссылки на комнату
     */
    copyRoomLink() {
        const link = `${window.location.origin}?room=${this.currentRoomId}`;
        navigator.clipboard.writeText(link);
        this.eventBus.emit('log:success', 'Ссылка на комнату скопирована');
    }
    
    /**
     * Выход из звонка
     */
    leaveCall() {
        // Закрытие Socket соединения
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Закрытие WebRTC соединений
        this.webrtcManager.closeAllConnections();
        
        // Остановка медиа
        this.mediaManager.stopAllTracks();
        
        // Переключение UI
        document.getElementById('join-screen').classList.remove('hidden');
        document.getElementById('call-screen').classList.add('hidden');
        
        // Сброс Store
        this.store.set('call.status', 'disconnected');
        this.store.set('call.roomId', null);
        this.store.set('call.participants', []);
        
        this.eventBus.emit('log:info', 'Вы вышли из звонка');
    }
    
    /**
     * Очистка подписок при уничтожении
     */
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        this.unsubscribeFunctions = [];
    }
}