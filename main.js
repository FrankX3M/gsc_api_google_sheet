// ============================================
// PAGESPEED INSIGHTS MONITORING
// Исправленная версия с улучшенным логированием
// FIX: Перезапись данных в той же колонке при повторном запуске в тот же день
// FIX v2: Корректный поиск существующей колонки с датой
// ============================================

const CONFIG = {
  API_KEY: 'AIzaSyCBibWwba4qgIoZbTsLjVniunnbh9FUGpI',

  // ─── Группировка по доменам ─────────────────
  // Ключ — домен, значение — массив путей.
  // Добавляйте новые домены просто как новые ключи.

  DOMAINS: {
      '5ka.ru': [
        '/',
        '/catalog/',
        '/catalog/ovoshchi-frukty-orekhi--251C12886/',
        '/product/ogurets-global-village-agromos-dlinnyy-1sht--3333628/',
      ],
      'perekrestok.ru': [
        '/',   
        '/delivery',
        '/delivery/saint-petersburg',
        '/cat',
        '/cat/mc/113/moloko-syr-ajca',
        '/cat/c/114/moloko',
        '/cat/114/p/moloko-prostokvasino-pasterizovannoe-2-5-bzmz-930ml-2093081',
        '/cat/b/10310/prostokvasino',
        '/cat/b/10310/prostokvasino/114/moloko',
        '/cat/d',
        '/cat/d/32/salaty',
        '/shops',
        '/shops/saint-petersburg',
      ],
      'chizhik.club': [
        '/',
        '/catalog/inout/',
        '/catalog/molochnye-produkty-iaitsa/product_moloko-svetaevo-tselnoe-sgushchionnoe-s-sakhar-773/',
        
      ],
    },

 // Цвета заголовков для каждого домена (по кругу, если домен больше чем цветов)
  DOMAIN_COLORS: [
    { bg: '#2979FF', font: '#FFFFFF' }, // яркий синий (Material Design Blue A400)
    { bg: '#00C853', font: '#FFFFFF' }, // яркий зелёный (Material Design Green A700)
    { bg: '#D500F9', font: '#FFFFFF' }, // яркий фиолетовый (Material Design Purple A400)
    { bg: '#FF6D00', font: '#FFFFFF' }, // яркий оранжевый (Material Design Orange A700)
    { bg: '#FF1744', font: '#FFFFFF' }, // яркий красный (Material Design Red A400)
    { bg: '#00E5FF', font: '#000000' }, // яркий бирюзовый (Material Design Cyan A400)
  ],

  SHEET_NAME: 'PageSpeed Dashboard',
  LOG_SHEET_NAME: 'Логи',

  ENABLE_LOGGING: false,

  MAX_RETRIES: 1,        // Было 2 - уменьшаем до 1 retry
  RETRY_DELAY: 2,        // Было 3 - уменьшаем задержку
  REQUEST_DELAY: 1,      // Было 2 - уменьшаем паузу между запросами
  MAX_EXECUTION_TIME: 330, // Было 300 (5 мин) - увеличиваем до 5.5 минут
  
  // Если true - при NO_FCP сразу пропускаем URL (быстрее)
  // Если false - пытаемся получить lab данные (медленнее, но полнее)
  SKIP_NO_FCP: false,
  
  // Батч-обработка для больших списков URL
  // Установите BATCH_MODE: true и настройте BATCH_START/BATCH_SIZE
  BATCH_MODE: false,      // true = обрабатывать только батч
  BATCH_START: 0,         // с какого URL начинать (0, 5, 10, 15...)
  BATCH_SIZE: 5,          // сколько URL обработать за раз

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
    GOOD:             '#00C853',  // Яркий изумрудно-зелёный (Material Design Green A700)
    NEEDS_IMPROVEMENT: '#FF9100',  // Яркий оранжевый (Material Design Orange A700)
    POOR:             '#FF1744'   // Яркий красный (Material Design Red A400)
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
  
  Logger.log(`\n╔═══════════════════════════════════════════════╗`);
  Logger.log(`║        ПОСТРОЕНИЕ СПИСКА URL                 ║`);
  Logger.log(`╚═══════════════════════════════════════════════╝`);
  Logger.log(`Всего доменов в CONFIG: ${domains.length}`);
  Logger.log(`Список доменов: ${domains.join(', ')}`);
  
  domains.forEach((domain, dIdx) => {
    Logger.log(`\n━━━ Домен ${dIdx + 1}/${domains.length}: ${domain} ━━━`);
    
    const paths = CONFIG.DOMAINS[domain];
    
    // Валидация
    if (!Array.isArray(paths)) {
      const errorMsg = `CONFIG.DOMAINS['${domain}'] не является массивом!`;
      Logger.log(`❌ ОШИБКА: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    Logger.log(`Количество путей: ${paths.length}`);
    
    paths.forEach((path, uIdx) => {
      const fullUrl = 'https://' + domain + path;
      const urlObj = {
        domain:           domain,
        path:             path,
        fullUrl:          fullUrl,
        domainIndex:      dIdx,
        urlIndexInDomain: uIdx
      };
      list.push(urlObj);
      Logger.log(`  ${uIdx + 1}. ${fullUrl}`);
    });
  });
  
  Logger.log(`\n╔═══════════════════════════════════════════════╗`);
  Logger.log(`║        ИТОГО ПОСТРОЕНО URL: ${list.length}              ║`);
  Logger.log(`╚═══════════════════════════════════════════════╝`);
  
  // Разбивка по доменам
  Logger.log(`\nРазбивка по доменам:`);
  domains.forEach(domain => {
    const count = list.filter(u => u.domain === domain).length;
    Logger.log(`  • ${domain}: ${count} URL`);
  });
  Logger.log(`${'═'.repeat(50)}\n`);
  
  return list;
}

// УБРАНО КЕШИРОВАНИЕ - всегда строим список заново
// Это критично для корректной работы с триггерами
function getUrlList() {
  return buildUrlList();
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
    Logger.log(`\n${'═'.repeat(60)}`);
    Logger.log(`║ ЗАПУСК СБОРА ДАННЫХ PAGESPEED INSIGHTS`);
    Logger.log(`║ Время старта: ${startTime}`);
    Logger.log(`${'═'.repeat(60)}\n`);
    
    // ━━━ ВАЛИДАЦИЯ КОНФИГУРАЦИИ ━━━
    Logger.log(`\n╔════════════════════════════════════════╗`);
    Logger.log(`║   ПРОВЕРКА КОНФИГУРАЦИИ               ║`);
    Logger.log(`╚════════════════════════════════════════╝`);
    
    Logger.log(`\n--- Цвета ---`);
    Logger.log(`CONFIG.COLORS.GOOD: ${CONFIG.COLORS.GOOD}`);
    Logger.log(`CONFIG.COLORS.NEEDS_IMPROVEMENT: ${CONFIG.COLORS.NEEDS_IMPROVEMENT}`);
    Logger.log(`CONFIG.COLORS.POOR: ${CONFIG.COLORS.POOR}`);
    
    Logger.log(`\n--- Пороги ---`);
    Logger.log(JSON.stringify(CONFIG.THRESHOLDS, null, 2));
    
    Logger.log(`\n--- Домены ---`);
    const domains = Object.keys(CONFIG.DOMAINS);
    Logger.log(`Количество доменов: ${domains.length}`);
    domains.forEach((domain, idx) => {
      const paths = CONFIG.DOMAINS[domain];
      Logger.log(`${idx + 1}. ${domain}: ${paths.length} путей`);
      if (!Array.isArray(paths)) {
        throw new Error(`CONFIG.DOMAINS['${domain}'] не является массивом!`);
      }
    });
    
    Logger.log(`${'═'.repeat(45)}\n`);
    
    // ━━━ ПОСТРОЕНИЕ СПИСКА URL ━━━
    const urlList = getUrlList();
    const totalUrls = urlList.length;
    
    // ━━━ БАТЧ-ОБРАБОТКА ━━━
    let urlsToProcess = urlList;
    let batchInfo = '';
    
    if (CONFIG.BATCH_MODE) {
      const batchStart = CONFIG.BATCH_START;
      const batchEnd = Math.min(CONFIG.BATCH_START + CONFIG.BATCH_SIZE, totalUrls);
      urlsToProcess = urlList.slice(batchStart, batchEnd);
      batchInfo = `БАТЧ-РЕЖИМ: обработка URL ${batchStart + 1}-${batchEnd} из ${totalUrls}`;
      
      Logger.log(`\n╔════════════════════════════════════════╗`);
      Logger.log(`║   БАТЧ-РЕЖИМ АКТИВЕН                  ║`);
      Logger.log(`╚════════════════════════════════════════╝`);
      Logger.log(`Всего URL в конфиге: ${totalUrls}`);
      Logger.log(`Обрабатываем: ${batchStart + 1}-${batchEnd} (${urlsToProcess.length} URL)`);
      Logger.log(`${'═'.repeat(45)}\n`);
      
      logToSheet('BATCH', 'INFO', 'INFO', batchInfo, `Start: ${batchStart}, Size: ${CONFIG.BATCH_SIZE}`);
    }
    
    Logger.log(`\n╔════════════════════════════════════════╗`);
    Logger.log(`║   ГОТОВ К ОБРАБОТКЕ ${urlsToProcess.length} URL           ║`);
    Logger.log(`╚════════════════════════════════════════╝\n`);

    const sheet = getOrCreateSheet();

    const startMessage = CONFIG.BATCH_MODE 
      ? `Начало сбора данных (БАТЧ ${CONFIG.BATCH_START + 1}-${Math.min(CONFIG.BATCH_START + CONFIG.BATCH_SIZE, totalUrls)} из ${totalUrls})`
      : `Начало сбора данных для ${totalUrls} URL`;
    
    logToSheet('ALL', 'СТАРТ', 'INFO', startMessage, `Время: ${startTime}`);
    
    const toastMessage = CONFIG.BATCH_MODE
      ? `🔄 Батч-режим: обработка ${urlsToProcess.length} URL...`
      : `🔄 Начинаем сбор данных для ${totalUrls} URL...`;
    
    showToast(toastMessage, 5);

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

    // ━━━ ОСНОВНОЙ ЦИКЛ ОБРАБОТКИ URL ━━━
    Logger.log(`\n${'═'.repeat(60)}`);
    Logger.log(`║ НАЧАЛО ОСНОВНОГО ЦИКЛА`);
    Logger.log(`║ Всего URL к обработке: ${urlsToProcess.length}`);
    if (CONFIG.BATCH_MODE) {
      Logger.log(`║ БАТЧ-РЕЖИМ: URL ${CONFIG.BATCH_START + 1}-${Math.min(CONFIG.BATCH_START + CONFIG.BATCH_SIZE, totalUrls)}`);
    }
    Logger.log(`${'═'.repeat(60)}\n`);
    
    for (let index = 0; index < urlsToProcess.length; index++) {
      const item = urlsToProcess[index];
      const actualIndex = CONFIG.BATCH_MODE ? CONFIG.BATCH_START + index : index;
      const urlNumber = actualIndex + 1;
      
      Logger.log(`\n╔═══════════════════════════════════════════════╗`);
      Logger.log(`║ НАЧАЛО ОБРАБОТКИ URL ${urlNumber}/${totalUrls}`);
      Logger.log(`╚═══════════════════════════════════════════════╝`);
      Logger.log(`Домен: ${item.domain}`);
      Logger.log(`Индекс домена: ${item.domainIndex}`);
      Logger.log(`Индекс URL в домене: ${item.urlIndexInDomain}`);
      Logger.log(`Путь: ${item.path}`);
      Logger.log(`Полный URL: ${item.fullUrl}`);
      Logger.log(`═══════════════════════════════════════════════\n`);

      // Проверка лимита времени
      const elapsedTime = (new Date() - startTime) / 1000;
      if (elapsedTime > CONFIG.MAX_EXECUTION_TIME) {
        Logger.log(`\n⚠️ ${'═'.repeat(50)}`);
        Logger.log(`⚠️ ПРИБЛИЖЕНИЕ К ЛИМИТУ ВРЕМЕНИ`);
        Logger.log(`⚠️ Прошло: ${Math.round(elapsedTime)} сек`);
        Logger.log(`⚠️ Лимит: ${CONFIG.MAX_EXECUTION_TIME} сек`);
        Logger.log(`⚠️ Останавливаем обработку`);
        Logger.log(`⚠️ ${'═'.repeat(50)}\n`);
        
        logToSheet('ALL', 'ТАЙМАУТ', 'WARNING', 'Превышен лимит времени выполнения',
          `Обработано: ${successCount}/${urlsToProcess.length}, Время: ${Math.round(elapsedTime)}с`);
        timeoutCount = urlsToProcess.length - index;
        break;
      }

      try {
        Logger.log(`\n${'═'.repeat(60)}`);
        Logger.log(`║ URL ${urlNumber}/${totalUrls}`);
        Logger.log(`║ Домен: ${item.domain} (индекс ${item.domainIndex})`);
        Logger.log(`║ Путь: ${item.path}`);
        Logger.log(`║ Полный URL: ${item.fullUrl}`);
        Logger.log(`║ Прошло времени: ${Math.round(elapsedTime)} сек`);
        Logger.log(`${'═'.repeat(60)}`);
        
        logToSheet(item.fullUrl, 'ОБРАБОТКА', 'INFO', `Начало обработки URL ${urlNumber}/${totalUrls}`, `Домен: ${item.domain}`);
        showToast(`🔄 Обработка ${urlNumber}/${totalUrls}: ${item.domain}${item.path}`, 3);

        // Mobile
        Logger.log(`\n📱 Запрос Mobile данных...`);
        logToSheet(item.fullUrl, 'API REQUEST', 'INFO', 'Запрос Mobile данных', '');
        const mobileData = fetchDataWithRetry(item.fullUrl, 'mobile');
        validateData(mobileData, 'Mobile');
        logToSheet(item.fullUrl, 'MOBILE', 'SUCCESS',
          `LCP: ${mobileData.lcp.toFixed(2)}, INP: ${mobileData.inp}, CLS: ${mobileData.cls.toFixed(3)}, Score: ${Math.round(mobileData.performanceScore)}`,
          `Full data: ${JSON.stringify(mobileData)}`);

        Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);

        // Desktop
        Logger.log(`\n🖥️ Запрос Desktop данных...`);
        logToSheet(item.fullUrl, 'API REQUEST', 'INFO', 'Запрос Desktop данных', '');
        const desktopData = fetchDataWithRetry(item.fullUrl, 'desktop');
        validateData(desktopData, 'Desktop');
        logToSheet(item.fullUrl, 'DESKTOP', 'SUCCESS',
          `LCP: ${desktopData.lcp.toFixed(2)}, INP: ${desktopData.inp}, CLS: ${desktopData.cls.toFixed(3)}, Score: ${Math.round(desktopData.performanceScore)}`,
          `Full data: ${JSON.stringify(desktopData)}`);

        // Сохраняем
        Logger.log(`\n💾 Сохранение данных в таблицу...`);
        saveDataToUrlBlock(sheet, actualIndex, mobileData, desktopData, todayCol);

        successCount++;
        results.push({ 
          url: item.fullUrl, 
          status: 'success', 
          mobile: Math.round(mobileData.performanceScore), 
          desktop: Math.round(desktopData.performanceScore) 
        });

        Logger.log(`\n✅ URL ${urlNumber} обработан успешно`);
        Logger.log(`   Mobile Score: ${Math.round(mobileData.performanceScore)}`);
        Logger.log(`   Desktop Score: ${Math.round(desktopData.performanceScore)}`);
        
        logToSheet(item.fullUrl, 'ЗАВЕРШЕНО', 'SUCCESS', 'URL обработан успешно',
          `Mobile: ${Math.round(mobileData.performanceScore)}, Desktop: ${Math.round(desktopData.performanceScore)}`);

        if (index < urlsToProcess.length - 1) {
          Logger.log(`\n⏸️ Пауза ${CONFIG.REQUEST_DELAY} сек перед следующим URL...`);
          Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);
        }

      } catch (error) {
        errorCount++;
        const errorMsg = `${item.domain}${item.path}: ${error.message}`;
        errors.push(errorMsg);
        results.push({ url: item.fullUrl, status: 'error', error: error.message });

        Logger.log(`\n❌ ${'═'.repeat(60)}`);
        Logger.log(`❌ ОШИБКА для URL ${urlNumber}/${totalUrls}`);
        Logger.log(`❌ Домен: ${item.domain}`);
        Logger.log(`❌ URL: ${item.fullUrl}`);
        Logger.log(`❌ Сообщение: ${error.message}`);
        Logger.log(`❌ Stack: ${error.stack || 'N/A'}`);
        
        // Проверяем тип ошибки
        if (error.message.includes('NO_FCP') || error.message.includes('NO_LCP')) {
          Logger.log(`⚠️ Это ошибка NO_FCP - URL будет пропущен`);
          Logger.log(`✅ ПРОДОЛЖАЕМ обработку следующих URL...`);
        } else {
          Logger.log(`⚠️ Это другая ошибка - продолжаем обработку`);
        }
        
        Logger.log(`❌ ${'═'.repeat(60)}\n`);
        
        logToSheet(item.fullUrl, 'ОШИБКА', 'ERROR', error.message, `Stack: ${error.stack || 'N/A'}`);
        
        // НЕ прерываем выполнение - продолжаем со следующим URL
      }
      
      // Логирование прогресса после обработки URL (успех или ошибка)
      const progressTotal = CONFIG.BATCH_MODE ? urlsToProcess.length : totalUrls;
      Logger.log(`\n📊 ПРОГРЕСС: Обработано ${index + 1}/${progressTotal} URL`);
      Logger.log(`   ✅ Успешно: ${successCount}`);
      Logger.log(`   ❌ Ошибок: ${errorCount}`);
      Logger.log(`   ⏱️ Прошло времени: ${Math.round((new Date() - startTime) / 1000)} сек\n`);
    }

    // ── Итоги ──
    const endTime  = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    Logger.log(`\n${'═'.repeat(60)}`);
    Logger.log(`║ ИТОГИ СБОРА ДАННЫХ`);
    if (CONFIG.BATCH_MODE) {
      Logger.log(`║ БАТЧ-РЕЖИМ: URL ${CONFIG.BATCH_START + 1}-${Math.min(CONFIG.BATCH_START + CONFIG.BATCH_SIZE, totalUrls)} из ${totalUrls}`);
    }
    Logger.log(`${'═'.repeat(60)}`);
    Logger.log(`Время завершения: ${endTime}`);
    Logger.log(`Продолжительность: ${duration} сек (${Math.floor(duration/60)}м ${duration%60}с)`);
    Logger.log(`Успешно обработано: ${successCount}/${urlsToProcess.length}`);
    Logger.log(`Ошибок: ${errorCount}/${urlsToProcess.length}`);
    if (timeoutCount > 0) {
      Logger.log(`Не обработано (таймаут): ${timeoutCount}/${urlsToProcess.length}`);
    }
    Logger.log(`${'═'.repeat(60)}\n`);

    const finalTotal = CONFIG.BATCH_MODE ? urlsToProcess.length : totalUrls;
    logToSheet('ALL', 'ЗАВЕРШЕНИЕ', 'INFO', 'Сбор данных завершен',
      `Успешно: ${successCount}/${finalTotal}, Ошибок: ${errorCount}, Время: ${duration}с`);

    let resultMessage = CONFIG.BATCH_MODE 
      ? `✅ Батч-режим завершен!\n\nОбработано URL: ${CONFIG.BATCH_START + 1}-${Math.min(CONFIG.BATCH_START + CONFIG.BATCH_SIZE, totalUrls)} из ${totalUrls}\n\n`
      : '✅ Сбор данных завершен!\n\n';
    
    resultMessage += `Время выполнения: ${duration} сек (${Math.floor(duration/60)}м ${duration%60}с)\n`;
    resultMessage += `Успешно: ${successCount}/${finalTotal}\n`;

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
    Logger.log(`\n❌ ${'═'.repeat(60)}`);
    Logger.log(`❌ КРИТИЧЕСКАЯ ОШИБКА`);
    Logger.log(`❌ ${'═'.repeat(60)}`);
    Logger.log(`❌ Сообщение: ${error.message}`);
    Logger.log(`❌ Stack trace: ${error.stack}`);
    Logger.log(`❌ ${'═'.repeat(60)}\n`);
    
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
    
    Logger.log(`\n╔════════════════════════════════════════╗`);
    Logger.log(`║   СБОР ДАННЫХ ДЛЯ ОДНОГО URL          ║`);
    Logger.log(`╚════════════════════════════════════════╝`);
    Logger.log(`Индекс URL: ${urlIndex}`);
    Logger.log(`Всего URL в списке: ${urlList.length}`);
    
    if (urlIndex < 0 || urlIndex >= urlList.length) {
      throw new Error(`Неверный индекс URL: ${urlIndex}. Доступны индексы от 0 до ${urlList.length - 1}`);
    }

    const sheet = getOrCreateSheet();
    const item  = urlList[urlIndex];
    const urlNumber = urlIndex + 1;

    Logger.log(`\nURL: ${item.fullUrl}`);
    Logger.log(`Домен: ${item.domain}`);
    Logger.log(`Путь: ${item.path}`);
    Logger.log(`${'═'.repeat(45)}\n`);

    showToast(`🔄 Сбор данных для ${item.domain}${item.path}...`, 5);

    const todayCol = getTodayColumn(sheet);

    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
    sheet.getRange(2, todayCol).setValue(dateStr);
    sheet.getRange(2, todayCol)
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');

    Logger.log(`📱 Запрос Mobile данных...`);
    const mobileData  = fetchDataWithRetry(item.fullUrl, 'mobile');
    validateData(mobileData, 'Mobile');
    Logger.log(`✅ Mobile данные получены: Score ${Math.round(mobileData.performanceScore)}`);

    Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);

    Logger.log(`\n🖥️ Запрос Desktop данных...`);
    const desktopData = fetchDataWithRetry(item.fullUrl, 'desktop');
    validateData(desktopData, 'Desktop');
    Logger.log(`✅ Desktop данные получены: Score ${Math.round(desktopData.performanceScore)}`);

    Logger.log(`\n💾 Сохранение данных в таблицу...`);
    saveDataToUrlBlock(sheet, urlIndex, mobileData, desktopData, todayCol);

    Logger.log(`\n✅ Данные успешно собраны и сохранены\n`);
    showAlert(`✅ Данные успешно обновлены для:\n${item.fullUrl}\n\nMobile: ${Math.round(mobileData.performanceScore)}\nDesktop: ${Math.round(desktopData.performanceScore)}`);

  } catch (error) {
    Logger.log(`\n❌ Ошибка при сборе данных для одного URL:`);
    Logger.log(`❌ ${error.message}`);
    Logger.log(`❌ Stack: ${error.stack}\n`);
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
      Logger.log(`  Попытка ${attempt}/${CONFIG.MAX_RETRIES} для ${strategy}`);

      if (attempt > 1) {
        const delay = CONFIG.RETRY_DELAY + (attempt * 2);
        Logger.log(`  Ждем ${delay} секунд перед повторной попыткой...`);
        logToSheet(url, 'RETRY', 'WARNING', `Повторная попытка ${attempt}/${CONFIG.MAX_RETRIES} для ${strategy}`, `Задержка: ${delay}с`);
        Utilities.sleep(delay * 1000);
      }

      const data = fetchPageSpeedData(url, strategy);
      if (data) {
        Logger.log(`  ✅ Данные получены для ${strategy}`);
        return data;
      }

    } catch (error) {
      lastError = error;
      Logger.log(`  ❌ Попытка ${attempt} неудачна: ${error.message}`);

      if (error.message.includes('NO_FCP') || error.message.includes('NO_LCP')) {
        logToSheet(url, 'NO_FCP ERROR', 'WARNING', `Страница не загрузилась (попытка ${attempt})`, error.message);

        if (attempt === CONFIG.MAX_RETRIES) {
          // Проверяем опцию - пропускать или пытаться получить lab данные
          if (CONFIG.SKIP_NO_FCP) {
            Logger.log('  ⚠️ SKIP_NO_FCP=true - пропускаем URL без получения lab данных');
            logToSheet(url, 'SKIPPED', 'WARNING', `URL пропущен (NO_FCP, SKIP_NO_FCP=true)`, error.message);
            throw new Error(`NO_FCP: URL пропущен согласно настройке SKIP_NO_FCP`);
          }
          
          Logger.log('  ⚠️ Пробуем получить lab данные вместо field данных...');
          try {
            const labData = fetchPageSpeedDataLabOnly(url, strategy);
            if (labData) {
              logToSheet(url, 'FALLBACK', 'WARNING', `Используем lab данные для ${strategy} (field данные недоступны)`, 'NO_FCP обработан');
              return labData;
            }
          } catch (labError) {
            Logger.log(`  Не удалось получить даже lab данные: ${labError.message}`);
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
    Logger.log('  Ошибка API: ' + error.message);
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
    Logger.log('  Ошибка Lab API: ' + error.message);
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
  Logger.log(`  ✅ Данные ${deviceName} валидны`);
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

    Logger.log(`\nИнициализация блоков для ${urlList.length} URL...`);

    urlList.forEach((item, flatIndex) => {
      // Если новый домен — рисуем заголовок-разделитель домена
      if (item.domain !== prevDomain) {
        const domainHeaderRow = getDomainHeaderRow(item.domainIndex);
        Logger.log(`  Заголовок домена "${item.domain}" в строке ${domainHeaderRow}`);
        initializeDomainHeader(sheet, domainHeaderRow, item.domain, item.domainIndex);
        prevDomain = item.domain;
      }

      // Блок URL
      const startRow = getStartRowForUrl(flatIndex);
      Logger.log(`  URL ${flatIndex + 1}: "${item.path}" начинается со строки ${startRow}`);
      initializeUrlBlock(sheet, startRow, item);
    });

    Logger.log('✅ Лист инициализирован\n');

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

    Logger.log(`  Сохранение в строку ${startRow}, колонку ${dataCol}`);

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
    Logger.log(`  Применение цветового кодирования...`);
    applyCompactColorCoding(sheet, startRow, dataCol, mobileData, desktopData);

    // Примечание для lab данных
    if (mobileData.isLabData || desktopData.isLabData) {
      let note = 'ℹ️ Lab данные (field данные недоступны из-за NO_FCP)\n\n';
      if (mobileData.isLabData)  note += 'Mobile: Lab данные\n';
      if (desktopData.isLabData) note += 'Desktop: Lab данные\n';
      sheet.getRange(startRow, dataCol).setNote(note);
      logToSheet(mobileData.url, 'NOTE', 'WARNING', 'Добавлено примечание о lab данных', note);
    }

    sheet.autoResizeColumn(dataCol);
    Logger.log(`  ✅ Данные сохранены`);

  } catch (error) {
    Logger.log(`  ❌ Ошибка сохранения: ${error.message}`);
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
    Logger.log(`  ⚠️ Ошибка форматирования: ${error.message}`);
  }
}

function applyCompactColorCoding(sheet, startRow, col, mobileData, desktopData) {
  try {
    Logger.log(`  📱 Mobile метрики:`);
    Logger.log(`     LCP: ${mobileData.lcp}, INP: ${mobileData.inp}, CLS: ${mobileData.cls}, Score: ${mobileData.performanceScore}`);
    
    applyCellColor(sheet, startRow + 1, col, mobileData.lcp,             'LCP');
    applyCellColor(sheet, startRow + 2, col, mobileData.inp,             'INP');
    applyCellColor(sheet, startRow + 3, col, mobileData.cls,             'CLS');
    applyCellColor(sheet, startRow + 4, col, mobileData.performanceScore,'PERFORMANCE');

    Logger.log(`  🖥️ Desktop метрики:`);
    Logger.log(`     LCP: ${desktopData.lcp}, INP: ${desktopData.inp}, CLS: ${desktopData.cls}, Score: ${desktopData.performanceScore}`);
    
    applyCellColor(sheet, startRow + 5, col, desktopData.lcp,             'LCP');
    applyCellColor(sheet, startRow + 6, col, desktopData.inp,             'INP');
    applyCellColor(sheet, startRow + 7, col, desktopData.cls,             'CLS');
    applyCellColor(sheet, startRow + 8, col, desktopData.performanceScore,'PERFORMANCE');
    
    Logger.log(`  ✅ Цветовое кодирование применено`);
    
  } catch (error) {
    Logger.log(`  ❌ Ошибка цветового кодирования: ${error.message}`);
    logToSheet(
      'COLOR_CODING_ERROR',
      'APPLY_COMPACT_COLOR',
      'ERROR',
      `Ошибка цветового кодирования для строки ${startRow}, колонки ${col}`,
      `${error.message} | Stack: ${error.stack}`
    );
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
    Logger.log(`     ❌ Ошибка применения цвета к ячейке [${row}, ${col}]: ${error.message}`);
    logToSheet(
      'COLOR_ERROR',
      'APPLY_COLOR_ERROR',
      'ERROR',
      `Не удалось применить цвет к [${row},${col}]`,
      `${error.message} | Stack: ${error.stack}`
    );
  }
}

function getColorForMetric(value, metricType) {
  const thresholds = CONFIG.THRESHOLDS[metricType];
  
  if (!thresholds) {
    Logger.log(`     ⚠️ Пороги для "${metricType}" не найдены, используем GOOD`);
    return CONFIG.COLORS.GOOD;
  }
  
  if (value <= thresholds.good) {
    return CONFIG.COLORS.GOOD;
  } else if (value <= thresholds.needsImprovement) {
    return CONFIG.COLORS.NEEDS_IMPROVEMENT;
  } else {
    return CONFIG.COLORS.POOR;
  }
}

// ═══════════════════════════════════════════════
// КОЛОНКА ДАТЫ (ИСПРАВЛЕННАЯ ВЕРСИЯ - FIX v2)
// FIX: Корректный поиск существующей колонки с датой
// ═══════════════════════════════════════════════

function getTodayColumn(sheet) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
  Logger.log(`\nПоиск колонки для даты: ${today}`);

  const maxCol = Math.max(sheet.getLastColumn() || 2, 26);   // минимум до Z
  let foundCol = 0;

  // 1. Ищем существующую колонку с ТОЧНО такой же датой
  for (let col = 2; col <= maxCol + 5; col++) {  // +5 на случай «дырок»
    const cell = sheet.getRange(2, col);
    let value;

    try {
      value = cell.getValue();
    } catch (e) {
      // колонка физически не существует → дальше искать бессмысленно
      break;
    }

    if (!value) continue;

    // Приводим к строке в нужном формате
    let dateStr = '';
    if (value instanceof Date) {
      dateStr = Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    } else {
      dateStr = value.toString().trim();
    }

    Logger.log(`  колонка ${col} → "${dateStr}"`);

    if (dateStr === today) {
      Logger.log(`→ НАЙДЕНА существующая колонка ${col}`);
      foundCol = col;
      break;
    }
  }

  if (foundCol > 0) {
    // нашли → перезаписываем сюда
    Logger.log(`Используем существующую колонку ${foundCol} (перезапись)`);
    return foundCol;
  }

  // 2. Не нашли → ищем первую пустую колонку после A
  Logger.log(`Колонка с ${today} не найдена → ищем свободное место`);

  for (let col = 2; col <= maxCol + 10; col++) {
    const cell = sheet.getRange(2, col);
    let value;

    try {
      value = cell.getValue();
    } catch (e) {
      // дошли до несуществующих колонок → используем эту
      Logger.log(`→ Используем новую колонку ${col} (расширение листа)`);
      return col;
    }

    if (!value || value.toString().trim() === '') {
      Logger.log(`→ Используем пустую колонку ${col}`);
      return col;
    }
  }

  // Крайний случай — очень маловероятный
  Logger.log(`→ Ничего не нашли → принудительно создаём после последней`);
  sheet.insertColumnAfter(maxCol);
  return maxCol + 1;
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
    if      (status === 'SUCCESS' || status === 'OK')   statusCell.setBackground('#00C853').setFontColor('white');
    else if (status === 'ERROR'   || status === 'FAIL') statusCell.setBackground('#FF1744').setFontColor('white');
    else if (status === 'WARNING')                      statusCell.setBackground('#FF9100').setFontColor('white');
    else if (status === 'INFO')                         statusCell.setBackground('#2979FF').setFontColor('white');

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
  showAlert(`✅ Ежедневный сбор настроен на 9:00\n\nЧасовой пояс: ${timezone}\n\n⚠️ ВАЖНО: У триггеров есть лимит 6 минут выполнения!\nДля большого количества URL используйте батчи.`);
}

function setupWeeklyTrigger() {
  deleteAllTriggers();
  ScriptApp.newTrigger('collectPageSpeedData')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  const timezone = Session.getScriptTimeZone();
  showAlert(`✅ Еженедельный сбор настроен на понедельник 9:00\n\nЧасовой пояс: ${timezone}\n\n⚠️ ВАЖНО: У триггеров есть лимит 6 минут выполнения!\nДля большого количества URL используйте батчи.`);
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
      ui.alert(`✅ Ежедневный сбор настроен на ${hour}:00\n\nЧасовой пояс: ${timezone}\n\n⚠️ ВАЖНО: У триггеров есть лимит 6 минут выполнения!\nДля большого количества URL используйте батчи.`);
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

// ═══════════════════════════════════════════════
// ТЕСТИРОВАНИЕ ЦВЕТОВОЙ СХЕМЫ
// ═══════════════════════════════════════════════

function testColorScheme() {
  Logger.log('\n╔═══════════════════════════════════════════════╗');
  Logger.log('║        ТЕСТ ЦВЕТОВОЙ СХЕМЫ                   ║');
  Logger.log('╚═══════════════════════════════════════════════╝\n');
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const testRow = sheet.getLastRow() + 2;
    
    Logger.log(`Создание тестовых ячеек в строке ${testRow}...\n`);
    
    // Заголовок теста
    sheet.getRange(testRow, 1).setValue('🧪 ТЕСТ ЦВЕТОВ:');
    sheet.getRange(testRow, 1).setFontWeight('bold');
    
    // Тест 1: GOOD
    Logger.log('━━━ Тест 1: GOOD цвет ━━━');
    sheet.getRange(testRow, 2).setValue('GOOD');
    applyCellColor(sheet, testRow, 2, 1.5, 'LCP'); // хорошее значение
    
    // Тест 2: NEEDS_IMPROVEMENT
    Logger.log('\n━━━ Тест 2: NEEDS_IMPROVEMENT цвет ━━━');
    sheet.getRange(testRow, 3).setValue('NEEDS_IMPROVEMENT');
    applyCellColor(sheet, testRow, 3, 3.5, 'LCP'); // среднее значение
    
    // Тест 3: POOR
    Logger.log('\n━━━ Тест 3: POOR цвет ━━━');
    sheet.getRange(testRow, 4).setValue('POOR');
    applyCellColor(sheet, testRow, 4, 5.5, 'LCP'); // плохое значение
    
    // Вывод конфигурации
    Logger.log('\n╔═══════════════════════════════════════════════╗');
    Logger.log('║        ТЕКУЩАЯ КОНФИГУРАЦИЯ ЦВЕТОВ           ║');
    Logger.log('╚═══════════════════════════════════════════════╝');
    Logger.log(`GOOD:              ${CONFIG.COLORS.GOOD}`);
    Logger.log(`NEEDS_IMPROVEMENT: ${CONFIG.COLORS.NEEDS_IMPROVEMENT}`);
    Logger.log(`POOR:              ${CONFIG.COLORS.POOR}`);
    Logger.log('═══════════════════════════════════════════════\n');
    
    showAlert(
      `✅ Тест цветовой схемы выполнен!\n\n` +
      `Проверьте строку ${testRow} в таблице.\n\n` +
      `Должны быть видны 3 цвета:\n` +
      `• Зелёный (${CONFIG.COLORS.GOOD})\n` +
      `• Оранжевый (${CONFIG.COLORS.NEEDS_IMPROVEMENT})\n` +
      `• Красный (${CONFIG.COLORS.POOR})\n\n` +
      `Подробности в логах (Ctrl+Enter или Вид → Логи выполнения)`
    );
    
  } catch (error) {
    Logger.log(`\n❌ ОШИБКА в testColorScheme: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    showAlert(`❌ Ошибка теста: ${error.message}\n\nПроверьте логи выполнения.`);
  }
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

  Logger.log(`\n╔════════════════════════════════════════╗`);
  Logger.log(`║   СОЗДАНИЕ МЕНЮ                       ║`);
  Logger.log(`╚════════════════════════════════════════╝`);
  Logger.log(`Доменов: ${domains.length}`);
  Logger.log(`Всего URL: ${urlList.length}\n`);

  // ── Подменю «Собрать по одному URL», сгруппировано по доменам ──
  const urlMenu = ui.createMenu('📍 Собрать для одного URL');

  let flatIndex = 0;
  domains.forEach(domain => {
    const domainSubMenu = ui.createMenu(`🌐 ${domain}`);
    CONFIG.DOMAINS[domain].forEach((path) => {
      const label = path === '/' ? '/ (главная)' : path;
      domainSubMenu.addItem(label, `collectUrl${flatIndex}`);
      Logger.log(`  Добавлен пункт меню: ${domain} → ${label} (функция collectUrl${flatIndex})`);
      flatIndex++;
    });
    urlMenu.addSubMenu(domainSubMenu);
  });

  // ── Главное меню ──
  const menu = ui.createMenu('📊 PageSpeed Monitoring')
    .addItem('🔄 Собрать данные для ВСЕХ URL', 'collectPageSpeedData')
    .addSubMenu(urlMenu)
    .addSeparator()
    .addItem('🧪 Тест цветовой схемы', 'testColorScheme')
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
  
  Logger.log(`✅ Меню создано успешно\n`);
}

// ═══════════════════════════════════════════════
// БАТЧ-ФУНКЦИИ ДЛЯ АВТОМАТИЧЕСКИХ ТРИГГЕРОВ
// ═══════════════════════════════════════════════
// Эти функции позволяют настроить 4 отдельных триггера,
// каждый из которых обработает свой батч из 5 URL

function collectBatch1() {
  Logger.log('\n🔄 ЗАПУСК БАТЧА 1: URL 1-5');
  const originalMode = CONFIG.BATCH_MODE;
  const originalStart = CONFIG.BATCH_START;
  const originalSize = CONFIG.BATCH_SIZE;
  
  CONFIG.BATCH_MODE = true;
  CONFIG.BATCH_START = 0;
  CONFIG.BATCH_SIZE = 5;
  
  try {
    collectPageSpeedData();
  } finally {
    CONFIG.BATCH_MODE = originalMode;
    CONFIG.BATCH_START = originalStart;
    CONFIG.BATCH_SIZE = originalSize;
  }
}

function collectBatch2() {
  Logger.log('\n🔄 ЗАПУСК БАТЧА 2: URL 6-10');
  const originalMode = CONFIG.BATCH_MODE;
  const originalStart = CONFIG.BATCH_START;
  const originalSize = CONFIG.BATCH_SIZE;
  
  CONFIG.BATCH_MODE = true;
  CONFIG.BATCH_START = 5;
  CONFIG.BATCH_SIZE = 5;
  
  try {
    collectPageSpeedData();
  } finally {
    CONFIG.BATCH_MODE = originalMode;
    CONFIG.BATCH_START = originalStart;
    CONFIG.BATCH_SIZE = originalSize;
  }
}

function collectBatch3() {
  Logger.log('\n🔄 ЗАПУСК БАТЧА 3: URL 11-15');
  const originalMode = CONFIG.BATCH_MODE;
  const originalStart = CONFIG.BATCH_START;
  const originalSize = CONFIG.BATCH_SIZE;
  
  CONFIG.BATCH_MODE = true;
  CONFIG.BATCH_START = 10;
  CONFIG.BATCH_SIZE = 5;
  
  try {
    collectPageSpeedData();
  } finally {
    CONFIG.BATCH_MODE = originalMode;
    CONFIG.BATCH_START = originalStart;
    CONFIG.BATCH_SIZE = originalSize;
  }
}

function collectBatch4() {
  Logger.log('\n🔄 ЗАПУСК БАТЧА 4: URL 16-20');
  const originalMode = CONFIG.BATCH_MODE;
  const originalStart = CONFIG.BATCH_START;
  const originalSize = CONFIG.BATCH_SIZE;
  
  CONFIG.BATCH_MODE = true;
  CONFIG.BATCH_START = 15;
  CONFIG.BATCH_SIZE = 5;
  
  try {
    collectPageSpeedData();
  } finally {
    CONFIG.BATCH_MODE = originalMode;
    CONFIG.BATCH_START = originalStart;
    CONFIG.BATCH_SIZE = originalSize;
  }
}

// ═══════════════════════════════════════════════
// WRAPPER-ФУНКЦИИ для меню (поддержка до 20 URL)
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