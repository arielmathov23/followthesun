// popup.js
// This script handles the UI display and interaction for the extension popup

let trackingBtn;
// Predefined categories
let categories = ['Work', 'Entertainment', 'Social', 'News', 'Others'];

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
  trackingBtn = document.getElementById('trackingBtn');
  const restartAllBtn = document.getElementById('restartAllBtn');
  
  console.log('Tracking button:', trackingBtn);
  if (trackingBtn) {
    trackingBtn.addEventListener('click', toggleTracking);
    console.log('Added click listener to tracking button');
  } else {
    console.error('Tracking button not found');
  }

  if (restartAllBtn) {
    restartAllBtn.addEventListener('click', restartAll);
    console.log('Added click listener to restart all button');
  } else {
    console.error('Restart all button not found');
  }

  // Initialize tabs
  initializeTabs();

  // Initialize the popup
  checkTrackingStatus();
  updateMainStats();

  // Set up periodic updates for main stats
  setInterval(updateMainStats, 1000);

  // Check if it's the first time use
  chrome.storage.local.get(['focusGoal'], (result) => {
    if (!result.focusGoal) {
      showOnboardingScreen();
    }
  });

  // Set up event listeners for new buttons
  document.getElementById('setFocusGoalBtn').addEventListener('click', setFocusGoal);
  document.getElementById('updateFocusGoalBtn').addEventListener('click', showUpdateFocusGoalModal);
  document.getElementById('saveFocusGoalBtn').addEventListener('click', updateFocusGoal);
  document.getElementById('cancelUpdateGoalBtn').addEventListener('click', hideUpdateFocusGoalModal);

  // Load initial reports and activity log
  loadReports();
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
    startMainStatsUpdate();
  } else {
    trackingBtn.innerHTML = '<i class="material-icons">play_arrow</i> Start Tracking';
    trackingBtn.classList.remove('tracking');
    stopMainStatsUpdate();
  }
  console.log('Tracking button updated:', trackingBtn.outerHTML);
}

function checkTrackingStatus() {
  chrome.runtime.sendMessage({ action: 'getTrackingStatus' }, (response) => {
    console.log('Tracking status:', response);
    if (response && response.isTracking !== undefined) {
      setTrackingButtonState(response.isTracking);
      if (response.isTracking) {
        startMainStatsUpdate(); // Start updating stats if tracking is active
      }
    } else {
      console.error('Failed to get tracking status');
    }
  });
}

