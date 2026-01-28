// ============================================
// PAGESPEED INSIGHTS MONITORING SCRIPT v4.4
// ============================================

const CONFIG = {
  API_KEY: 'YOU_API_KEY',
  
  URLS: [
    'https://example.com',
    'https://example.com/catalog',
    'https://example.com/catalog/category_name/',
    'https://example.com/product/product_api_name/',
  ],
  
  SHEET_NAME: 'PageSpeed Dashboard',
  LOG_SHEET_NAME: 'Логи',
  
  ENABLE_LOGGING: false,
  
  MAX_RETRIES: 2,
  RETRY_DELAY: 3,
  REQUEST_DELAY: 2,
  MAX_EXECUTION_TIME: 300,
  ROWS_PER_URL: 18,
  
  THRESHOLDS: {
    LCP: { good: 2.5, needsImprovement: 4 },
    INP: { good: 200, needsImprovement: 500 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    PERFORMANCE: { good: 90, needsImprovement: 50 }
  },
  
  COLORS: {
    GOOD: '#34A853',
    NEEDS_IMPROVEMENT: '#FBBC04',
    POOR: '#EA4335'
  }
};

function collectPageSpeedData() {
  const startTime = new Date();
  
  try {
    const sheet = getOrCreateSheet();
    const totalUrls = CONFIG.URLS.length;
    
    Logger.log(`=== НАЧАЛО СБОРА ДАННЫХ ===`);
    Logger.log(`Время старта: ${startTime}`);
    Logger.log(`Количество URL: ${totalUrls}`);
    
    logToSheet('ALL', 'СТАРТ', 'INFO', `Начало сбора данных для ${totalUrls} URL`, `Время: ${startTime}`);
    showToast(`🔄 Начинаем сбор данных для ${totalUrls} URL...`, 5);
    
    const todayCol = getTodayColumn(sheet);
    
    let successCount = 0;
    let errorCount = 0;
    let timeoutCount = 0;
    const errors = [];
    const results = [];
    
    const dateStr = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'dd.MM.yyyy');
    sheet.getRange(2, todayCol).setValue(dateStr);
    sheet.getRange(2, todayCol)
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');
    
    for (let index = 0; index < CONFIG.URLS.length; index++) {
      const url = CONFIG.URLS[index];
      const urlNumber = index + 1;
      
      const elapsedTime = (new Date() - startTime) / 1000;
      if (elapsedTime > CONFIG.MAX_EXECUTION_TIME) {
        Logger.log(`⚠️ Приближение к лимиту времени (${Math.round(elapsedTime)}с). Останавливаем.`);
        logToSheet('ALL', 'ТАЙМАУТ', 'WARNING', `Превышен лимит времени выполнения`, `Обработано: ${successCount}/${totalUrls}, Время: ${Math.round(elapsedTime)}с`);
        timeoutCount = totalUrls - index;
        break;
      }
      
      try {
        Logger.log(`\n=== URL ${urlNumber}/${totalUrls}: ${url} ===`);
        logToSheet(url, 'ОБРАБОТКА', 'INFO', `Начало обработки URL ${urlNumber}/${totalUrls}`, '');
        showToast(`🔄 Обработка ${urlNumber}/${totalUrls}: ${getShortUrl(url)}`, 3);
        
        Logger.log('Запрос Mobile данных...');
        logToSheet(url, 'API REQUEST', 'INFO', 'Запрос Mobile данных', '');
        
        const mobileData = fetchDataWithRetry(url, 'mobile');
        validateData(mobileData, 'Mobile');
        
        logToSheet(url, 'MOBILE', 'SUCCESS', `LCP: ${mobileData.lcp.toFixed(2)}, INP: ${mobileData.inp}, CLS: ${mobileData.cls.toFixed(3)}, Score: ${Math.round(mobileData.performanceScore)}`, 
          `Full data: ${JSON.stringify(mobileData)}`);
        
        Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);
        
        Logger.log('Запрос Desktop данных...');
        logToSheet(url, 'API REQUEST', 'INFO', 'Запрос Desktop данных', '');
        
        const desktopData = fetchDataWithRetry(url, 'desktop');
        validateData(desktopData, 'Desktop');
        
        logToSheet(url, 'DESKTOP', 'SUCCESS', `LCP: ${desktopData.lcp.toFixed(2)}, INP: ${desktopData.inp}, CLS: ${desktopData.cls.toFixed(3)}, Score: ${Math.round(desktopData.performanceScore)}`, 
          `Full data: ${JSON.stringify(desktopData)}`);
        
        saveDataToUrlBlock(sheet, index, mobileData, desktopData, todayCol);
        
        successCount++;
        results.push({
          url: url,
          status: 'success',
          mobile: Math.round(mobileData.performanceScore),
          desktop: Math.round(desktopData.performanceScore)
        });
        
        Logger.log(`✅ URL ${urlNumber} обработан успешно`);
        logToSheet(url, 'ЗАВЕРШЕНО', 'SUCCESS', `URL обработан успешно`, `Mobile: ${Math.round(mobileData.performanceScore)}, Desktop: ${Math.round(desktopData.performanceScore)}`);
        
        if (index < CONFIG.URLS.length - 1) {
          Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);
        }
        
      } catch (error) {
        errorCount++;
        const errorMsg = `${getShortUrl(url)}: ${error.message}`;
        errors.push(errorMsg);
        results.push({
          url: url,
          status: 'error',
          error: error.message
        });
        
        Logger.log(`❌ Ошибка для URL ${urlNumber}: ${error.message}`);
        logToSheet(url, 'ОШИБКА', 'ERROR', error.message, `Stack: ${error.stack || 'N/A'}`);
      }
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    Logger.log(`\n=== ИТОГИ ===`);
    Logger.log(`Время завершения: ${endTime}`);
    Logger.log(`Продолжительность: ${duration} сек`);
    Logger.log(`Успешно: ${successCount}/${totalUrls}`);
    Logger.log(`Ошибок: ${errorCount}/${totalUrls}`);
    
    logToSheet('ALL', 'ЗАВЕРШЕНИЕ', 'INFO', `Сбор данных завершен`, `Успешно: ${successCount}/${totalUrls}, Ошибок: ${errorCount}, Время: ${duration}с`);
    
    let resultMessage = `✅ Сбор данных завершен!\n\n`;
    resultMessage += `Время выполнения: ${duration} сек\n`;
    resultMessage += `Успешно: ${successCount}/${totalUrls}\n`;
    
    if (errorCount > 0) {
      resultMessage += `Ошибок: ${errorCount}\n`;
      if (CONFIG.ENABLE_LOGGING) {
        resultMessage += `\n⚠️ Проверьте лист "Логи" для деталей!\n`;
      }
    }
    
    if (timeoutCount > 0) {
      resultMessage += `⚠️ Не обработано из-за лимита времени: ${timeoutCount}\n`;
      resultMessage += `\nРекомендация: запустите скрипт для пропущенных URL отдельно через подменю.`;
    }
    
    if (errors.length > 0) {
      resultMessage += `\n\nДетали ошибок:\n`;
      errors.forEach(err => resultMessage += `• ${err}\n`);
    }
    
    if (successCount > 0) {
      resultMessage += `\n📊 Собранные данные:\n`;
      results.forEach(r => {
        if (r.status === 'success') {
          resultMessage += `• ${getShortUrl(r.url)}: M${r.mobile} / D${r.desktop}\n`;
        }
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

function getTodayColumn(sheet) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
  
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

function collectDataForSingleUrl(urlIndex) {
  try {
    if (urlIndex < 0 || urlIndex >= CONFIG.URLS.length) {
      throw new Error(`Неверный индекс URL: ${urlIndex}`);
    }
    
    const sheet = getOrCreateSheet();
    const url = CONFIG.URLS[urlIndex];
    const urlNumber = urlIndex + 1;
    
    Logger.log(`\n=== СБОР ДАННЫХ ДЛЯ URL ${urlNumber} ===`);
    Logger.log(`URL: ${url}`);
    
    showToast(`🔄 Сбор данных для ${getShortUrl(url)}...`, 5);
    
    const todayCol = getTodayColumn(sheet);
    
    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy');
    sheet.getRange(2, todayCol).setValue(dateStr);
    sheet.getRange(2, todayCol)
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');
    
    const mobileData = fetchDataWithRetry(url, 'mobile');
    validateData(mobileData, 'Mobile');
    
    Utilities.sleep(CONFIG.REQUEST_DELAY * 1000);
    
    const desktopData = fetchDataWithRetry(url, 'desktop');
    validateData(desktopData, 'Desktop');
    
    saveDataToUrlBlock(sheet, urlIndex, mobileData, desktopData, todayCol);
    
    Logger.log(`✅ Данные успешно собраны`);
    showAlert(`✅ Данные успешно обновлены для:\n${url}\n\nMobile: ${Math.round(mobileData.performanceScore)}\nDesktop: ${Math.round(desktopData.performanceScore)}`);
    
  } catch (error) {
    Logger.log(`❌ Ошибка: ${error.message}`);
    handleError(error);
  }
}

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
      
      if (attempt === CONFIG.MAX_RETRIES) {
        throw error;
      }
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
    
    logToSheet(url, 'PARSE', 'SUCCESS', `JSON успешно распарсен (${strategy})`, `Lighthouse данные найдены`);
    
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
    
    if (responseCode !== 200) {
      throw new Error(`Lab API error ${responseCode}`);
    }
    
    const json = JSON.parse(responseText);
    
    if (!json.lighthouseResult) {
      throw new Error('Lab Lighthouse результаты отсутствуют');
    }
    
    return extractLabMetrics(json, url, strategy);
    
  } catch (error) {
    Logger.log('Ошибка Lab API: ' + error.message);
    throw error;
  }
}

function extractLabMetrics(json, url, strategy) {
  const audits = json.lighthouseResult?.audits || {};
  
  const lcp = (audits['largest-contentful-paint']?.numericValue || 0) / 1000;
  const inp = audits['interaction-to-next-paint']?.numericValue || 0;
  const cls = audits['cumulative-layout-shift']?.numericValue || 0;
  const performanceScore = (json.lighthouseResult?.categories?.performance?.score || 0) * 100;
  
  logToSheet(url, 'LAB METRICS', 'WARNING', `Извлечены lab метрики для ${strategy}`, 
    `LCP: ${lcp.toFixed(2)}, INP: ${inp}, CLS: ${cls.toFixed(3)}, Score: ${Math.round(performanceScore)}`);
  
  return {
    url: url,
    strategy: strategy,
    lcp: lcp,
    inp: inp,
    cls: cls,
    performanceScore: performanceScore,
    date: new Date(),
    isLabData: true
  };
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
  const audits = json.lighthouseResult?.audits || {};
  
  const lcp = getMetricValue(metrics, 'LARGEST_CONTENTFUL_PAINT_MS', audits['largest-contentful-paint']) / 1000;
  const inp = getMetricValue(metrics, 'INTERACTION_TO_NEXT_PAINT', audits['interaction-to-next-paint']);
  const cls = getMetricValue(metrics, 'CUMULATIVE_LAYOUT_SHIFT_SCORE', audits['cumulative-layout-shift']) / 100;
  const performanceScore = (json.lighthouseResult?.categories?.performance?.score || 0) * 100;
  
  return {
    url: url,
    strategy: strategy,
    lcp: lcp,
    inp: inp,
    cls: cls,
    performanceScore: performanceScore,
    date: new Date()
  };
}

function getMetricValue(cruxMetrics, cruxKey, labAudit) {
  if (cruxMetrics[cruxKey]?.percentile !== undefined) {
    return cruxMetrics[cruxKey].percentile;
  }
  
  if (labAudit?.numericValue !== undefined) {
    return labAudit.numericValue;
  }
  
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
  if (!data) {
    throw new Error(`Данные для ${deviceName} отсутствуют`);
  }
  
  if (data.lcp === 0 && data.cls === 0 && data.performanceScore === 0) {
    throw new Error(`Все метрики для ${deviceName} равны 0`);
  }
  
  Logger.log(`✅ Данные ${deviceName} валидны`);
}

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
    
    sheet.getRange('A1').setValue('📊 PAGESPEED INSIGHTS DASHBOARD');
    sheet.getRange('A1')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('white');
    
    sheet.getRange('A2').setValue('Метрика');
    sheet.getRange('A2')
      .setFontWeight('bold')
      .setBackground('#F3F3F3')
      .setHorizontalAlignment('center');
    
    sheet.setFrozenRows(2);
    sheet.setFrozenColumns(1);
    sheet.setColumnWidth(1, 180);
    
    CONFIG.URLS.forEach((url, index) => {
      initializeUrlBlock(sheet, index, url);
    });
    
    Logger.log('✅ Лист инициализирован');
    
  } catch (error) {
    Logger.log(`❌ Ошибка инициализации листа: ${error.message}`);
    throw error;
  }
}

