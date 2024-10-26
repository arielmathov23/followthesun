// background.js
// This script handles tab and window tracking

let currentTabId = null;
let currentWindowId = null;
let tabStartTime = null;

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    tabData: {},
    windowData: {},
    switchEvents: [],
    switchingReports: {
      daily: {},
      weekly: {},
      monthly: {}
    }
  });
});

// Function to update tab data
function updateTabData(tabId, url, timeSpent) {
  chrome.storage.local.get(['tabData'], (result) => {
    const tabData = result.tabData || {};
    if (!tabData[url]) {
      tabData[url] = { timeSpent: 0, visits: 0, category: categorizeTab(url) };
    }
    tabData[url].timeSpent += timeSpent;
    tabData[url].visits += 1;
    chrome.storage.local.set({ tabData });
  });
}

// Function to update window data
function updateWindowData(windowId, timeSpent) {
  chrome.storage.local.get(['windowData'], (result) => {
    const windowData = result.windowData || {};
    if (!windowData[windowId]) {
      windowData[windowId] = { timeSpent: 0 };
    }
    windowData[windowId].timeSpent += timeSpent;
    chrome.storage.local.set({ windowData });
  });
}

// Function to log switch events
function logSwitchEvent(type, fromId, toId, url) {
  chrome.storage.local.get(['switchEvents'], (result) => {
    const switchEvents = result.switchEvents || [];
    switchEvents.push({
      type,
      fromId,
      toId,
      url,
      timestamp: new Date().toISOString()
    });
    chrome.storage.local.set({ switchEvents });
    updateSwitchingReports();
  });
}

// Function to get domain from URL
function getDomain(url) {
  const urlObj = new URL(url);
  return urlObj.hostname;
}

// Function to handle tab or window switch
function handleSwitch(tabId, windowId, url) {
  const now = Date.now();
  if (tabStartTime) {
    const timeSpent = now - tabStartTime;
    if (currentTabId && currentWindowId) {
      updateTabData(currentTabId, url, timeSpent);
      updateWindowData(currentWindowId, timeSpent);
    }
  }

  if (currentTabId !== tabId) {
    logSwitchEvent('tab', currentTabId, tabId, url);
  }
  if (currentWindowId !== windowId) {
    logSwitchEvent('window', currentWindowId, windowId, url);
  }

  currentTabId = tabId;
  currentWindowId = windowId;
  tabStartTime = now;

  calculateFocusScore();
}

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    handleSwitch(activeInfo.tabId, activeInfo.windowId, tab.url);
  });
});

// Listen for window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs.length > 0) {
        handleSwitch(tabs[0].id, windowId, tabs[0].url);
      }
    });
  }
});

// Periodically update time spent (every 5 seconds)
setInterval(() => {
  if (currentTabId && currentWindowId && tabStartTime) {
    const now = Date.now();
    const timeSpent = now - tabStartTime;
    chrome.tabs.get(currentTabId, (tab) => {
      if (tab) {
        updateTabData(currentTabId, tab.url, timeSpent);
        updateWindowData(currentWindowId, timeSpent);
      }
    });
    tabStartTime = now;
  }
}, 5000);

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleSwitch(tabId, tab.windowId, tab.url);
  }
});

// Function to update switching reports
function updateSwitchingReports() {
  chrome.storage.local.get(['switchEvents', 'switchingReports'], (result) => {
    const switchEvents = result.switchEvents || [];
    const reports = result.switchingReports || { daily: {}, weekly: {}, monthly: {} };

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeek = getWeekNumber(now);
    const thisMonth = now.toISOString().slice(0, 7);

    // Update daily report
    if (!reports.daily[today]) {
      reports.daily[today] = { totalSwitches: 0, switchesPerHour: {} };
    }
    reports.daily[today].totalSwitches++;
    updateSwitchesPerHour(reports.daily[today], now.getHours());

    // Update weekly report
    if (!reports.weekly[thisWeek]) {
      reports.weekly[thisWeek] = { totalSwitches: 0, switchesPerDay: {} };
    }
    reports.weekly[thisWeek].totalSwitches++;
    updateSwitchesPerDay(reports.weekly[thisWeek], now.getDay());

    // Update monthly report
    if (!reports.monthly[thisMonth]) {
      reports.monthly[thisMonth] = { totalSwitches: 0, switchesPerDay: {} };
    }
    reports.monthly[thisMonth].totalSwitches++;
    updateSwitchesPerDay(reports.monthly[thisMonth], now.getDate());

    chrome.storage.local.set({ switchingReports: reports });
  });
}

