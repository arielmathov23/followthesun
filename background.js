// background.js
// This script handles tab and window tracking

let currentTabId = null;
let currentWindowId = null;
let tabStartTime = null;
let isTracking = false;
let trackingStartTime = null;
let currentSessionTime = 0;
let todayTime = 0;
let weekTime = 0;
let domainTimes = {};

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

// Function to get root domain from URL
function getRootDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    console.error('Invalid URL:', url);
    return url;
  }
}

// Function to update tab data
function updateTabData(tabId, url, timeSpent) {
  const rootDomain = getRootDomain(url);
  chrome.storage.local.get(['tabData'], (result) => {
    const tabData = result.tabData || {};
    if (!tabData[rootDomain]) {
      tabData[rootDomain] = { timeSpent: 0, visits: 0, category: '' };
    }
    tabData[rootDomain].timeSpent += timeSpent;
    tabData[rootDomain].visits += 1;
    tabData[rootDomain].lastAccessed = new Date().toISOString();
    chrome.storage.local.set({ tabData }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating tab data:', chrome.runtime.lastError);
      } else {
        console.log('Tab data updated successfully');
      }
    });
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
    chrome.storage.local.set({ switchEvents }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error logging switch event:', chrome.runtime.lastError);
      } else {
        console.log('Switch event logged successfully');
      }
    });
    updateSwitchingReports();
  });
}

// Function to handle tab or window switch
function handleSwitch(tabId, windowId, url) {
  if (!isTracking) return;

  const now = Date.now();
  if (tabStartTime) {
    const timeSpent = now - tabStartTime;
    if (currentTabId && currentWindowId) {
      updateTabData(currentTabId, url, timeSpent);
      updateWindowData(currentWindowId, timeSpent);
    }
  }

  const rootDomain = getRootDomain(url);
  if (currentTabId !== tabId) {
    logSwitchEvent('tab', currentTabId, tabId, rootDomain);
  }
  if (currentWindowId !== windowId) {
    logSwitchEvent('window', currentWindowId, windowId, rootDomain);
  }

  currentTabId = tabId;
  currentWindowId = windowId;
  tabStartTime = now;
}

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo);
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    handleSwitch(activeInfo.tabId, activeInfo.windowId, tab.url);
  });
});

// Listen for window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  console.log('Window focus changed:', windowId);
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

// Remove the inactivity timer logic, as it's causing unintended stops
// Instead, we'll rely on the chrome.idle API for more reliable inactivity detection

chrome.idle.setDetectionInterval(300); // Set to 5 minutes (300 seconds)

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    pauseTracking();
  } else if (state === 'active') {
    resumeTracking();
  }
});

function pauseTracking() {
  if (isTracking) {
    updateTrackingTimes();
    isTracking = false;
    chrome.storage.local.set({ isTracking });
    console.log('Tracking paused due to inactivity');
  }
}

function resumeTracking() {
  if (!isTracking) {
    isTracking = true;
    trackingStartTime = Date.now();
    chrome.storage.local.set({ isTracking, trackingStartTime });
    console.log('Tracking resumed');
  }
}

// Modify updateTrackingTimes to handle pauses
function updateTrackingTimes() {
  const now = Date.now();
  if (isTracking && trackingStartTime) {
    const sessionDuration = now - trackingStartTime;
    currentSessionTime += sessionDuration;
    todayTime += sessionDuration;
    weekTime += sessionDuration;
    
    // Update domain times
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        const domain = getDomain(tabs[0].url);
        domainTimes[domain] = (domainTimes[domain] || 0) + sessionDuration;
      }
    });
    
    trackingStartTime = now;
    
    chrome.storage.local.set({ 
      currentSessionTime, 
      todayTime, 
      weekTime, 
      domainTimes,
      trackingStartTime
    });
  }
}

// Update tracking times every 5 seconds
setInterval(updateTrackingTimes, 5000);

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  if (request.action === 'startTracking') {
    sendResponse(startTracking());
  } else if (request.action === 'stopTracking') {
    sendResponse(stopTracking());
  } else if (request.action === 'getTrackingStatus') {
    sendResponse({ 
      isTracking, 
      trackingStartTime, 
      currentSessionTime, 
      todayTime, 
      weekTime 
    });
  } else if (request.action === 'getTrackingTimes') {
    updateTrackingTimes(); // Ensure times are up-to-date
    sendResponse({
      currentSessionTime,
      todayTime,
      weekTime,
      domainTimes
    });
  } else if (request.action === 'updateURLCategory') {
    updateURLCategory(request.url, request.category);
    sendResponse({ status: 'success' });
  }
  return true; // Indicates that the response is sent asynchronously
});

function updateURLCategory(url, category) {
  chrome.storage.local.get(['tabData'], (result) => {
    const tabData = result.tabData || {};
    if (!tabData[url]) {
      tabData[url] = { timeSpent: 0, visits: 0 };
    }
    tabData[url].category = category;
    chrome.storage.local.set({ tabData }, () => {
      console.log(`Category updated for ${url}: ${category}`);
    });
  });
}

// Initial category definitions
let categories = {
  Work: ['github.com', 'docs.google.com', 'trello.com', 'slack.com'],
  Social: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
  News: ['news.google.com', 'nytimes.com', 'bbc.com', 'cnn.com'],
  Entertainment: ['youtube.com', 'netflix.com', 'hulu.com', 'spotify.com']
};

// Function to categorize a tab based on its URL
function categorizeTab(url) {
  const domain = getRootDomain(url);
  for (const [category, domains] of Object.entries(categories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  return 'Uncategorized';
}

// Listen for tab and window events to reset the inactivity timer
chrome.tabs.onActivated.addListener(resetInactivityTimer);
chrome.windows.onFocusChanged.addListener(resetInactivityTimer);

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'activityDetected') {
    resetInactivityTimer();
  }
});

// Handle system sleep/wake events
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    stopTrackingDueToInactivity();
  } else if (state === 'active' && isTracking) {
    resetInactivityTimer();
  }
});

function startTracking() {
  if (!isTracking) {
    isTracking = true;
    trackingStartTime = Date.now();
    currentSessionTime = 0;
    chrome.storage.local.set({ isTracking, trackingStartTime, currentSessionTime });
    console.log('Tracking started');
    return { status: 'success', message: 'Tracking started successfully.' };
  }
  return { status: 'error', message: 'Tracking is already active.' };
}

function stopTracking() {
  if (isTracking) {
    updateTrackingTimes();
    isTracking = false;
    trackingStartTime = null;
    currentSessionTime = 0;
    chrome.storage.local.set({ isTracking, trackingStartTime, currentSessionTime });
    console.log('Tracking stopped');
    return { status: 'success', message: 'Tracking stopped successfully.' };
  }
  return { status: 'error', message: 'Tracking is not active.' };
}

// Load saved data when the extension starts
chrome.runtime.onStartup.addListener(() => {
  loadSavedData();
});

function loadSavedData() {
  chrome.storage.local.get(['todayTime', 'weekTime', 'domainTimes'], (result) => {
    todayTime = result.todayTime || 0;
    weekTime = result.weekTime || 0;
    domainTimes = result.domainTimes || {};
  });
}
