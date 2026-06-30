// ─── content.js ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'scrapeNow') {
    try {
      const data = scrapeProfile();
      saveAsTxt(data);
      sendResponse({ status: 'done', data });
    } catch (err) {
      console.error('Scrape error:', err);
      sendResponse({ status: 'error', message: err.message });
    }
    return true;
  }
});

function scrapeProfile() {

  // ── NAME ──────────────────────────────────────────────────────────────────
  // section[1] = profile card, always has h2 = person's name
  const topSection = Array.from(document.querySelectorAll('section'))[1];
  const name = topSection?.querySelector('h2')?.innerText?.trim() ?? null;

  // ── HEADLINE + LOCATION ───────────────────────────────────────────────────
  const topParas = Array.from(topSection?.querySelectorAll('p') ?? [])
    .map(p => p.innerText.trim())
    .filter(t => t && t !== name && t.length > 3);

  const headline = topParas[0] ?? null;

  const location = topParas.find(t =>
    t.includes(',') && !t.includes(' at ') && !t.includes('·')
  ) ?? null;
  
  const company = headline?.includes(' at ')
    ? headline.split(' at ').slice(1).join(' at ').trim()
    : null;

  // ── ABOUT ─────────────────────────────────────────────────────────────────
  // data-testid="expandable-text-box" is stable — LinkedIn uses it for testing
  const about = document
    .querySelector('section[componentkey$="About"] [data-testid="expandable-text-box"]')
    ?.innerText?.trim() ?? null;

  // ── EXPERIENCE ────────────────────────────────────────────────────────────
  // Stable anchor: <a href="...edit/forms/position/ID/">
  //   first <p>  = title
  //   second <p> = company
  const expSection = document.querySelector('section[componentkey$="ExperienceTopLevelSection"]');
  const experience = Array.from(
    expSection?.querySelectorAll('a[href*="/edit/forms/position/"]') ?? []
  ).map(link => {
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
    return {
      title:   ps[0] ?? null,
      company: ps[1] ?? null,
    };
  });

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  // Stable anchor: <a href="...details/education/edit/forms/ID/">
  //   first <p>  = school
  //   second <p> = degree (may be absent)
  const eduSection = document.querySelector('section[componentkey$="EducationTopLevelSection"]');
  const education = Array.from(
    eduSection?.querySelectorAll('a[href*="/details/education/edit/forms/"]') ?? []
  ).map(link => {
    const ps = Array.from(link.querySelectorAll('p'))
      .map(p => p.innerText.trim()).filter(Boolean);
    return {
      school: ps[0] ?? null,
      degree: ps[1] ?? null,
    };
  })

  // ── SKILLS ────────────────────────────────────────────────────────────────
  // Stable anchor: componentkey="com.linkedin.sdui.profile.skill(...)"
  // Skill name = first <p> > <span> inside each skill card
  const skillSection = document.querySelector('section[componentkey$="Skills"]');
  const skills = Array.from(
    skillSection?.querySelectorAll('[componentkey^="com.linkedin.sdui.profile.skill"]') ?? []
  ).map(card =>
    // first span that is a direct child of a p — the skill label
    card.querySelector('p > span')?.innerText?.trim() ?? null
  ).filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i); // unique

  // ── PROFILE IMAGE ─────────────────────────────────────────────────────────
  const profileImage = topSection?.querySelector('img')?.src ?? null;

  return {
    name, headline, company, location,
    about, experience, education, skills,
    profileImage,
    url:        window.location.href,
    scraped_at: new Date().toISOString(),
  };
}

// ─── save as .txt ─────────────────────────────────────────────────────────────
function saveAsTxt(data) {
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
    ...(data.experience.length
      ? data.experience.map((e, i) => `${i+1}. ${e.title ?? ''} @ ${e.company ?? ''}`)
      : ['N/A']
    ),
    ``,
    `EDUCATION`, `---------`,
    ...(data.education.length
      ? data.education.map((e, i) => `${i+1}. ${e.school ?? ''} — ${e.degree ?? 'N/A'}`)
      : ['N/A']
    ),
    ``,
    `SKILLS`,      `------`,
    data.skills.length ? data.skills.join(', ') : 'N/A',
    ``,
    `PROFILE IMAGE`, `-------------`,
    data.profileImage ?? 'N/A',
  ];

  const blob    = new Blob([lines.join('\n')], { type: 'text/plain' });
  const blobUrl = URL.createObjectURL(blob);
  const filename = `linkedin_${(data.name ?? 'profile').replace(/\s+/g, '_')}_${Date.now()}.txt`;
  const a = document.createElement('a');
  a.href = blobUrl; a.download = filename; a.click();
  URL.revokeObjectURL(blobUrl);
  console.log('✅ Saved:', filename);
}