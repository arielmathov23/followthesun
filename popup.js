// popup.js
// This script handles the UI display and interaction for the extension popup

let trackingBtn;

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  trackingBtn = document.getElementById('trackingBtn');
  console.log('Tracking button:', trackingBtn);
  if (trackingBtn) {
    trackingBtn.addEventListener('click', toggleTracking);
    console.log('Added click listener to tracking button');
  } else {
    console.error('Tracking button not found');
  }

  // Initialize tabs
  initializeTabs();

  // Initialize the popup
  checkTrackingStatus();
  updateMainStats();

  // Set up periodic updates only for main stats
  setInterval(updateMainStats, 1000);
});

function initializeTabs() {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      activateTab(tabName);
    });
  });

  function activateTab(tabName) {
    // Hide all tab contents
    tabContents.forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    // Deactivate all tab buttons
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Activate the selected tab and its content
    const selectedTab = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(tabName);

    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedContent.classList.add('active');
      selectedContent.style.display = 'block';

      // Load content based on the selected tab
      if (tabName === 'reports') {
        loadReports();
      } else if (tabName === 'categories') {
        loadCategories();
      } else if (tabName === 'log') {
        updateActivityLog();
      }
    }
  }

  // Activate the default tab (reports)
  activateTab('reports');
}

function toggleTracking() {
  const action = trackingBtn.classList.contains('tracking') ? 'stopTracking' : 'startTracking';
  console.log('Sending message to background:', action);
  chrome.runtime.sendMessage({ action: action }, (response) => {
    console.log('Received response from background:', response);
    if (response && response.status === 'success') {
      const isTracking = action === 'startTracking';
      console.log('Setting tracking button state:', isTracking);
      setTrackingButtonState(isTracking);
      updateMainStats();
      if (!isTracking) {
        updateActivityLog();
      }
    } else {
      console.error(`Failed to ${action === 'startTracking' ? 'start' : 'stop'} tracking:`, response);
    }
  });
}

function setTrackingButtonState(isTracking) {
  console.log('Setting tracking button state:', isTracking);
  if (isTracking) {
    trackingBtn.innerHTML = '<i class="material-icons">stop</i> Stop Tracking';
    trackingBtn.classList.add('tracking');
  } else {
    trackingBtn.innerHTML = '<i class="material-icons">play_arrow</i> Start Tracking';
    trackingBtn.classList.remove('tracking');
  }
  console.log('Tracking button updated:', trackingBtn.outerHTML);
}

function checkTrackingStatus() {
  chrome.runtime.sendMessage({ action: 'getTrackingStatus' }, (response) => {
    console.log('Tracking status:', response);
    if (response && response.isTracking !== undefined) {
      setTrackingButtonState(response.isTracking);
    } else {
      console.error('Failed to get tracking status');
    }
  });
}

function updateMainStats() {
  chrome.runtime.sendMessage({ action: 'getTrackingStatus' }, (response) => {
    if (response && response.isTracking) {
      chrome.runtime.sendMessage({ action: 'getTrackingTimes' }, (timeResponse) => {
        console.log('Tracking times:', timeResponse);
        if (timeResponse) {
          document.getElementById('currentSessionTime').textContent = formatTime(timeResponse.currentSessionTime);
          document.getElementById('todayTime').textContent = formatTime(timeResponse.todayTime);
          document.getElementById('weekTime').textContent = formatTime(timeResponse.weekTime);
        } else {
          console.error('Failed to get tracking times');
        }
      });
    }
  });
}

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

function updateActivityLog() {
  console.log('Requesting activity log');
  chrome.runtime.sendMessage({ action: 'getActivityLog' }, (response) => {
    console.log('Received activity log response:', response);
    if (response && response.status === 'success') {
      console.log('DomainTimes received:', response.domainTimes);
      const logElement = document.getElementById('activityLog');
      logElement.innerHTML = '<h3>Activity Log</h3>';
      
      const sessionStartTime = response.sessionStartTime;
      const sessionEndTime = new Date().getTime(); // Current time as session end time

      if (!response.domainTimes || Object.keys(response.domainTimes).length === 0) {
        console.log('No entries to display');
        logElement.innerHTML += '<p>No activity logged in this session.</p>';
      } else {
        console.log('Displaying entries');
        const sortedDomains = Object.entries(response.domainTimes)
          .sort((a, b) => b[1] - a[1]); // Sort by time spent, descending

        sortedDomains.forEach(([domain, timeSpent]) => {
          const logEntry = document.createElement('p');
          logEntry.textContent = `${domain}: ${formatTime(timeSpent)}`;
          logElement.appendChild(logEntry);
        });

        // Add session information
        if (sessionStartTime) {
          const sessionInfo = document.createElement('p');
          sessionInfo.innerHTML = `<strong>Session:</strong> ${new Date(sessionStartTime).toLocaleString()} - ${new Date(sessionEndTime).toLocaleString()}`;
          logElement.insertBefore(sessionInfo, logElement.firstChild);
        }
      }
    } else {
      console.error('Failed to get activity log:', response);
      document.getElementById('activityLog').innerHTML = '<h3>Activity Log</h3><p>Failed to load activity log.</p>';
    }
  });
}

function loadReports() {
  // Implement report loading logic here
  console.log('Loading reports...');
  // For now, we'll just display a placeholder message
  const reportsElement = document.getElementById('reports');
  reportsElement.innerHTML = '<h3>Reports</h3><p>Report functionality coming soon!</p>';
}

function loadCategories() {
  // Implement category loading logic here
  console.log('Loading categories...');
  // For now, we'll just display a placeholder message
  const categoriesElement = document.getElementById('categories');
  categoriesElement.innerHTML = '<h3>Categories</h3><p>Category management coming soon!</p>';
}

// Add event listeners for report buttons
document.getElementById('dailyReportBtn').addEventListener('click', () => loadReport('daily'));
document.getElementById('weeklyReportBtn').addEventListener('click', () => loadReport('weekly'));
document.getElementById('monthlyReportBtn').addEventListener('click', () => loadReport('monthly'));

function loadReport(period) {
  console.log(`Loading ${period} report...`);
  // Implement report loading logic here
  // For now, we'll just update the reports section with a message
  const reportsElement = document.getElementById('reports');
  reportsElement.innerHTML = `<h3>${period.charAt(0).toUpperCase() + period.slice(1)} Report</h3><p>Data for ${period} report will be displayed here.</p>`;
}

// Make sure to call updateActivityLog when the log tab is opened
function activateTab(tabName) {
  // ... (previous code remains unchanged)
  if (tabName === 'log') {
    updateActivityLog();
  }
  // ... (rest of the function remains unchanged)
}

// Also, call updateActivityLog periodically if the log tab is active
setInterval(() => {
  if (document.querySelector('.tab-button[data-tab="log"]').classList.contains('active')) {
    updateActivityLog();
  }
}, 5000); // Update every 5 seconds
