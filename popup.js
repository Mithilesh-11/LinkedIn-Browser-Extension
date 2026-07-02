document.addEventListener('DOMContentLoaded', () => {

  const btn        = document.getElementById('extractBtn');
  const btnLabel    = document.getElementById('btnLabel');
  const spinner     = document.getElementById('spinner');
  const dot         = document.getElementById('dot');
  const targetLabel = document.getElementById('targetLabel');
  const historyCount = document.getElementById('historyCount');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');

  let currentTab = null;

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
      const company = candidate?.company || 'No company';
      const location = candidate?.location || 'No location';
      const about = candidate?.about || 'No about';
      const followers = candidate?.followers || 'N/A';
      const url = candidate?.url || null;
      const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];
      const dateStr = candidate?.created_at || candidate?.saved_at || null;
      const date = dateStr ? new Date(dateStr).toLocaleDateString() : 'Recently';

      const skillsHtml = skills.length > 0
        ? skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')
        : '<span class="empty">No skills listed</span>';

      return `
        <li class="history-item" data-idx="${idx}">
          <div class="history-item-header">
            <div class="history-item-basic">
              <div class="history-name">${name}</div>
              <div class="history-meta">${headline}</div>
              <div class="history-meta">${location}</div>
              ${url ? `<div class="history-url"><a href="${url}" target="_blank">View Profile</a></div>` : ''}
              <div class="history-date">${date}</div>
            </div>
            <div class="history-item-toggle">...more</div>
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

    // Add click handlers for expanding items
    document.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
        const toggle = item.querySelector('.history-item-toggle');
        toggle.textContent = item.classList.contains('expanded') ? '...less' : '...more';
      });
    });
  }

  function loadHistory() {
    const BACKEND_URL = 'http://localhost:3000/api/candidates';
    
    fetch(`${BACKEND_URL}?limit=5`)
      .then((response) => response.json())
      .then((data) => {
        let candidates = data.candidates || [];
        
        // Filter out duplicates based on URL
        const seenUrls = new Set();
        candidates = candidates.filter((candidate) => {
          const url = candidate?.url || null;
          if (!url) return true; // Keep candidates without URL
          
          if (seenUrls.has(url)) {
            return false; // Skip duplicate
          }
          seenUrls.add(url);
          return true; // Keep first occurrence
        });
        
        renderHistory(candidates);
      })
      .catch((error) => {
        console.error('Failed to load candidates from database:', error);
        historyCount.textContent = '0';
        historyEmpty.style.display = 'block';
        historyList.innerHTML = '';
      });
  }

  // ── check active tab on open ─────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    currentTab = tabs[0];
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
  });

  loadHistory();

  // ── extract button ───────────────────────────────────
  btn.addEventListener('click', () => {
    if (!currentTab) return;

    btn.disabled = true;
    spinner.classList.add('show');
    btnLabel.textContent = 'Reading profile…';

    chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeNow' }, (response) => {
      if (chrome.runtime.lastError || !response || response.status !== 'done') {
        spinner.classList.remove('show');
        btn.disabled = false;
        btnLabel.textContent = 'Try again';
        setTimeout(() => { btnLabel.textContent = 'Extract profile data'; }, 2000);
        return;
      }

      chrome.runtime.sendMessage({ action: 'downloadProfileJson', data: response.data }, (downloadResponse) => {
          spinner.classList.remove('show');
          btn.disabled = false;

          if (chrome.runtime.lastError || !downloadResponse || downloadResponse.status !== 'done') {
            btnLabel.textContent = 'Try again';
            setTimeout(() => { btnLabel.textContent = 'Extract profile data'; }, 1200);
            return;
          }

          loadHistory();
          btnLabel.textContent = 'Saved ✓';
          setTimeout(() => { btnLabel.textContent = 'Extract profile data'; }, 1200);
        }
      );
    });
  });

});