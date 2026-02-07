const synth = window.speechSynthesis;
const voiceSelect = document.getElementById('voiceSelect');
let words = [];
let voices = [];
let currentIndex = 0;
let isPlaying = false;
let timer = null;
let wakeLock = null;
let currentWpm = 30;

// Mapping for punctuation dictation
const punctMap = {
    '.': 'period',
    ',': 'comma',
    '!': 'exclamation point',
    '?': 'question mark',
    ';': 'semicolon',
    ':': 'colon',
    '-': 'dash',
    '—': 'dash',
    '(': 'open parenthesis',
    ')': 'close parenthesis',
    '"': 'quote'
};

function loadVoices() {
    voices = synth.getVoices();
    if (voices.length === 0) return;
    const englishVoices = voices.filter(v => v.lang.includes('en'));
    voiceSelect.innerHTML = englishVoices.map(v => `<option value="${v.name}">${v.name}</option>`).join('');
    const preferred = ["Microsoft David", "Google US English", "Microsoft Zira", "Samantha"];
    for (let name of preferred) {
        const found = englishVoices.find(v => v.name.includes(name));
        if (found) { voiceSelect.value = found.name; break; }
    }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

function saveText() {
    localStorage.setItem('stenoText', document.getElementById('textInput').value);
}

function loadSavedText() {
    const saved = localStorage.getItem('stenoText');
    if (saved) document.getElementById('textInput').value = saved;
}

function clearAll() {
    document.getElementById('textInput').value = "";
    localStorage.removeItem('stenoText');
    currentIndex = 0;
    initDisplay();
}

function toggleTheme() {
    document.body.classList.toggle('night-theme');
    localStorage.setItem('stenoTheme', document.body.classList.contains('night-theme') ? 'night' : 'light');
}

function adjustSpeed(amount) {
    currentWpm += amount;
    if (currentWpm > 250) currentWpm = 250;
    if (currentWpm < 15) currentWpm = 15;
    document.getElementById('wpmVal').innerText = currentWpm;
}

function initDisplay() {
    const textInput = document.getElementById('textInput').value;
    const display = document.getElementById('displayArea');
    
    // Split by paragraph breaks, punctuation, or spaces
    const segments = textInput.split(/(\n+|[.,!?;:\-—()"]|\s+)/);

    let htmlOutput = "";
    let wordIdx = 0;
    words = []; 

    segments.forEach((segment) => {
        if (!segment) return;

        if (segment.includes('\n')) {
            htmlOutput += segment.replace(/\n/g, '<br>');
            words.push({ text: segment, type: 'newline', label: 'new paragraph' });
        } else if (/^\s+$/.test(segment)) {
            htmlOutput += segment;
        } else {
            let speakLabel = segment;
            // Check if the segment is a punctuation mark in our map
            if (punctMap[segment]) {
                speakLabel = punctMap[segment];
            }

            htmlOutput += `<span id="w-${wordIdx}" class="word" onclick="setIndex(${wordIdx})">${segment}</span>`;
            words.push({ text: segment, type: 'word', label: speakLabel, id: `w-${wordIdx}` });
            wordIdx++;
        }
    });

    display.innerHTML = htmlOutput;
    document.getElementById('wordCount').innerText = words.filter(w => /[a-zA-Z0-9]/.test(w.text)).length;
}

function setIndex(i) {
    if(isPlaying) return; 
    currentIndex = i;
    updateHighlight(i);
}

function updateHighlight(index) {
    document.querySelectorAll('.word').forEach(el => el.classList.remove('current-word'));
    const wordObj = words[index];
    if (wordObj && wordObj.id) {
        const el = document.getElementById(wordObj.id);
        if (el) {
            el.classList.add('current-word');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

async function handlePlay() {
    if (words.length === 0) return;
    if (isPlaying) {
        isPlaying = false;
        synth.cancel();
        clearTimeout(timer);
        document.getElementById('mainBtn').innerText = "RESUME";
        if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
    } else {
        isPlaying = true;
        document.getElementById('mainBtn').innerText = "PAUSE";
        if ('wakeLock' in navigator) {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
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
    
    const wordObj = words[currentIndex];
    const msPerWord = (60 / currentWpm) * 1000;
    
    synth.cancel(); 

    const utterance = new SpeechSynthesisUtterance(wordObj.label);
    const selectedVoice = voices.find(v => v.name === voiceSelect.value);
    if (selectedVoice) utterance.voice = selectedVoice;
    
    if (currentWpm > 130) utterance.rate = 1.4;
    else if (currentWpm > 90) utterance.rate = 1.1;
    else utterance.rate = 1.0;

    updateHighlight(currentIndex);
    
    synth.speak(utterance);
    currentIndex++;
    
    const delay = wordObj.type === 'newline' ? msPerWord * 1.2 : msPerWord;
    timer = setTimeout(speakNextWord, delay);
}

function reset() {
    isPlaying = false;
    synth.cancel();
    clearTimeout(timer);
    currentIndex = 0;
    document.getElementById('mainBtn').innerText = "PLAY";
    if (wakeLock) { wakeLock.release().then(() => wakeLock = null); }
    initDisplay();
}

if (localStorage.getItem('stenoTheme') === 'night') toggleTheme();
loadSavedText();
initDisplay();

function openGoogleLens() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = 'intent://lens.google.com/vsearch#Intent;scheme=https;package=com.google.android.googlequicksearchbox;end';
        setTimeout(() => { window.location.href = 'https://www.google.com'; }, 500);
    } else {
        window.open('https://www.google.com', '_blank');
    }
}