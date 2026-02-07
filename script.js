const synth = window.speechSynthesis;
const voiceSelect = document.getElementById('voiceSelect');
let words = [];
let voices = [];
let currentIndex = 0;
let isPlaying = false;
let timer = null;
let wakeLock = null;
let currentWpm = 30;

// --- VOICE LOADING (FIXED) ---
function loadVoices() {
    voices = synth.getVoices();
    if (voices.length === 0) return; // Wait for voices to load

    const englishVoices = voices.filter(v => v.lang.includes('en'));
    
    voiceSelect.innerHTML = englishVoices
        .map(v => `<option value="${v.name}">${v.name}</option>`).join('');

    // Neutral priority list to avoid "maarte" accents
    const preferred = [
        "Microsoft David", 
        "Google US English", 
        "Microsoft Zira", 
        "Samantha", 
        "English (Philippines)"
    ];

    for (let name of preferred) {
        const found = englishVoices.find(v => v.name.includes(name));
        if (found) {
            voiceSelect.value = found.name;
            break;
        }
    }
}

// Chrome/Edge/Safari handling for voice loading
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
// Try immediately for Firefox
loadVoices();

// --- PERSISTENCE & CLEAR ---
function saveText() {
    localStorage.setItem('stenoText', document.getElementById('textInput').value);
}

function loadSavedText() {
    const saved = localStorage.getItem('stenoText');
    document.getElementById('textInput').value = saved ? saved : "";
}

function clearAll() {
    // The confirmation check has been removed for instant clearing
    document.getElementById('textInput').value = "";
    localStorage.removeItem('stenoText');
    currentIndex = 0;
    initDisplay();
}

// --- SPEED & THEME ---
function toggleTheme() {
    document.body.classList.toggle('night-theme');
    localStorage.setItem('stenoTheme', document.body.classList.contains('night-theme') ? 'night' : 'light');
}

function adjustSpeed(amount) {
    const display = document.getElementById('wpmVal');
    currentWpm += amount;
    if (currentWpm > 250) currentWpm = 250;
    if (currentWpm < 15) currentWpm = 15;
    display.innerText = currentWpm;
}

// --- CORE ENGINE ---
function initDisplay() {
    const text = document.getElementById('textInput').value.trim();
    words = text ? text.split(/\s+/) : [];
    document.getElementById('wordCount').innerText = words.length;
    const display = document.getElementById('displayArea');
    
    display.innerHTML = words.map((w, i) => 
        `<span id="w-${i}" class="word" onclick="setIndex(${i})">${w}</span>`
    ).join(' ');
    
    if(currentIndex >= words.length) currentIndex = 0;
}

function setIndex(i) {
    if(isPlaying) return; 
    document.querySelectorAll('.word').forEach(el => el.classList.remove('current-word'));
    currentIndex = i;
    const el = document.getElementById(`w-${i}`);
    if(el) {
        el.classList.add('current-word');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function handlePlay() {
    if (words.length === 0) return;
    if (isPlaying) {
        isPlaying = false;
        synth.cancel();
        clearTimeout(timer);
        document.getElementById('mainBtn').innerText = "RESUME";
        if (wakeLock !== null) {
            wakeLock.release().then(() => wakeLock = null);
        }
    } else {
        isPlaying = true;
        document.getElementById('mainBtn').innerText = "PAUSE";
        if ('wakeLock' in navigator) {
            try { wakeLock = await navigator.wakeLock.request('screen'); } 
            catch (err) { console.log(err); }
        }
        speakNextWord();
    }
}

function speakNextWord() {
    if (!isPlaying) return;
    if (currentIndex >= words.length) {
        reset();
        return;
    }
    
    const msPerWord = (60 / currentWpm) * 1000;
    synth.cancel(); 

    const utterance = new SpeechSynthesisUtterance(words[currentIndex]);
    const selectedVoice = voices.find(v => v.name === voiceSelect.value);
    if (selectedVoice) utterance.voice = selectedVoice;
    
    // Adjust rate for natural flow at speed
    if (currentWpm > 130) utterance.rate = 1.4;
    else if (currentWpm > 90) utterance.rate = 1.1;
    else utterance.rate = 1.0;

    document.querySelectorAll('.word').forEach(el => el.classList.remove('current-word'));
    const el = document.getElementById(`w-${currentIndex}`);
    if (el) {
        el.classList.add('current-word');
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    synth.speak(utterance);
    currentIndex++;
    timer = setTimeout(speakNextWord, msPerWord);
}

function reset() {
    isPlaying = false;
    synth.cancel();
    clearTimeout(timer);
    currentIndex = 0;
    document.getElementById('mainBtn').innerText = "PLAY";
    if (wakeLock !== null) {
        wakeLock.release().then(() => wakeLock = null);
    }
    initDisplay();
}

if (localStorage.getItem('stenoTheme') === 'night') toggleTheme();
loadSavedText();
initDisplay();

function openGoogleLens() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // 1. Try to open the Google App Lens camera directly (Android)
        window.location.href = 'intent://lens.google.com/vsearch#Intent;scheme=https;package=com.google.android.googlequicksearchbox;end';
        
        // 2. Fallback: If the app doesn't trigger in 500ms, open Google.com
        setTimeout(() => {
            // Check if we are still on the same page (meaning intent failed)
            window.location.href = 'https://www.google.com';
        }, 500);
    } else {
        // 3. Laptop/PC: Open Google.com in a new tab
        window.open('https://www.google.com', '_blank');
    }
}