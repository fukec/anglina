// Globální proměnné
let vocabulary = [];
let currentTest = [];
let currentQuestion = 0;
let score = 0;
let wrongAnswers = [];
let testSettings = {};
let statistics = {
    totalTests: 0,
    totalScore: 0,
    streak: 0,
    lastTestDate: null,
    wordStats: {}
};
let deferredPrompt;
let cameraStream = null;

// Inicializace aplikace
document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializace aplikace...');
    try {
        hideLoading();
        loadData();
        initializeNavigation();
        updateStatistics();
        checkInstallPrompt();
        console.log('Aplikace úspěšně načtena');
        
        // Rychlé akce z URL parametrů
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('quick-test') === 'true') {
            quickTest();
        }
        if (urlParams.get('add-vocab') === 'true') {
            showScreen('camera');
        }
    } catch (error) {
        console.error('Chyba při inicializaci:', error);
        hideLoading();
        alert('Chyba při načítání aplikace. Obnovte stránku.');
    }
});

// ===== NAVIGACE =====
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            showScreen(screen);
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenName + '-screen');
    if (targetScreen) {
        targetScreen.classList.add('active');
        switch(screenName) {
            case 'vocabulary':
                displayVocabulary();
                break;
            case 'stats':
                updateStatistics();
                break;
            case 'camera':
                setupCamera();
                break;
        }
    }
}

// ===== SPRÁVA DAT =====
function loadData() {
    const savedVocab = localStorage.getItem('vocabulary');
    if (savedVocab) {
        vocabulary = JSON.parse(savedVocab);
    } else {
        vocabulary = [
            {id: 1, cs: "dům", en: "house", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 2, cs: "auto", en: "car", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 3, cs: "kniha", en: "book", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 4, cs: "voda", en: "water", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 5, cs: "jídlo", en: "food", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 6, cs: "škola", en: "school", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 7, cs: "práce", en: "work", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 8, cs: "čas", en: "time", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 9, cs: "peníze", en: "money", dateAdded: new Date(), correctCount: 0, wrongCount: 0},
            {id: 10, cs: "rodina", en: "family", dateAdded: new Date(), correctCount: 0, wrongCount: 0}
        ];
        saveData();
    }
    const savedStats = localStorage.getItem('statistics');
    if (savedStats) {
        statistics = JSON.parse(savedStats);
    }
}

function saveData() {
    localStorage.setItem('vocabulary', JSON.stringify(vocabulary));
    localStorage.setItem('statistics', JSON.stringify(statistics));
}

// ===== TEST FUNKCIONALITA =====
function startTest() {
    showLoading();
    // Doplněno: vlastní počet otázek
    const customInput = document.getElementById('customQuestionCount');
    const select = document.getElementById('questionCount');
    let count = parseInt(select.value);
    if (select.value === 'custom' && customInput.value) {
        count = Math.min(100, Math.max(1, parseInt(customInput.value)));
    } else if (select.value === 'all') {
        count = vocabulary.length;
    }
    testSettings.count = count;
    testSettings.direction = document.getElementById('direction').value;
    testSettings.type = document.getElementById('testType').value;

    generateTest();
    document.getElementById('test-setup').style.display = 'none';
    document.getElementById('test-active').style.display = 'block';
    currentQuestion = 0;
    score = 0;
    wrongAnswers = [];
    hideLoading();
    showQuestion();
}

function generateTest() {
    currentTest = [];
    let availableWords = [...vocabulary];
    availableWords = availableWords.sort(() => Math.random() - 0.5);
    const questionCount = testSettings.count === 'all' ? availableWords.length : parseInt(testSettings.count);
    const wordsToUse = availableWords.slice(0, Math.min(questionCount, availableWords.length));
    wordsToUse.forEach(word => {
        let question = {
            id: word.id,
            czech: word.cs,
            english: word.en
        };
        if (testSettings.direction === 'cs-en') {
            question.word = word.cs;
            question.answer = word.en;
            question.direction = 'cs-en';
        } else if (testSettings.direction === 'en-cs') {
            question.word = word.en;
            question.answer = word.cs;
            question.direction = 'en-cs';
        } else { // mix
            const isCStoEN = Math.random() > 0.5;
            question.word = isCStoEN ? word.cs : word.en;
            question.answer = isCStoEN ? word.en : word.cs;
            question.direction = isCStoEN ? 'cs-en' : 'en-cs';
        }
        if (testSettings.type === 'choice') {
            question.choices = generateChoices(question.answer, question.direction);
        }
        currentTest.push(question);
    });
}

