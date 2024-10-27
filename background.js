// background.js
// This script handles tab and window tracking

let isTracking = false;
let trackingStartTime = null;
let currentSessionTime = 0;
let totalTimeTracked = 0;
let currentDomain = null;
let domainStartTime = null;
let allDomainTimes = {};
let sessionStartTime = null;
let currentTabId = null;
let sessionCounter = 0;
let categories = ['Work', 'Entertainment', 'Social', 'News', 'Others'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isTracking: false,
    trackingStartTime: null,
    currentSessionTime: 0,
    todayTime: 0,
    weekTime: 0
  });
});

function startTracking() {
  if (!isTracking) {
    isTracking = true;
    trackingStartTime = Date.now();
    currentSessionTime = 0;
    sessionCounter++;
    saveState();
    console.log('Tracking started', { isTracking, trackingStartTime, currentSessionTime, sessionCounter });
    return { status: 'success', message: 'Tracking started successfully.' };
  }
  return { status: 'error', message: 'Tracking is already active.' };
}

function stopTracking() {
  if (isTracking) {
    updateTrackingTimes();
    isTracking = false;
    trackingStartTime = null;
    saveState();
    console.log('Tracking stopped', { isTracking, trackingStartTime, currentSessionTime, totalTimeTracked });
    return { status: 'success', message: 'Tracking stopped successfully.' };
  }
  return { status: 'error', message: 'Tracking is not active.' };
}

function updateTrackingTimes() {
  if (isTracking && trackingStartTime) {
    const now = Date.now();
    const sessionDuration = now - trackingStartTime;
    currentSessionTime += sessionDuration;
    totalTimeTracked += sessionDuration;
    trackingStartTime = now; // Reset the start time for the next update
    updateCurrentDomainTime(sessionDuration);
    saveState();
    console.log('Tracking times updated', { currentSessionTime, totalTimeTracked });
  }
}

function updateCurrentDomainTime(duration) {
  if (currentDomain) {
    if (!allDomainTimes[currentDomain]) {
      allDomainTimes[currentDomain] = { timeSpent: 0, category: 'Uncategorized', visits: 0 };
    }
    allDomainTimes[currentDomain].timeSpent += duration;
    allDomainTimes[currentDomain].visits += 1;
    console.log('Domain time updated', { domain: currentDomain, ...allDomainTimes[currentDomain] });
  }
}

// Update tracking times every second
setInterval(updateTrackingTimes, 1000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  switch (request.action) {
    case 'startTracking':
      sendResponse(startTracking());
      break;
    case 'stopTracking':
      sendResponse(stopTracking());
      break;
    case 'getTrackingStatus':
      sendResponse({ isTracking, trackingStartTime, currentSessionTime, totalTimeTracked });
      break;
    case 'getTrackingTimes':
      sendResponse({
        currentSessionTime,
        totalTimeTracked,
      });
      break;
    case 'getAllDomainTimes':
      sendResponse({
        status: 'success',
        allDomainTimes: allDomainTimes
      });
      return true;
    case 'updateDomainCategory':
      updateDomainCategory(request.domain, request.category);
      sendResponse({ status: 'success', message: 'Category updated successfully' });
      break;
    case 'getCategories':
      sendResponse({ categories: categories });
      break;
    case 'addCategory':
      if (!categories.includes(request.category)) {
        categories.push(request.category);
        saveState();
        sendResponse({ status: 'success' });
      } else {
        sendResponse({ status: 'error', message: 'Category already exists' });
      }
      break;
    case 'restartAll':
      restartAllTracking();
      sendResponse({ status: 'success', message: 'All tracking data has been reset' });
      break;
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ status: 'error', message: 'Unknown action' });
  }
  return true; // This line is important for asynchronous response
});

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

// Add this function to get the domain from a URL
function getDomain(url) {
  const urlObj = new URL(url);
  return urlObj.hostname;
}

// Modify the existing chrome.tabs.onActivated listener
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (isTracking) {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab && tab.url) {
        const domain = getDomain(tab.url);
        updateCurrentDomain(domain);
      }
    });
  }
});

// Modify the listener for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isTracking && changeInfo.status === 'complete' && tab.active) {
    const domain = getDomain(tab.url);
    updateCurrentDomain(domain);
  }
});

function updateCurrentDomain(newDomain) {
  if (newDomain !== currentDomain) {
    const now = Date.now();
    if (currentDomain && domainStartTime) {
      const timeSpent = now - domainStartTime;
      updateCurrentDomainTime(timeSpent);
    }
    currentDomain = newDomain;
    domainStartTime = now;
    console.log('Current domain updated', { currentDomain, domainStartTime });
  }
}