function updateMainStats() {
  chrome.runtime.sendMessage({ action: 'getTrackingTimes' }, (response) => {
    console.log('Tracking times:', response);
    if (response) {
      document.getElementById('currentSessionTime').textContent = formatTime(response.currentSessionTime);
      document.getElementById('totalTimeTracked').textContent = formatTime(response.totalTimeTracked);
    } else {
      console.error('Failed to get tracking times');
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

function loadReports() {
  console.log('Loading reports...');
  const reportsElement = document.getElementById('reports');
  // Clear previous content
  reportsElement.innerHTML = '<h2><i class="material-icons">assessment</i> Reports</h2>';

  chrome.runtime.sendMessage({ action: 'getAllDomainTimes' }, (response) => {
    if (response && response.status === 'success') {
      const allDomainTimes = response.allDomainTimes;
      console.log('Received allDomainTimes:', allDomainTimes);

      // Calculate total time
      const totalTime = Object.values(allDomainTimes).reduce((sum, data) => sum + data.timeSpent, 0);

      // Create URL time table
      const urlTable = createTable('Time Spent on URLs', ['URL', 'Time Spent', '% of Total']);
      const urlData = Object.entries(allDomainTimes)
        .map(([domain, data]) => ({
          domain,
          timeSpent: data.timeSpent,
          percentage: (data.timeSpent / totalTime) * 100
        }))
        .sort((a, b) => b.timeSpent - a.timeSpent); // Sort by time spent, descending

      populateTable(urlTable, urlData, (data) => [
        data.domain,
        formatTime(data.timeSpent),
        `${data.percentage.toFixed(2)}%`
      ]);
      reportsElement.appendChild(urlTable);

      // Create Category time table
      const categoryTable = createTable('Time Spent in Categories', ['Category', 'Time Spent', '% of Total']);
      const categoryTimes = {};
      Object.entries(allDomainTimes).forEach(([domain, data]) => {
        const category = data.category || 'Uncategorized';
        categoryTimes[category] = (categoryTimes[category] || 0) + data.timeSpent;
      });

      const categoryData = Object.entries(categoryTimes)
        .map(([category, time]) => ({
          category,
          timeSpent: time,
          percentage: (time / totalTime) * 100
        }))
        .sort((a, b) => b.timeSpent - a.timeSpent); // Sort by time spent, descending

      populateTable(categoryTable, categoryData, (data) => [
        data.category,
        formatTime(data.timeSpent),
        `${data.percentage.toFixed(2)}%`
      ]);
      reportsElement.appendChild(categoryTable);

      // Add Restart All button
      const restartControls = document.createElement('div');
      restartControls.id = 'restartControls';
      const restartAllBtn = document.createElement('button');
      restartAllBtn.id = 'restartAllBtn';
      restartAllBtn.textContent = 'Restart All';
      restartAllBtn.addEventListener('click', restartAll);
      restartControls.appendChild(restartAllBtn);
      reportsElement.appendChild(restartControls);
    } else {
      console.error('Failed to get all domain times:', response);
      reportsElement.innerHTML += '<p>Failed to load report data.</p>';
    }
  });
}

function getCategoryForDomain(domain) {
  // Implement this function to return the category for a given domain
  // You might need to store and retrieve this information from chrome.storage
  return 'Uncategorized'; // Placeholder
}

function createTable(title, headers) {
  const table = document.createElement('table');
  table.innerHTML = `
    <caption>${title}</caption>
    <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
  `;
  return table;
}

function populateTable(table, data, rowDataFunction) {
  data.forEach((item) => {
    const row = table.insertRow();
    const rowData = rowDataFunction(item);
    rowData.forEach(cellData => {
      const cell = row.insertCell();
      cell.textContent = cellData;
    });
  });
}

function loadCategories() {
  console.log('Loading categories...');
  chrome.runtime.sendMessage({ action: 'getCategories' }, (response) => {
    if (response && response.categories) {
      categories = response.categories;
      const categoriesElement = document.getElementById('categories');
      categoriesElement.innerHTML = '<h3>Categories</h3>';

      // Display existing categories
      const categoryList = document.createElement('div');
      categoryList.id = 'categoryList';
      categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.textContent = category;
        categoryList.appendChild(categoryDiv);
      });
      categoriesElement.appendChild(categoryList);

      // Add new category input
      const newCategoryDiv = document.createElement('div');
      newCategoryDiv.innerHTML = `
        <input type="text" id="newCategoryInput" placeholder="New category name">
        <button id="addCategoryBtn">Add Category</button>
      `;
      categoriesElement.appendChild(newCategoryDiv);

      // Add event listener for adding new category
      document.getElementById('addCategoryBtn').addEventListener('click', addNewCategory);

      // Display domains for categorization
      displayDomainsForCategorization(categoriesElement);
    } else {
      console.error('Failed to load categories');
    }
  });
}

function addNewCategory() {
  const newCategoryInput = document.getElementById('newCategoryInput');
  const newCategory = newCategoryInput.value.trim();
  if (newCategory && !categories.includes(newCategory)) {
    chrome.runtime.sendMessage({ action: 'addCategory', category: newCategory }, (response) => {
      if (response && response.status === 'success') {
        newCategoryInput.value = '';
        loadCategories(); // Reload categories to display the new one
      } else {
        console.error('Failed to add new category');
      }
    });
  }
}

function displayDomainsForCategorization(categoriesElement) {
  chrome.runtime.sendMessage({ action: 'getAllDomainTimes' }, (response) => {
    if (response && response.status === 'success') {
      const allDomainTimes = response.allDomainTimes;
      const urlList = document.createElement('div');
      urlList.id = 'urlList';
      urlList.innerHTML = '<h3>Domains to Categorize</h3>';

      const table = document.createElement('table');
      table.innerHTML = `
        <tr>
          <th>Domain</th>
          <th>Category</th>
        </tr>
      `;

      Object.keys(allDomainTimes).sort().forEach(domain => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${domain}</td>
          <td>
            <select data-domain="${domain}">
              <option value="">Select a category</option>
              ${categories.map(cat => `<option value="${cat}" ${allDomainTimes[domain].category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </td>
        `;
        table.appendChild(row);
      });

      urlList.appendChild(table);
      categoriesElement.appendChild(urlList);

      // Add event listener for category changes
      urlList.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
          const domain = e.target.dataset.domain;
          const newCategory = e.target.value;
          updateDomainCategory(domain, newCategory);
        }
      });
    } else {
      console.error('Failed to get all domain times:', response);
      categoriesElement.innerHTML += '<p>Failed to load domains for categorization.</p>';
    }
  });
}

