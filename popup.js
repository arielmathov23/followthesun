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

  // Category Settings
  let categories = {};

  function displayCategories() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';
    Object.entries(categories).forEach(([category, keywords]) => {
      const categoryDiv = document.createElement('div');
      categoryDiv.innerHTML = `
        <h3>${category}</h3>
        <input type="text" value="${keywords.join(', ')}" data-category="${category}">
        <button class="deleteCategory" data-category="${category}">Delete</button>
      `;
      categoryList.appendChild(categoryDiv);
    });
  }

  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const newCategory = prompt('Enter new category name:');
    if (newCategory && !categories[newCategory]) {
      categories[newCategory] = [];
      displayCategories();
    }
  });

  document.getElementById('categoryList').addEventListener('click', (e) => {
    if (e.target.classList.contains('deleteCategory')) {
      const category = e.target.dataset.category;
      delete categories[category];
      displayCategories();
    }
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const inputs = document.querySelectorAll('#categoryList input');
    inputs.forEach(input => {
      const category = input.dataset.category;
      categories[category] = input.value.split(',').map(k => k.trim()).filter(k => k);
    });
    chrome.storage.local.set({ categories }, () => {
      chrome.runtime.sendMessage({ action: 'updateCategories', categories }, (response) => {
        console.log(response.status);
        alert('Settings saved successfully!');
      });
    });
  });

  // Event Listeners
  document.getElementById('dailyReportBtn').addEventListener('click', () => displaySwitchingReport('daily'));
  document.getElementById('weeklyReportBtn').addEventListener('click', () => displaySwitchingReport('weekly'));
  document.getElementById('monthlyReportBtn').addEventListener('click', () => displaySwitchingReport('monthly'));

  // Initial data load
  chrome.storage.local.get(['categories'], (result) => {
    categories = result.categories || {};
    displayCategories();
  });

  // Update displays
  updateFocusScore();
  displayTabStats();
  setInterval(updateFocusScore, 5000);
  setInterval(displayTabStats, 5000);
});

