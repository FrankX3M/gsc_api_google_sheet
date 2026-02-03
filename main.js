// ============================================
// PAGESPEED INSIGHTS MONITORING SCRIPT v5.0
// ============================================
// Изменения v5.0:
//   - Группировка URL по доменам
//   - Компактная таблица: 9 строк на URL (было 18)
//   - Заголовки доменов с цветовым кодированием
// ============================================

const CONFIG = {
  API_KEY: 'YOU_API_KEY',

  // ─── Группировка по доменам ─────────────────
  // Ключ — домен, значение — массив путей.
  // Добавляйте новые домены просто как новые ключи.
  DOMAINS: {
    'example.com': [
      '/',
      '/catalog',
      '/catalog/category_name/',
      '/product/product_api_name/',
    ],
    // 'other-site.com': [
    //   '/',
    //   '/about',
    // ],
  },

  // Цвета заголовков для каждого домена (по кругу, если домен больше чем цветов)
  DOMAIN_COLORS: [
    { bg: '#4285F4', font: '#FFFFFF' }, // синий
    { bg: '#34A853', font: '#FFFFFF' }, // зелёный
    { bg: '#9C27B0', font: '#FFFFFF' }, // фиолетовый
    { bg: '#FF9800', font: '#FFFFFF' }, // оранжевый
    { bg: '#F44336', font: '#FFFFFF' }, // красный
    { bg: '#00BCD4', font: '#FFFFFF' }, // бирюзовый
  ],

  SHEET_NAME: 'PageSpeed Dashboard',
  LOG_SHEET_NAME: 'Логи',

  ENABLE_LOGGING: false,

  MAX_RETRIES: 2,
  RETRY_DELAY: 3,
  REQUEST_DELAY: 2,
  MAX_EXECUTION_TIME: 300,

  // Компактная таблица: 9 строк на URL
  // +0  URL баннер (путь)
  // +1  📱 LCP (сек)
  // +2  📱 INP (мс)
  // +3  📱 CLS
  // +4  📱 Score
  // +5  🖥️ LCP (сек)
  // +6  🖥️ INP (мс)
  // +7  🖥️ CLS
  // +8  🖥️ Score
  ROWS_PER_URL: 9,

  THRESHOLDS: {
    LCP:         { good: 2.5,  needsImprovement: 4   },
    INP:         { good: 200,  needsImprovement: 500 },
    CLS:         { good: 0.1,  needsImprovement: 0.25 },
    PERFORMANCE: { good: 90,   needsImprovement: 50  }
  },

  COLORS: {
    GOOD:             '#34A853',
    NEEDS_IMPROVEMENT: '#FBBC04',
    POOR:             '#EA4335'
  }
};

// ═══════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ: построение плоского списка URL
// ═══════════════════════════════════════════════

// Возвращает массив объектов { domain, path, fullUrl, domainIndex, urlIndexInDomain }
// Порядок: все URL первого домена, затем второго и т.д.
function buildUrlList() {
  const list = [];
  const domains = Object.keys(CONFIG.DOMAINS);
  domains.forEach((domain, dIdx) => {
    CONFIG.DOMAINS[domain].forEach((path, uIdx) => {
      const fullUrl = 'https://' + domain + path;
      list.push({
        domain:           domain,
        path:             path,
        fullUrl:          fullUrl,
        domainIndex:      dIdx,
        urlIndexInDomain: uIdx
      });
    });
  });
  return list;
}

// Кеш списка (пересоздаётся при каждом запуске скрипта)
let _urlList = null;
function getUrlList() {
  if (!_urlList) _urlList = buildUrlList();
  return _urlList;
}

// ═══════════════════════════════════════════════
// РАСЧЁТ ПОЗИЦИЙ СТРОК
// ═══════════════════════════════════════════════

// Строка 1  — заголовок листа
// Строка 2  — дата (frozen)
// Строка 3+ — данные
// Перед каждой группой домена стоит 1 строка-заголовок домена.
// Для каждого URL — ROWS_PER_URL строк.

// Возвращает номер строки (1-based) начала блока для i-го URL в плоском списке
function getStartRowForUrl(flatIndex) {
  const list = getUrlList();
  let row = 3; // начало после frozen-заголовков

  let currentDomain = null;
  for (let i = 0; i <= flatIndex; i++) {
    if (list[i].domain !== currentDomain) {
      // новый домен — добавляем строку-заголовок домена
      row += 1;
      currentDomain = list[i].domain;
    }
    if (i < flatIndex) {
      row += CONFIG.ROWS_PER_URL;
    }
  }
  return row;
}

// Возвращает номер строки заголовка домена для данного доменного индекса
function getDomainHeaderRow(domainIndex) {
  const list = getUrlList();
  let row = 3;
  let currentDomain = null;
  for (let i = 0; i < list.length; i++) {
    if (list[i].domain !== currentDomain) {
      if (list[i].domainIndex === domainIndex) return row;
      row += 1;
      currentDomain = list[i].domain;
    }
    row += CONFIG.ROWS_PER_URL;
  }
  return row;
}

// ═══════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ СБОРА
// ═══════════════════════════════════════════════

