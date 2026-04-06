/**
 * WebRTC Manager Module
 * 
 * Отвечает за P2P соединения:
 * - Создание RTCPeerConnection
 * - Обмен SDP (offer/answer)
 * - Обмен ICE кандидатами
 * - Управление удаленными видео
 * 
 * Ключевой модуль для видеозвонков.
 */
export class WebRTCManager {
    constructor(eventBus, store, mediaManager) {
        this.eventBus = eventBus;
        this.store = store;
        this.mediaManager = mediaManager;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        this.socket = null;
        this.roomId = null;
        this.currentUserId = null;
    }
    
    /**
     * Установка Socket.IO соединения
     * @param {Socket} socket - Socket.IO экземпляр
     * @param {string} roomId - ID комнаты
     * @param {string} userId - ID текущего пользователя
     */
    setSocket(socket, roomId, userId) {
        this.socket = socket;
        this.roomId = roomId;
        this.currentUserId = userId;
        this.setupSocketHandlers();
    }
    
    /**
     * Настройка обработчиков Socket.IO
     * @private
     */
    setupSocketHandlers() {
        this.socket.on('offer', async (data) => {
            this.eventBus.emit('log:info', `Получен offer от ${data.from.slice(-6)}`);
            await this.handleOffer(data.from, data.offer);
        });
        
        this.socket.on('answer', async (data) => {
            this.eventBus.emit('log:info', `Получен answer от ${data.from.slice(-6)}`);
            await this.handleAnswer(data.from, data.answer);
        });
        
        this.socket.on('ice-candidate', async (data) => {
            await this.handleIceCandidate(data.from, data.candidate);
        });
        
        this.socket.on('user-connected', async (userId) => {
            this.eventBus.emit('log:info', `Пользователь ${userId.slice(-6)} подключился`);
            await this.createOffer(userId);
        });
        
        this.socket.on('user-disconnected', (userId) => {
            this.eventBus.emit('log:info', `Пользователь ${userId.slice(-6)} отключился`);
            this.closePeerConnection(userId);
            this.updateParticipants(userId, 'remove');
        });
        
        this.socket.on('room-users', (users) => {
            this.eventBus.emit('log:info', `В комнате: ${users.map(u => u.slice(-6)).join(', ') || 'только вы'}`);
            users.forEach(userId => this.createOffer(userId));
        });
    }
    
    /**
     * Создание RTCPeerConnection для пользователя
     * @param {string} userId - ID пользователя
     * @returns {Promise<RTCPeerConnection>}
     * @private
     */
    async createPeerConnection(userId) {
        const pc = new RTCPeerConnection(this.configuration);
        
        // Добавление локального потока
        const localStream = this.mediaManager.getLocalStream();
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }
        
