# Lottery Parser (Lottery Archive Scraper)

Парсер архива лотереи на Node.js с использованием Puppeteer.  
Скрипт прокручивает страницу до указанной даты и сохраняет данные тиража в CSV.

![demo](docs/demo.mp4)

## Возможности
- Ввод даты (например `2 августа 2025`)
- Сбор: дата, тираж, числа
- Экспорт: `data/results_YYYYMMDD.csv`

## Установка и запуск
```bash
git clone https://github.com/Karen2485/lottery--parser.git
cd lottery--parser
npm install
node parser.js