function collectPageSpeedData() {
  const startTime = new Date();

  try {
    const sheet   = getOrCreateSheet();
    const urlList = getUrlList();
    const totalUrls = urlList.length;

    Logger.log('=== НАЧАЛО СБОРА ДАННЫХ ===');
    Logger.log(`Время старта: ${startTime}`);
    Logger.log(`Количество URL: ${totalUrls}`);

    logToSheet('ALL', 'СТАРТ', 'INFO', `Начало сбора данных для ${totalUrls} URL`, `Время: ${startTime}`);
    showToast(`🔄 Начинаем сбор данных для ${totalUrls} URL...`, 5);

    const todayCol = getTodayColumn(sheet);

    // Записываем дату в заголовок
    const dateStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    sheet.getRange(2, todayCol).setValue(dateStr);
    sheet.getRange(2, todayCol)
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');

    let successCount = 0;
    let errorCount   = 0;
    let timeoutCount = 0;
    const errors  = [];
    const results = [];

    for (let index = 0; index < urlList.length; index++) {
      const item = urlList[index];
      const urlNumber = index + 1;

      // Проверка лимита времени
      const elapsedTime = (new Date() - startTime) / 1000;
      if (elapsedTime > CONFIG.MAX_EXECUTION_TIME) {
        Logger.log(`⚠️ Приближение к лимиту времени (${Math.round(elapsedTime)}с). Останавливаем.`);
        logToSheet('ALL', 'ТАЙМАУТ', 'WARNING', 'Превышен лимит времени выполнения',
          `Обработано: ${successCount}/${totalUrls}, Время: ${Math.round(elapsedTime)}с`);
        timeoutCount = totalUrls - index;
        break;
      }

      try {
        Logger.log(`\n=== URL ${urlNumber}/${totalUrls}: ${item.fullUrl} ===`);
        logToSheet(item.fullUrl, 'ОБРАБОТКА', 'INFO', `Начало обработки URL ${urlNumber}/${totalUrls}`, '');
        showToast(`🔄 Обработка ${urlNumber}/${totalUrls}: ${item.domain}${item.path}`, 3);

        // Mobile
        Logger.log('Запрос Mobile данных...');
        logToSheet(item.fullUrl, 'API REQUEST', 'INFO', 'Запрос Mobile данных', '');
        const mobileData = fetchDataWithRetry(item.fullUrl, 'mobile');
        validateData(mobileData, 'Mobile');
        logToSheet(item.fullUrl, 'MOBILE', 'SUCCESS',
          `LCP: ${mobileData.lcp.toFixed(2)}, INP: ${mobileData.inp}, CLS: ${mobileData.cls.toFixed(3)}, Score: ${Math.round(mobileData.performanceScore)}`,
          `Full data: ${JSON.stringify(mobileData)}`);

        Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);

        // Desktop
        Logger.log('Запрос Desktop данных...');
        logToSheet(item.fullUrl, 'API REQUEST', 'INFO', 'Запрос Desktop данных', '');
        const desktopData = fetchDataWithRetry(item.fullUrl, 'desktop');
        validateData(desktopData, 'Desktop');
        logToSheet(item.fullUrl, 'DESKTOP', 'SUCCESS',
          `LCP: ${desktopData.lcp.toFixed(2)}, INP: ${desktopData.inp}, CLS: ${desktopData.cls.toFixed(3)}, Score: ${Math.round(desktopData.performanceScore)}`,
          `Full data: ${JSON.stringify(desktopData)}`);

        // Сохраняем
        saveDataToUrlBlock(sheet, index, mobileData, desktopData, todayCol);

        successCount++;
        results.push({ url: item.fullUrl, status: 'success', mobile: Math.round(mobileData.performanceScore), desktop: Math.round(desktopData.performanceScore) });

        Logger.log(`✅ URL ${urlNumber} обработан успешно`);
        logToSheet(item.fullUrl, 'ЗАВЕРШЕНО', 'SUCCESS', 'URL обработан успешно',
          `Mobile: ${Math.round(mobileData.performanceScore)}, Desktop: ${Math.round(desktopData.performanceScore)}`);

        if (index < urlList.length - 1) Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);

      } catch (error) {
        errorCount++;
        const errorMsg = `${item.domain}${item.path}: ${error.message}`;
        errors.push(errorMsg);
        results.push({ url: item.fullUrl, status: 'error', error: error.message });

        Logger.log(`❌ Ошибка для URL ${urlNumber}: ${error.message}`);
        logToSheet(item.fullUrl, 'ОШИБКА', 'ERROR', error.message, `Stack: ${error.stack || 'N/A'}`);
      }
    }

    // ── Итоги ──
    const endTime  = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    Logger.log('\n=== ИТОГИ ===');
    Logger.log(`Время завершения: ${endTime}`);
    Logger.log(`Продолжительность: ${duration} сек`);
    Logger.log(`Успешно: ${successCount}/${totalUrls}`);
    Logger.log(`Ошибок: ${errorCount}/${totalUrls}`);

    logToSheet('ALL', 'ЗАВЕРШЕНИЕ', 'INFO', 'Сбор данных завершен',
      `Успешно: ${successCount}/${totalUrls}, Ошибок: ${errorCount}, Время: ${duration}с`);

    let resultMessage = '✅ Сбор данных завершен!\n\n';
    resultMessage += `Время выполнения: ${duration} сек\n`;
    resultMessage += `Успешно: ${successCount}/${totalUrls}\n`;

    if (errorCount > 0) {
      resultMessage += `Ошибок: ${errorCount}\n`;
      if (CONFIG.ENABLE_LOGGING) resultMessage += '\n⚠️ Проверьте лист "Логи" для деталей!\n';
    }
    if (timeoutCount > 0) {
      resultMessage += `⚠️ Не обработано из-за лимита времени: ${timeoutCount}\n`;
      resultMessage += '\nРекомендация: запустите скрипт для пропущенных URL отдельно через подменю.';
    }
    if (errors.length > 0) {
      resultMessage += '\n\nДетали ошибок:\n';
      errors.forEach(err => { resultMessage += `• ${err}\n`; });
    }
    if (successCount > 0) {
      resultMessage += '\n📊 Собранные данные:\n';
      results.forEach(r => {
        if (r.status === 'success') resultMessage += `• ${r.url}: M${r.mobile} / D${r.desktop}\n`;
      });
    }

    Logger.log('\n' + resultMessage);
    showAlert(resultMessage);

  } catch (error) {
    Logger.log(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    Logger.log(`Stack trace: ${error.stack}`);
    logToSheet('ALL', 'КРИТИЧЕСКАЯ ОШИБКА', 'ERROR', error.message, `Stack: ${error.stack}`);
    handleError(error);
  }
}

