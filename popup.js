import { initEditModal } from './edit-modal.js';

document.addEventListener('DOMContentLoaded', async () => {

  const btn         = document.getElementById('extractBtn');
  const btnLabel    = document.getElementById('btnLabel');
  const spinner     = document.getElementById('spinner');
  const dot         = document.getElementById('dot');
  const targetLabel = document.getElementById('targetLabel');
  const historyCount = document.getElementById('historyCount');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');

  let currentTab = null;

  const editModal = initEditModal({
    onSave: async (updatedCandidate) => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'updateCandidate', candidate: updatedCandidate });
        if (!response || response.status !== 'done') {
          throw new Error(response?.message || 'Update failed.');
        }
        await loadHistory();
        return true;
      } catch (error) {
        console.error('Failed to update candidate:', error);
        return false;
      }
    },
  });
 
  // ── Render History View ──────────────────────────────
  function renderHistory(candidates = []) {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    historyCount.textContent = String(safeCandidates.length);

    if (!safeCandidates.length) {
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';
      return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = safeCandidates.map((candidate, idx) => {
      const name = candidate?.name || 'Unnamed';
      const headline = candidate?.headline || 'No headline';
      const location = candidate?.location || 'No location';
      const about = candidate?.about || 'No about';
      const followers = candidate?.followers || 'N/A';
      const url = candidate?.url || null;
      const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];
      const dateStr = candidate?.createdAt || null;
      const date = dateStr ? new Date(dateStr).toLocaleDateString() : 'Recently';
      const profileImage  = candidate?.profileImage || null;

      const skillsHtml = skills.length > 0
        ? skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')
        : '<span class="empty">No skills listed</span>';

      return `
        <li class="history-item" data-idx="${idx}">
          <div class="history-item-header">
            <div class="history-item-basic">
              ${profileImage ? `<img class="history-profile-image" src="${profileImage}" alt="${name}">` : ''}
              <div class="history-name">${name}</div>
              <div class="history-meta">${headline}</div>
              <div class="history-meta">${location}</div>
              ${url ? `<div class="history-url"><a href="${url}" target="_blank">View Profile</a></div>` : ''}
              <div class="history-date">${date}</div>
            </div>
            <div class="history-item-actions">
              <button type="button" class="history-edit-btn" data-candidate-idx="${idx}">Edit</button>
              <div class="history-item-toggle">...more</div>
            </div>
          </div>
          <div class="history-item-details">
            <div class="detail-row">
              <span class="detail-label">About</span>
              <div class="detail-value">${about}</div>
            </div>
            <div class="detail-row">
              <span class="detail-label">Followers</span>
              <div class="detail-value">${followers}</div>
            </div>
            <div class="detail-row">
              <span class="detail-label">Skills</span>
              <div class="skills-list">${skillsHtml}</div>
            </div>
          </div>
        </li>
      `;
    }).join('');

    // Click handlers for expanding cards
    document.querySelectorAll('.history-item').forEach((item) => {
      const toggle = item.querySelector('.history-item-toggle');
      const editButton = item.querySelector('.history-edit-btn');

      if (toggle) {
        toggle.addEventListener('click', (e) => {
          item.classList.toggle('expanded');
          toggle.textContent = item.classList.contains('expanded') ? '...less' : '...more';
        });
      }

      if (editButton) {
        editButton.addEventListener('click', (e) => {
          const candidateIndex = Number(editButton.dataset.candidateIdx);
          editModal.openEditModal(safeCandidates[candidateIndex]);
        });
      }
    });
  }

  async function loadHistory() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStoredCandidates' });

      if (!response || response.status !== 'done') {
        throw new Error(response?.message || 'History request failed.');
      }

    let candidates = response.candidates ?? [];
      // Deduplicate profiles by URL safely
      const seenUrls = new Set();
      candidates = candidates.filter((candidate) => {
        const url = candidate?.url || null;
        if (!url) return true;
        if (seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
      });

      renderHistory(candidates);
    } catch (error) {
      console.error('Failed to load candidates from database:', error);
      historyCount.textContent = '0';
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';
    }
  }

  // ── Runtime Context Check ────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  const url = currentTab?.url ?? '';

  if (url.includes('linkedin.com/in/')) {
    dot.className = 'dot on';
    const handle = url.split('linkedin.com/in/')[1]?.split('/')[0]?.split('?')[0] ?? 'profile';
    targetLabel.textContent = `On profile: ${handle}`;
    btn.disabled = false;
  } else {
    dot.className = 'dot off';
    targetLabel.textContent = 'Open a LinkedIn profile to begin';
    btn.disabled = true;
  }

  // Populate view immediately on open
  loadHistory();

  // ── Extraction Logic Orchestration ───────────────────
  btn.addEventListener('click', async () => {
    if (!currentTab) return;

    btn.disabled = true;
    spinner.classList.add('show');
    btnLabel.textContent = 'Reading profile…';

    try {
      // 1. Kick off scraping securely through your background architecture channel
      const scrapeResponse = await chrome.runtime.sendMessage({ 
        action: 'initiateScrape', 
        tabId: currentTab.id 
      });

      if (!scrapeResponse || scrapeResponse.status !== 'done') {
        throw new Error('Content script failed execution or timed out.');
      }

      // 2. Pass data downstream to handle local download & PostgreSQL synchronization
      const downloadResponse = await chrome.runtime.sendMessage({ 
        action: 'downloadProfileJson', 
        data: scrapeResponse.data 
      });

      if (!downloadResponse || downloadResponse.status !== 'done') {
        throw new Error('Database serialization/file output script dropped.');
      }

      // Success Updates
      btnLabel.textContent = 'Saved ✓';
      await loadHistory(); // Refresh history panel dynamically

    } catch (err) {
      console.error('Extraction flow broke:', err);
      btnLabel.textContent = 'Try again';
    } finally {
      spinner.classList.remove('show');
      setTimeout(() => { btnLabel.textContent = 'Extract profile data'; btn.disabled = false; }, 2000);
    }
  });
});