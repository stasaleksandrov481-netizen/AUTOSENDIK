import asyncio
import os
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart

# Токен будем получать из настроек хостинга для безопасности
TOKEN = os.environ.get("BOT_TOKEN")

bot = Bot(token=TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start_cmd(message: types.Message):
    text = (
        "🏁 **Добро пожаловать в AutoSyndicate!**\n\n"
        "Построй собственную авто-империю, не выходя из Telegram:\n\n"
        "🏎 **Гараж и автосалон:** Покупай легендарные тачки и прокачивай их мощность.\n"
        "⚔️ **PvP-Дуэли:** Вызывай друзей на гонки прямо в чатах!\n"
        "🎰 **Казино и события:** Рискуй, зарабатывай авто-коины и забирай редкие награды.\n"
        "🚔 **Полицейские погони:** Уходи от облав и спасай свою репутацию.\n\n"
        "Жми кнопку ниже и делай свой первый вызов! 👇"
    )
    await message.answer(text, parse_mode="Markdown")


async def main():
    print("Бот успешно запущен!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())