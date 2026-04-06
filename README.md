# P2P Video Chat Widget

### Принципы

1. **Модульность** — каждый модуль решает одну задачу
2. **Слабая связанность** — модули общаются через Event Bus
3. **Единое состояние** — все данные в одном хранилище
4. **Dependency Injection** — зависимости передаются через конструктор
5. **Композиция** — предпочтение композиции перед наследованием

### Технологии

- **Frontend**: Нативный JavaScript (ES8+), HTML5, CSS3
- **Signaling Server**: Node.js + Express + Socket.IO
- **WebRTC**: P2P видео и аудио
- **Deployment**: Render / Railway / Heroku

## Установка и запуск

```bash
# Клонирование репозитория
git clone https://github.com/Tinkinazoo/webrtc-video-chat.git
cd webrtc-video-chat

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Запуск в production
npm start
