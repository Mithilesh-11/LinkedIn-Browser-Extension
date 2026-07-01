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

  const headline = topParas[1] ?? null;

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
  const experience = Array.from(
    expSection?.querySelectorAll('a[tabindex="0"]') ?? []
  ).map(link => {
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
    return {
      title:   ps[0] ?? null,
      company: ps[1] ?? null,
      Dates:   ps[2] ?? null,
      Location: ps[3] ?? null,
    };
  }).filter(exp => exp.title || exp.company); // drop empty cards

  // ── EDUCATION ─────────────────────────────────────────────────────────────

  const eduSection = document.querySelector('section[componentkey$="EducationTopLevelSection"]');
  const education = Array.from(
    eduSection?.querySelectorAll('a[tabindex="0"]') ?? []
  ).map(link => {
    const ps = Array.from(link.querySelectorAll('p'))
      .map(p => p.innerText.trim()).filter(Boolean);
    return {
      school: ps[0] ?? null,
      degree: ps[1] ?? null,
      Dates: ps[2] ?? null,
    };
  }).filter(edu => edu.school); // drop empty cards

  // ── SKILLS ────────────────────────────────────────────────────────────────
  // Stable anchor: componentkey="com.linkedin.sdui.profile.skill(...)"
  // Skill name = first <p> > <span> inside each skill card
  const skillSection = document.querySelector('section[componentkey$="Skills"]');
  const skills = Array.from(
    skillSection?.querySelectorAll('[componentkey^="com.linkedin.sdui.profile.skill"]') ?? []
  ).map(card =>
    card.querySelector('p > span')?.innerText?.trim() ?? null
  ).filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i);

  // ── ACTIVITY (followers + recent posts) ──────────────────────────────────
  // Section is identified by its h2 text "Activity" — same pattern as other
  // sections but this one doesn't use a stable componentkey suffix, so we find it by heading text instead.
  const activitySection = Array.from(document.querySelectorAll('section')).find(
    s => s.querySelector('h2')?.innerText?.trim() === 'Activity'
  );

  const followers = activitySection?.querySelector('p')?.innerText?.trim() ?? null;

  // Each post lives inside a carousel child <li data-testid="carousel-child-container">
  const postItems = Array.from(
    activitySection?.querySelectorAll('li[data-testid="carousel-child-container"]') ?? []
  );

  const posts = postItems.map(item => {
    // post text — same stable testid pattern as About section
    const text = item
      .querySelector('[data-testid="expandable-text-box"]')
      ?.innerText?.trim()
      ?.replace(/…\s*more\s*$/i, '') // strip the trailing "… more" toggle text
      .trim() ?? null;

    return text;
  }).filter(Boolean); // drop empty/broken cards

  // ── PROFILE IMAGE ─────────────────────────────────────────────────────────
  // Anchored on componentkey="topcard-logo-image-referencekey" — this block

  const profileImageBlock = document.querySelector(
    '[componentkey="topcard-logo-image-referencekey"]'
  );
  const profileImageEl = profileImageBlock?.querySelector('img') ?? null;
  const profileImage = profileImageEl?.src ?? null;

  return {
    name, headline, company, location,
    about, experience, education, skills,
    followers, posts,
    profileImage,
    url:        window.location.href,
    scraped_at: new Date().toISOString(),
  };
}