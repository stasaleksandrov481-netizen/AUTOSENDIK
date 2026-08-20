import os
import telebot
from flask import Flask, request

TOKEN = os.environ.get('BOT_TOKEN', '')
bot = telebot.TeleBot(TOKEN) if TOKEN else None
app = Flask(__name__)

# Обработчик команды /start
@bot.message_handler(commands=['start']) if bot else lambda f: f
def start_message(message):
    text = (
        "🏎 **AutoSyndicate!**\n\n"
        "Построй собственную авто-империю, не выходя из Telegram!\n\n"
        "🏎 **Гараж и автосалон:**\n Покупай легендарные тачки и прокачивай их мощность.\n\n"
        "⚔️ **PvP-Дуэли:** Вызывай друзей на гонки прямо в чатах!\n\n"
        "🎰 **Казино и события:** Рискуй, зарабатывай авто-коины и забирай редкие награды.\n\n"
        "🚨 **Полицейские погони:** Уходи от облав и спасай свою репутацию.\n\n"
        "Жми кнопку ниже и делай свой первый вызов! 👇"
    )
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

# Эндпоинт для вебхука Telegram
@app.route(f"/{TOKEN}" if TOKEN else "/webhook", methods=['POST'])
def get_message():
    if not bot:
        return "Bot token not configured", 500
    json_string = request.get_data().decode('utf-8')
    update = telebot.types.Update.de_json(json_string)
    bot.process_new_updates([update])
    return "!", 200

# Страница для автоматической установки вебхука
@app.route('/')
def webhook_setup():
    if not bot or not TOKEN:
        return "BOT_TOKEN not set", 400
    
    bot.remove_webhook()
    render_url = os.environ.get('RENDER_EXTERNAL_URL')
    if render_url:
        bot.set_webhook(url=f"{render_url}/{TOKEN}")
        return "Webhook set successfully!", 200
    return "Render URL not set", 400

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)