const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

// Список месяцев на русском
const months = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

// Проверка корректности даты (дд месяц гггг)
function validateFullDateInput(input) {
  const parts = input.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 3) return { valid: false, message: 'Введите дату в формате "2 августа 2025".' };

  const day = parseInt(parts[0], 10);
  const monthName = parts[1];
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || day < 1 || day > 31) {
    return { valid: false, message: 'Неверный день месяца.' };
  }

  const monthIndex = months.indexOf(monthName);
  if (monthIndex === -1) {
    return { valid: false, message: 'Неверное название месяца.' };
  }

  if (isNaN(year) || year < 2000 || year > 2100) {
    return { valid: false, message: 'Неверный год.' };
  }

  const inputDate = new Date(year, monthIndex, day);
  const today = new Date();

  if (inputDate > today) {
    return { valid: false, message: 'Дата не может быть в будущем.' };
  }

  return { valid: true, fullDate: input, dayMonth: `${day} ${monthName}`, year };
}

// Запрос даты у пользователя
function askFullDate() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    function prompt() {
      rl.question('📅 До какой даты хотите извлечь данные? (формат: 2 августа 2025): ', answer => {
        const check = validateFullDateInput(answer);
        if (!check.valid) {
          console.log(`❌ ${check.message}`);
          prompt();
        } else {
          rl.close();
          resolve(check);
        }
      });
    }
    prompt();
  });
}

// Скроллим, пока не найдём нужную дату (без года)
async function scrollUntilDate(page, targetDayMonth, stepPx = 300, intervalMs = 200, waitAfterVisibleMs = 1000) {
  console.log(`🔽 Скроллим, пока не появится дата "${targetDayMonth}"...`);

  while (true) {
    const isDateVisible = await page.evaluate((target) => {
      const dateCells = document.querySelectorAll('.TBody_dateCell__O2_YI');
      for (const cell of dateCells) {
        const cellText = cell.innerText.replace(/\s+/g, ' ').trim().toLowerCase();
        if (cellText.includes(target.toLowerCase())) {
          return true;
        }
      }
      return false;
    }, targetDayMonth);

    if (isDateVisible) {
      console.log(`✅ Дата "${targetDayMonth}" найдена!`);
      break;
    }

    const isLogoVisible = await page.evaluate(() => {
      const logo = document.querySelector('use[href="#logo-horizontal-2.aae2731c"]');
      if (!logo) return false;
      const rect = logo.ownerSVGElement?.getBoundingClientRect();
      return rect && rect.top >= 0 && rect.bottom <= window.innerHeight;
    });

    if (isLogoVisible) {
      await delay(waitAfterVisibleMs);
    } else {
      await page.evaluate((step) => window.scrollBy(0, step), stepPx);
      await delay(intervalMs);
    }
  }
}

(async () => {
  try {
    const { fullDate, dayMonth, year } = await askFullDate();

    console.log(`📌 Запрошенная дата: ${fullDate} (ищем на сайте по: "${dayMonth}")`);

    console.log('🚀 Запуск Puppeteer...');
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    });

    const page = await browser.newPage();
    const url = 'https://www.stoloto.ru/zabava/archive';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('🌐 Страница загружена:', url);

    await page.waitForSelector('.ArchiveTableRow_drawNumber___1Cj4', { timeout: 60000 });

    await scrollUntilDate(page, dayMonth);

    const rowsData = await page.evaluate(() => {
      const results = [];
      let currentDate = '';
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const dateCell = row.querySelector('.TBody_dateCell__O2_YI');
        if (dateCell) {
          currentDate = dateCell.innerText.trim();
        }

        const drawEl = row.querySelector('.ArchiveTableRow_drawNumber___1Cj4');
        const numberBtns = row.querySelectorAll('button.ArchiveTableRow_btn__ns2zz');
        if (drawEl && numberBtns.length === 12) {
          const drawNumber = drawEl.innerText.replace(/[^\d]/g, '');
          const numbers = Array.from(numberBtns).map(btn => btn.innerText.trim()).join(' ');
          results.push({
            date: currentDate,
            time: '',
            draw: drawNumber,
            numbers: numbers
          });
        }
      }

      return results;
    });

    console.log('🎯 Получено записей:', rowsData.length);
    console.table(rowsData.slice(0, 5));

    const csvHeader = '\uFEFFDate,Time,DrawNumber,Numbers\n';
    const csvRows = rowsData.map(r => `${r.date},${r.time},${r.draw},"${r.numbers}"`).join('\n');
    const csvContent = csvHeader + csvRows;
    fs.writeFileSync('draws_full.csv', csvContent, 'utf8');
    console.log('💾 Сохранено в draws_full.csv (с BOM)');

    await browser.close();
  } catch (error) {
    console.error('❌ Ошибка в скрипте:', error);
  }
})();