// ═══════════════════════════════════════════════
// СБОР ДЛЯ ОДНОГО URL
// ═══════════════════════════════════════════════

function collectDataForSingleUrl(urlIndex) {
  try {
    const urlList = getUrlList();
    if (urlIndex < 0 || urlIndex >= urlList.length) {
      throw new Error(`Неверный индекс URL: ${urlIndex}`);
    }

    const sheet = getOrCreateSheet();
    const item  = urlList[urlIndex];
    const urlNumber = urlIndex + 1;

    Logger.log(`\n=== СБОР ДАННЫХ ДЛЯ URL ${urlNumber} ===`);
    Logger.log(`URL: ${item.fullUrl}`);

    showToast(`🔄 Сбор данных для ${item.domain}${item.path}...`, 5);

    const todayCol = getTodayColumn(sheet);

    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
    sheet.getRange(2, todayCol).setValue(dateStr);
    sheet.getRange(2, todayCol)
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');

    const mobileData  = fetchDataWithRetry(item.fullUrl, 'mobile');
    validateData(mobileData, 'Mobile');

    Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);

    const desktopData = fetchDataWithRetry(item.fullUrl, 'desktop');
    validateData(desktopData, 'Desktop');

    saveDataToUrlBlock(sheet, urlIndex, mobileData, desktopData, todayCol);

    Logger.log('✅ Данные успешно собраны');
    showAlert(`✅ Данные успешно обновлены для:\n${item.fullUrl}\n\nMobile: ${Math.round(mobileData.performanceScore)}\nDesktop: ${Math.round(desktopData.performanceScore)}`);

  } catch (error) {
    Logger.log(`❌ Ошибка: ${error.message}`);
    handleError(error);
  }
}

// ═══════════════════════════════════════════════
// FETCH + RETRY
// ═══════════════════════════════════════════════

function fetchDataWithRetry(url, strategy) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      Logger.log(`Попытка ${attempt}/${CONFIG.MAX_RETRIES} для ${strategy}`);

      if (attempt > 1) {
        const delay = CONFIG.RETRY_DELAY + (attempt * 2);
        Logger.log(`Ждем ${delay} секунд перед повторной попыткой...`);
        logToSheet(url, 'RETRY', 'WARNING', `Повторная попытка ${attempt}/${CONFIG.MAX_RETRIES} для ${strategy}`, `Задержка: ${delay}с`);
        Utilities.sleep(delay * 1000);
      }

      const data = fetchPageSpeedData(url, strategy);
      if (data) {
        Logger.log(`✅ Данные получены для ${strategy}`);
        return data;
      }

    } catch (error) {
      lastError = error;
      Logger.log(`❌ Попытка ${attempt} неудачна: ${error.message}`);

      if (error.message.includes('NO_FCP') || error.message.includes('NO_LCP')) {
        logToSheet(url, 'NO_FCP ERROR', 'WARNING', `Страница не загрузилась (попытка ${attempt})`, error.message);

        if (attempt === CONFIG.MAX_RETRIES) {
          Logger.log('⚠️ Пробуем получить lab данные вместо field данных...');
          try {
            const labData = fetchPageSpeedDataLabOnly(url, strategy);
            if (labData) {
              logToSheet(url, 'FALLBACK', 'WARNING', `Используем lab данные для ${strategy} (field данные недоступны)`, 'NO_FCP обработан');
              return labData;
            }
          } catch (labError) {
            Logger.log(`Не удалось получить даже lab данные: ${labError.message}`);
          }
        }
      }

      if (attempt === CONFIG.MAX_RETRIES) throw error;
    }
  }

  throw lastError || new Error('Не удалось получить данные');
}

function fetchPageSpeedData(url, strategy) {
  const apiUrl = buildApiUrl(url, strategy);

  try {
    logToSheet(url, 'API CALL', 'INFO', `Вызов API для ${strategy}`, `URL: ${apiUrl.substring(0, 100)}...`);

    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    logToSheet(url, 'API RESPONSE', 'INFO', `Ответ API (${strategy}): код ${responseCode}`, `Размер ответа: ${responseText.length} байт`);

    if (responseCode !== 200) {
      const errorMsg = `API error ${responseCode}: ${parseErrorMessage(responseText)}`;
      logToSheet(url, 'API ERROR', 'ERROR', errorMsg, responseText.substring(0, 500));
      throw new Error(errorMsg);
    }

    const json = JSON.parse(responseText);

    if (!json.lighthouseResult) {
      logToSheet(url, 'PARSE ERROR', 'ERROR', 'Lighthouse результаты отсутствуют', JSON.stringify(json).substring(0, 500));
      throw new Error('Lighthouse результаты отсутствуют');
    }

    logToSheet(url, 'PARSE', 'SUCCESS', `JSON успешно распарсен (${strategy})`, 'Lighthouse данные найдены');

    return extractMetrics(json, url, strategy);

  } catch (error) {
    Logger.log('Ошибка API: ' + error.message);
    logToSheet(url, 'EXCEPTION', 'ERROR', `Исключение в fetchPageSpeedData (${strategy})`, error.stack || error.message);
    throw error;
  }
}

