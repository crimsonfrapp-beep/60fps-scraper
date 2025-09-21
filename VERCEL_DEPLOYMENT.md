# Vercel Serverless Function Deployment

## Overview

The 60fps.design scraper has been converted to a Vercel serverless function that n8n can call via HTTP requests.

## Files Created

- `api/scrape.js` - Serverless function endpoint
- `vercel.json` - Vercel configuration 
- Updated `package.json` - Added Vercel build scripts

## Deployment Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Configure Domain** (optional):
   - Set up custom domain in Vercel dashboard
   - Or use the provided `.vercel.app` domain

## Usage in n8n

### HTTP Request Node Configuration:
- **Method**: `GET` or `POST`
- **URL**: `https://your-project.vercel.app/api/scrape`
- **Query Parameters** (optional):
  - `limit=10` - Limit number of results

### Example URLs:
```
https://your-project.vercel.app/api/scrape
https://your-project.vercel.app/api/scrape?limit=5
```

### Response Format:
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

## n8n Workflow Setup

1. **HTTP Request Node**:
   - URL: `https://your-project.vercel.app/api/scrape?limit=10`
   - Method: GET

2. **Supabase Insert Node**:
   - Connect directly to HTTP Request output
   - Map fields automatically
   - Table: your target table name

## Error Handling

On errors, the function returns:
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-09-20T11:40:18.861Z"
}
```

## Performance Notes

- Function timeout: 60 seconds (configured in vercel.json)
- Optimized browser args for serverless environment
- Reduced load attempts to stay within timeout limits
- Automatic fallback to mock data on scraping errors

## Environment Variables (Optional)

Set in Vercel dashboard if needed:
- `NODE_ENV=production`
- Any custom configuration variables

## Monitoring

- View function logs in Vercel dashboard
- Monitor performance and errors
- Set up alerts for failures