function generateChoices(correctAnswer, direction) {
    const choices = [correctAnswer];
    const otherWords = vocabulary.filter(word => {
        const wordAnswer = direction === 'cs-en' ? word.en : word.cs;
        return wordAnswer !== correctAnswer;
    });
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5);
    for (let i = 0; i < 3 && i < shuffledOthers.length; i++) {
        const wrongAnswer = direction === 'cs-en' ? shuffledOthers[i].en : shuffledOthers[i].cs;
        choices.push(wrongAnswer);
    }
    return choices.sort(() => Math.random() - 0.5);
}

function showQuestion() {
    if (currentQuestion >= currentTest.length) {
        showResults();
        return;
    }
    const question = currentTest[currentQuestion];
    document.getElementById('questionText').textContent = question.word;
    document.getElementById('questionDirection').textContent = question.direction === 'cs-en' ? '🇨🇿 → 🇬🇧' : '🇬🇧 → 🇨🇿';
    document.getElementById('questionCounter').textContent = `${currentQuestion + 1} / ${currentTest.length}`;
    document.getElementById('currentScore').textContent = `Skóre: ${score}`;
    const progress = (currentQuestion / currentTest.length) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('feedback').innerHTML = '';
    document.getElementById('answerInput').value = '';
    if (testSettings.type === 'input') {
        document.getElementById('inputAnswer').style.display = 'block';
        document.getElementById('choiceAnswer').style.display = 'none';
        document.getElementById('answerInput').focus();
    } else {
        document.getElementById('inputAnswer').style.display = 'none';
        document.getElementById('choiceAnswer').style.display = 'block';
        showChoices(question.choices);
    }
}

function showChoices(choices) {
    const container = document.getElementById('choiceButtons');
    container.innerHTML = '';
    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = choice;
        button.onclick = () => checkChoiceAnswer(choice);
        container.appendChild(button);
    });
}

function checkAnswer() {
    const userAnswer = document.getElementById('answerInput').value.trim().toLowerCase();
    const correctAnswer = currentTest[currentQuestion].answer.toLowerCase();
    processAnswer(userAnswer === correctAnswer, userAnswer, currentTest[currentQuestion].answer);
}

function checkChoiceAnswer(selectedAnswer) {
    const correctAnswer = currentTest[currentQuestion].answer;
    const isCorrect = selectedAnswer === correctAnswer;
    const buttons = document.querySelectorAll('.choice-btn');
    buttons.forEach(btn => {
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.textContent === selectedAnswer && !isCorrect) {
            btn.classList.add('wrong');
        }
        btn.disabled = true;
    });
    processAnswer(isCorrect, selectedAnswer, correctAnswer);
}

function processAnswer(isCorrect, userAnswer, correctAnswer) {
    const question = currentTest[currentQuestion];
    const wordId = question.id;
    if (isCorrect) {
        score++;
        showFeedback(true, '✅ Správně!');
        const word = vocabulary.find(w => w.id === wordId);
        if (word) {
            word.correctCount = (word.correctCount || 0) + 1;
        }
    } else {
        showFeedback(false, `❌ Správná odpověď: ${correctAnswer}`);
        wrongAnswers.push({
            question: question.word,
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            direction: question.direction
        });
        const word = vocabulary.find(w => w.id === wordId);
        if (word) {
            word.wrongCount = (word.wrongCount || 0) + 1;
        }
    }
    setTimeout(() => {
        currentQuestion++;
        if (currentQuestion < currentTest.length) {
            showQuestion();
        } else {
            showResults();
        }
    }, 1500);
}

function showFeedback(isCorrect, message) {
    const feedback = document.getElementById('feedback');
    feedback.innerHTML = message;
    feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
}

function skipQuestion() {
    const question = currentTest[currentQuestion];
    wrongAnswers.push({
        question: question.word,
        userAnswer: '(přeskočeno)',
        correctAnswer: question.answer,
        direction: question.direction
    });
    currentQuestion++;
    if (currentQuestion < currentTest.length) {
        showQuestion();
    } else {
        showResults();
    }
}

function endTest() {
    if (confirm('Opravdu chcete ukončit test?')) {
        showResults();
    }
}

