// ─── content.js ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'scrapeNow') {
    try {
      const data = scrapeProfile();
      sendResponse({ status: 'done', data });
    } catch (err) {
      console.error('Scrape error:', err);
      sendResponse({ status: 'error', message: err.message });
    }
    return false;
  }
});

function scrapeProfile() {

  // ── NAME ──────────────────────────────────────────────────────────────────
  const topSection = Array.from(document.querySelectorAll('section'))[1];
  const name = topSection?.querySelector('h2')?.innerText?.trim() ?? null;

  // ── HEADLINE + LOCATION ───────────────────────────────────────────────────
  const topParas = Array.from(topSection?.querySelectorAll('p') ?? [])
    .map(p => p.innerText.trim())
    .filter(t => t && t !== name && t.length > 3);

  // Pronoun line: short, matches a known closed set
  const pronounSet = ['He/Him', 'She/Her', 'They/Them'];
  const pronouns = topParas.find(t => pronounSet.includes(t)) ?? null;
  // Location: has a comma, no " · " separator (company/school lines use " · ")
  const locations = topParas.find(t => t.includes(',') && !t.includes(' · ')) ?? null;
  // Company/school summary: contains " · " joining two org names
  const orgSummary = topParas.find(t => t.includes(' · ') && t !== locations) ?? null;

  // Headline: whatever's left after removing pronoun, location, orgSummary, and any leftover verification text
  const headline = topParas.find(t =>
    t !== pronouns &&
    t !== locations &&
    t !== orgSummary &&
    !t.toLowerCase().includes('verify')
  ) ?? null;

  const location = topParas.find(t =>
    t.includes(',') && !t.includes(' at ') && !t.includes('·')
  ) ?? null;

  // ── COMPANY ───────────────────
  const companyIcon = topSection?.querySelector('svg#company-accent-4');
  const company = companyIcon
    ?.closest('div')
    ?.querySelector('p span')
    ?.innerText?.trim() ?? null;

  // ── ABOUT ─────────────────────────────────────────────────────────────────

  const about = document.querySelector('section[componentkey$="About"] [data-testid="expandable-text-box"]')
    ?.innerText?.trim()?.replace(/…\s*more\s*$/i, '') // strip the trailing "… more" toggle text
 ?? null;

  // ── EXPERIENCE ────────────────────────────────────────────────────────────

  const expSection = document.querySelector('section[componentkey$="ExperienceTopLevelSection"]');
  const experience = Array.from(expSection?.querySelectorAll('a[tabindex="0"]') ?? [])
  .map(link => {
    
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
    
    let dateRangePart = typeof ps[2] === 'string' ? ps[2] : '';
    let duration = null;

    // 1. Split by dot to extract duration
    if (dateRangePart.includes('·')) {
      const primaryParts = dateRangePart.split('·');
      dateRangePart = primaryParts[0] ?? '';
      duration = primaryParts[1]?.trim() ?? null;
    }

    // 2. Split by hyphen to separate dates
    const dateParts = dateRangePart
      .split('-')
      .map(part => part.trim())
      .filter(Boolean);
    const startDate = dateParts[0] ?? null;
    const endDate = dateParts[1] ?? null; 

    return {
      title:   ps[0] ?? null,
      company: ps[1] ?? null,
      location: ps[3] ?? null,
      endDate : endDate ?? null,
      startDate: startDate ?? null,
      duration: duration ?? null
    };
  }).filter(exp => exp.title && exp.company); // drop empty cards

  // ── EDUCATION ─────────────────────────────────────────────────────────────

  const eduSection = document.querySelector('section[componentkey$="EducationTopLevelSection"]');
  const education = Array.from(eduSection?.querySelectorAll('a[tabindex="0"]') ?? [])
  .map(link => {
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
     // Split the date string by hyphen (handles standard, en-dash, and em-dash)
    const dateParts = ps[2] ? ps[2].split(/[-–—]/) : [];
    
    return {
      school: ps[0] ?? null,
      degree: ps[1] ?? null,
      startDate: dateParts[0]?.trim() ?? null,
      endDate: dateParts[1]?.trim() ?? null,
    };
  }).filter(edu => edu.school); // drop empty cards

  // ── SKILLS ────────────────────────────────────────────────────────────────
  // Stable anchor: componentkey="com.linkedin.sdui.profile.skill(...)"
  // Skill name = first <p> > <span> inside each skill card
  const skillSection = document.querySelector('section[componentkey$="Skills"]');
  const skills = Array.from(skillSection?.querySelectorAll('[componentkey^="com.linkedin.sdui.profile.skill"]') ?? [])
  .map(card =>card.querySelector('p > span')?.innerText?.trim() ?? null)
  .filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i);

  // ── ACTIVITY (followers + recent posts) ──────────────────────────────────
  // Section is identified by its h2 text "Activity" — same pattern as other
  // sections but this one doesn't use a stable componentkey suffix, so we find it by heading text instead.
  const activitySection = Array.from(document.querySelectorAll('section'))
   .find(s => s.querySelector('h2')?.innerText?.trim() === 'Activity');

  const normalizeFollowers = (value) => {
    if (value == null) return null;
    const match = String(value).replace(/,/g, '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const followersText = activitySection?.querySelector('p')?.innerText?.trim() ?? null;
  const followers = normalizeFollowers(followersText);

  // Each post lives inside a carousel child <li data-testid="carousel-child-container">
  const postItems = Array.from(activitySection?.querySelectorAll('li[data-testid="carousel-child-container"]') ?? []);

  const posts = postItems.map(item => {
    // post text — same stable testid pattern as About section
    const text = item
      .querySelector('[data-testid="expandable-text-box"]')
      ?.innerText
      ?.replace(/…\s*more\s*$/i, '') // strip the trailing "… more" toggle text
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim() ?? null;

    return text;
  }).filter(Boolean); // drop empty/broken cards

  // ── PROFILE IMAGE ─────────────────────────────────────────────────────────
  // Anchored on componentkey="topcard-logo-image-referencekey" — this block
  const profileImageEl = document.querySelector('[componentkey="topcard-logo-image-referencekey"] img');
  const profileImage = profileImageEl?.src ?? null;


  

 const projSection = document.querySelector('section[componentkey$="Projects"]');
 const projects = Array.from(projSection?.querySelectorAll('div[componentkey^="entity-collection-item-"]') ?? [])
  .map(item => {
    const ps = Array.from(item.querySelectorAll('p'));

    let startDate = null;
    let endDate = null;
    let association = null;

    ps.forEach(p => {
      const text = p.innerText?.trim() ?? '';

      // Association line
      const assocMatch = text.match(/^Associated with\s*(.*)/i);
      if (assocMatch) {
        association = assocMatch[1].trim() || null;
        return;
      }

      // Date range line (contains a month/year-like pattern plus a dash)
      if (/[-–—]/.test(text) && /\d{4}|present/i.test(text)) {
        const parts = text.split(/[-–—]/).map(s => s.trim()).filter(Boolean);
        startDate = parts[0] ?? null;
        endDate = parts[1] ?? null;
      }
    });

    return {
      name: ps[0]?.innerText?.trim() ?? null,
      startDate,
      endDate,
      association,
      description: item.querySelector('[data-testid="expandable-text-box"]')
        ?.innerText?.trim()?.replace(/…\s*more\s*$/i, '') ?? null,
      skills: Array.from(item.querySelectorAll('a[href*="skill-associations-details"]'))
        .map(a => a.innerText.trim())
        .filter(Boolean),
    };
  }).filter(p => p.name);




  const certSection = document.querySelector('section[componentkey$="CertificationTopLevel"]');
  const certifications = Array.from(certSection?.querySelectorAll('div[componentkey^="entity-collection-item-"]') ?? [])
  .map(item => {
    const paragraphNodes = Array.from(item.querySelectorAll('p')).filter(p => !p.closest('a'));
    const ps = paragraphNodes
      .map(p => p.innerText.trim())
      .filter(Boolean);

    const dateParagraph = paragraphNodes.find(p => /Issued|Expires/i.test(p.innerText.trim()));
    const credentialParagraph = paragraphNodes.find(p => /Credential ID/i.test(p.innerText.trim()));

    const parts = ps[2] ? ps[2].split(" · ") : null;
    // 2. Clean up the "Issued " string from the first part
    const startDate = parts && parts[0] ? parts[0].replace("Issued ", "").trim() : null;
    // 3. Clean up the "Expires " string from the second part (if it exists)
    const endDate = parts && parts[1] ? parts[1].replace("Expires ", "").trim() : null;

    const actualId = credentialParagraph
      ? credentialParagraph.innerText.replace(/Credential ID\s*/i, '').trim()
      : null;

    return {
      title: ps[0] ?? null,
      issuer: ps[1] ?? null,
      startDate: startDate,
      endDate: endDate,
      credentialId: actualId,
      skills: item.querySelector('a[href*="skill-associations-details"]')?.innerText?.trim() ?? null,
    };
  }).filter(c => c.title);


  const normalizeInterestFollowers = (value) => {
    if (value == null) return null;
    const match = String(value).replace(/,/g, '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const normalizeInterestName = (value) => {
    if (value == null) return null;
    const lines = String(value)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    return lines[0].replace(/\s+/g, ' ').trim();
  };

const interestsSection = Array.from(document.querySelectorAll('section'))
  .find(s => s.querySelector('h2')?.innerText?.trim().startsWith('Interests'));

const interests = Array.from(interestsSection?.querySelectorAll('a[tabindex="0"]') ?? [])
  .map(a => {
    const ps = Array.from(a.querySelectorAll('p'));
    return {
      name: normalizeInterestName(ps[0]?.innerText?.trim() ?? null),
      followers: normalizeInterestFollowers(ps[ps.length - 1]?.innerText?.trim()),
    };
  }).filter(i => i.name);

  return {
    name, headline, company, location,
    about, experience, education, skills,
    followers, posts,
    projects, certifications, interests,
    profileImage,
    url: window.location.href,
    scrapedAt: new Date().toISOString(),
  };
}