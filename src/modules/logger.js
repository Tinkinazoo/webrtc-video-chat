/**
 * Logger Module
 * 
 * Отвечает за логирование событий в UI.
 * Подписывается на события Event Bus и отображает их.
 * 
 * Принцип: Модуль ничего не знает о других модулях,
 * только реагирует на события.
 */
export class Logger {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logContainer = null;
        this.unsubscribeFunctions = [];
        this.init();
    }
    
    init() {
        // Подписка на события
        this.unsubscribeFunctions.push(
            this.eventBus.on('log:info', (msg) => this.addLog(msg, 'info')),
            this.eventBus.on('log:error', (msg) => this.addLog(msg, 'error')),
            this.eventBus.on('log:success', (msg) => this.addLog(msg, 'success'))
        );
        
        // Ожидание DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            this.setupUI();
        }
    }
    
    setupUI() {
        this.logContainer = document.getElementById('log-content');
        if (!this.logContainer) {
            // Если элемент еще не создан, пробуем позже
            setTimeout(() => this.setupUI(), 100);
        }
    }
    
    addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        if (this.logContainer) {
            this.logContainer.appendChild(logEntry);
            logEntry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            console.log(`[${type}]`, message);
        }
        
        // Автоочистка после 50 записей (чтобы не переполнять память)
        if (this.logContainer && this.logContainer.children.length > 50) {
            this.logContainer.removeChild(this.logContainer.children[0]);
        }
    }
    
    /**
     * Очистка подписок при уничтожении модуля
     */
    destroy() {
        this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        this.unsubscribeFunctions = [];
    }
}