function showResults() {
    const percentage = Math.round((score / currentTest.length) * 100);
    document.getElementById('test-active').style.display = 'none';
    document.getElementById('test-results').style.display = 'block';
    document.getElementById('finalScore').textContent = `${percentage}%`;
    document.getElementById('scoreDetails').textContent = `${score} z ${currentTest.length} správně`;
    if (wrongAnswers.length > 0) {
        let wrongHtml = '<h4>❌ Chybné odpovědi:</h4><div class="wrong-list">';
        wrongAnswers.forEach(wrong => {
            wrongHtml += `
                <div class="wrong-item">
                    <strong>${wrong.question}</strong> → 
                    <span class="correct-answer">${wrong.correctAnswer}</span>
                    <small>(vaše: ${wrong.userAnswer})</small>
                </div>
            `;
        });
        wrongHtml += '</div>';
        document.getElementById('wrongAnswers').innerHTML = wrongHtml;
    } else {
        document.getElementById('wrongAnswers').innerHTML = '<div class="perfect-score">🎉 Perfektní skóre!</div>';
    }
    statistics.totalTests++;
    statistics.totalScore += score;
    updateStreak(percentage >= 70);
    saveData();
}

function restartTest() {
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('test-setup').style.display = 'block';
}

function quickTest() {
    document.getElementById('questionCount').value = '10';
    document.getElementById('direction').value = 'mix';
    document.getElementById('testType').value = 'input';
    startTest();
}

function reviewMistakes() {
    if (wrongAnswers.length === 0) {
        showNotification('🎉 Žádné chyby k procvičení!');
        return;
    }
    currentTest = wrongAnswers.map(wrong => ({
        word: wrong.question,
        answer: wrong.correctAnswer,
        direction: wrong.direction,
        id: Date.now() + Math.random()
    }));
    currentQuestion = 0;
    score = 0;
    wrongAnswers = [];
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('test-active').style.display = 'block';
    showQuestion();
}

// ===== SPRÁVA SLOVÍČEK =====
function displayVocabulary() {
    const container = document.getElementById('vocabularyList');
    const searchTerm = document.getElementById('searchVocab').value.toLowerCase();
    const filteredVocab = vocabulary.filter(word => 
        word.cs.toLowerCase().includes(searchTerm) || 
        word.en.toLowerCase().includes(searchTerm)
    );
    container.innerHTML = '';
    filteredVocab.forEach(word => {
        const item = document.createElement('div');
        item.className = 'vocab-item';
        const successRate = word.correctCount + word.wrongCount > 0 
            ? Math.round((word.correctCount / (word.correctCount + word.wrongCount)) * 100)
            : 0;
        item.innerHTML = `
            <div class="vocab-words">
                <div class="vocab-czech">${word.cs}</div>
                <div class="vocab-english">${word.en}</div>
                <small>Úspěšnost: ${successRate}% (${word.correctCount}/${word.correctCount + word.wrongCount})</small>
            </div>
            <div class="vocab-actions">
                <button class="btn-icon" onclick="editVocabulary(${word.id})" title="Upravit">✏️</button>
                <button class="btn-icon" onclick="deleteVocabulary(${word.id})" title="Smazat">🗑️</button>
            </div
        `;
        container.appendChild(item);
    });
    document.getElementById('vocabStats').innerHTML = `
        <strong>${vocabulary.length}</strong> slovíček celkem
        ${searchTerm ? `| <strong>${filteredVocab.length}</strong> nalezeno` : ''}
    `;
}

function filterVocabulary() {
    displayVocabulary();
}

function addVocabulary() {
    const czechWord = document.getElementById('newCzech').value.trim();
    const englishWord = document.getElementById('newEnglish').value.trim();
    if (!czechWord || !englishWord) {
        alert('Vyplňte prosím obě pole');
        return;
    }
    const exists = vocabulary.some(word => 
        word.cs.toLowerCase() === czechWord.toLowerCase() || 
        word.en.toLowerCase() === englishWord.toLowerCase()
    );
    if (exists) {
        alert('Toto slovíčko už existuje');
        return;
    }
    const newWord = {
        id: Date.now(),
        cs: czechWord,
        en: englishWord,
        dateAdded: new Date(),
        correctCount: 0,
        wrongCount: 0
    };
    vocabulary.push(newWord);
    saveData();
    document.getElementById('newCzech').value = '';
    document.getElementById('newEnglish').value = '';
    displayVocabulary();
    showNotification(`✅ Přidáno: ${czechWord} → ${englishWord}`);
}

