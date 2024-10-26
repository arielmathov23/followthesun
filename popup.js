// popup.js
// This script handles the UI display and interaction for the extension popup

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality
  const tabs = document.querySelectorAll('.tab-button');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      activateTab(tabName);
    });
  });

  function activateTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
  }

  // Focus Score Display
  function updateFocusScore() {
    chrome.storage.local.get(['focusScore', 'tabData', 'switchEvents'], (result) => {
      const score = result.focusScore || 0;
      const tabData = result.tabData || {};
      const switchEvents = result.switchEvents || [];

      const focusScoreIndicator = document.getElementById('focusScoreIndicator');
      const focusScoreSummary = document.getElementById('focusScoreSummary');

      focusScoreIndicator.style.width = `${score}%`;
      focusScoreIndicator.style.backgroundColor = getScoreColor(score);

      const recentSwitches = switchEvents.slice(-10).length;
      const workTime = Object.entries(tabData)
        .filter(([url, data]) => data.category === 'Work')
        .reduce((sum, [url, data]) => sum + data.timeSpent, 0);
      const totalTime = Object.values(tabData).reduce((sum, tab) => sum + tab.timeSpent, 0);
      const workPercentage = (workTime / totalTime) * 100 || 0;

      let summary = '';
      if (score >= 80) {
        summary = `High focus! ${workPercentage.toFixed(1)}% time in Work tabs.`;
      } else if (score >= 50) {
        summary = `Moderate focus. ${recentSwitches} recent tab switches.`;
      } else {
        summary = `Low focus. Consider reducing distractions.`;
      }

      focusScoreSummary.textContent = summary;
    });
  }

  function getScoreColor(score) {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 50) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  // Tab Statistics Display
  let tabStatsChart;

  function createTabStatsChart(tabData) {
    const ctx = document.getElementById('tabStatsChart').getContext('2d');
    const labels = Object.keys(tabData);
    const timeSpentData = Object.values(tabData).map(data => data.timeSpent / 60000); // Convert to minutes

    tabStatsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Time Spent (minutes)',
          data: timeSpentData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  function updateTabStatsChart(tabData) {
    tabStatsChart.data.labels = Object.keys(tabData);
    tabStatsChart.data.datasets[0].data = Object.values(tabData).map(data => data.timeSpent / 60000);
    tabStatsChart.update();
  }

  function displayTabStats() {
    chrome.storage.local.get(['tabData'], (result) => {
      const tabData = result.tabData || {};
      const tabStatsElement = document.getElementById('tabStats');
      tabStatsElement.innerHTML = '';
      
      for (const [url, data] of Object.entries(tabData)) {
        tabStatsElement.innerHTML += `
          <p>
            <strong>${url}</strong><br>
            Time spent: ${formatTime(data.timeSpent)}<br>
            Visits: ${data.visits}<br>
            Category: ${data.category}
          </p>
        `;
      }

      if (!tabStatsChart) {
        createTabStatsChart(tabData);
      } else {
        updateTabStatsChart(tabData);
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

  // Switching Reports
  let switchingReportChart;

  function createSwitchingReportChart(reportData) {
    const ctx = document.getElementById('switchingReportChart').getContext('2d');
    const labels = Object.keys(reportData.switchesPerHour || reportData.switchesPerDay);
    const switchData = Object.values(reportData.switchesPerHour || reportData.switchesPerDay);

    switchingReportChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Switches',
          data: switchData,
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  function updateSwitchingReportChart(reportData) {
    switchingReportChart.data.labels = Object.keys(reportData.switchesPerHour || reportData.switchesPerDay);
    switchingReportChart.data.datasets[0].data = Object.values(reportData.switchesPerHour || reportData.switchesPerDay);
    switchingReportChart.update();
  }

  function displaySwitchingReport(period) {
    chrome.runtime.sendMessage({ action: 'getSwitchingReport', period }, (response) => {
      const reportElement = document.getElementById('switchingReport');
      if (response.error) {
        reportElement.textContent = response.error;
      } else {
        reportElement.innerHTML = `
          <h3>${period.charAt(0).toUpperCase() + period.slice(1)} Switching Report</h3>
          <p>Total switches: ${response.totalSwitches}</p>
          <p>Average switches per hour: ${response.averageSwitchesPerHour}</p>
          <p>Peak switching period: ${response.peakSwitchingPeriod}</p>
        `;

        if (!switchingReportChart) {
          createSwitchingReportChart(response);
        } else {
          updateSwitchingReportChart(response);
        }
      }
    });
  }

  // Category Management
  const predefinedCategories = ['Work', 'Entertainment', 'Press', 'Others'];

  function displayCategories() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';
    predefinedCategories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.textContent = category;
      categoryList.appendChild(categoryDiv);
    });
  }

  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const newCategory = prompt('Enter new category name:');
    if (newCategory && !predefinedCategories.includes(newCategory)) {
      predefinedCategories.push(newCategory);
      displayCategories();
    }
  });

  // Activity Log
  function updateActivityLog() {
    chrome.storage.local.get(['switchEvents'], (result) => {
      const switchEvents = result.switchEvents || [];
      const logElement = document.getElementById('activityLog');
      logElement.innerHTML = '';
      switchEvents.slice(-20).reverse().forEach(event => {
        const logEntry = document.createElement('p');
        logEntry.textContent = `${new Date(event.timestamp).toLocaleString()} - ${event.type} switch to ${event.url}`;
        logElement.appendChild(logEntry);
      });
    });
  }

  // Event Listeners
  document.getElementById('dailyReportBtn').addEventListener('click', () => displaySwitchingReport('daily'));
  document.getElementById('weeklyReportBtn').addEventListener('click', () => displaySwitchingReport('weekly'));
  document.getElementById('monthlyReportBtn').addEventListener('click', () => displaySwitchingReport('monthly'));

  // Start/Stop button functionality
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  startBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startTracking' }, (response) => {
      if (response.status === 'started') {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopTracking' }, (response) => {
      if (response.status === 'stopped') {
        stopBtn.classList.add('hidden');
        startBtn.classList.remove('hidden');
      }
    });
  });

  // Check initial tracking status
  chrome.runtime.sendMessage({ action: 'getTrackingStatus' }, (response) => {
    if (response.isTracking) {
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      stopBtn.classList.add('hidden');
      startBtn.classList.remove('hidden');
    }
  });

  // Initial data load and periodic updates
  displayCategories();
  updateMainStats();
  displayTabStats();
  updateActivityLog();

  setInterval(() => {
    updateMainStats();
    displayTabStats();
    updateActivityLog();
  }, 1000);
});
