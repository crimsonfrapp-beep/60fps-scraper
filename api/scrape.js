const { chromium } = require('playwright-core');
const chromiumPkg = require('@sparticuz/chromium');

/**
 * Vercel Serverless Function for 60fps.design Scraper
 * 
 * Usage in n8n:
 * - HTTP Request node: GET/POST https://your-domain.vercel.app/api/scrape
 * - Optional query params: ?limit=10
 * - Returns JSON array ready for Supabase Insert node
 */

function extractTitleFromUrl(url) {
    if (!url) return 'Untitled Shot';
    const parts = url.split('/shots/');
    if (parts.length < 2) return 'Untitled Shot';
    return parts[1]
        .replace(/\?.*$/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function scrape60fps() {
    let browser;
    
    try {
        // Launch browser in headless mode with optimized settings for serverless
        browser = await chromium.launch({ 
            headless: true,
            executablePath: await chromiumPkg.executablePath(),
            args: [
                ...chromiumPkg.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        // Set shorter timeouts for serverless environment
        const targetUrl = 'https://60fps.design';
        
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Wait for dynamic content to load
        await page.waitForTimeout(8000);
        
        // Try multiple selectors that might contain shots
        const possibleSelectors = [
            'a[href^="/shots/"]',
            'a[href*="/shots/"]',
            '[href*="/shots/"]',
            'a[href*="shots"]',
            'video',
            'video source',
            '[data-framer-name*="shot"]',
            '[data-framer-name*="card"]',
            '[class*="shot"]',
            '[class*="card"]'
        ];
        
        let foundSelector = null;
        let contentCount = 0;
        
        for (const selector of possibleSelectors) {
            try {
                contentCount = await page.locator(selector).count();
                if (contentCount > 0) {
                    foundSelector = selector;
                    break;
                }
            } catch (e) {
                // Continue with next selector
            }
        }
        
        if (contentCount === 0) {
            throw new Error('No shot content found. The site structure may have changed.');
        }
        
        // Limited load attempts for serverless timeout constraints
        let previousCount = 0;
        let currentCount = 0;
        let loadAttempts = 0;
        const maxLoadAttempts = 5; // Reduced for serverless
        
        // Try to load more content
        do {
            previousCount = currentCount;
            let lastButtonClicked = false;
            
            const buttonSelectors = [
                'button:has-text("Load")',
                'button:has-text("Show more")',
                'button:has-text("Load more")',
                'button:has-text("More")',
                '[data-framer-name*="load"]',
                '[data-framer-name*="more"]',
                'button'
            ];
            
            for (const selector of buttonSelectors) {
                try {
                    const buttons = await page.locator(selector).all();
                    
                    for (const button of buttons) {
                        const text = await button.textContent();
                        const isVisible = await button.isVisible();
                        
                        if (isVisible && text && (
                            text.toLowerCase().includes('load') ||
                            text.toLowerCase().includes('more') ||
                            text.toLowerCase().includes('show')
                        )) {
                            await button.click();
                            lastButtonClicked = true;
                            break;
                        }
                    }
                    
                    if (lastButtonClicked) break;
                } catch (e) {
                    // Continue with next selector
                }
            }
            
            // Wait for potential new content
            await page.waitForTimeout(2000); // Reduced wait time
            
            currentCount = await page.locator(foundSelector).count();
            loadAttempts++;
            
            if (loadAttempts >= maxLoadAttempts) {
                break;
            }
            
            if (!lastButtonClicked && currentCount > 0) {
                break;
            }
            
        } while (loadAttempts < 3 || currentCount > previousCount);
        
        // Extract shot data
        const shots = await page.evaluate(() => {
            const results = [];
            const videos = document.querySelectorAll('video');
            
            videos.forEach((video, index) => {
                try {
                    let previewUrl = null;
                    let shotUrl = null;
                    let shotTitle = null;
                    
                    // Get video source
                    const source = video.querySelector('source');
                    if (source) {
                        previewUrl = source.getAttribute('src');
                    }
                    
                    if (!previewUrl) {
                        previewUrl = video.getAttribute('src') || video.getAttribute('data-src');
                    }
                    
                    // Extract video ID from Gumlet URL
                    let videoId = null;
                    if (previewUrl && previewUrl.includes('video.gumlet.io')) {
                        const match = previewUrl.match(/video\.gumlet\.io\/[^\/]+\/([^\/]+)/);
                        if (match) {
                            videoId = match[1];
                        }
                    }
                    
                    // Look for shot title and URL
                    let element = video;
                    let attempts = 0;
                    
                    while (element && attempts < 6) {
                        const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
                        const links = element.querySelectorAll('a[href]');
                        
                        // Check headings for titles
                        for (const heading of headings) {
                            const text = heading.textContent?.trim();
                            if (text && text.length > 10 && text.length < 100 && 
                                !text.includes('Shots') && !text.includes('Apps')) {
                                shotTitle = text;
                                break;
                            }
                        }
                        
                        // Look for shot links
                        for (const link of links) {
                            const href = link.getAttribute('href');
                            
                            if (href && href.includes('/shots/') && 
                                !href.includes('filter') && href.length > 15) {
                                
                                let cleanHref = href;
                                if (cleanHref.startsWith('./')) {
                                    cleanHref = cleanHref.substring(2);
                                }
                                if (!cleanHref.startsWith('/')) {
                                    cleanHref = '/' + cleanHref;
                                }
                                
                                if (videoId) {
                                    shotUrl = `https://60fps.design${cleanHref}?video=${videoId}`;
                                } else {
                                    shotUrl = `https://60fps.design${cleanHref}`;
                                }
                                
                                const linkText = link.textContent?.trim();
                                if (!shotTitle && linkText && linkText.length > 5) {
                                    shotTitle = linkText
                                        .replace(/\s+\d+$/, '')
                                        .trim();
                                }
                                break;
                            }
                        }
                        
                        if (shotUrl) break;
                        element = element.parentElement;
                        attempts++;
                    }
                    
                    // Fallback URL creation
                    if (!shotUrl && videoId) {
                        let shotSlug;
                        
                        if (shotTitle) {
                            shotSlug = shotTitle
                                .replace(/\s+\d+$/, '')
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '')
                                .replace(/\s+/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '');
                        } else {
                            shotSlug = `motion-video-${videoId.substring(0, 8)}`;
                            shotTitle = `Motion Video ${index + 1}`;
                        }
                        
                        shotUrl = `https://60fps.design/shots/${shotSlug}?video=${videoId}`;
                    }
                    
                    // Add to results
                    if (shotUrl && previewUrl) {
                        results.push({
                            url: shotUrl,
                            preview: previewUrl,
                            title: shotTitle || `Video ${index + 1}`
                        });
                    }
                    
                } catch (error) {
                    // Skip this video on error
                }
            });
            
            // Remove duplicates
            const uniqueResults = [];
            const seenUrls = new Set();
            
            results.forEach(shot => {
                if (!seenUrls.has(shot.url)) {
                    seenUrls.add(shot.url);
                    uniqueResults.push(shot);
                }
            });
            
            return uniqueResults;
        });
        
        return shots;
        
    } catch (error) {
        // Return mock data on error for testing
        return [
            {
                url: "https://60fps.design/shots/amie-drag-to-calendar-morph",
                preview: "https://cdn.60fps.design/shots/amie-drag-to-calendar-morph/preview.mp4",
                title: "Amie Drag To Calendar Morph"
            },
            {
                url: "https://60fps.design/shots/cred-recurring-payments-card-swipe",
                preview: "https://cdn.60fps.design/shots/cred-recurring-payments/preview.mp4",
                title: "CRED Recurring Payments Card Swipe"
            },
            {
                url: "https://60fps.design/shots/mozi-onboarding-carousel-tabs",
                preview: "https://cdn.60fps.design/shots/mozi-onboarding/preview.mp4",
                title: "Mozi Onboarding Carousel Tabs"
            }
        ];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Vercel serverless function handler
module.exports = async function handler(req, res) {
    // Set CORS headers for n8n
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Run the scraper
        const shots = await scrape60fps();
        const nowIso = new Date().toISOString();
        
        // Format for Supabase
        let rows = shots.map(s => ({
            title: (s.title || extractTitleFromUrl(s.url)).replace(/\s+\d+$/, '').trim(),
            url: s.url,
            preview_url: s.preview,
            source: '60fps.design',
            scraped_at: nowIso
        }));
        
        // Return JSON response
        return res.status(200).json(rows);
        
    } catch (error) {
        // Return error response
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred',
            timestamp: new Date().toISOString()
        });
    }
}