function editVocabulary(id) {
    const word = vocabulary.find(w => w.id === id);
    if (!word) return;
    const newCzech = prompt('České slovo:', word.cs);
    if (newCzech === null) return;
    const newEnglish = prompt('Anglické slovo:', word.en);
    if (newEnglish === null) return;
    if (newCzech.trim() && newEnglish.trim()) {
        word.cs = newCzech.trim();
        word.en = newEnglish.trim();
        saveData();
        displayVocabulary();
        showNotification('✅ Slovíčko upraveno');
    }
}

function deleteVocabulary(id) {
    const word = vocabulary.find(w => w.id === id);
    if (!word) return;
    if (confirm(`Opravdu smazat "${word.cs} → ${word.en}"?`)) {
        vocabulary = vocabulary.filter(w => w.id !== id);
        saveData();
        displayVocabulary();
        showNotification('🗑️ Slovíčko smazáno');
    }
}



// ===== KAMERA A OCR =====
async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('startCamera').style.display = 'none';
        showNotification('❌ Kamera není podporována', 'error');
        return;
    }
}

async function startCamera() {
    try {
        showLoading();
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera');
        const preview = document.getElementById('cameraPreview');
        video.srcObject = cameraStream;
        video.style.display = 'block';
        preview.style.display = 'none';
        document.getElementById('startCamera').style.display = 'none';
        document.getElementById('takePhoto').style.display = 'inline-block';
        document.getElementById('stopCamera').style.display = 'inline-block';
        hideLoading();
    } catch (error) {
        console.error('Chyba při spuštění kamery:', error);
        showNotification('❌ Nelze spustit kameru', 'error');
        hideLoading();
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    const video = document.getElementById('camera');
    const preview = document.getElementById('cameraPreview');
    video.style.display = 'none';
    preview.style.display = 'flex';
    document.getElementById('startCamera').style.display = 'inline-block';
    document.getElementById('takePhoto').style.display = 'none';
    document.getElementById('stopCamera').style.display = 'none';
}

function takePhoto() {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
        processImageFile(blob);
    }, 'image/jpeg', 0.8);
}

