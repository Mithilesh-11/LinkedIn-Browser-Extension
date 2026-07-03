const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  password: 'mithilesh',
  host: 'localhost',
  port: 5432,
  database: 'Linkedin',
});

app.post('/api/candidates', async (req, res) => {
  try {
    const data = req.body;

    if (!data.url) {
      return res.status(400).json({ status: 'error', message: 'URL is required' });
    }

    const values = [
      data.url,
      data.name ?? null,
      data.headline ?? null,
      data.company ?? null,
      data.location ?? null,
      data.about ?? null,
      JSON.stringify(data.experience || []),
      JSON.stringify(data.education || []),
      JSON.stringify(data.skills || []),
      data.followers ?? 0, // Fallback to 0 for integer column
      JSON.stringify(data.posts || []),
      JSON.stringify(data.projects || []),
      JSON.stringify(data.certifications || []),
      JSON.stringify(data.interests || []),
      data.profileImage ?? null,
      data.scrapedAt ?? null,
    ];

    const upsertQuery = `
      INSERT INTO candidates (
        url, name, headline, company, location, about, 
        experience, education, skills, followers, posts, 
        projects, certifications, interests, "profileImage", "scrapedAt",
        "createdAt", "updatedAt"
      ) 
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
        NOW(), NOW()
      )
      ON CONFLICT (url) DO UPDATE SET
        name = EXCLUDED.name,
        headline = EXCLUDED.headline,
        company = EXCLUDED.company,
        location = EXCLUDED.location,
        about = EXCLUDED.about,
        experience = EXCLUDED.experience,
        education = EXCLUDED.education,
        skills = EXCLUDED.skills,
        followers = EXCLUDED.followers,
        posts = EXCLUDED.posts,
        projects = EXCLUDED.projects,
        certifications = EXCLUDED.certifications,
        interests = EXCLUDED.interests,
        "profileImage" = EXCLUDED."profileImage",
        "scrapedAt" = EXCLUDED."scrapedAt",
        "updatedAt" = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, values);
    return res.json({ status: 'done', data: result.rows[0] });

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});


// GET endpoint to fetch all candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM candidates ORDER BY "createdAt" DESC LIMIT 100'
    );
    res.json({ status: 'done', candidates: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});


app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});