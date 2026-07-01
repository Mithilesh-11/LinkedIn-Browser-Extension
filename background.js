chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadProfileTxt') {
    const data = message.data;
    const filename = `linkedin_${(data.name ?? 'profile').replace(/\s+/g, '_')}_${Date.now()}.txt`;
    const lines = [
      `LinkedIn Profile`,
      `================`,
      `Scraped: ${data.scraped_at}`,
      `URL:     ${data.url}`,
      ``,
      `NAME`,        `----`,      data.name     ?? 'N/A', ``,
      `HEADLINE`,    `--------`,  data.headline ?? 'N/A', ``,
      `COMPANY`,     `-------`,   data.company  ?? 'N/A', ``,
      `LOCATION`,    `--------`,  data.location ?? 'N/A', ``,
      `ABOUT`,       `-----`,     data.about    ?? 'N/A', ``,
      `EXPERIENCE`,  `----------`,
      ...(data.experience?.length
        ? data.experience.map((e, i) => `${i+1}. ${e.title ?? ''} @ ${e.company ?? ''} (${e.Dates ?? 'N/A'}, ${e.Location ?? 'N/A'})`)
        : ['N/A']
      ),
      ``,
      `EDUCATION`, `---------`,
      ...(data.education?.length
        ? data.education.map((e, i) => `${i+1}. ${e.school ?? ''} — ${e.degree ?? 'N/A'} (${e.Dates ?? 'N/A'})`)
        : ['N/A']
      ),
      ``,
      `SKILLS`,      `------`,
      data.skills?.length ? data.skills.join(', ') : 'N/A',
      ``,
      `ACTIVITY`, `--------`,
      `Followers: ${data.followers ?? 'N/A'}`,
      ``,
      `RECENT POSTS`, `------------`,
      ...(data.posts?.length
        ? data.posts.flatMap((text, i) => [`${i + 1}. ${text}`, ``])
        : ['N/A']
      ),
      `PROFILE IMAGE`, `-------------`,
      data.profileImage ?? 'N/A',
    ];

    const content = lines.join('\n');
    const url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);

    chrome.downloads.download({url,filename,saveAs: false, }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          console.error('Download failed:', chrome.runtime.lastError);
          sendResponse({ status: 'error', message: chrome.runtime.lastError?.message ?? 'download failed' });
          return;
        }
        sendResponse({ status: 'done', downloadId });
      }
    );

    return true;
  }
});