function fetchPageSpeedDataLabOnly(url, strategy) {
  const apiUrl = buildApiUrl(url, strategy);

  try {
    logToSheet(url, 'LAB API CALL', 'INFO', `Запрос lab данных для ${strategy}`, 'Fallback режим');

    const response = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: true
    });

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) throw new Error(`Lab API error ${responseCode}`);

    const json = JSON.parse(responseText);
    if (!json.lighthouseResult) throw new Error('Lab Lighthouse результаты отсутствуют');

    return extractLabMetrics(json, url, strategy);

  } catch (error) {
    Logger.log('Ошибка Lab API: ' + error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════
// ПАРСИНГ МЕТРИК
// ═══════════════════════════════════════════════

function extractLabMetrics(json, url, strategy) {
  const audits = json.lighthouseResult?.audits || {};

  const lcp              = (audits['largest-contentful-paint']?.numericValue || 0) / 1000;
  const inp              = audits['interaction-to-next-paint']?.numericValue || 0;
  const cls              = audits['cumulative-layout-shift']?.numericValue || 0;
  const performanceScore = (json.lighthouseResult?.categories?.performance?.score || 0) * 100;

  logToSheet(url, 'LAB METRICS', 'WARNING', `Извлечены lab метрики для ${strategy}`,
    `LCP: ${lcp.toFixed(2)}, INP: ${inp}, CLS: ${cls.toFixed(3)}, Score: ${Math.round(performanceScore)}`);

  return { url, strategy, lcp, inp, cls, performanceScore, date: new Date(), isLabData: true };
}

function buildApiUrl(url, strategy) {
  const params = [
    `url=${encodeURIComponent(url)}`,
    `strategy=${strategy}`,
    `key=${CONFIG.API_KEY}`,
    'category=performance'
  ];
  return `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.join('&')}`;
}

function extractMetrics(json, url, strategy) {
  const metrics = json.loadingExperience?.metrics || {};
  const audits  = json.lighthouseResult?.audits || {};

  const lcp              = getMetricValue(metrics, 'LARGEST_CONTENTFUL_PAINT_MS', audits['largest-contentful-paint']) / 1000;
  const inp              = getMetricValue(metrics, 'INTERACTION_TO_NEXT_PAINT',   audits['interaction-to-next-paint']);
  const cls              = getMetricValue(metrics, 'CUMULATIVE_LAYOUT_SHIFT_SCORE', audits['cumulative-layout-shift']) / 100;
  const performanceScore = (json.lighthouseResult?.categories?.performance?.score || 0) * 100;

  return { url, strategy, lcp, inp, cls, performanceScore, date: new Date() };
}

function getMetricValue(cruxMetrics, cruxKey, labAudit) {
  if (cruxMetrics[cruxKey]?.percentile !== undefined) return cruxMetrics[cruxKey].percentile;
  if (labAudit?.numericValue !== undefined)            return labAudit.numericValue;
  return 0;
}

function parseErrorMessage(responseText) {
  try {
    const errorJson = JSON.parse(responseText);
    return errorJson.error?.message || responseText;
  } catch (e) {
    return responseText;
  }
}

function validateData(data, deviceName) {
  if (!data) throw new Error(`Данные для ${deviceName} отсутствуют`);
  if (data.lcp === 0 && data.cls === 0 && data.performanceScore === 0) {
    throw new Error(`Все метрики для ${deviceName} равны 0`);
  }
  Logger.log(`✅ Данные ${deviceName} валидны`);
}

// ═══════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ ЛИСТА
// ═══════════════════════════════════════════════

function getOrCreateSheet() {
  try {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      Logger.log(`Создание нового листа: ${CONFIG.SHEET_NAME}`);
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG.SHEET_NAME);
      initializeSheet(sheet);
    }
    return sheet;
  } catch (error) {
    Logger.log(`❌ Ошибка при работе с листом: ${error.message}`);
    throw error;
  }
}

function initializeSheet(sheet) {
  try {
    Logger.log('Инициализация листа...');

    // ── Строка 1: заголовок листа ──
    sheet.getRange('A1').setValue('📊 PAGESPEED INSIGHTS DASHBOARD');
    sheet.getRange('A1')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('white');

    // ── Строка 2: «Метрика» + будущие даты ──
    sheet.getRange('A2').setValue('Метрика');
    sheet.getRange('A2')
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(2);
    sheet.setFrozenColumns(1);
    sheet.setColumnWidth(1, 200);

    // ── Заполняем блоки по доменам ──
    const urlList = getUrlList();
    let prevDomain = null;

    urlList.forEach((item, flatIndex) => {
      // Если новый домен — рисуем заголовок-разделитель домена
      if (item.domain !== prevDomain) {
        const domainHeaderRow = getDomainHeaderRow(item.domainIndex);
        initializeDomainHeader(sheet, domainHeaderRow, item.domain, item.domainIndex);
        prevDomain = item.domain;
      }

      // Блок URL
      const startRow = getStartRowForUrl(flatIndex);
      initializeUrlBlock(sheet, startRow, item);
    });

    Logger.log('✅ Лист инициализирован');

  } catch (error) {
    Logger.log(`❌ Ошибка инициализации листа: ${error.message}`);
    throw error;
  }
}

// Заголовок домена — полная строка с цветом
function initializeDomainHeader(sheet, row, domain, domainIndex) {
  const color = CONFIG.DOMAIN_COLORS[domainIndex % CONFIG.DOMAIN_COLORS.length];

  sheet.getRange(row, 1).setValue(`🌐 ${domain.toUpperCase()}`);
  sheet.getRange(row, 1)
    .setFontSize(11)
    .setFontWeight('bold')
    .setBackground(color.bg)
    .setFontColor(color.font)
    .setHorizontalAlignment('left');

  // Растягиваем цвет на несколько столбцов (вперёд, на возможные даты)
  try {
    const lastCol = Math.max(sheet.getLastColumn(), 10);
    sheet.getRange(row, 1, 1, lastCol)
      .setBackground(color.bg)
      .setFontColor(color.font);
    sheet.getRange(row, 1)
      .setFontWeight('bold')
      .setFontSize(11);
  } catch (e) { /* ignore */ }
}

