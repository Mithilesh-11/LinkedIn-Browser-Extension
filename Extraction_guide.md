# LinkedIn Profile Data Extraction — Technical Guide

A detailed explanation of how each field is extracted in the current implementation, which selectors are used, and why the current approach was chosen.

---

## Table of Contents

1. [How the Current Extractor Works](#how-the-current-extractor-works)
2. [Core Concepts in the Current Implementation](#core-concepts-in-the-current-implementation)
3. [Field-by-Field Breakdown](#field-by-field-breakdown)
   - [Name](#1-name)
   - [Headline](#2-headline)
   - [Location](#3-location)
   - [Company](#4-company)
   - [About](#5-about)
   - [Experience](#6-experience)
   - [Education](#7-education)
   - [Skills](#8-skills)
   - [Activity — Followers](#9-activity--followers)
   - [Activity — Posts](#10-activity--posts)
   - [Profile Image](#11-profile-image)
   - [Projects](#12-projects)
   - [Certifications](#13-certifications)
   - [Interests](#14-interests)
   - [Recommendations](#15-recommendations)
4. [Why the Current Approach Was Chosen](#why-the-current-approach-was-chosen)
5. [What Breaks and Why](#what-breaks-and-why)

---

## How the Current Extractor Works

The current implementation is a pragmatic DOM scraper that runs inside the extension content script. It is designed to read the visible LinkedIn profile page, extract a structured object, and return it to the popup/background workflow without relying on a rigid parser or external API.

The extractor uses a mix of:

- stable component-oriented selectors such as `componentkey`
- a few test selectors such as `data-testid`
- simple text heuristics for paragraphs and headings
- optional chaining and `?? []` fallbacks so missing sections do not crash the script

This is the approach that is actually implemented in the project today, rather than an idealized version of a fully generic scraper.

---

## Core Concepts in the Current Implementation

### 1. `componentkey` selectors

The project uses `componentkey` attributes because they are more stable than hashed class names in LinkedIn's DOM.

Examples from the current code:

```js
document.querySelector('section[componentkey$="ExperienceTopLevelSection"]')
document.querySelector('section[componentkey$="Skills"]')
document.querySelector('[componentkey="topcard-logo-image-referencekey"] img')
```

The current implementation uses:

- `$=` for suffix matching such as `ExperienceTopLevelSection` and `About`
- `^=` for prefix matching such as `com.linkedin.sdui.profile.skill`
- an exact match for the top-card photo block

This is more reliable than using raw class names because LinkedIn's class names are generated and often change.

### 2. `data-testid` selectors

The project uses `data-testid="expandable-text-box"` for text content that appears in the About section and in activity posts.

```js
document.querySelector('section[componentkey$="About"] [data-testid="expandable-text-box"]')
```

This is used because LinkedIn's expandable text components expose a stable testid even when the visible text is collapsed or expanded.

### 3. Null-safe DOM access

The implementation does not use a custom `safeList()` helper. Instead, it uses optional chaining and fallback arrays directly:

```js
Array.from(section?.querySelectorAll('a[tabindex="0"]') ?? [])
```

That pattern prevents errors when a section is missing or when a query returns no elements.

### 4. Heuristics for text parsing

Some fields are not extracted through a single exact selector. Instead, the script uses small text-based rules to identify values such as headline, location, followers, and date ranges.

Examples include:

- removing the name from the top paragraph list
- detecting location by checking for a comma and avoiding strings that contain `·` or ` at `
- splitting experience and education date strings around `-`, `–`, or `—`
- normalizing follower counts by extracting digits from text

These heuristics are intentionally simple and practical, which matches the current project’s goals.

---

## Field-by-Field Breakdown

---

### 1. Name

```js
const topSection = Array.from(document.querySelectorAll('section'))[1];
const name = topSection?.querySelector('h2')?.innerText?.trim() ?? null;
```

The script takes the second top-level `<section>` as the profile container and reads the first `<h2>` inside it.

Why this approach is used:

- the top card is consistently the second `<section>` in the current DOM layout
- the profile name is rendered inside an `<h2>` in that section
- using the section context avoids accidentally grabbing a navigation heading elsewhere on the page

---

### 2. Headline

```js
const topParas = Array.from(topSection?.querySelectorAll('p') ?? [])
  .map(p => p.innerText.trim())
  .filter(t => t && t !== name && t.length > 3);

const pronounSet = ['He/Him', 'She/Her', 'They/Them'];
const pronouns = topParas.find(t => pronounSet.includes(t)) ?? null;
const locations = topParas.find(t => t.includes(',') && !t.includes(' · ')) ?? null;
const orgSummary = topParas.find(t => t.includes(' · ') && t !== locations) ?? null;

const headline = topParas.find(t =>
  t !== pronouns &&
  t !== locations &&
  t !== orgSummary &&
  !t.toLowerCase().includes('verify')
) ?? null;
```

The headline is not pulled from a single dedicated selector. Instead, the implementation collects paragraph text from the top section and filters it down to the paragraph that remains after removing obvious noise.

The current logic is designed to exclude:

- the person's name
- pronoun lines such as `He/Him`
- location text
- org summary lines such as `Company · School`
- LinkedIn verification banner text such as `Verify in 2 minutes`

This is a practical heuristic rather than a perfect parser.

---

### 3. Location

```js
const location = topParas.find(t =>
  t.includes(',') && !t.includes(' at ') && !t.includes('·')
) ?? null;
```

The current script identifies location by looking for a paragraph that contains a comma and does not look like a headline or an org summary.

This heuristic works because profile locations are usually written in a `City, State, Country` style, while the headline usually contains `at` and the company/school line uses `·`.

---

### 4. Company

```js
const companyIcon = topSection?.querySelector('svg#company-accent-4');
const company = companyIcon
  ?.closest('div')
  ?.querySelector('p span')
  ?.innerText?.trim() ?? null;
```

The company name is taken from the company tag context near the SVG icon. The current implementation uses the company accent icon because it is a known stable anchor in the top card markup.

This avoids parsing the company from the headline text, which is less reliable and often varies by profile wording.

---

### 5. About

```js
const about = document.querySelector('section[componentkey$="About"] [data-testid="expandable-text-box"]')
  ?.innerText?.trim()?.replace(/…\s*more\s*$/i, '') ?? null;
```

The About text is extracted from the About section using a component key suffix selector plus the expandable text container testid.

The implementation also strips the trailing `… more` text that LinkedIn adds to collapsed expandable blocks.

---

### 6. Experience

```js
const expSection = document.querySelector('section[componentkey$="ExperienceTopLevelSection"]');
const experience = Array.from(expSection?.querySelectorAll('a[tabindex="0"]') ?? [])
  .map(link => {
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);

    let dateRangePart = typeof ps[2] === 'string' ? ps[2] : '';
    let duration = null;

    if (dateRangePart.includes('·')) {
      const primaryParts = dateRangePart.split('·');
      dateRangePart = primaryParts[0] ?? '';
      duration = primaryParts[1]?.trim() ?? null;
    }

    const dateParts = dateRangePart
      .split('-')
      .map(part => part.trim())
      .filter(Boolean);

    const startDate = dateParts[0] ?? null;
    const endDate = dateParts[1] ?? null;

    return {
      title: ps[0] ?? null,
      company: ps[1] ?? null,
      location: ps[3] ?? null,
      endDate: endDate ?? null,
      startDate: startDate ?? null,
      duration: duration ?? null
    };
  }).filter(exp => exp.title && exp.company);
```

Experience entries are parsed from anchor cards found inside the Experience section. Each card is converted into an object by reading its `<p>` nodes in order.

The current implementation also parses:

- `startDate` and `endDate` from date strings by splitting on `-`
- `duration` from a secondary piece after `·`

The filtering step removes empty or non-entry links so the result stays clean.

---

### 7. Education

```js
const eduSection = document.querySelector('section[componentkey$="EducationTopLevelSection"]');
const education = Array.from(eduSection?.querySelectorAll('a[tabindex="0"]') ?? [])
  .map(link => {
    const ps = Array.from(link.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
    const dateParts = ps[2] ? ps[2].split(/[-–—]/) : [];

    return {
      school: ps[0] ?? null,
      degree: ps[1] ?? null,
      startDate: dateParts[0]?.trim() ?? null,
      endDate: dateParts[1]?.trim() ?? null,
    };
  }).filter(edu => edu.school);
```

Education entries follow the same anchor-card model as experience, but the parser is simpler and focuses on the school, degree, and date range.

Date values are split on common dash characters so the extractor can separate start and end dates.

---

### 8. Skills

```js
const skillSection = document.querySelector('section[componentkey$="Skills"]');
const skills = Array.from(skillSection?.querySelectorAll('[componentkey^="com.linkedin.sdui.profile.skill"]') ?? [])
  .map(card => card.querySelector('p > span')?.innerText?.trim() ?? null)
  .filter(Boolean)
  .filter((v, i, arr) => arr.indexOf(v) === i);
```

Skills are pulled from skill cards whose `componentkey` starts with the LinkedIn skill component prefix. The script reads the first `<span>` inside the first `<p>` and then deduplicates the result.

This is one of the most stable selectors in the current implementation because the skill cards expose a component prefix that is specific to the skill UI.

---

### 9. Activity — Followers

```js
const activitySection = Array.from(document.querySelectorAll('section'))
  .find(s => s.querySelector('h2')?.innerText?.trim() === 'Activity');

const followersText = activitySection?.querySelector('p')?.innerText?.trim() ?? null;
const followers = normalizeFollowers(followersText);
```

The Activity section is identified by its visible heading text `Activity`. The follower count is read from the first paragraph inside that section and normalized to a number.

The normalization step removes commas and extracts the first numeric value from the string.

---

### 10. Activity — Posts

```js
const postItems = Array.from(activitySection?.querySelectorAll('li[data-testid="carousel-child-container"]') ?? []);

const posts = postItems.map(item => {
  const text = item
    .querySelector('[data-testid="expandable-text-box"]')
    ?.innerText
    ?.replace(/…\s*more\s*$/i, '')
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim() ?? null;

  return text;
}).filter(Boolean);
```

Recent activity posts are extracted from the carousel child containers. The parser looks for the same expandable text component used by the About section and then cleans the text by removing UI artifacts and punctuation.

---

### 11. Profile Image

```js
const profileImageEl = document.querySelector('[componentkey="topcard-logo-image-referencekey"] img');
const profileImage = profileImageEl?.src ?? null;
```

The profile image is taken from the specific top-card photo block. The implementation scopes the query to the exact `componentkey` for the top-card image reference so it does not accidentally pick up unrelated images on the page.

---

### 12. Projects

```js
const projSection = document.querySelector('section[componentkey$="Projects"]');
const projects = Array.from(projSection?.querySelectorAll('div[componentkey^="entity-collection-item-"]') ?? [])
  .map(item => {
    const ps = Array.from(item.querySelectorAll('p'));

    let startDate = null;
    let endDate = null;
    let association = null;

    ps.forEach(p => {
      const text = p.innerText?.trim() ?? '';

      const assocMatch = text.match(/^Associated with\s*(.*)/i);
      if (assocMatch) {
        association = assocMatch[1].trim() || null;
        return;
      }

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
```

Projects are parsed from entity collection items inside a Projects section. The extractor reads the first paragraph as the project name, looks for an `Associated with` line, detects start/end dates from date-like text, and captures the expandable description and skill links.

---

### 13. Certifications

```js
const certSection = document.querySelector('section[componentkey$="CertificationTopLevel"]');
const certifications = Array.from(certSection?.querySelectorAll('div[componentkey^="entity-collection-item-"]') ?? [])
  .map(item => {
    const paragraphNodes = Array.from(item.querySelectorAll('p')).filter(p => !p.closest('a'));
    const ps = paragraphNodes.map(p => p.innerText.trim()).filter(Boolean);

    const credentialParagraph = paragraphNodes.find(p => /Credential ID/i.test(p.innerText.trim()));

    const parts = ps[2] ? ps[2].split(" · ") : null;
    const startDate = parts && parts[0] ? parts[0].replace("Issued ", "").trim() : null;
    const endDate = parts && parts[1] ? parts[1].replace("Expires ", "").trim() : null;

    const actualId = credentialParagraph ? credentialParagraph.innerText.replace(/Credential ID\s*/i, '').trim() : null;

    return {
      title: ps[0] ?? null,
      issuer: ps[1] ?? null,
      startDate: startDate,
      endDate: endDate,
      credentialId: actualId,
      skills: item.querySelector('a[href*="skill-associations-details"]')?.innerText?.trim() ?? null,
    };
  }).filter(c => c.title);
```

Certification cards are extracted in the same entity-collection pattern as projects. The parser looks for the title, issuer, dates embedded in a `Issued ... · Expires ...` style string, and a credential ID label when present.

---

### 14. Interests

```js
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
```

Interests are extracted from the section whose heading begins with `Interests`. Each interest entry is parsed from its anchor card and the follower count is normalized if present.

---

### 15. Recommendations

```js
const recSection = document.querySelector('section[componentkey$="RecommendationsTopLevel"]');

const recommendations = Array.from(recSection?.querySelectorAll('a[href*="linkedin.com/in/"]') ?? [])
  .map(link => {
    const container = link.closest('div[componentkey]') ?? link;
    const ps = Array.from(container.querySelectorAll('p'));

    const nameSpan = ps[0]?.querySelector('span');
    const name = nameSpan?.childNodes[0]?.textContent?.trim() ?? null;

    return {
      name,
      headline: ps[2]?.innerText?.trim() ?? null,
      dateAndRelationship: ps[3]?.innerText?.trim() ?? null,
      text: container.querySelector('[data-testid="expandable-text-box"]')
        ?.innerText?.trim()?.replace(/…\s*more\s*$/i, '') ?? null,
    };
  }).filter(r => r.name);
```

Recommendations are extracted from the Recommendations section by finding recommendation cards linked to LinkedIn profile URLs and reading their visible text blocks.

---

## Why the Current Approach Was Chosen

The current implementation favors practicality over completeness.

It was chosen because it:

- works directly in the browser without a server or credentials
- avoids brittle class-name selectors that change often
- uses the DOM structure that is visible in the current LinkedIn UI
- preserves partial data when sections are missing
- keeps the scraper small and understandable for an extension workflow

It is intentionally pragmatic: when the structure is predictable enough, the script uses a direct selector; when it is not, it falls back to simple text heuristics.

---

