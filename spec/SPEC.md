# Technical Specification — LinkedIn Profile Scraper Chrome Extension

**Product:** LinkedIn Profile Scraper Chrome Extension

---

# 1. Executive Summary

This document defines the technical specification for the current Chrome/Edge extension implementation that extracts structured profile data from an open LinkedIn profile page, exports it as a JSON file, and stores it in a backend database. The solution is composed of a popup UI, a content script for DOM scraping, a background service worker for message orchestration, and a lightweight backend API for persistence and history retrieval.

The current implementation is designed for practical browser-extension usage rather than a fully generalized scraping framework. It focuses on reliable extraction of commonly used profile sections and graceful handling of missing or rearranged DOM elements.

---

# 2. Scope

## 2.1 In Scope

| Module | Description |
| ------ | ----------- |
| Popup UI | Validate the active tab, enable/disable extraction, and display recent profile history. |
| Content Script | Extract structured profile information from the current LinkedIn profile page DOM. |
| Background Worker | Relay scrape requests from the popup to the content script and orchestrate download/database persistence. |
| Persistence Layer | Save extracted data locally as a JSON file and send it to a backend API for storage. |
| History View | Display previously scraped profiles retrieved from the backend. |

## 2.2 Out of Scope

- Automated crawling of multiple profiles.
- Full LinkedIn API integration.
- Authentication or login handling.
- Advanced browser compatibility beyond Chromium-based browsers.
- A fully resilient parser for every possible LinkedIn layout variant.

---

# 3. Functional Requirements

## FR-001 — Detect Active LinkedIn Profile

| Field | Detail |
| ----- | ------ |
| Description | The popup must inspect the current tab URL and enable the Extract button only when the active tab is a LinkedIn profile page. |
| Priority | Critical |
| Acceptance Criteria | The button is disabled for non-profile pages and enabled for URLs matching `linkedin.com/in/`. |

## FR-002 — Trigger Scraping From Popup

| Field | Detail |
| ----- | ------ |
| Description | Clicking the Extract button must start a scrape flow from the popup through the background worker. |
| Priority | Critical |
| Acceptance Criteria | The popup sends an `initiateScrape` message with the active tab ID, and the background worker forwards a `scrapeNow` request to the content script. |

## FR-003 — Extract Structured Profile Fields

| Field | Detail |
| ----- | ------ |
| Description | The content script must collect the current profile’s structured fields from the DOM. |
| Priority | Critical |
| Acceptance Criteria | The returned payload includes `name`, `headline`, `company`, `location`, `about`, `experience`, `education`, `skills`, `followers`, `posts`, `projects`, `certifications`, `interests`, `recommendations`, `profileImage`, `url`, and `scrapedAt`. |

## FR-004 — Export and Persist Data

| Field | Detail |
| ----- | ------ |
| Description | Extracted data must be saved locally as a downloadable JSON file and sent to the backend for persistence. |
| Priority | High |
| Acceptance Criteria | A JSON file is downloaded with a filename based on the profile name and timestamp, and the data is posted to the backend API. |

## FR-005 — Show Scraping History

| Field | Detail |
| ----- | ------ |
| Description | The popup must display previously stored profile records retrieved from the backend. |
| Priority | Medium |
| Acceptance Criteria | The popup loads stored candidates and renders a history list with profile name, headline, location, about text, followers, skills, and URL. |

## FR-006 — Graceful Failure Handling

| Field | Detail |
| ----- | ------ |
| Description | Missing or changed DOM sections must not crash the extension. |
| Priority | High |
| Acceptance Criteria | The scraper returns partial data and logs/report errors when a section is unavailable. |

---

# 4. Architecture and File Responsibilities

| File | Responsibility |
| ---- | -------------- |
| `popup.html` | UI structure for the extension popup, including the Extract button and recent history panel. |
| `popup.css` | Visual styling for the popup, status indicators, spinner, and history cards. |
| `popup.js` | Current-tab validation, button state management, message orchestration, and history rendering. |
| `content.js` | DOM scraping logic for LinkedIn profile sections and return of structured data. |
| `background.js` | Message routing, scrape initiation, persistence orchestration, JSON download, and backend API calls. |
| `manifest.json` | Extension permissions, host permissions, content script registration, background worker setup, and popup entry point. |
| `Backend/server.js` | Express API that stores and retrieves candidate records in PostgreSQL. |
| `Backend/package.json` | Backend dependencies and scripts. |

---

# 5. Runtime Flow

## 5.1 Popup Initialization

1. The popup loads on extension icon click.
2. It checks the active tab URL.
3. If the URL contains `linkedin.com/in/`, the Extract button is enabled and the target label shows the profile handle.
4. The popup immediately requests stored candidates from the backend and renders the history panel.

## 5.2 Scrape Execution