// Компактный блок одного URL (9 строк)
function initializeUrlBlock(sheet, startRow, item) {
  const domainColor = CONFIG.DOMAIN_COLORS[item.domainIndex % CONFIG.DOMAIN_COLORS.length];

  // Полупрозрачный тон цвета домена для баннера URL
  const urlBannerBg = lightenHex(domainColor.bg, 0.85); // очень светлый оттенок

  const labels = [
    item.path === '/' ? '/ (главная)' : item.path,   // +0  URL баннер
    '📱 LCP (сек)',                                   // +1
    '📱 INP (мс)',                                    // +2
    '📱 CLS',                                         // +3
    '📱 Score',                                       // +4
    '🖥️ LCP (сек)',                                  // +5
    '🖥️ INP (мс)',                                   // +6
    '🖥️ CLS',                                        // +7
    '🖥️ Score',                                      // +8
  ];

  sheet.getRange(startRow, 1, labels.length, 1)
    .setValues(labels.map(l => [l]));

  // ── Стили баннера URL ──
  sheet.getRange(startRow, 1)
    .setFontSize(10)
    .setFontWeight('bold')
    .setBackground(urlBannerBg)
    .setFontColor(domainColor.bg) // текст цвета домена
    .setWrap(true);

  // ── Фон мобильных строк (лёгкий синий) ──
  sheet.getRange(startRow + 1, 1, 4, 1)
    .setBackground('#F0F4FF')
    .setFontSize(9);

  // ── Фон десктоп строк (лёгкий оранжевый) ──
  sheet.getRange(startRow + 5, 1, 4, 1)
    .setBackground('#FFF8F0')
    .setFontSize(9);

  // ── Высота строк (плотнее) ──
  sheet.setRowHeights(startRow, labels.length, 20);
}

// Lighten hex color: factor 0..1 (1 = белый)
function lightenHex(hex, factor) {
  const num   = parseInt(hex.replace('#', ''), 16);
  const r     = (num >> 16) & 0xff;
  const g     = (num >> 8)  & 0xff;
  const b     = num & 0xff;
  const toHex = v => ('0' + Math.round(v + (255 - v) * factor).toString(16)).slice(-2);
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ═══════════════════════════════════════════════
// СОХРАНЕНИЕ ДАННЫХ
// ═══════════════════════════════════════════════

function saveDataToUrlBlock(sheet, flatIndex, mobileData, desktopData, dataCol) {
  try {
    const startRow = getStartRowForUrl(flatIndex);

    // Компактная структура значений (9 строк):
    // +0  — пустой (баннер URL, уже заполнен)
    // +1  📱 LCP
    // +2  📱 INP
    // +3  📱 CLS
    // +4  📱 Score
    // +5  🖥️ LCP
    // +6  🖥️ INP
    // +7  🖥️ CLS
    // +8  🖥️ Score
    const values = [
      [''],                          // +0 баннер
      [mobileData.lcp],             // +1
      [mobileData.inp],             // +2
      [mobileData.cls],             // +3
      [mobileData.performanceScore],// +4
      [desktopData.lcp],            // +5
      [desktopData.inp],            // +6
      [desktopData.cls],            // +7
      [desktopData.performanceScore] // +8
    ];

    sheet.getRange(startRow, dataCol, values.length, 1).setValues(values);

    // Форматирование чисел
    formatCompactColumn(sheet, startRow, dataCol);

    // Цветовое кодирование по thresholds
    applyCompactColorCoding(sheet, startRow, dataCol, mobileData, desktopData);

    // Фон блоков mobile / desktop в колонке данных
    sheet.getRange(startRow + 1, dataCol, 4, 1).setBackground('#F0F4FF');
    sheet.getRange(startRow + 5, dataCol, 4, 1).setBackground('#FFF8F0');

    // Примечание для lab данных
    if (mobileData.isLabData || desktopData.isLabData) {
      let note = 'ℹ️ Lab данные (field данные недоступны из-за NO_FCP)\n\n';
      if (mobileData.isLabData)  note += 'Mobile: Lab данные\n';
      if (desktopData.isLabData) note += 'Desktop: Lab данные\n';
      sheet.getRange(startRow, dataCol).setNote(note);
      logToSheet(mobileData.url, 'NOTE', 'WARNING', 'Добавлено примечание о lab данных', note);
    }

    sheet.autoResizeColumn(dataCol);
    Logger.log('✅ Данные сохранены');

  } catch (error) {
    Logger.log(`❌ Ошибка сохранения: ${error.message}`);
    throw error;
  }
}

function formatCompactColumn(sheet, startRow, col) {
  try {
    // Mobile: LCP(+1), INP(+2), CLS(+3), Score(+4)
    sheet.getRange(startRow + 1, col).setNumberFormat('0.00');   // LCP
    sheet.getRange(startRow + 2, col).setNumberFormat('0');      // INP
    sheet.getRange(startRow + 3, col).setNumberFormat('0.000');  // CLS
    sheet.getRange(startRow + 4, col).setNumberFormat('0');      // Score

    // Desktop: LCP(+5), INP(+6), CLS(+7), Score(+8)
    sheet.getRange(startRow + 5, col).setNumberFormat('0.00');   // LCP
    sheet.getRange(startRow + 6, col).setNumberFormat('0');      // INP
    sheet.getRange(startRow + 7, col).setNumberFormat('0.000');  // CLS
    sheet.getRange(startRow + 8, col).setNumberFormat('0');      // Score
  } catch (error) {
    Logger.log(`⚠️ Ошибка форматирования: ${error.message}`);
  }
}

function applyCompactColorCoding(sheet, startRow, col, mobileData, desktopData) {
  try {
    // Mobile
    applyCellColor(sheet, startRow + 1, col, mobileData.lcp,             'LCP');
    applyCellColor(sheet, startRow + 2, col, mobileData.inp,             'INP');
    applyCellColor(sheet, startRow + 3, col, mobileData.cls,             'CLS');
    applyCellColor(sheet, startRow + 4, col, mobileData.performanceScore,'PERFORMANCE');

    // Desktop
    applyCellColor(sheet, startRow + 5, col, desktopData.lcp,             'LCP');
    applyCellColor(sheet, startRow + 6, col, desktopData.inp,             'INP');
    applyCellColor(sheet, startRow + 7, col, desktopData.cls,             'CLS');
    applyCellColor(sheet, startRow + 8, col, desktopData.performanceScore,'PERFORMANCE');
  } catch (error) {
    Logger.log(`⚠️ Ошибка цветового кодирования: ${error.message}`);
  }
}

function applyCellColor(sheet, row, col, value, metricType) {
  try {
    const color = getColorForMetric(value, metricType);
    sheet.getRange(row, col)
      .setBackground(color)
      .setFontColor('white')
      .setFontWeight('bold');
  } catch (error) {
    Logger.log(`⚠️ Ошибка применения цвета: ${error.message}`);
  }
}

function getColorForMetric(value, metricType) {
  const thresholds = CONFIG.THRESHOLDS[metricType];
  if (!thresholds) return CONFIG.COLORS.GOOD;

  if (value <= thresholds.good)            return CONFIG.COLORS.GOOD;
  if (value <= thresholds.needsImprovement) return CONFIG.COLORS.NEEDS_IMPROVEMENT;
  return CONFIG.COLORS.POOR;
}

// ═══════════════════════════════════════════════
// КОЛОНКА ДАТЫ
// ═══════════════════════════════════════════════

function getTodayColumn(sheet) {
  const today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
  const lastCol = sheet.getLastColumn();

  for (let col = 2; col <= lastCol; col++) {
    const cellValue = sheet.getRange(2, col).getValue();
    if (cellValue && cellValue.toString() === today) {
      Logger.log(`Найдена колонка для сегодня: ${col}`);
      return col;
    }
  }

  const newCol = lastCol + 1;
  Logger.log(`Создается новая колонка для сегодня: ${newCol}`);
  return newCol;
}

// ═══════════════════════════════════════════════
// ЛОГИРОВАНИЕ
// ═══════════════════════════════════════════════

function getOrCreateLogSheet() {
  if (!CONFIG.ENABLE_LOGGING) return null;

  try {
    let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG.LOG_SHEET_NAME);
      initializeLogSheet(logSheet);
    }
    return logSheet;
  } catch (error) {
    Logger.log(`⚠️ Не удалось создать лист логов: ${error.message}`);
    return null;
  }
}