function initializeUrlBlock(sheet, urlIndex, url) {
  const startRow = getStartRowForUrl(urlIndex);
  
  const structure = [
    [url],
    [''],
    ['📱 MOBILE'],
    ['LCP (сек)'],
    ['INP (мс)'],
    ['CLS'],
    ['Performance Score'],
    [''],
    ['🖥️ DESKTOP'],
    ['LCP (сек)'],
    ['INP (мс)'],
    ['CLS'],
    ['Performance Score'],
    [''],
    [''],
    ['']
  ];
  
  sheet.getRange(startRow, 1, structure.length, 1).setValues(structure);
  
  sheet.getRange(startRow, 1)
    .setFontSize(9)
    .setBackground('#F3F3F3')
    .setFontColor('#666666')
    .setWrap(true);
  
  sheet.getRange(startRow + 2, 1)
    .setFontWeight('bold')
    .setBackground('#E8F0FE')
    .setFontSize(11);
  
  sheet.getRange(startRow + 8, 1)
    .setFontWeight('bold')
    .setBackground('#FEF7E0')
    .setFontSize(11);
}

function getStartRowForUrl(urlIndex) {
  return 3 + (urlIndex * CONFIG.ROWS_PER_URL);
}

function getShortUrl(url) {
  try {
    let cleanUrl = url.replace(/^https?:\/\//, '');
    cleanUrl = cleanUrl.replace(/^www\./, '');
    cleanUrl = cleanUrl.replace(/\/$/, '');
    
    const parts = cleanUrl.split('/');
    
    if (parts.length > 1) {
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].length > 0) {
          return parts[i];
        }
      }
    }
    
    return parts[0];
    
  } catch (e) {
    return url.substring(0, 20);
  }
}