// Log domainTimes state periodically (every 5 minutes)
setInterval(() => {
  console.log('Current domainTimes state:', domainTimes);
}, 300000);

// Add a listener for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (isTracking && windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({active: true, windowId: windowId}, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        const domain = getDomain(tabs[0].url);
        if (domain !== currentDomain) {
          updateActivityLog(domain);
        }
      }
    });
  }
});

// Add this new function to update domain category
function updateDomainCategory(domain, category) {
  if (allDomainTimes[domain]) {
    allDomainTimes[domain].category = category;
  } else {
    allDomainTimes[domain] = { timeSpent: 0, category: category };
  }

  if (!categories.includes(category)) {
    categories.push(category);
  }

  saveState();
  console.log(`Updated category for ${domain} to ${category}`);
  console.log('Updated categories:', categories);
}

// Add this function to initialize or load saved data
function initializeOrLoadData() {
  chrome.storage.local.get(['isTracking', 'trackingStartTime', 'currentSessionTime', 'todayTime', 'weekTime', 'allDomainTimes', 'sessionCounter', 'categories', 'totalTimeTracked'], (result) => {
    isTracking = result.isTracking || false;
    trackingStartTime = result.trackingStartTime || null;
    currentSessionTime = result.currentSessionTime || 0;
    todayTime = result.todayTime || 0;
    weekTime = result.weekTime || 0;
    allDomainTimes = result.allDomainTimes || {};
    sessionCounter = result.sessionCounter || 0;
    categories = result.categories || ['Work', 'Entertainment', 'Social', 'News', 'Others'];
    totalTimeTracked = result.totalTimeTracked || 0;

    console.log('Initialized/Loaded data:', { isTracking, trackingStartTime, currentSessionTime, todayTime, weekTime, allDomainTimes, sessionCounter, categories, totalTimeTracked });
  });
}

// Call this function when the extension is installed or updated
chrome.runtime.onInstalled.addListener(initializeOrLoadData);

// Call this function when the browser starts
chrome.runtime.onStartup.addListener(initializeOrLoadData);

function saveState() {
  chrome.storage.local.set({
    isTracking,
    trackingStartTime,
    currentSessionTime,
    activityLog,
    currentDomain,
    domainStartTime,
    allDomainTimes,
    sessionCounter,
    categories,
    totalTimeTracked
  }, () => {
    console.log('State saved:', {
      isTracking,
      trackingStartTime,
      currentSessionTime,
      activityLog,
      currentDomain,
      domainStartTime,
      allDomainTimes,
      sessionCounter,
      categories,
      totalTimeTracked
    });
  });
}

function loadState() {
  chrome.storage.local.get([
    'isTracking',
    'trackingStartTime',
    'currentSessionTime',
    'activityLog',
    'currentDomain',
    'domainStartTime',
    'allDomainTimes',
    'sessionCounter',
    'categories',
    'totalTimeTracked'
  ], (result) => {
    isTracking = result.isTracking || false;
    trackingStartTime = result.trackingStartTime || null;
    currentSessionTime = result.currentSessionTime || 0;
    activityLog = result.activityLog || [];
    currentDomain = result.currentDomain || null;
    domainStartTime = result.domainStartTime || null;
    allDomainTimes = result.allDomainTimes || {};
    sessionCounter = result.sessionCounter || 0;
    categories = result.categories || ['Work', 'Entertainment', 'Social', 'News', 'Others'];
    totalTimeTracked = result.totalTimeTracked || 0;

    console.log('State loaded:', {
      isTracking,
      trackingStartTime,
      currentSessionTime,
      activityLog,
      currentDomain,
      domainStartTime,
      allDomainTimes,
      sessionCounter,
      categories,
      totalTimeTracked
    });

    if (isTracking) {
      // If tracking was active when the extension was closed, resume tracking
      trackingStartTime = Date.now();
      saveState();
    }
  });
}

// Call loadState when the extension starts
chrome.runtime.onStartup.addListener(loadState);

// Also call loadState when the service worker is initialized
loadState();

function restartAllTracking() {
  isTracking = false;
  trackingStartTime = null;
  currentSessionTime = 0;
  totalTimeTracked = 0;
  currentDomain = null;
  domainStartTime = null;
  allDomainTimes = {};
  sessionCounter = 0; // Reset the session counter
  saveState();
  console.log('All tracking data has been reset');
}