function initializeLogSheet(sheet) {
  try {
    sheet.getRange('A1').setValue('📋 ЛОГИ СБОРА ДАННЫХ PAGESPEED INSIGHTS');
    sheet.getRange('A1')
      .setFontSize(12)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('white');

    const headers = [['Дата/Время', 'URL', 'Тип', 'Статус', 'Сообщение', 'Детали']];
    sheet.getRange('A2:F2').setValues(headers);
    sheet.getRange('A2:F2')
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(2);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 100);
    sheet.setColumnWidth(4, 80);
    sheet.setColumnWidth(5, 250);
    sheet.setColumnWidth(6, 400);

    Logger.log('✅ Лист логов инициализирован');
  } catch (error) {
    Logger.log(`⚠️ Ошибка инициализации листа логов: ${error.message}`);
  }
}

function logToSheet(url, type, status, message, details) {
  if (!CONFIG.ENABLE_LOGGING) return;

  try {
    const logSheet = getOrCreateLogSheet();
    if (!logSheet) return;

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss');
    const lastRow   = logSheet.getLastRow();
    const newRow    = lastRow + 1;

    logSheet.getRange(newRow, 1, 1, 6).setValues([[timestamp, url, type, status, message, details || '']]);

    const statusCell = logSheet.getRange(newRow, 4);
    if      (status === 'SUCCESS' || status === 'OK')   statusCell.setBackground('#34A853').setFontColor('white');
    else if (status === 'ERROR'   || status === 'FAIL') statusCell.setBackground('#EA4335').setFontColor('white');
    else if (status === 'WARNING')                      statusCell.setBackground('#FBBC04').setFontColor('white');
    else if (status === 'INFO')                         statusCell.setBackground('#4285F4').setFontColor('white');

    logSheet.setRowHeight(newRow, 30);

  } catch (error) {
    Logger.log(`⚠️ Ошибка записи в лог: ${error.message}`);
  }
}

function viewLogs() {
  if (!CONFIG.ENABLE_LOGGING) {
    showAlert('ℹ️ Логирование отключено в CONFIG.ENABLE_LOGGING');
    return;
  }

  try {
    const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      showAlert('ℹ️ Лист с логами еще не создан.\n\nЛоги будут создаваться автоматически при сборе данных.');
      return;
    }

    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(logSheet);
    const lastRow = logSheet.getLastRow();
    const logCount = lastRow > 2 ? lastRow - 2 : 0;
    showAlert(`📜 Лист с логами открыт!\n\nВсего записей: ${logCount}\n\nПоследние записи показаны внизу таблицы.`);
    if (lastRow > 2) logSheet.setActiveRange(logSheet.getRange(lastRow, 1));

  } catch (error) {
    Logger.log(`❌ Ошибка просмотра логов: ${error.message}`);
    showAlert(`❌ Ошибка просмотра логов:\n\n${error.message}`);
  }
}

function clearLogs() {
  if (!CONFIG.ENABLE_LOGGING) {
    showAlert('ℹ️ Логирование отключено в CONFIG.ENABLE_LOGGING');
    return;
  }

  try {
    const logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (logSheet) {
      const lastRow = logSheet.getLastRow();
      if (lastRow > 2) {
        logSheet.getRange(3, 1, lastRow - 2, 6).clear();
        showAlert('✅ Логи очищены!');
      } else {
        showAlert('ℹ️ Логи уже пусты');
      }
    } else {
      showAlert('ℹ️ Лист с логами не найден');
    }
  } catch (error) {
    Logger.log(`❌ Ошибка очистки логов: ${error.message}`);
    showAlert(`❌ Ошибка очистки логов:\n\n${error.message}`);
  }
}