function getOrCreateLogSheet() {
  if (!CONFIG.ENABLE_LOGGING) {
    return null;
  }
  
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
    
    const headers = [
      ['Дата/Время', 'URL', 'Тип', 'Статус', 'Сообщение', 'Детали']
    ];
    
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
  if (!CONFIG.ENABLE_LOGGING) {
    return;
  }
  
  try {
    const logSheet = getOrCreateLogSheet();
    
    if (!logSheet) {
      return;
    }
    
    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd.MM.yyyy HH:mm:ss'
    );
    
    const lastRow = logSheet.getLastRow();
    const newRow = lastRow + 1;
    
    const rowData = [
      [timestamp, url, type, status, message, details || '']
    ];
    
    logSheet.getRange(newRow, 1, 1, 6).setValues(rowData);
    
    const statusCell = logSheet.getRange(newRow, 4);
    if (status === 'SUCCESS' || status === 'OK') {
      statusCell.setBackground('#34A853').setFontColor('white');
    } else if (status === 'ERROR' || status === 'FAIL') {
      statusCell.setBackground('#EA4335').setFontColor('white');
    } else if (status === 'WARNING') {
      statusCell.setBackground('#FBBC04').setFontColor('white');
    } else if (status === 'INFO') {
      statusCell.setBackground('#4285F4').setFontColor('white');
    }
    
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
    
    if (lastRow > 2) {
      logSheet.setActiveRange(logSheet.getRange(lastRow, 1));
    }
    
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

function toggleLogging() {
  const ui = SpreadsheetApp.getUi();
  const currentStatus = CONFIG.ENABLE_LOGGING ? 'включено' : 'отключено';
  const newStatus = !CONFIG.ENABLE_LOGGING;
  
  const response = ui.alert(
    'Изменить настройки логирования',
    `Текущий статус: ${currentStatus}\n\nИзменить на ${newStatus ? 'включено' : 'отключено'}?\n\nВНИМАНИЕ: Изменение применится только после редактирования CONFIG.ENABLE_LOGGING в коде скрипта.`,
    ui.ButtonSet.OK
  );
  
  showAlert(`ℹ️ Для изменения логирования:\n\n1. Расширения → Apps Script\n2. Найдите CONFIG.ENABLE_LOGGING\n3. Измените на ${newStatus}\n4. Сохраните (Ctrl+S)`);
}

function saveDataToUrlBlock(sheet, urlIndex, mobileData, desktopData, dataCol) {
  try {
    const startRow = getStartRowForUrl(urlIndex);
    
    const values = [
      [''],
      [''],
      [''],
      [mobileData.lcp],
      [mobileData.inp],
      [mobileData.cls],
      [mobileData.performanceScore],
      [''],
      [''],
      [desktopData.lcp],
      [desktopData.inp],
      [desktopData.cls],
      [desktopData.performanceScore],
      [''],
      [''],
      ['']
    ];
    
    sheet.getRange(startRow, dataCol, values.length, 1).setValues(values);
    
    formatDataColumn(sheet, startRow, dataCol);
    applyColorCoding(sheet, startRow, dataCol, mobileData, desktopData);
    
    if (mobileData.isLabData || desktopData.isLabData) {
      let note = 'ℹ️ Lab данные (field данные недоступны из-за NO_FCP)\n\n';
      if (mobileData.isLabData) note += 'Mobile: Lab данные\n';
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

function formatDataColumn(sheet, startRow, col) {
  try {
    sheet.getRange(startRow + 2, col).setBackground('#E8F0FE');
    sheet.getRange(startRow + 8, col).setBackground('#FEF7E0');
    
    const formats = [
      { offset: 3, format: '0.00' },
      { offset: 4, format: '0' },
      { offset: 5, format: '0.000' },
      { offset: 6, format: '0' },
      { offset: 9, format: '0.00' },
      { offset: 10, format: '0' },
      { offset: 11, format: '0.000' },
      { offset: 12, format: '0' }
    ];
    
    formats.forEach(f => {
      sheet.getRange(startRow + f.offset, col).setNumberFormat(f.format);
    });
    
  } catch (error) {
    Logger.log(`⚠️ Ошибка форматирования: ${error.message}`);
  }
}

function applyColorCoding(sheet, startRow, col, mobileData, desktopData) {
  try {
    applyCellColor(sheet, startRow + 3, col, mobileData.lcp, 'LCP');
    applyCellColor(sheet, startRow + 4, col, mobileData.inp, 'INP');
    applyCellColor(sheet, startRow + 5, col, mobileData.cls, 'CLS');
    applyCellColor(sheet, startRow + 6, col, mobileData.performanceScore, 'PERFORMANCE');
    
    applyCellColor(sheet, startRow + 9, col, desktopData.lcp, 'LCP');
    applyCellColor(sheet, startRow + 10, col, desktopData.inp, 'INP');
    applyCellColor(sheet, startRow + 11, col, desktopData.cls, 'CLS');
    applyCellColor(sheet, startRow + 12, col, desktopData.performanceScore, 'PERFORMANCE');
    
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
  
  if (value <= thresholds.good) {
    return CONFIG.COLORS.GOOD;
  } else if (value <= thresholds.needsImprovement) {
    return CONFIG.COLORS.NEEDS_IMPROVEMENT;
  } else {
    return CONFIG.COLORS.POOR;
  }
}

function manageUrls() {
  const ui = SpreadsheetApp.getUi();
  
  let message = 'Текущие URL для мониторинга:\n\n';
  CONFIG.URLS.forEach((url, index) => {
    message += `${index + 1}. ${url}\n`;
  });
  
  message += '\n\n⚠️ ВАЖНО ПРИ БОЛЬШОМ КОЛИЧЕСТВЕ URL:\n';
  message += 'Если у вас больше 5 URL, рекомендуется:\n';
  message += '• Собирать данные по одному URL через подменю\n';
  message += '• Или настроить автоматический сбор (триггер)\n\n';
  message += 'Для изменения списка:\n';
  message += '1. Расширения → Apps Script\n';
  message += '2. Найдите массив CONFIG.URLS\n';
  message += '3. Добавьте/удалите URL\n';
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
      
      if (sheet) {
        SpreadsheetApp.getActiveSpreadsheet().deleteSheet(sheet);
      }
      
      getOrCreateSheet();
      
      showAlert('✅ Лист пересоздан!');
    }
    
  } catch (error) {
    Logger.log(`❌ Ошибка пересоздания листа: ${error.message}`);
    showAlert(`❌ Ошибка: ${error.message}`);
  }
}

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
    errorMessage += '• Уменьшите количество URL в CONFIG.URLS\n';
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
  const ui = SpreadsheetApp.getUi();
  const timezone = Session.getScriptTimeZone();
  const currentTime = new Date();
  const formattedTime = Utilities.formatDate(currentTime, timezone, 'dd.MM.yyyy HH:mm:ss');
  
  let message = '🕐 ИНФОРМАЦИЯ О ЧАСОВОМ ПОЯСЕ\n\n';
  message += `Часовой пояс: ${timezone}\n`;
  message += `Текущее время: ${formattedTime}\n\n`;
  message += `📌 ВАЖНО:\n`;
  message += `• Триггеры используют этот часовой пояс\n`;
  message += `• Для изменения используйте "Изменить часовой пояс"`;
  
  ui.alert('Часовой пояс', message, ui.ButtonSet.OK);
}

function changeTimezone() {
  const ui = SpreadsheetApp.getUi();
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
        const testDate = new Date();
        Utilities.formatDate(testDate, newTimezone, 'HH:mm');
        
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
    const handlerFunction = trigger.getHandlerFunction();
    const eventType = trigger.getEventType();
    message += `${index + 1}. ${handlerFunction} - ${eventType}\n`;
  });
  
  showAlert(message);
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  const urlMenu = ui.createMenu('📍 Собрать для одного URL');
  CONFIG.URLS.forEach((url, index) => {
    const shortUrl = getShortUrl(url);
    urlMenu.addItem(`${index + 1}. ${shortUrl}`, `collectUrl${index}`);
  });
  
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