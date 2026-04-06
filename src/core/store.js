/**
 * Store (Единое хранилище состояния)
 * 
 * Паттерн: Singleton + Observer
 * 
 * Единый источник истины для состояния приложения.
 * Компоненты подписываются на изменения и получают уведомления.
 * Аналог Redux, но упрощенный для демонстрации концепции.
 */
export class Store {
    constructor(initialState = {}) {
        this.state = {
            call: {
                status: 'disconnected', // disconnected, connecting, connected
                roomId: null,
                participants: []
            },
            media: {
                camera: { enabled: true, stream: null },
                microphone: { enabled: true },
                screen: { enabled: false, stream: null }
            },
            ...initialState
        };
        this.subscribers = new Map();
    }
    
    /**
     * Получение значения по пути
     * @param {string} path - Путь вида 'call.status' или 'media.camera.enabled'
     * @returns {any} Значение
     */
    get(path) {
        const parts = path.split('.');
        let value = this.state;
        for (const part of parts) {
            if (value === undefined) return undefined;
            value = value[part];
        }
        return value;
    }
    
    /**
     * Установка значения по пути
     * @param {string} path - Путь вида 'call.status'
     * @param {any} newValue - Новое значение
     */
    set(path, newValue) {
        const parts = path.split('.');
        let current = this.state;
        
        // Идем по пути до последнего элемента
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        
        const oldValue = current[parts[parts.length - 1]];
        current[parts[parts.length - 1]] = newValue;
        
        // Оповещаем подписчиков на конкретный путь
        this._notifySubscribers(path, newValue, oldValue);
        
        // Оповещаем подписчиков на родительские пути
        this._notifyParentSubscribers(path, newValue);
    }
    
    /**
     * Подписка на изменения по пути
     * @param {string} path - Путь вида 'call.status'
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, []);
        }
        this.subscribers.get(path).push(callback);
        
        // Возвращаем функцию для отписки
        return () => {
            const callbacks = this.subscribers.get(path);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) callbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Уведомление подписчиков
     * @private
     */
    _notifySubscribers(path, newValue, oldValue) {
        if (this.subscribers.has(path)) {
            this.subscribers.get(path).forEach(cb => cb(newValue, oldValue));
        }
    }
    
    /**
     * Уведомление подписчиков на родительские пути
     * @private
     */
    _notifyParentSubscribers(path, newValue) {
        const parts = path.split('.');
        for (let i = 1; i <= parts.length; i++) {
            const parentPath = parts.slice(0, i).join('.');
            if (parentPath !== path && this.subscribers.has(parentPath)) {
                this.subscribers.get(parentPath).forEach(cb => cb(this.get(parentPath), null));
            }
        }
    }
    
    /**
     * Сброс состояния до начального
     */
    reset(initialState = {}) {
        this.state = {
            call: {
                status: 'disconnected',
                roomId: null,
                participants: []
            },
            media: {
                camera: { enabled: true, stream: null },
                microphone: { enabled: true },
                screen: { enabled: false, stream: null }
            },
            ...initialState
        };
        this.subscribers.clear();
    }
}