function updateDomainCategory(domain, category) {
  chrome.runtime.sendMessage({ 
    action: 'updateDomainCategory', 
    domain: domain, 
    category: category 
  }, (response) => {
    if (response && response.status === 'success') {
      console.log(`Category updated for ${domain} to ${category}`);
      loadReports(); // Refresh the reports to reflect the change
    } else {
      console.error('Failed to update category:', response);
    }
  });
}

let mainStatsInterval;

function startMainStatsUpdate() {
  clearInterval(mainStatsInterval);
  updateMainStats(); // Update immediately when starting
  mainStatsInterval = setInterval(updateMainStats, 1000);
}

function stopMainStatsUpdate() {
  clearInterval(mainStatsInterval);
}

function restartAll() {
  if (confirm('Are you sure you want to restart all tracking data? This action cannot be undone.')) {
    chrome.runtime.sendMessage({ action: 'restartAll' }, (response) => {
      if (response && response.status === 'success') {
        console.log('All tracking data has been reset');
        updateMainStats();
        loadReports();
      } else {
        console.error('Failed to restart all tracking data:', response);
      }
    });
  }
}

function showOnboardingScreen() {
  document.getElementById('onboardingScreen').classList.remove('hidden');
  // Hide other content
  document.querySelector('.tab').classList.add('hidden');
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
}

function setFocusGoal() {
  const focusGoal = document.getElementById('focusGoalInput').value.trim();
  if (focusGoal) {
    saveFocusGoal(focusGoal);
    document.getElementById('onboardingScreen').classList.add('hidden');
    // Show main content
    document.querySelector('.tab').classList.remove('hidden');
    document.getElementById('reports').classList.remove('hidden');
  } else {
    alert('Please enter a focus goal.');
  }
}

function saveFocusGoal(goal) {
  const timestamp = new Date().toISOString();
  chrome.storage.local.set({ focusGoal: { goal, timestamp } }, () => {
    console.log('Focus goal saved:', goal);
    updateActivityLog(`Focus goal set: ${goal}`);
  });
}

function showUpdateFocusGoalModal() {
  document.getElementById('updateFocusGoalModal').classList.remove('hidden');
}

function hideUpdateFocusGoalModal() {
  document.getElementById('updateFocusGoalModal').classList.add('hidden');
}

function updateFocusGoal() {
  const newGoal = document.getElementById('updateFocusGoalInput').value.trim();
  if (newGoal) {
    saveFocusGoal(newGoal);
    hideUpdateFocusGoalModal();
  } else {
    alert('Please enter a new focus goal.');
  }
}

function updateActivityLog(entry) {
  chrome.runtime.sendMessage({ action: 'addActivityLogEntry', entry }, (response) => {
    if (response && response.status === 'success') {
      console.log('Activity log updated');
    } else {
      console.error('Failed to update activity log');
    }
  });
}