// ═══════════════════════════════════════════════
// УПРАВЛЕНИЕ ЛИСТОМ + URL
// ═══════════════════════════════════════════════

function manageUrls() {
  const ui = SpreadsheetApp.getUi();
  const domains = Object.keys(CONFIG.DOMAINS);

  let message = 'Текущие URL для мониторинга:\n\n';
  domains.forEach(domain => {
    message += `🌐 ${domain}\n`;
    CONFIG.DOMAINS[domain].forEach(path => {
      message += `   └─ ${path}\n`;
    });
    message += '\n';
  });

  message += '⚠️ Для изменения списка:\n';
  message += '1. Расширения → Apps Script\n';
  message += '2. Найдите объект CONFIG.DOMAINS\n';
  message += '3. Добавьте/удалите домены и пути\n';
  message += '4. Сохраните (Ctrl+S)\n';
  message += '5. Запустите "Пересоздать структуру листа"';

  ui.alert('📋 Список URL', message, ui.ButtonSet.OK);
}

function recreateSheet() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Пересоздать лист?',
      'Это удалит все существующие данные и историю.\n\nПродолжить?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
      if (sheet) SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
      getOrCreateSheet();
      showAlert('✅ Лист пересоздан!');
    }
  } catch (error) {
    Logger.log(`❌ Ошибка пересоздания листа: ${error.message}`);
    showAlert(`❌ Ошибка: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════
// ТРИГГЕРЫ + РАСПИСАНИЕ
// ═══════════════════════════════════════════════

function setupDailyTrigger() {
  deleteAllTriggers();
  ScriptApp.newTrigger('collectPageSpeedData')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  const timezone = Session.getScriptTimeZone();
  showAlert(`✅ Ежедневный сбор настроен на 9:00\n\nЧасовой пояс: ${timezone}\n\n✅ Триггеры не имеют лимита времени 6 минут!`);
}

function setupWeeklyTrigger() {
  deleteAllTriggers();
  ScriptApp.newTrigger('collectPageSpeedData')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  const timezone = Session.getScriptTimeZone();
  showAlert(`✅ Еженедельный сбор настроен на понедельник 9:00\n\nЧасовой пояс: ${timezone}\n\n✅ Триггеры не имеют лимита времени 6 минут!`);
}

function setupCustomSchedule() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Настройка расписания',
    'Введите час для ежедневного запуска (0-23):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const hour = parseInt(response.getResponseText());
    if (hour >= 0 && hour <= 23) {
      deleteAllTriggers();
      ScriptApp.newTrigger('collectPageSpeedData')
        .timeBased()
        .everyDays(1)
        .atHour(hour)
        .create();

      const timezone = Session.getScriptTimeZone();
      ui.alert(`✅ Ежедневный сбор настроен на ${hour}:00\n\nЧасовой пояс: ${timezone}\n\n✅ Триггеры не имеют лимита времени 6 минут!`);
    } else {
      ui.alert('❌ Неверное значение! Введите число от 0 до 23');
    }
  }
}

function viewTimezoneInfo() {
  const ui       = SpreadsheetApp.getUi();
  const timezone = Session.getScriptTimeZone();
  const formattedTime = Utilities.formatDate(new Date(), timezone, 'dd.MM.yyyy HH:mm:ss');

  let message = '🕐 ИНФОРМАЦИЯ О ЧАСОВОМ ПОЯСЕ\n\n';
  message += `Часовой пояс: ${timezone}\n`;
  message += `Текущее время: ${formattedTime}\n\n`;
  message += '📌 ВАЖНО:\n';
  message += '• Триггеры используют этот часовой пояс\n';
  message += '• Для изменения используйте "Изменить часовой пояс"';

  ui.alert('Часовой пояс', message, ui.ButtonSet.OK);
}

function changeTimezone() {
  const ui              = SpreadsheetApp.getUi();
  const currentTimezone = Session.getScriptTimeZone();

  const response = ui.prompt(
    'Изменить часовой пояс',
    `Текущий: ${currentTimezone}\n\nВведите новый (например: Europe/Moscow):`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const newTimezone = response.getResponseText().trim();
    if (newTimezone && newTimezone.length > 0) {
      try {
        Utilities.formatDate(new Date(), newTimezone, 'HH:mm'); // валидация
        SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(newTimezone);
        const formattedTime = Utilities.formatDate(new Date(), newTimezone, 'dd.MM.yyyy HH:mm:ss');
        ui.alert(`✅ Часовой пояс изменен!\n\nНовый: ${newTimezone}\nВремя: ${formattedTime}`);
      } catch (error) {
        ui.alert(`❌ Неверный часовой пояс: ${newTimezone}`);
      }
    }
  }
}

function deleteAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function removeTriggers() {
  deleteAllTriggers();
  showAlert('✅ Все триггеры удалены');
}

function viewCurrentTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    showAlert('ℹ️ Нет активных триггеров');
    return;
  }

  let message = 'Активные триггеры:\n\n';
  triggers.forEach((trigger, index) => {
    message += `${index + 1}. ${trigger.getHandlerFunction()} - ${trigger.getEventType()}\n`;
  });
  showAlert(message);
}

// ═══════════════════════════════════════════════
// МЕНЮ
// ═══════════════════════════════════════════════

function onOpen() {
  const ui      = SpreadsheetApp.getUi();
  const urlList = getUrlList();
  const domains = Object.keys(CONFIG.DOMAINS);

  // ── Подменю «Собрать по одному URL», сгруппировано по доменам ──
  const urlMenu = ui.createMenu('📍 Собрать для одного URL');

  let flatIndex = 0;
  domains.forEach(domain => {
    const domainSubMenu = ui.createMenu(`🌐 ${domain}`);
    CONFIG.DOMAINS[domain].forEach((path) => {
      const label = path === '/' ? '/ (главная)' : path;
      domainSubMenu.addItem(label, `collectUrl${flatIndex}`);
      flatIndex++;
    });
    urlMenu.addSubMenu(domainSubMenu);
  });

  // ── Главное меню ──
  const menu = ui.createMenu('📊 PageSpeed Monitoring')
    .addItem('🔄 Собрать данные для ВСЕХ URL', 'collectPageSpeedData')
    .addSubMenu(urlMenu)
    .addSeparator()
    .addItem('📋 Показать список URL', 'manageUrls')
    .addItem('🔨 Пересоздать структуру листа', 'recreateSheet')
    .addSeparator();

  if (CONFIG.ENABLE_LOGGING) {
    menu.addItem('📜 Посмотреть логи', 'viewLogs')
        .addItem('🗑️ Очистить логи', 'clearLogs')
        .addSeparator();
  }

  menu.addItem('⏰ Ежедневный сбор', 'setupDailyTrigger')
      .addItem('📅 Еженедельный сбор', 'setupWeeklyTrigger')
      .addItem('⚙️ Свое время запуска', 'setupCustomSchedule')
      .addSeparator()
      .addItem('🕐 Показать часовой пояс', 'viewTimezoneInfo')
      .addItem('🌍 Изменить часовой пояс', 'changeTimezone')
      .addSeparator()
      .addItem('👁️ Активные триггеры', 'viewCurrentTriggers')
      .addItem('🛑 Отключить автосбор', 'removeTriggers')
      .addToUi();
}

// ═══════════════════════════════════════════════
// WRAPPER-ФУНКЦИИ для меню (поддержка до 10 URL)
// ═══════════════════════════════════════════════
function collectUrl0() { collectDataForSingleUrl(0); }
function collectUrl1() { collectDataForSingleUrl(1); }
function collectUrl2() { collectDataForSingleUrl(2); }
function collectUrl3() { collectDataForSingleUrl(3); }
function collectUrl4() { collectDataForSingleUrl(4); }
function collectUrl5() { collectDataForSingleUrl(5); }
function collectUrl6() { collectDataForSingleUrl(6); }
function collectUrl7() { collectDataForSingleUrl(7); }
function collectUrl8() { collectDataForSingleUrl(8); }
function collectUrl9() { collectDataForSingleUrl(9); }
function collectUrl10() { collectDataForSingleUrl(10); }
function collectUrl11() { collectDataForSingleUrl(11); }
function collectUrl12() { collectDataForSingleUrl(12); }
function collectUrl13() { collectDataForSingleUrl(13); }
function collectUrl14() { collectDataForSingleUrl(14); }
function collectUrl15() { collectDataForSingleUrl(15); }
function collectUrl16() { collectDataForSingleUrl(16); }
function collectUrl17() { collectDataForSingleUrl(17); }
function collectUrl18() { collectDataForSingleUrl(18); }
function collectUrl19() { collectDataForSingleUrl(19); }

// ═══════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════

function showToast(message, duration) {
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, 'PageSpeed', duration);
  } catch (error) {
    Logger.log(`⚠️ Toast: ${error.message}`);
  }
}

function showAlert(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}

function handleError(error) {
  Logger.log('❌ Ошибка: ' + error.message);

  let errorMessage = '❌ Ошибка:\n\n' + error.message;

  if (error.message.includes('Exceeded maximum execution time')) {
    errorMessage += '\n\n💡 Превышен лимит времени выполнения (6 минут).\n\n';
    errorMessage += 'Рекомендации:\n';
    errorMessage += '• Уменьшите количество URL в CONFIG.DOMAINS\n';
    errorMessage += '• Собирайте данные по одному URL через подменю\n';
    errorMessage += '• Используйте автоматический сбор (триггеры)';
  } else if (error.message.includes('NO_FCP') || error.message.includes('NO_LCP')) {
    errorMessage += '\n\n💡 ОШИБКА NO_FCP - Страница не загрузилась\n\n';
    errorMessage += 'Возможные причины:\n';
    errorMessage += '• Страница требует авторизации или cookies\n';
    errorMessage += '• Слишком долгое время загрузки (>30 сек)\n';
    errorMessage += '• Страница блокирует роботов (robots.txt или User-Agent)\n';
    errorMessage += '• Страница использует защиту от DDoS\n';
    errorMessage += '• Временные проблемы с сервером\n\n';
    errorMessage += '✅ Решения:\n';
    errorMessage += '• Попробуйте запустить сбор повторно через несколько минут\n';
    errorMessage += '• Проверьте доступность URL в обычном браузере\n';
    errorMessage += '• Если проблема повторяется - URL может быть недоступен для API';
  } else if (error.message.includes('API error 429')) {
    errorMessage += '\n\n💡 Превышен лимит API (429 Too Many Requests).\n\n';
    errorMessage += 'Решение:\n';
    errorMessage += '• Подождите 5-10 минут\n';
    errorMessage += '• Google ограничивает количество запросов в день\n';
    errorMessage += '• Используйте триггеры для автоматического сбора';
  } else if (error.message.includes('API error 400')) {
    errorMessage += '\n\n💡 Неверный запрос к API (400 Bad Request).\n\n';
    errorMessage += 'Проверьте:\n';
    errorMessage += '• Корректность URL (должен начинаться с https://)\n';
    errorMessage += '• Правильность API ключа в CONFIG.API_KEY';
  } else if (error.message.includes('API error 500')) {
    errorMessage += '\n\n💡 Внутренняя ошибка сервера Google (500).\n\n';
    errorMessage += 'Это временная проблема на стороне Google.\n';
    errorMessage += 'Подождите несколько минут и попробуйте снова.';
  }

  if (CONFIG.ENABLE_LOGGING) {
    errorMessage += '\n\n📜 Проверьте детали в листе "Логи"';
  }

  showAlert(errorMessage);
}