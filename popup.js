// popup.js
// This script handles the UI display and interaction for the extension popup

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      activateTab(tabName);
    });
  });

  function activateTab(tabName) {
    tabContents.forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none';
    });

    tabs.forEach(tab => {
      tab.classList.remove('active');
    });

    const selectedTab = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(tabName);

    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedContent.classList.add('active');
      selectedContent.style.display = 'block';

      if (tabName === 'reports') {
        displayReports();
      }
      if (tabName === 'categories') {
        displayCategories();
        displayURLs();
      }
    }
  }

  // Activate the default tab (reports)
  activateTab('reports');

  // Tracking button functionality
  const trackingBtn = document.getElementById('trackingBtn');

  function updateMainStats() {
    chrome.runtime.sendMessage({ action: 'getTrackingTimes' }, (response) => {
      if (response) {
        document.getElementById('currentSessionTime').textContent = formatTime(response.currentSessionTime);
        document.getElementById('todayTime').textContent = formatTime(response.todayTime);
        document.getElementById('weekTime').textContent = formatTime(response.weekTime);
        updateDomainLog(response.domainTimes);
        updateUncategorizedWarning();
      } else {
        console.error('Failed to get tracking times');
      }
    });
  }

  function updateDomainLog(domainTimes) {
    const logElement = document.getElementById('activityLog');
    logElement.innerHTML = '<h3>Domain Times</h3>';
    for (const [domain, time] of Object.entries(domainTimes)) {
      const logEntry = document.createElement('p');
      const date = new Date().toLocaleDateString();
      logEntry.textContent = `${date} - ${domain}: ${formatTime(time)}`;
      logElement.appendChild(logEntry);
    }
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

  let mainStatsInterval;

  function startMainStatsUpdate() {
    clearInterval(mainStatsInterval);
    mainStatsInterval = setInterval(updateMainStats, 1000);
  }

  function stopMainStatsUpdate() {
    clearInterval(mainStatsInterval);
  }

  function setTrackingButtonState(isTracking) {
    if (isTracking) {
      trackingBtn.innerHTML = '<i class="material-icons">stop</i> Stop Tracking';
      trackingBtn.classList.add('tracking');
      startMainStatsUpdate();
    } else {
      trackingBtn.innerHTML = '<i class="material-icons">play_arrow</i> Start Tracking';
      trackingBtn.classList.remove('tracking');
      stopMainStatsUpdate();
    }
  }

  function triggerConfetti() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  trackingBtn.addEventListener('click', () => {
    if (trackingBtn.classList.contains('tracking')) {
      chrome.runtime.sendMessage({ action: 'stopTracking' }, (response) => {
        if (response && response.status === 'stopped') {
          setTrackingButtonState(false);
          updateMainStats();
          triggerConfetti();
        } else {
          console.error('Failed to stop tracking:', response);
        }
      });
    } else {
      chrome.runtime.sendMessage({ action: 'startTracking' }, (response) => {
        if (response && response.status === 'started') {
          setTrackingButtonState(true);
          updateMainStats();
          triggerConfetti();
        } else {
          console.error('Failed to start tracking:', response);
        }
      });
    }
  });

  function checkTrackingStatus() {
    chrome.runtime.sendMessage({ action: 'getTrackingStatus' }, (response) => {
      if (response && response.isTracking) {
        setTrackingButtonState(true);
      } else {
        setTrackingButtonState(false);
      }
      updateMainStats();
    });
  }

  // Category Management
  const predefinedCategories = ['Work', 'Entertainment', 'Press', 'Others'];

  function displayCategories() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '<h3>Existing Categories</h3>';
    predefinedCategories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.textContent = category;
      categoryList.appendChild(categoryDiv);
    });
  }

  function displayURLs() {
    chrome.storage.local.get(['tabData'], (result) => {
      const tabData = result.tabData || {};
      const urlList = document.getElementById('urlList');
      urlList.innerHTML = '<h3>Domains to Categorize</h3>';
      
      // Create a table for better organization
      const table = document.createElement('table');
      table.innerHTML = `
        <tr>
          <th>Domain</th>
          <th>Category</th>
        </tr>
      `;
      
      // Sort domains alphabetically
      const sortedDomains = Object.keys(tabData).sort();
      
      for (const domain of sortedDomains) {
        const data = tabData[domain];
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${domain}</td>
          <td>
            <select data-domain="${domain}">
              <option value="">Select a category</option>
              ${predefinedCategories.map(cat => `<option value="${cat}" ${data.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </td>
        `;
        table.appendChild(row);
      }
      
      urlList.appendChild(table);

      // Add event listener for category changes
      urlList.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
          const domain = e.target.dataset.domain;
          const newCategory = e.target.value;
          chrome.runtime.sendMessage({ 
            action: 'updateURLCategory', 
            url: domain, 
            category: newCategory 
          }, (response) => {
            if (response && response.status === 'success') {
              console.log(`Category updated for ${domain}: ${newCategory}`);
            } else {
              console.error('Failed to update category:', response);
            }
          });
        }
      });
    });
  }

  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const newCategory = prompt('Enter new category name:');
    if (newCategory && !predefinedCategories.includes(newCategory)) {
      predefinedCategories.push(newCategory);
      displayCategories();
      displayURLs();
    }
  });

  // Function to create the domain pie chart
  function createDomainPieChart(domainTimes) {
    const ctx = document.getElementById('domainPieChart').getContext('2d');
    const labels = Object.keys(domainTimes);
    const data = Object.values(domainTimes);

    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ]
        }]
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: 'Time Spent by Domain (Today)'
        }
      }
    });
  }

  // Function to create the category doughnut chart
  function createCategoryDoughnutChart(categoryTimes, totalTime) {
    const ctx = document.getElementById('categoryDoughnutChart').getContext('2d');
    const labels = Object.keys(categoryTimes);
    const data = Object.values(categoryTimes);

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
          ]
        }]
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: 'Time Spent by Category'
        },
        tooltips: {
          callbacks: {
            label: function(tooltipItem, data) {
              const dataset = data.datasets[tooltipItem.datasetIndex];
              const currentValue = dataset.data[tooltipItem.index];
              const percentage = ((currentValue / totalTime) * 100).toFixed(2);
              return `${data.labels[tooltipItem.index]}: ${formatTime(currentValue)} (${percentage}%)`;
            }
          }
        }
      }
    });
  }

  function displayReports() {
    chrome.storage.local.get(['tabData'], (result) => {
      const tabData = result.tabData || {};
      const domainTimes = {};
      const categoryTimes = {};
      let totalTime = 0;

      // Process the data
      for (const [domain, data] of Object.entries(tabData)) {
        domainTimes[domain] = data.timeSpent;
        const category = data.category || 'Uncategorized';
        categoryTimes[category] = (categoryTimes[category] || 0) + data.timeSpent;
        totalTime += data.timeSpent;
      }

      // Create domain pie chart
      createDomainPieChart(domainTimes);

      // Create category doughnut chart
      createCategoryDoughnutChart(categoryTimes, totalTime);
    });
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
      }
    });
  }

  // Event listeners for report buttons
  document.getElementById('dailyReportBtn').addEventListener('click', () => displaySwitchingReport('daily'));
  document.getElementById('weeklyReportBtn').addEventListener('click', () => displaySwitchingReport('weekly'));
  document.getElementById('monthlyReportBtn').addEventListener('click', () => displaySwitchingReport('monthly'));

  // Initial setup
  initialize();

  // Periodic updates
  setInterval(() => {
    checkTrackingStatus();
    displayURLs();
    updateMainStats();
    updateUncategorizedWarning();
    if (document.querySelector('.tab-button[data-tab="reports"]').classList.contains('active')) {
      displayReports();
    }
    if (document.querySelector('.tab-button[data-tab="categories"]').classList.contains('active')) {
      displayURLs();
    }
  }, 5000);
});

function updateUncategorizedWarning() {
  chrome.storage.local.get(['tabData'], (result) => {
    const tabData = result.tabData || {};
    const uncategorizedCount = Object.values(tabData).filter(data => !data.category || data.category === 'Uncategorized').length;
    
    const warningElement = document.getElementById('uncategorizedWarning');
    if (!warningElement) {
      const mainStats = document.getElementById('mainStats');
      const warning = document.createElement('p');
      warning.id = 'uncategorizedWarning';
      warning.style.color = 'red';
      warning.style.fontSize = '12px';
      warning.style.marginTop = '10px';
      mainStats.appendChild(warning);
    }
    
    document.getElementById('uncategorizedWarning').textContent = 
      uncategorizedCount > 0 ? `Warning: ${uncategorizedCount} URL${uncategorizedCount > 1 ? 's' : ''} not categorized` : '';
  });
}

function initialize() {
  checkTrackingStatus();
  displayCategories();
  displayURLs();
  displayReports();
  updateMainStats();
  updateUncategorizedWarning();
}
