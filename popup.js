// popup.js
// This script handles the UI display and interaction for the extension popup

document.addEventListener('DOMContentLoaded', () => {
  // Function to display tab statistics
  function displayTabStats() {
    chrome.storage.local.get(['tabData'], (result) => {
      const tabData = result.tabData || {};
      const tabStatsElement = document.getElementById('tabStats');
      tabStatsElement.innerHTML = '<h2>Tab Statistics</h2>';
      
      for (const [url, data] of Object.entries(tabData)) {
        tabStatsElement.innerHTML += `
          <p>
            <strong>${url}</strong><br>
            Time spent: ${formatTime(data.timeSpent)}<br>
            Visits: ${data.visits}
          </p>
        `;
      }
    });
  }

  // Helper function to format time in HH:MM:SS
  function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
  }

  // Helper function to pad single digits with a leading zero
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }

  // TODO: Implement focus score display
  // - Retrieve focus score from storage
  // - Display focus score in the UI

  // TODO: Implement category breakdown display
  // - Retrieve category data from storage
  // - Display category breakdown in the UI

  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const categoryList = document.getElementById('categoryList');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  let categories = {};

  // Function to display categories
  function displayCategories() {
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

  // Toggle settings panel
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    if (!settingsPanel.classList.contains('hidden')) {
      chrome.storage.local.get(['categories'], (result) => {
        categories = result.categories || {};
        displayCategories();
      });
    }
  });

  // Add new category
  addCategoryBtn.addEventListener('click', () => {
    const newCategory = prompt('Enter new category name:');
    if (newCategory && !categories[newCategory]) {
      categories[newCategory] = [];
      displayCategories();
    }
  });

  // Delete category
  categoryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('deleteCategory')) {
      const category = e.target.dataset.category;
      delete categories[category];
      displayCategories();
    }
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const inputs = categoryList.querySelectorAll('input');
    inputs.forEach(input => {
      const category = input.dataset.category;
      categories[category] = input.value.split(',').map(k => k.trim()).filter(k => k);
    });
    chrome.storage.local.set({ categories }, () => {
      chrome.runtime.sendMessage({ action: 'updateCategories', categories }, (response) => {
        console.log(response.status);
        settingsPanel.classList.add('hidden');
      });
    });
  });

  const focusScoreIndicator = document.getElementById('focusScoreIndicator');
  const focusScoreSummary = document.getElementById('focusScoreSummary');

  // Function to update focus score display
  function updateFocusScore() {
    chrome.storage.local.get(['focusScore', 'tabData', 'switchEvents'], (result) => {
      const score = result.focusScore || 0;
      const tabData = result.tabData || {};
      const switchEvents = result.switchEvents || [];

      // Update focus score bar
      focusScoreIndicator.style.width = `${score}%`;
      focusScoreIndicator.style.backgroundColor = getScoreColor(score);

      // Generate summary
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

  // Helper function to get color based on score
  function getScoreColor(score) {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 50) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  // Update focus score every 5 seconds
  setInterval(updateFocusScore, 5000);

  // Update focus score immediately when popup opens
  updateFocusScore();

  // Call the display function when the popup is opened
  displayTabStats();

  // Add this function to request and display the switching report
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
      }
    });
  }

  // Add event listeners for report buttons
  document.getElementById('dailyReportBtn').addEventListener('click', () => displaySwitchingReport('daily'));
  document.getElementById('weeklyReportBtn').addEventListener('click', () => displaySwitchingReport('weekly'));
  document.getElementById('monthlyReportBtn').addEventListener('click', () => displaySwitchingReport('monthly'));
});
