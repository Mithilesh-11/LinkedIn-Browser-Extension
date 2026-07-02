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

// POST endpoint to save candidate
app.post('/api/candidates', async (req, res) => {
  try {
    const data = req.body;

    const query = `

       INSERT INTO candidates 
       ( url, name,headline,company, location, about,experience,education,skills, followers, posts, projects,
       certifications, interests, profile_image, scraped_at) 

       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)

       ON CONFLICT (url) 

       DO UPDATE SET
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
        profile_image = EXCLUDED.profile_image,
        scraped_at = EXCLUDED.scraped_at,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      data.url,
      data.name,
      data.headline,
      data.company,
      data.location,
      data.about,
      JSON.stringify(data.experience || []),
      JSON.stringify(data.education || []),
      JSON.stringify(data.skills || []),
      data.followers,
      JSON.stringify(data.posts || []),
      JSON.stringify(data.projects || []),
      JSON.stringify(data.certifications || []),
      JSON.stringify(data.interests || []),
      data.profileImage || data.profile_image,
      data.scraped_at,
    ];

    const result = await pool.query(query, values);
    res.json({ status: 'done', data: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET endpoint to fetch all candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM candidates ORDER BY created_at DESC LIMIT 100'
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