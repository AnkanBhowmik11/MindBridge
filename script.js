        // Configuration - Updated with your actual n8n webhook URLs
const N8N_CONFIG = {
    // Your actual n8n webhook endpoints
    ANALYZE_URL: 'https://ankanbh1.app.n8n.cloud/webhook/analyze-sentiment',
GET_DATA_URL: 'https://ankanbh1.app.n8n.cloud/webhook/get-messages', // We'll create this next
    // Switch to production mode
    DEMO_MODE: false
};

let messagesData = [];
let currentSection = 'dashboard';

// Initialize particles
function createParticles() {
    const particles = document.querySelector('.particles');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 25 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
        particles.appendChild(particle);
    }
}

// Status message helper
function showStatus(message, isError = false) {
    const container = document.getElementById('status-container');
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
    statusDiv.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(statusDiv);
    
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => container.innerHTML = '', 300);
    }, 5000);
}

// Update connection status
function updateConnectionStatus(isOnline) {
    const status = document.getElementById('connection-status');
    if (isOnline) {
        status.className = 'connection-status online';
        status.textContent = '🟢 n8n Connected';
    } else {
        status.className = 'connection-status offline';
        status.textContent = '🔴 n8n Offline';
    }
}

// Show different sections
function showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    document.getElementById(`nav-${sectionName}`).classList.add('active');

    // Show section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    currentSection = sectionName;
    
    // Load data if switching to dashboard
    if (sectionName === 'dashboard') {
        setTimeout(refreshData, 300);
    }
}