        // Обработка ICE кандидатов
        pc.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.emit('ice-candidate', {
                    roomId: this.roomId,
                    candidate: event.candidate
                });
            }
        };
        
        // Обработка входящих треков
        pc.ontrack = (event) => {
            this.eventBus.emit('log:success', `Получен поток от ${userId.slice(-6)}`);
            this.displayRemoteVideo(userId, event.streams[0]);
        };
        
        // Отслеживание состояния соединения
        pc.onconnectionstatechange = () => {
            this.eventBus.emit('log:info', `Соединение с ${userId.slice(-6)}: ${pc.connectionState}`);
            
            if (pc.connectionState === 'connected') {
                this.updateParticipants(userId, 'add');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.removeRemoteVideo(userId);
                this.updateParticipants(userId, 'remove');
            }
        };
        
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed') {
                this.eventBus.emit('log:error', `ICE соединение с ${userId.slice(-6)} упало`);
                pc.restartIce();
            }
        };
        
        this.peerConnections.set(userId, pc);
        return pc;
    }
    
    /**
     * Создание offer для пользователя
     * @param {string} userId - ID пользователя
     * @private
     */
    async createOffer(userId) {
        try {
            let pc = this.peerConnections.get(userId);
            if (!pc) {
                pc = await this.createPeerConnection(userId);
            }
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                roomId: this.roomId,
                offer: offer
            });
            
            this.eventBus.emit('log:info', `Отправлен offer для ${userId.slice(-6)}`);
        } catch (error) {
            this.eventBus.emit('log:error', `Ошибка создания offer: ${error.message}`);
        }
    }
    
    /**
     * Обработка входящего offer
     * @param {string} userId - ID пользователя
     * @param {RTCSessionDescription} offer - Offer
     * @private
     */
    async handleOffer(userId, offer) {
        try {
            let pc = this.peerConnections.get(userId);
            if (!pc) {
                pc = await this.createPeerConnection(userId);
            }
            
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                roomId: this.roomId,
                answer: answer
            });
            
            this.eventBus.emit('log:info', `Отправлен answer для ${userId.slice(-6)}`);
        } catch (error) {
            this.eventBus.emit('log:error', `Ошибка обработки offer: ${error.message}`);
        }
    }
    
    /**
     * Обработка входящего answer
     * @param {string} userId - ID пользователя
     * @param {RTCSessionDescription} answer - Answer
     * @private
     */
    async handleAnswer(userId, answer) {
        try {
            const pc = this.peerConnections.get(userId);
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                this.eventBus.emit('log:info', `Установлен answer для ${userId.slice(-6)}`);
            }
        } catch (error) {
            this.eventBus.emit('log:error', `Ошибка обработки answer: ${error.message}`);
        }
    }
    
    /**
     * Обработка ICE кандидата
     * @param {string} userId - ID пользователя
     * @param {RTCIceCandidate} candidate - ICE кандидат
     * @private
     */
    async handleIceCandidate(userId, candidate) {
        try {
            const pc = this.peerConnections.get(userId);
            if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            this.eventBus.emit('log:error', `Ошибка добавления ICE кандидата: ${error.message}`);
        }
    }
    
    /**
     * Отображение удаленного видео
     * @param {string} userId - ID пользователя
     * @param {MediaStream} stream - Медиапоток
     * @private
     */
    displayRemoteVideo(userId, stream) {
        const remoteVideosContainer = document.getElementById('remote-videos');
        if (!remoteVideosContainer) return;
        
        let wrapper = document.getElementById(`remote-video-${userId}`);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = `remote-video-${userId}`;
            wrapper.className = 'remote-video-wrapper';
            
            const video = document.createElement('video');
            video.id = `remote-video-${userId}-element`;
            video.className = 'video';
            video.autoplay = true;
            video.playsInline = true;
            
            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = `Пользователь ${userId.slice(-6)}`;
            
            wrapper.appendChild(video);
            wrapper.appendChild(label);
            remoteVideosContainer.appendChild(wrapper);
            
            video.srcObject = stream;
        }
    }
    
    /**
     * Удаление удаленного видео
     * @param {string} userId - ID пользователя
     * @private
     */
    removeRemoteVideo(userId) {
        const wrapper = document.getElementById(`remote-video-${userId}`);
        if (wrapper) {
            wrapper.remove();
        }
    }
    
    /**
     * Закрытие PeerConnection
     * @param {string} userId - ID пользователя
     */
    closePeerConnection(userId) {
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }
        this.removeRemoteVideo(userId);
    }
    
    /**
     * Обновление списка участников в Store
     * @param {string} userId - ID пользователя
     * @param {string} action - 'add' или 'remove'
     * @private
     */
    updateParticipants(userId, action) {
        const participants = this.store.get('call.participants') || [];
        if (action === 'add' && !participants.includes(userId)) {
            participants.push(userId);
            this.store.set('call.participants', participants);
        } else if (action === 'remove') {
            const index = participants.indexOf(userId);
            if (index !== -1) {
                participants.splice(index, 1);
                this.store.set('call.participants', participants);
            }
        }
    }
    
    /**
     * Закрытие всех соединений
     */
    closeAllConnections() {
        this.peerConnections.forEach((pc, userId) => {
            pc.close();
        });
        this.peerConnections.clear();
        
        const remoteVideosContainer = document.getElementById('remote-videos');
        if (remoteVideosContainer) {
            remoteVideosContainer.innerHTML = '';
        }
    }
}