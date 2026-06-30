document.addEventListener('DOMContentLoaded', () => {

  const btn        = document.getElementById('extractBtn');
  const btnLabel    = document.getElementById('btnLabel');
  const spinner     = document.getElementById('spinner');
  const dot         = document.getElementById('dot');
  const targetLabel = document.getElementById('targetLabel');

  let currentTab = null;

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

  // ── extract button ───────────────────────────────────
  btn.addEventListener('click', () => {
    if (!currentTab) return;

    btn.disabled = true;
    spinner.classList.add('show');
    btnLabel.textContent = 'Reading profile…';

    chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeNow' }, (response) => {

      spinner.classList.remove('show');
      btn.disabled = false;

      if (chrome.runtime.lastError || !response || response.status !== 'done') {
        btnLabel.textContent = 'Try again';
        btnLabel.textContent = 'Extract profile data'; 
        return;
      }

      btnLabel.textContent = 'Saved ✓';
      btnLabel.textContent = 'Extract profile data'; 
    });
  });

});