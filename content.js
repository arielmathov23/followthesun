let lastActivityTime = Date.now();

function detectActivity() {
  lastActivityTime = Date.now();
  chrome.runtime.sendMessage({ action: 'activityDetected' });
}

document.addEventListener('mousemove', detectActivity);
document.addEventListener('keydown', detectActivity);
document.addEventListener('scroll', detectActivity);
document.addEventListener('click', detectActivity);

// Periodically check for inactivity
setInterval(() => {
  const inactiveTime = Date.now() - lastActivityTime;
  if (inactiveTime >= 5 * 60 * 1000) { // 5 minutes
    chrome.runtime.sendMessage({ action: 'inactivityDetected' });
  }
}, 60000); // Check every minute
