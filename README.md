# Phạm Trần Thủy Hường — Personal Portfolio

A single-page personal portfolio website for **Phạm Trần Thủy Hường**,
an Investment Economics student and Marketing & Communications professional.

## Tech

Plain, dependency-free static site:

- `index.html` — page content & structure
- `styles.css` — styling (responsive, light theme, Poppins / Playfair Display)
- `app.js` — small interactions (sticky nav, mobile menu, scroll reveal, active-section highlight)

Fonts are loaded from Google Fonts; no build step is required.

## Sections

About · Experience · Skills · Education & Certifications · Contact

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

Pushed to GitHub Pages automatically via `.github/workflows/deploy.yml`
on every push to the configured branch.
