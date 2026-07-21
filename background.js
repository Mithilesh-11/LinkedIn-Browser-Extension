import { EXTENSION_CONFIG } from './config.js';

const BACKEND_URL = EXTENSION_CONFIG?.backendUrl || 'http://localhost:3000/api/candidates';

// ─── STREAMLINED MESSAGE DISPATCHER ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === 'initiateScrape') {
    handleScrapeInit(message.tabId, sendResponse);
    return true; 
  }

  if (message.action === 'downloadProfileJson') {
    handleProfileDownload(message.data, sendResponse);
    return true; 
  }

  if (message.action === 'getStoredCandidates') {
    handleGetCandidates(sendResponse);
    return true; 
  }

  if (message.action === 'updateCandidate') {
    handleUpdateCandidate(message.candidate, sendResponse);
    return true;
  }
});


// ─── ASYNC ACTION HANDLERS ───────────────────────────────────────────────────

async function handleScrapeInit(tabId, sendResponse) {
  try {
    // Await the message reply directly from content.js using Promise format
    const contentResponse = await chrome.tabs.sendMessage(tabId, { action: 'scrapeNow' });
    sendResponse(contentResponse);
  } catch (error) {
    console.error('Content script contact error:', error);
    sendResponse({ status: 'error', message: 'Could not contact page content script.' });
  }
}

async function handleProfileDownload(data, sendResponse) {
  try {
    // 1. Await database write operation
    const saveResult = await saveCandidate(data);
    
    // 2. Prepare JSON backup file configurations
    const filename = `linkedin_${(data?.name ?? 'profile').replace(/\s+/g, '_')}_${Date.now()}.json`;
    const content = JSON.stringify(data, filterNullAndEmpty, 2);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);
 
    // 3. Await native browser file download 
    const downloadId = await chrome.downloads.download({ url, filename, saveAs: false });

    sendResponse({
      status: 'done',
      downloadId,
      dbStatus: saveResult?.status || 'unknown'
    });
  } catch (error) {
    console.error('Processing backup payload failed:', error);
    sendResponse({ status: 'error', message: error.message });
  }
}

async function handleGetCandidates(sendResponse) {
  try {
    const candidates = await getStoredCandidates();
    sendResponse({ status: 'done', candidates });
  } catch (error) {
    sendResponse({ status: 'error', message: error.message });
  }
}

async function handleUpdateCandidate(candidate, sendResponse) {
  try {
    const result = await saveCandidate(candidate);
    sendResponse({ status: 'done', ...result });
  } catch (error) {
    sendResponse({ status: 'error', message: error.message });
  }
}


// ─── ASYNC DATABASE OPERATIONS ───────────────────────────────────────────────

async function sendToPostgreSQL(candidate) {
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(candidate),
    mode: 'cors',
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.message || `Server returned status code: ${response.status}`);
  }

  console.log('Sent to PostgreSQL successfully:', data);
  return { status: 'done', dbData: data };
}

async function saveCandidate(candidate) {
  const normalized = {
    ...candidate,
    url: candidate?.url || null,
  };
  // Wait cleanly for server transaction to finish
  return await sendToPostgreSQL(normalized);
}

async function getStoredCandidates() {
  const res = await fetch(BACKEND_URL);

  if (!res.ok) {
    throw new Error('Could not fetch candidates.');
  }

  const data = await res.json();

  return data.candidates ?? [];
}


// ─── HELPERS ─────────────────────────────────────────────────────────────────
function filterNullAndEmpty(key, value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}