// Submit message for analysis
async function submitMessage() {
    const message = document.getElementById('customer-message').value.trim();
    
    if (!message) {
        showStatus('Please enter a customer message', true);
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    const loading = document.getElementById('loading');
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing with n8n...';
        loading.classList.add('active');
        document.getElementById('n8n-status').textContent = '🟡 Processing';
        
        console.log('Sending to n8n:', N8N_CONFIG.ANALYZE_URL);
        
        // Real n8n API call
        const response = await fetch(N8N_CONFIG.ANALYZE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                timestamp: new Date().toISOString()
            })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`n8n webhook error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log('n8n response:', result);
        
// Handle n8n response format with better error checking
let sentiment, emotion;

console.log('Full n8n response structure:', JSON.stringify(result, null, 2));

if (result && typeof result === 'object') {
    // Try different possible response structures
    if (result.sentiment) {
        sentiment = result.sentiment;
        emotion = result.emotion || 'unknown';
    } else if (result.data && result.data.sentiment) {
        sentiment = result.data.sentiment;
        emotion = result.data.emotion || 'unknown';
    } else if (result[0] && result[0].sentiment) {
        // Array response format
        sentiment = result[0].sentiment;
        emotion = result[0].emotion || 'unknown';
    } else {
        console.error('Unexpected n8n response format:', result);
        sentiment = 'neutral';
        emotion = 'processing_error';
    }
} else {
    throw new Error('Invalid response format from n8n');
}
        
        // Add to local data
        const newMessage = {
            timestamp: new Date().toISOString(),
            message: message,
            sentiment: sentiment,
            emotion: emotion
        };
        
        messagesData.unshift(newMessage);
        
        // Clear form
        document.getElementById('customer-message').value = '';
        
        // Show success message
        showStatus(`✅ n8n Analysis Complete! Sentiment: ${sentiment}, Emotion: ${emotion}`);
        
        // Update dashboard
        updateDashboard();
        updateConnectionStatus(true);
        
    } catch (error) {
        console.error('n8n Error:', error);
        showStatus('❌ n8n Connection Error: ' + error.message, true);
        updateConnectionStatus(false);
        document.getElementById('n8n-status').textContent = '🔴 Error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🧠 Analyze with n8n + Groq';
        loading.classList.remove('active');
        
        // Reset status after a delay if no error
        setTimeout(() => {
            if (document.getElementById('n8n-status').textContent !== '🔴 Error') {
                document.getElementById('n8n-status').textContent = '🟢 Online';
            }
        }, 2000);
    }
}

// Process Google Sheets data format
function processSheetData(rawData) {
    // Handle different response formats from Google Sheets API
    let dataArray = rawData;
    
// Check if rawData is wrapped in an object
if (!Array.isArray(rawData)) {
    if (rawData.values) {
        dataArray = rawData.values;
    } else if (rawData.data) {
        dataArray = rawData.data;
} else if (rawData['object Object']) {
    // Handle the specific case where data is nested under "object Object" key
    const singleRow = rawData['object Object'];
    console.log('Found data under "object Object" key:', singleRow);
    
    // Convert single object to array format that matches Google Sheets structure
    if (singleRow && typeof singleRow === 'object') {
        // Create array with header row and data row
        dataArray = [
            ['timestamp', 'message', 'sentiment', 'confidence', 'explanation'], // Header
            [
                singleRow.timestamp || '',
                singleRow.message || '',
                singleRow.sentiment || '',
                singleRow.confidence || '',
                singleRow.explanation || ''
            ] // Data row
        ];
        console.log('Converted single object to array format:', dataArray);
    } else {
        console.error('Invalid single row data:', singleRow);
        return [];
    }
    } else {
        // Try to extract from the first key if it contains array-like data
        const keys = Object.keys(rawData);
        if (keys.length === 1) {
            const firstKey = keys[0];
            const firstValue = rawData[firstKey];
            if (Array.isArray(firstValue)) {
                dataArray = firstValue;
                console.log(`Found array data under key "${firstKey}"`);
            } else if (firstValue && typeof firstValue === 'object') {
                // Single row of data
                dataArray = [firstValue];
                console.log('Converting single object to array');
            }
        }
        
        if (!Array.isArray(dataArray)) {
            console.error('Expected array but got:', typeof rawData, rawData);
            return [];
        }
    }
}
    // Skip header row and process data
    if (!dataArray || dataArray.length <= 1) return [];
    
    return dataArray.slice(1).map(row => {
        // Google Sheets returns arrays for each row
        // [timestamp, message, sentiment, confidence, explanation]
        const [timestamp, message, sentiment, confidence, explanation] = row;
        
        return {
            timestamp: new Date(timestamp).toISOString(),
            message: message || '',
            sentiment: sentiment || 'neutral',
            emotion: explanation || '', // Use explanation as emotion for now
            confidence: parseFloat(confidence) || 0.5
        };
    }).filter(item => item.message); // Filter out empty messages
}

// Load data from n8n (placeholder for now)
async function loadData() {
    try {
        updateConnectionStatus(true);
        /*
        // For now, we'll skip this until we create the GET webhook
        console.log('GET data webhook not yet created - using local data only');
        updateDashboard();
        return;
        */
        /* Commented out until we create the GET webhook
        const response = await fetch(N8N_CONFIG.GET_DATA_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            messagesData = result.data || [];
            updateDashboard();
            console.log('Loaded', messagesData.length, 'messages from n8n');
        } else {
            throw new Error(result.error || 'Failed to load data');
        }
        */
       const response = await fetch(N8N_CONFIG.GET_DATA_URL);

if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
}

const rawData = await response.json();
console.log('Raw data from Google Sheets:', rawData);
console.log('Raw data type:', typeof rawData);
console.log('Is array?', Array.isArray(rawData));
if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    console.log('Object keys:', Object.keys(rawData));
}
// Process the Google Sheets data
messagesData = processSheetData(rawData);
updateDashboard();
console.log('Loaded', messagesData.length, 'messages from n8n');
        
    } catch (error) {
        console.error('Error loading data:', error);
        updateConnectionStatus(false);
        showStatus('Error loading data from n8n: ' + error.message, true);
    }
}

// Refresh dashboard data
async function refreshData() {
    try {
        await loadData();
        document.getElementById('last-check').textContent = 'Just now';
        console.log('Dashboard refreshed');
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Update dashboard with current data
function updateDashboard() {
    updateSentimentStats();
    updateEmotionDisplay();
    updateRecentMessages();
    updateInsights();
    updateAlertStatus();
}

// Update sentiment statistics
function updateSentimentStats() {
    if (messagesData.length === 0) {
        document.getElementById('positive-percent').textContent = '0%';
        document.getElementById('neutral-percent').textContent = '0%';
        document.getElementById('negative-percent').textContent = '0%';
        return;
    }
    
    const positive = messagesData.filter(msg => msg.sentiment === 'Positive').length;
    const negative = messagesData.filter(msg => msg.sentiment === 'Negative').length;
    const neutral = messagesData.filter(msg => msg.sentiment === 'Neutral').length;
    const total = messagesData.length;
    
    document.getElementById('positive-percent').textContent = Math.round((positive / total) * 100) + '%';
    document.getElementById('neutral-percent').textContent = Math.round((neutral / total) * 100) + '%';
    document.getElementById('negative-percent').textContent = Math.round((negative / total) * 100) + '%';
}

// Update emotion display
function updateEmotionDisplay() {
    const emotionList = document.getElementById('emotion-list');
    
    if (messagesData.length === 0) {
        emotionList.innerHTML = '<span class="emotion-tag">No data yet</span>';
        return;
    }
    
    // Count emotions
    const emotions = {};
    messagesData.forEach(msg => {
        if (msg.emotion && msg.emotion !== 'Error') {
            emotions[msg.emotion] = (emotions[msg.emotion] || 0) + 1;
        }
    });
    
    // Sort by count and create tags
    const sortedEmotions = Object.entries(emotions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6);
    
    if (sortedEmotions.length === 0) {
        emotionList.innerHTML = '<span class="emotion-tag">No emotions detected</span>';
        return;
    }
    
    emotionList.innerHTML = sortedEmotions
        .map(([emotion, count]) => `<span class="emotion-tag">${emotion} (${count})</span>`)
        .join('');
}

// Update recent messages table
function updateRecentMessages() {
    const tbody = document.getElementById('messages-tbody');
    tbody.innerHTML = '';
    
    if (messagesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; opacity: 0.7;">
                    📝 No messages yet. Submit a message above to see analysis results!
                </td>
            </tr>
        `;
        return;
    }
    
    messagesData.slice(0, 10).forEach(msg => {
        const row = document.createElement('tr');
        const preview = msg.message && msg.message.length > 30 ? 
            msg.message.substring(0, 30) + '...' : (msg.message || 'N/A');
        
        const sentiment = msg.sentiment || 'Unknown';
        const sentimentClass = sentiment.toLowerCase() === 'positive' ? 'sentiment-positive' :
                             sentiment.toLowerCase() === 'negative' ? 'sentiment-negative' :
                             'sentiment-neutral';
        
        const timestamp = msg.timestamp ? 
            new Date(msg.timestamp).toLocaleTimeString() + ' ' + new Date(msg.timestamp).toLocaleDateString() : 
            'N/A';
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${preview}</td>
            <td><span class="${sentimentClass}">${sentiment}</span></td>
            <td>${msg.emotion || 'Unknown'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update insights
function updateInsights() {
    const totalMessages = messagesData.length;
    document.getElementById('total-messages').textContent = totalMessages;
    
    if (messagesData.length > 0) {
        const positiveRatio = messagesData.filter(msg => msg.sentiment === 'Positive').length / messagesData.length;
        const negativeRatio = messagesData.filter(msg => msg.sentiment === 'Negative').length / messagesData.length;
        const avgRating = (4.5 * positiveRatio + 2.5 * negativeRatio + 3.5 * (1 - positiveRatio - negativeRatio)).toFixed(1);
        document.getElementById('avg-rating').textContent = avgRating;
        
        const themes = generateKeyThemes();
        document.getElementById('key-themes').textContent = themes;
    } else {
        document.getElementById('avg-rating').textContent = '0.0';
        document.getElementById('key-themes').textContent = 'Awaiting customer messages...';
    }
}

// Generate key themes from data
function generateKeyThemes() {
    if (messagesData.length === 0) return 'Awaiting customer messages...';
    
    const emotions = {};
    const sentiments = {};
    
    messagesData.forEach(msg => {
        if (msg.emotion && msg.emotion !== 'Error') {
            emotions[msg.emotion] = (emotions[msg.emotion] || 0) + 1;
        }
        if (msg.sentiment) {
            sentiments[msg.sentiment] = (sentiments[msg.sentiment] || 0) + 1;
        }
    });
    
    const topEmotion = Object.entries(emotions).sort(([,a], [,b]) => b - a)[0];
    const topSentiment = Object.entries(sentiments).sort(([,a], [,b]) => b - a)[0];
    
    if (!topEmotion || !topSentiment) return 'Analyzing patterns...';
    
    const themes = [];
    if (topSentiment[0] === 'Positive') {
        themes.push('Generally satisfied customers');
    } else if (topSentiment[0] === 'Negative') {
        themes.push('Areas needing improvement');
    } else {
        themes.push('Mixed feedback patterns');
    }
    
    if (topEmotion[0] === 'Joy') {
        themes.push('Happy customer experiences');
    } else if (topEmotion[0] === 'Anger') {
        themes.push('Frustrated customer interactions');
    } else if (topEmotion[0] === 'Neutral') {
        themes.push('Balanced emotional responses');
    }
    
    return themes.length > 0 ? themes.join(', ') : 'Analyzing customer feedback patterns';
}

// Update alert status
function updateAlertStatus() {
    if (messagesData.length === 0) {
        const alertDiv = document.getElementById('alert-status');
        alertDiv.innerHTML = `
            <p>🔄 System Ready</p>
            <p style="opacity: 0.7; font-size: 0.9rem;">
                Waiting for customer messages to analyze
            </p>
        `;
        return;
    }
    
    const negativeCount = messagesData.filter(msg => msg.sentiment === 'Negative').length;
    const negativePercentage = (negativeCount / messagesData.length) * 100;
    
    const alertDiv = document.getElementById('alert-status');
    
    if (negativePercentage > 40) {
        alertDiv.innerHTML = `
            <p>⚠️ High negative sentiment detected</p>
            <p style="opacity: 0.7; font-size: 0.9rem;">
                ${negativePercentage.toFixed(1)}% negative messages (${negativeCount}/${messagesData.length})
            </p>
        `;
    } else if (negativeCount >= 2) {
        alertDiv.innerHTML = `
            <p>⚠️ Multiple negative messages detected</p>
            <p style="opacity: 0.7; font-size: 0.9rem;">
                ${negativeCount} negative messages found
            </p>
        `;
    } else {
        alertDiv.innerHTML = `
            <p>✅ All systems normal</p>
            <p style="opacity: 0.7; font-size: 0.9rem;">
                Last checked: <span id="last-check">Just now</span>
            </p>
        `;
    }
}

// Scroll reveal animation
function revealOnScroll() {
    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < window.innerHeight - elementVisible) {
            element.classList.add('revealed');
        }
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧠 MindBridge AI Platform Initializing...');
    console.log('🔗 n8n Integration Mode: Production');
    console.log('📡 Webhook URL:', N8N_CONFIG.ANALYZE_URL);
    
    createParticles();
    
    // Set up scroll reveal
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();
    
// Load existing data on startup
loadData();
    updateConnectionStatus(false); // Will be updated when first request succeeds
    
    console.log('✅ MindBridge AI Platform Ready!');
    console.log('💡 Submit a message to test your n8n integration!');
});

// Handle Enter key in textarea
document.addEventListener('keydown', function(e) {
    if (e.target.id === 'customer-message' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
    }
});
