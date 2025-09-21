# 60fps.design Scraper

A Node.js scraper for extracting motion design videos from 60fps.design with support for n8n workflows and Vercel serverless deployment.

## Features

- 🎬 Scrapes shot URLs and preview videos from 60fps.design
- 🔄 Automatically clicks "Load More" buttons to get all content
- 🚀 Vercel serverless function support
- 🔧 n8n integration ready with clean JSON output
- 📦 Formats data for direct Supabase insertion
- 🛡️ Error handling with fallback mock data

## Installation

```bash
npm install

# For local development, install browsers:
npm run install-browsers
```

## Usage

### Command Line (Interactive)
```bash
npm start
# or
node scrape60fps.js
```

### n8n Integration (Silent JSON Output)
```bash
npm run n8n
# or
node scrape60fps-n8n.js --limit 10
```

### Vercel Serverless Function
Deploy to Vercel and call via HTTP:
```bash
npm run vercel-build
vercel --prod
```

Then use: `https://your-project.vercel.app/api/scrape?limit=10`

## Files Structure

```
60fps-scraper/
├── scrape60fps.js         # Main scraper with console output
├── scrape60fps-n8n.js     # n8n wrapper (silent, JSON only)
├── api/
│   └── scrape.js          # Vercel serverless function
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Output Format

All versions output data in this format, ready for Supabase insertion:

```json
[
  {
    "title": "CRED Recurring Payments Card Swipe Interaction",
    "url": "https://60fps.design/shots/cred-recurring-payments-card-swipe-interaction?video=68adddc0cd4a3cfd5418a305",
    "preview_url": "https://video.gumlet.io/66b49d08225b7b88f78b7b44/68adddc0cd4a3cfd5418a305/main.mp4",
    "source": "60fps.design",
    "scraped_at": "2025-09-20T11:40:18.861Z"
  }
]
```

## n8n Workflow

1. **Execute Command Node**: `node scrape60fps-n8n.js --limit 10`
2. **Supabase Insert Node**: Direct mapping from JSON output

## Vercel Deployment

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Deploy**: `vercel --prod`
3. **Use endpoint**: `GET https://your-project.vercel.app/api/scrape?limit=10`

## Environment Variables

For Vercel deployment, you can set these optional variables:
- `NODE_ENV=production`
- `LIMIT=10` (default limit if not specified in query)

## Error Handling

- Graceful fallback to mock data if scraping fails
- Structured error responses for API calls
- Console errors in n8n version go to stderr

## Browser Requirements

Uses Playwright with Chromium. The browser is automatically installed via postinstall script.

## License

MIT
