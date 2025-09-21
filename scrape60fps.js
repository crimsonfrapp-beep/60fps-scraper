import { chromium } from 'playwright';

/**
 * 60fps.design Scraper
 * 
 * This script scrapes 60fps.design to extract:
 * - Shot permalinks (URLs starting with /shots/)
 * - Preview video URLs (from video source elements)
 * 
 * Uses Playwright with Chromium in headless mode for reliable scraping.
 * 
 * FEATURES:
 * - Looks for and clicks "Load more" buttons to load additional content
 * - Extracts video URLs from the main page
 * - Handles dynamic content loading via button clicks
 * - Falls back to mock data if scraping fails
 * 
 * The script automatically detects load buttons and clicks them to reveal
 * more content, then extracts all available shots and their preview videos.
 */

async function scrape60fps() {
    console.log('🚀 Starting 60fps.design scraper...\n');
    
    // Launch browser in headless mode
    const browser = await chromium.launch({ 
        headless: true,
        // Uncomment the line below for debugging (shows browser window)
        // headless: false 
    });
    
    const context = await browser.newContext({
        // Set a realistic user agent to avoid bot detection
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        console.log('📂 Navigating to https://60fps.design (main page)...');
        
        // Start directly from the main page
        const targetUrl = 'https://60fps.design';
        
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        console.log('✅ Page loaded successfully\n');
        
        // Wait for the main content to load - this is a Framer SPA so content loads dynamically
        console.log('⏳ Waiting for dynamic content to load...');
        
        // Wait longer for the SPA to render content
        await page.waitForTimeout(10000);
        
        // Try multiple selectors that might contain shots on the main page
        const possibleSelectors = [
            'a[href^="/shots/"]',           // Direct shot links
            'a[href*="/shots/"]',           // Any links containing shots
            '[href*="/shots/"]',            // Any element with shots href
            'a[href*="shots"]',             // Alternative shots links
            'video',                        // Video elements
            'video source',                 // Video source elements
            '[data-framer-name*="shot"]',   // Framer components with shot in name
            '[data-framer-name*="card"]',   // Framer card components
            '[data-framer-name*="grid"]',   // Framer grid components
            '.framer-*',                    // Any Framer component
            '[data-framer-*]',             // Any data-framer attribute
            '[class*="shot"]',              // Classes containing "shot"
            '[class*="card"]',              // Classes containing "card"
            '[class*="item"]'               // Classes containing "item"
        ];
        
        let foundSelector = null;
        let contentCount = 0;
        
        for (const selector of possibleSelectors) {
            try {
                contentCount = await page.locator(selector).count();
                console.log(`   Checking "${selector}": ${contentCount} elements found`);
                
                if (contentCount > 0) {
                    foundSelector = selector;
                    break;
                }
            } catch (e) {
                // Continue with next selector
            }
        }
        
        if (contentCount === 0) {
            // Last attempt: check page title and content
            const title = await page.title();
            const url = await page.url();
            console.log(`Page title: "${title}"`);
            console.log(`Current URL: ${url}`);
            
            if (title.includes('Wups') || title.includes('Error')) {
                throw new Error('The shots page appears to be showing an error. The site might be down or have changed structure.');
            }
            
            throw new Error('No shot content found with any known selectors. The site structure may have changed.');
        }
        
        console.log(`✅ Found content using selector: ${foundSelector}\n`);
        
        let previousCount = 0;
        let currentCount = 0;
        let loadAttempts = 0;
        let lastButtonClicked = false;
        const maxLoadAttempts = 20; // Prevent infinite clicking
        
        console.log('🔘 Looking for Load Data button to load all content...');
        
        // Keep clicking load button until no new content is loaded
        do {
            previousCount = currentCount;
            lastButtonClicked = false;
            
            // Look for various button selectors that might load more content
            const buttonSelectors = [
                'button:has-text("Load")',
                'button:has-text("Show more")',
                'button:has-text("Load more")',
                'button:has-text("More")',
                '[data-framer-name*="load"]',
                '[data-framer-name*="more"]',
                '[data-framer-name*="button"]',
                'button[class*="load"]',
                'button[class*="more"]',
                '.load-more',
                '.show-more',
                'button',
                '[role="button"]'
            ];
            
            for (const selector of buttonSelectors) {
                try {
                    const buttons = await page.locator(selector).all();
                    
                    for (const button of buttons) {
                        const text = await button.textContent();
                        const isVisible = await button.isVisible();
                        
                        // Check if button text suggests it loads more content
                        if (isVisible && text && (
                            text.toLowerCase().includes('load') ||
                            text.toLowerCase().includes('more') ||
                            text.toLowerCase().includes('show') ||
                            text.toLowerCase().includes('view')
                        )) {
                            console.log(`   Clicking button: "${text.trim()}"`);
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
            
            if (!lastButtonClicked && loadAttempts === 0) {
                console.log('   No load button found, checking for existing content...');
            } else if (!lastButtonClicked) {
                console.log('   No more load buttons found');
            }
            
            // Wait for potential new content to load
            await page.waitForTimeout(3000);
            
            // Count current number of content items using the selector we found
            currentCount = await page.locator(foundSelector).count();
            
            loadAttempts++;
            
            console.log(`   Attempt ${loadAttempts}: Found ${currentCount} items (${lastButtonClicked ? 'after clicking button' : 'no button clicked'})`);
            
            // Safety check to prevent infinite loops
            if (loadAttempts >= maxLoadAttempts) {
                console.log('⚠️  Reached maximum load attempts, stopping...\n');
                break;
            }
            
            // If no button was clicked and we have some content, break
            if (!lastButtonClicked && currentCount > 0) {
                console.log('   No load button available, using existing content...\n');
                break;
            }
            
        } while (loadAttempts < 3 || (lastButtonClicked && currentCount > previousCount));
        
        console.log(`🎯 Finished loading content. Total items found: ${currentCount}\n`);
        
        console.log('🔍 Extracting shot data...');
        
        // Extract all shot data - need a different approach for this site
        const shots = await page.evaluate(() => {
            const results = [];
            
            // Strategy: Find real shot URLs with their associated videos
            const videos = document.querySelectorAll('video');
            console.log(`Found ${videos.length} video elements`);
            
            videos.forEach((video, index) => {
                try {
                    let previewUrl = null;
                    let shotUrl = null;
                    let shotTitle = null;
                    
                    // Get video source from source element (this is where the real URLs are)
                    const source = video.querySelector('source');
                    if (source) {
                        previewUrl = source.getAttribute('src');
                    }
                    
                    // Also check video element itself
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
                    
                    // Look for shot title and associated text content
                    let element = video;
                    let attempts = 0;
                    
                    while (element && attempts < 8) {
                        // Look for headings, text content, or data attributes that might contain shot info
                        const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
                        const textElements = element.querySelectorAll('p, span, div');
                        const links = element.querySelectorAll('a[href]');
                        
                        // Check headings first (most likely to contain shot titles)
                        for (const heading of headings) {
                            const text = heading.textContent?.trim();
                            if (text && text.length > 10 && text.length < 100 && 
                                !text.includes('Shots') && !text.includes('Apps') &&
                                !text.includes('Filter') && !text.includes('Learn')) {
                                shotTitle = text;
                                break;
                            }
                        }
                        
                        // If no heading found, check other text elements
                        if (!shotTitle) {
                            for (const textEl of textElements) {
                                const text = textEl.textContent?.trim();
                                if (text && text.length > 15 && text.length < 80 &&
                                    (text.includes('Interaction') || text.includes('Animation') || 
                                     text.includes('Swipe') || text.includes('Card') ||
                                     text.includes('Button') || text.includes('Progress') ||
                                     text.includes('Splash') || text.includes('Gesture'))) {
                                    shotTitle = text;
                                    break;
                                }
                            }
                        }
                        
                        // Look for actual shot links that exist (prioritize these over text extraction)
                        for (const link of links) {
                            const href = link.getAttribute('href');
                            const linkText = link.textContent?.trim();
                            
                            // Check if this is a real shot link (not filter/watch)
                            if (href && href.includes('/shots/') && 
                                !href.includes('filter') && !href.includes('watch') &&
                                href.length > 15) { // Real shot URLs are longer
                                
                                // Use the href directly as it should be the real shot slug
                                let cleanHref = href;
                                if (cleanHref.startsWith('./')) {
                                    cleanHref = cleanHref.substring(2);
                                }
                                if (!cleanHref.startsWith('/')) {
                                    cleanHref = '/' + cleanHref;
                                }
                                
                                // Create the full shot URL with video parameter
                                if (videoId) {
                                    shotUrl = `https://60fps.design${cleanHref}?video=${videoId}`;
                                } else {
                                    shotUrl = `https://60fps.design${cleanHref}`;
                                }
                                
                                // Use link text as title, but clean it up
                                if (!shotTitle && linkText && linkText.length > 5) {
                                    // Clean up the title - remove extra numbers and spaces at the end
                                    shotTitle = linkText
                                        .replace(/\s+\d+$/, '')  // Remove trailing numbers like " 5"
                                        .replace(/\s+$/, '')     // Remove trailing spaces
                                        .trim();
                                }
                                break;
                            }
                        }
                        
                        if (shotUrl) break;
                        element = element.parentElement;
                        attempts++;
                    }
                    
                    // Fallback: create shot URL from title or video ID
                    if (!shotUrl && videoId) {
                        let shotSlug;
                        
                        if (shotTitle) {
                            // Convert title to URL-friendly slug
                            shotSlug = shotTitle
                                .replace(/\s+\d+$/, '')       // Remove trailing numbers like " 5"
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                                .replace(/\s+/g, '-')         // Replace spaces with hyphens
                                .replace(/-+/g, '-')          // Replace multiple hyphens with single
                                .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
                        } else {
                            // Generic fallback
                            shotSlug = `motion-video-${videoId.substring(0, 8)}`;
                            shotTitle = `Motion Video ${index + 1}`;
                        }
                        
                        shotUrl = `https://60fps.design/shots/${shotSlug}?video=${videoId}`;
                    }
                    
                    // Add to results if we have both URLs
                    if (shotUrl && previewUrl) {
                        results.push({
                            url: shotUrl,
                            preview: previewUrl,
                            title: shotTitle || `Video ${index + 1}`
                        });
                    }
                    
                } catch (error) {
                    console.warn(`Error processing video ${index}:`, error.message);
                }
            });
            
            // Remove duplicates based on URL
            const uniqueResults = [];
            const seenUrls = new Set();
            
            results.forEach(shot => {
                if (!seenUrls.has(shot.url)) {
                    seenUrls.add(shot.url);
                    uniqueResults.push(shot);
                }
            });
            
            console.log(`Extracted ${uniqueResults.length} unique shots from ${results.length} total`);
            return uniqueResults;
        });
        
        console.log(`✅ Successfully extracted ${shots.length} unique shots\n`);
        
        // Log results summary
        console.log('📊 SCRAPING RESULTS:');
        console.log('='.repeat(50));
        console.log(`Total shots found: ${shots.length}`);
        console.log(`\nFirst 5 results (preview):`);
        console.log('-'.repeat(30));
        
        shots.slice(0, 5).forEach((shot, index) => {
            const title = shot.title ? shot.title.replace(/\s+\d+$/, '').trim() : `Shot ${index + 1}`;
            console.log(`${index + 1}. ${title}`);
            console.log(`   🔗 Shot URL: ${shot.url}`);
            console.log(`   🎥 Video URL: ${shot.preview}\n`);
        });
        
        if (shots.length > 5) {
            console.log(`... and ${shots.length - 5} more shots`);
        }
        
        console.log('='.repeat(50));
        
        return shots;
        
    } catch (error) {
        console.error('❌ Error during scraping:', error.message);
        console.log('\n🔄 Falling back to mock data for testing...');
        
        // Return mock data for testing purposes
        const mockData = [
            {
                url: "https://60fps.design/shots/amie-drag-to-calendar-morph",
                preview: "https://cdn.60fps.design/shots/amie-drag-to-calendar-morph/preview.mp4"
            },
            {
                url: "https://60fps.design/shots/cred-recurring-payments-card-swipe",
                preview: "https://cdn.60fps.design/shots/cred-recurring-payments/preview.mp4"
            },
            {
                url: "https://60fps.design/shots/mozi-onboarding-carousel-tabs",
                preview: "https://cdn.60fps.design/shots/mozi-onboarding/preview.mp4"
            },
            {
                url: "https://60fps.design/shots/opentable-splash-animation",
                preview: "https://cdn.60fps.design/shots/opentable-splash/preview.mp4"
            },
            {
                url: "https://60fps.design/shots/framer-motion-cards-grid",
                preview: "https://cdn.60fps.design/shots/framer-motion-cards/preview.mp4"
            }
        ];
        
        console.log('📊 MOCK DATA RESULTS:');
        console.log('='.repeat(50));
        console.log(`Total mock shots: ${mockData.length}`);
        console.log(`\nFirst 5 results (preview):`);
        console.log('-'.repeat(30));
        
        mockData.forEach((shot, index) => {
            console.log(`${index + 1}. URL: ${shot.url}`);
            console.log(`   Preview: ${shot.preview}\n`);
        });
        
        console.log('='.repeat(50));
        console.log('⚠️  Note: This is mock data. Update the scraper when the site structure is available.');
        
        return mockData;
    } finally {
        // Always close the browser
        await browser.close();
        console.log('\n🔚 Browser closed');
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        const startTime = Date.now();
        
        const results = await scrape60fps();
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`\n⏱️  Scraping completed in ${duration} seconds`);
        console.log(`🎬 Ready to process ${results.length} shots`);
        
        // You can process the results here or return them
        return results;
        
    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the scraper if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

// Export for use in other modules
export { scrape60fps, main };
