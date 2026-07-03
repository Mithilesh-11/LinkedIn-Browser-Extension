const BACKEND_URL = 'http://localhost:3000/api/candidates';

function sendToPostgreSQL(candidate, callback) {
  fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(candidate),
    mode: 'cors',
  })
    .then(async (response) => {
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data?.message || `Server returned ${response.status}`);
      }

      console.log('Sent to PostgreSQL:', data);
      if (callback) callback({ status: 'done', dbData: data });
    })
    .catch((error) => {
      console.error('Failed to send to PostgreSQL:', error);
      if (callback) callback({ status: 'error', error: error.message });
    });
}

function saveCandidate(candidate, callback) {
  const normalized = {
    ...candidate,
    url: candidate?.url|| null,
  };

  sendToPostgreSQL(normalized, (dbResult) => {
    callback({
      status: 'done',
      dbStatus: dbResult?.status || 'error',
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadProfileJson') {
    const data = message.data;
    saveCandidate(data, (saveResult) => {
      const filename = `linkedin_${(data?.name ?? 'profile').replace(/\s+/g, '_')}_${Date.now()}.json`;
      const content = JSON.stringify(
        data,
        (key, value) => {
          if (value === null || value === undefined) return undefined;
          if (Array.isArray(value) && value.length === 0) return undefined;
          return value;
        },
        2
      );
      const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);

      chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          console.error('Download failed:', chrome.runtime.lastError);
          sendResponse({ status: 'error', message: chrome.runtime.lastError?.message ?? 'download failed' });
          return;
        }
        sendResponse({
          status: 'done',
          downloadId,
          count: saveResult.count,
          candidates: saveResult.candidates,
        });
      });
    });

    return true;
  }

  if (message.action === 'getStoredCandidates') {
    getStoredCandidates((candidates) => {
      sendResponse({ status: 'done', candidates });
    });
    return true;
  }
});
