chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadProfileJson' || message.action === 'downloadProfileTxt') {
    const data = message.data;
    const filename = `linkedin_${(data.name ?? 'profile').replace(/\s+/g, '_')}_${Date.now()}.json`;
    const content = JSON.stringify(data, null, 2);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);

    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        console.error('Download failed:', chrome.runtime.lastError);
        sendResponse({ status: 'error', message: chrome.runtime.lastError?.message ?? 'download failed' });
        return;
      }
      sendResponse({ status: 'done', downloadId });
    });

    return true;
  }
});