// Helper function to get week number
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + weekNo;
}

// Helper function to update switches per hour
function updateSwitchesPerHour(report, hour) {
  if (!report.switchesPerHour[hour]) {
    report.switchesPerHour[hour] = 0;
  }
  report.switchesPerHour[hour]++;
}

// Helper function to update switches per day
function updateSwitchesPerDay(report, day) {
  if (!report.switchesPerDay[day]) {
    report.switchesPerDay[day] = 0;
  }
  report.switchesPerDay[day]++;
}

// Function to generate switching report
function generateSwitchingReport(period) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['switchingReports'], (result) => {
      const reports = result.switchingReports || {};
      const report = reports[period] || {};

      if (Object.keys(report).length === 0) {
        resolve({ error: 'No data available for the selected period.' });
        return;
      }

      const latestReport = Object.values(report).pop();
      const totalSwitches = latestReport.totalSwitches;
      let averageSwitchesPerHour, peakSwitchingPeriod;

      if (period === 'daily') {
        averageSwitchesPerHour = totalSwitches / 24;
        peakSwitchingPeriod = Object.entries(latestReport.switchesPerHour)
          .sort((a, b) => b[1] - a[1])[0][0] + ':00';
      } else {
        const days = Object.keys(latestReport.switchesPerDay).length;
        averageSwitchesPerHour = totalSwitches / (days * 24);
        peakSwitchingPeriod = Object.entries(latestReport.switchesPerDay)
          .sort((a, b) => b[1] - a[1])[0][0];
        peakSwitchingPeriod = period === 'weekly' ? 
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][peakSwitchingPeriod] :
          'Day ' + peakSwitchingPeriod;
      }

      resolve({
        totalSwitches,
        averageSwitchesPerHour: averageSwitchesPerHour.toFixed(2),
        peakSwitchingPeriod
      });
    });
  });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSwitchingReport') {
    generateSwitchingReport(request.period).then(report => {
      sendResponse(report);
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

// Initial category definitions
let categories = {
  Work: ['github.com', 'docs.google.com', 'trello.com', 'slack.com'],
  Social: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
  News: ['news.google.com', 'nytimes.com', 'bbc.com', 'cnn.com'],
  Entertainment: ['youtube.com', 'netflix.com', 'hulu.com', 'spotify.com']
};

// Function to categorize a tab based on its URL
function categorizeTab(url) {
  const domain = getDomain(url);
  for (const [category, domains] of Object.entries(categories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  return 'Uncategorized';
}

let focusScore = 100; // Initialize focus score
const FOCUS_SCORE_UPDATE_INTERVAL = 60000; // Update focus score every minute

// Function to calculate focus score
function calculateFocusScore() {
  chrome.storage.local.get(['tabData', 'switchEvents'], (result) => {
    const tabData = result.tabData || {};
    const switchEvents = result.switchEvents || [];
    
    const totalTime = Object.values(tabData).reduce((sum, tab) => sum + tab.timeSpent, 0);
    const workTime = Object.entries(tabData)
      .filter(([url, data]) => data.category === 'Work')
      .reduce((sum, [url, data]) => sum + data.timeSpent, 0);
    
    const workRatio = workTime / totalTime;
    const switchFrequency = switchEvents.length / (totalTime / 60000); // switches per minute
    
    // Calculate score based on work ratio and switch frequency
    let newScore = 100 * workRatio - 10 * switchFrequency;
    newScore = Math.max(0, Math.min(100, newScore)); // Clamp score between 0 and 100
    
    focusScore = Math.round(newScore);
    chrome.storage.local.set({ focusScore });
  });
}

// Update focus score periodically
setInterval(calculateFocusScore, FOCUS_SCORE_UPDATE_INTERVAL);