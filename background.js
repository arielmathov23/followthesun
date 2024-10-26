// background.js
// This script handles tab and window tracking

let isTracking = false;
let trackingStartTime = null;
let currentSessionTime = 0;
let todayTime = 0;
let weekTime = 0;
let activityLog = [];
let currentDomain = null;
let domainStartTime = null;
let domainTimes = {};
let sessionStartTime = null;
let currentTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isTracking: false,
    trackingStartTime: null,
    currentSessionTime: 0,
    todayTime: 0,
    weekTime: 0
  });
});

function logActivity(action, details) {
  activityLog.push({
    timestamp: new Date().toISOString(),
    action: action,
    details: details
  });
  // Keep only the last 50 entries
  if (activityLog.length > 50) {
    activityLog = activityLog.slice(-50);
  }
  chrome.storage.local.set({ activityLog: activityLog });
}

function startTracking() {
  if (!isTracking) {
    isTracking = true;
    trackingStartTime = Date.now();
    sessionStartTime = trackingStartTime;
    domainTimes = {}; // Reset domain times for new session
    chrome.storage.local.set({ isTracking, trackingStartTime, sessionStartTime, domainTimes }, () => {
      console.log('Tracking started:', { isTracking, trackingStartTime, sessionStartTime });
    });
    console.log('Tracking started');
    return { status: 'success', message: 'Tracking started successfully.' };
  }
  return { status: 'error', message: 'Tracking is already active.' };
}

function stopTracking() {
  if (isTracking) {
    updateTrackingTimes();
    updateActivityLog(null); // Log the last domain
    isTracking = false;
    trackingStartTime = null;
    currentDomain = null;
    domainStartTime = null;
    chrome.storage.local.set({ 
      isTracking, 
      trackingStartTime, 
      domainTimes,
      sessionStartTime: null
    }, () => {
      console.log('Tracking stopped:', { isTracking, trackingStartTime, domainTimes });
    });
    console.log('Tracking stopped');
    return { status: 'success', message: 'Tracking stopped successfully.' };
  }
  return { status: 'error', message: 'Tracking is not active.' };
}

function updateTrackingTimes() {
  if (isTracking && trackingStartTime) {
    const now = Date.now();
    const sessionDuration = now - trackingStartTime;
    currentSessionTime += sessionDuration;
    todayTime += sessionDuration;
    weekTime += sessionDuration;
    trackingStartTime = now;
    
    chrome.storage.local.set({ currentSessionTime, todayTime, weekTime, trackingStartTime });
  }
}

// Update tracking times every second
setInterval(updateTrackingTimes, 1000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  switch (request.action) {
    case 'startTracking':
      const startResult = startTracking();
      console.log('Start tracking result:', startResult);
      sendResponse(startResult);
      break;
    case 'stopTracking':
      const stopResult = stopTracking();
      console.log('Stop tracking result:', stopResult);
      sendResponse(stopResult);
      break;
    case 'getTrackingStatus':
      const status = { isTracking, trackingStartTime, currentSessionTime, todayTime, weekTime };
      console.log('Get tracking status result:', status);
      sendResponse(status);
      break;
    case 'getTrackingTimes':
      const times = { currentSessionTime, todayTime, weekTime };
      console.log('Get tracking times result:', times);
      sendResponse(times);
      break;
    case 'getActivityLog':
      chrome.storage.local.get(['domainTimes', 'sessionStartTime'], (result) => {
        console.log('Retrieved domainTimes from storage:', result.domainTimes);
        console.log('Retrieved sessionStartTime from storage:', result.sessionStartTime);
        sendResponse({
          status: 'success',
          domainTimes: result.domainTimes || {},
          sessionStartTime: result.sessionStartTime
        });
      });
      return true; // Indicates that the response is sent asynchronously
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
      if (tab.url) {
        const domain = getDomain(tab.url);
        if (domain !== currentDomain) {
          updateActivityLog(domain);
        }
      }
    });
  }
});

// Modify the listener for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isTracking && changeInfo.status === 'complete' && tab.active) {
    const domain = getDomain(tab.url);
    if (domain !== currentDomain) {
      updateActivityLog(domain);
    }
  }
});

function updateActivityLog(newDomain) {
  const now = Date.now();
  if (currentDomain && domainStartTime) {
    const timeSpent = now - domainStartTime;
    if (!domainTimes[currentDomain]) {
      domainTimes[currentDomain] = 0;
    }
    domainTimes[currentDomain] += timeSpent;
    console.log(`Domain updated: ${currentDomain}, Time spent: ${timeSpent}ms, Total: ${domainTimes[currentDomain]}ms`);
  }
  currentDomain = newDomain;
  domainStartTime = now;
  
  // Update storage with the latest domainTimes
  chrome.storage.local.set({ domainTimes: domainTimes, sessionStartTime: sessionStartTime }, () => {
    console.log('Domain times updated:', domainTimes);
  });
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