1. The user clicks Extract.
2. The popup sends `{ action: 'initiateScrape', tabId }` to the background worker.
3. The background worker sends `{ action: 'scrapeNow' }` to the content script in the active LinkedIn tab.
4. The content script scrapes the DOM and returns a profile object.
5. The background worker sends the profile data to the backend API and creates a JSON file download.
6. The popup refreshes the history list after the save operation completes.

---

# 6. Data Extraction Strategy

The content script uses a set of DOM-based selectors and heuristics that match the current implementation. The scraper is not built around a formal schema parser; instead, it targets known LinkedIn profile sections and extracts whatever is present.

## 6.1 Extraction Flow

1. Identify the top profile section and extract the profile name from the second `section` on the page.
2. Extract headline and location from top-level paragraph text, filtering out obvious noise such as the name and pronoun lines.
3. Extract the company name using the `svg#company-accent-4` icon context.
4. Extract the About text from the About section using the `data-testid="expandable-text-box"` selector.
5. Extract experience entries from the Experience section by reading anchor cards and parsing title, company, dates, duration, and location.
6. Extract education entries from the Education section by reading anchor cards and parsing school, degree, and date ranges.
7. Extract skills from the Skills section using the profile skill component selectors.
8. Extract follower counts and recent posts from the Activity section by locating the section with the heading text `Activity`.
9. Extract projects, certifications, interests, and recommendations from their respective profile sections when present.
10. Extract the profile image URL from the `topcard-logo-image-referencekey` block.

## 6.2 Actual Selector Patterns Used

| Field | Selector Strategy | Notes |
| ----- | ----------------- | ----- |
| `name` | `document.querySelectorAll('section')[1]` then `h2` | Uses the second top-level section when present. |
| `headline` / `location` | Top section paragraph text | Filters paragraphs based on structure and known text patterns. |
| `company` | `svg#company-accent-4` ancestor chain | Uses a DOM context anchored to the company icon. |
| `about` | `section[componentkey$="About"] [data-testid="expandable-text-box"]` | Pulls the expandable text box. |
| `experience` | `section[componentkey$="ExperienceTopLevelSection"] a[tabindex="0"]` | Each anchor card yields one experience record. |
| `education` | `section[componentkey$="EducationTopLevelSection"] a[tabindex="0"]` | Each anchor card yields one education record. |
| `skills` | `section[componentkey$="Skills"] [componentkey^="com.linkedin.sdui.profile.skill"]` | Extracts and deduplicates skill names. |
| `activity` | Section whose heading text is `Activity` | Used for follower count and post extraction. |
| `profileImage` | `[componentkey="topcard-logo-image-referencekey"] img` | Returns the profile image source URL. |
| `projects` | `section[componentkey$="Projects"] div[componentkey^="entity-collection-item-"]` | Extracts project cards when available. |
| `certifications` | `section[componentkey$="CertificationTopLevel"] div[componentkey^="entity-collection-item-"]` | Extracts certificate cards when available. |
| `interests` | Section with heading starting with `Interests` | Extracts interest names and follower counts. |
| `recommendations` | `section[componentkey$="RecommendationsTopLevel"] a[href*="linkedin.com/in/"]` | Extracts recommendation cards when available. |

## 6.3 Post-Processing Rules

- Trim whitespace from extracted text.
- Strip the trailing `… more` suffix from expandable text blocks.
- Remove empty values and deduplicate skill names.
- Preserve partial data when some sections are missing.
- Return `null` for unavailable values and empty arrays for missing repeated data.

---

# 7. Data Model

The scraped payload is a JSON object with the following shape:

```json
{
  "name": "string | null",
  "headline": "string | null",
  "company": "string | null",
  "location": "string | null",
  "about": "string | null",
  "experience": [
    {
      "title": "string | null",
      "company": "string | null",
      "location": "string | null",
      "startDate": "string | null",
      "endDate": "string | null",
      "duration": "string | null"
    }
  ],
  "education": [
    {
      "school": "string | null",
      "degree": "string | null",
      "startDate": "string | null",
      "endDate": "string | null"
    }
  ],
  "skills": ["string"],
  "followers": "number | null",
  "posts": ["string"],
  "projects": ["object"],
  "certifications": ["object"],
  "interests": ["object"],
  "recommendations": ["object"],
  "profileImage": "string | null",
  "url": "string",
  "scrapedAt": "ISO date string"
}
```

---

# 8. Persistence and Export

## 8.1 Local Export

The background worker creates a JSON file using the profile name and a timestamped filename:

- Format: `linkedin_<profile>_<timestamp>.json`
- Delivery method: `chrome.downloads.download`
- Content type: `application/json`

## 8.2 Backend Persistence

The background worker sends the profile object to the backend API at:

- `POST http://localhost:3000/api/candidates`
- `GET http://localhost:3000/api/candidates`

The server stores candidate records in PostgreSQL and returns a list of recent candidates for the popup history view.

---