function processImageFile(file) {
    if (!file) return;
    showLoading();
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            recognizeText(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function recognizeText(image) {
    try {
        showNotification('🔍 Rozpoznávám text...', 'info');
        const { data: { text } } = await Tesseract.recognize(
            image,
            'ces+eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );
        const words = parseRecognizedText(text);
        displayOCRResults(words);
        hideLoading();
    } catch (error) {
        console.error('OCR Error:', error);
        showNotification('❌ Chyba při rozpoznávání textu', 'error');
        hideLoading();
    }
}

function parseRecognizedText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const results = [];
    lines.forEach(line => {
        const match = line.match(/(.+?)\s*[-–—]\s*(.+)/);
        if (match) {
            results.push({
                czech: match[1].trim(),
                english: match[2].trim()
            });
        }
    });
    return results;
}

function displayOCRResults(results) {
    const container = document.getElementById('ocrResults');
    if (results.length === 0) {
        container.innerHTML = '<p>❌ Žádný text nebyl rozpoznán</p>';
        return;
    }
    let html = '<h3>📝 Rozpoznaný text:</h3>';
    html += '<div class="ocr-words">';
    results.forEach((result, index) => {
        html += `
            <div class="ocr-word-pair">
                <input type="text" value="${result.czech}" id="ocr-czech-${index}" placeholder="České slovo">
                <input type="text" value="${result.english}" id="ocr-english-${index}" placeholder="English word">
                <button class="btn btn-primary btn-small" onclick="addOCRWord(${index})">➕ Přidat</button>
            </div>
        `;
    });
    html += '</div>';
    html += '<button class="btn btn-success" onclick="addAllOCRWords()">✅ Přidat všechna</button>';
    container.innerHTML = html;
}

function addOCRWord(index) {
    const czechWord = document.getElementById(`ocr-czech-${index}`).value.trim();
    const englishWord = document.getElementById(`ocr-english-${index}`).value.trim();
    if (czechWord && englishWord) {
        const newWord = {
            id: Date.now() + index,
            cs: czechWord,
            en: englishWord,
            dateAdded: new Date(),
            correctCount: 0,
            wrongCount: 0
        };
        vocabulary.push(newWord);
        saveData();
        showNotification(`✅ Přidáno: ${czechWord} → ${englishWord}`);
        document.getElementById(`ocr-czech-${index}`).parentElement.remove();
    }
}

function addAllOCRWords() {
    const ocrWordPairs = document.querySelectorAll('.ocr-word-pair');
    let addedCount = 0;
    ocrWordPairs.forEach((pair, index) => {
        const czechInput = pair.querySelector(`#ocr-czech-${index}`);
        const englishInput = pair.querySelector(`#ocr-english-${index}`);
        if (czechInput && englishInput) {
            const czechWord = czechInput.value.trim();
            const englishWord = englishInput.value.trim();
            if (czechWord && englishWord) {
                const newWord = {
                    id: Date.now() + index,
                    cs: czechWord,
                    en: englishWord,
                    dateAdded: new Date(),
                    correctCount: 0,
                    wrongCount: 0
                };
                vocabulary.push(newWord);
                addedCount++;
            }
        }
    });
    if (addedCount > 0) {
        saveData();
        showNotification(`✅ Přidáno ${addedCount} slovíček`);
        document.getElementById('ocrResults').innerHTML = '';
    }
}

// ===== STATISTIKY =====
function updateStatistics() {
    document.getElementById('totalWords').textContent = vocabulary.length;
    document.getElementById('totalTests').textContent = statistics.totalTests;
    const avgScore = statistics.totalTests > 0 
        ? Math.round((statistics.totalScore / statistics.totalTests) * 100) / 100
        : 0;
    document.getElementById('avgScore').textContent = avgScore + '%';
    document.getElementById('streak').textContent = statistics.streak;
    updateDifficultWords();
    drawProgressChart();
}

function updateStreak(testPassed) {
    const today = new Date().toDateString();
    const lastTest = statistics.lastTestDate;
    if (testPassed) {
        if (lastTest === today) {
            // Už dnes testoval, neměnit streak
        } else if (isConsecutiveDay(lastTest, today)) {
            statistics.streak++;
        } else {
            statistics.streak = 1;
        }
    } else {
        statistics.streak = 0;
    }
    statistics.lastTestDate = today;
}

function isConsecutiveDay(lastDate, currentDate) {
    if (!lastDate) return false;
    const last = new Date(lastDate);
    const current = new Date(currentDate);
    const diffTime = current - last;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
}

function updateDifficultWords() {
    const difficultWords = vocabulary
        .filter(word => (word.correctCount + word.wrongCount) >= 3)
        .map(word => ({
            ...word,
            errorRate: word.wrongCount / (word.correctCount + word.wrongCount)
        }))
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 5);
    const container = document.getElementById('difficultWordsList');
    if (difficultWords.length === 0) {
        container.innerHTML = '<p>🎉 Zatím žádná problematická slovíčka!</p>';
        return;
    }
    let html = '';
    difficultWords.forEach(word => {
        const errorPercentage = Math.round(word.errorRate * 100);
        html += `
            <div class="difficult-word">
                <span class="word-pair">${word.cs} → ${word.en}</span>
                <span class="error-rate">${errorPercentage}% chyb</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

function drawProgressChart() {
    const canvas = document.getElementById('progressChart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const data = [65, 72, 68, 85, 78, 92, 88];
    const labels = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const stepX = canvas.width / (data.length - 1);
    const maxY = Math.max(...data);
    data.forEach((point, index) => {
        const x = index * stepX;
        const y = canvas.height - (point / maxY) * canvas.height * 0.8;
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    labels.forEach((label, index) => {
        ctx.fillText(label, index * stepX, canvas.height - 5);
    });
}

// ===== POMOCNÉ FUNKCE =====
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : '#4caf50'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ===== PWA FUNKCIONALITA =====
function checkInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installBanner').style.display = 'flex';
    });
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Uživatel přijal instalaci');
            }
            deferredPrompt = null;
        });
    }
}

function dismissInstall() {
    document.getElementById('installBanner').style.display = 'none';
    localStorage.setItem('installDismissed', Date.now() + (7 * 24 * 60 * 60 * 1000));
}

// ===== NAČÍTÁNÍ OBRÁZKŮ Z GALERIE =====
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Vyberte prosím soubor obrázku');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            recognizeText(img);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// ===== VÝBĚR POČTU OTÁZEK - VLASTNÍ ČÍSLO =====
function updateQuestionCount() {
    const customInput = document.getElementById('customQuestionCount');
    const select = document.getElementById('questionCount');
    if (customInput.value > 0 && customInput.value <= 100) {
        select.value = 'custom';
    }
}

function updateInputState() {
    const select = document.getElementById('questionCount');
    const customInput = document.getElementById('customQuestionCount');
    if (select.value === 'all') {
        customInput.disabled = true;
        customInput.value = '';
    } else if (select.value === 'custom') {
        customInput.disabled = false;
        customInput.focus();
    } else {
        customInput.disabled = true;
        customInput.value = '';
    }
}
