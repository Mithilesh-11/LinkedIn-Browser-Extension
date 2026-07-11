// Load environment variables from the current working directory
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

// Middleware configuration
app.use(cors());
app.use(express.json());

// Database connection configuration using environment variables
const pool = new Pool({
  user: process.env.PG_DB_USER,
  password: process.env.PG_DB_PASSWORD,
  host: process.env.PG_DB_HOST,
  port: parseInt(process.env.PG_DB_PORT || '5432', 10),
  database: process.env.PG_DB_NAME,
});

// POST endpoint to save or update candidate data
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
      data.followers ?? 0,
      JSON.stringify(data.posts || []),
      JSON.stringify(data.projects || []),
      JSON.stringify(data.certifications || []),
      JSON.stringify(data.interests || []),
      JSON.stringify(data.recommendations || []),
      data.profileImage ?? null,
      data.scrapedAt ?? null,
    ];

    const upsertQuery = `
      INSERT INTO candidates (
        url, name, headline, company, location, about, experience, education, skills,
        followers, posts, projects, certifications, interests, recommendations, "profileImage", "scrapedAt", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
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
        recommendations = EXCLUDED.recommendations,
        "profileImage" = EXCLUDED."profileImage",
        "scrapedAt" = EXCLUDED."scrapedAt",
        "updatedAt" = NOW()
      RETURNING *;
    `;

    const result = await pool.query(upsertQuery, values);
    return res.json({ status: 'done', data: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// GET endpoint to fetch all stored candidates
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

// Launch server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
