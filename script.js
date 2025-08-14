document.addEventListener('DOMContentLoaded', () => {
    // --- Bazy Danych ---
    let allCards = [];
    let deckComposition = [];

    // --- Klasa do zarządzania stanem gry ---
    class Game {
        constructor() {
            this.player = {
                superhero: null, deck: [], hand: [], discard: [], locations: [], played: [], power: 0
            };
            this.mainDeck = []; this.lineUp = []; this.kickStack = [];
            this.weaknessStack = []; this.superVillainStack = []; this.destroyedPile = [];

            this.ui = {
                playerHand: document.querySelector('#player-hand-area .card-row'),
                playerDeck: document.querySelector('#player-deck-area .card-stack'),
                playerDiscard: document.querySelector('#player-discard-pile-area .card-stack'),
                playerSuperhero: document.querySelector('#player-superhero-area .card-stack'),
                destroyedPile: document.querySelector('#destroyed-pile-area .card-stack'),
                lineUp: document.querySelector('#line-up-area .card-row'),
                mainDeck: document.querySelector('#main-deck-area .card-stack'),
                kickStack: document.querySelector('#kick-stack-area .card-stack'),
                weaknessStack: document.querySelector('#weakness-stack-area .card-stack'),
                superVillainStack: document.querySelector('#super-villain-stack-area .card-stack'),
                powerTotal: document.getElementById('power-total')
            };
        }

        shuffle(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; } }
        resetState() {
            this.player = { superhero: null, deck: [], hand: [], discard: [], locations: [], played: [], power: 0 };
            this.mainDeck = []; this.lineUp = []; this.kickStack = [];
            this.weaknessStack = []; this.superVillainStack = []; this.destroyedPile = [];
            Object.values(this.ui).forEach(zone => { if (zone.id !== 'power-total') zone.innerHTML = ''; });
        }
        setupNewGame() {
            this.resetState(); console.log("Rozpoczynanie setupu nowej gry...");
            const superheroes = allCards.filter(c => c.type === 'Super-Hero');
            this.player.superhero = superheroes[Math.floor(Math.random() * superheroes.length)];
            console.log(`Wybrano Superbohatera: ${this.player.superhero.name_pl}`);
            for (let i = 0; i < 7; i++) this.player.deck.push(allCards.find(c => c.id === 'punch'));
            for (let i = 0; i < 3; i++) this.player.deck.push(allCards.find(c => c.id === 'vulnerability'));
            this.shuffle(this.player.deck);
            deckComposition.forEach(item => {
                const cardInfo = allCards.find(c => c.id === item.id);
                if (cardInfo && !['Starter', 'Kick', 'Weakness', 'Super-Villain', 'Super-Hero'].includes(cardInfo.type)) {
                    for (let i = 0; i < item.count; i++) this.mainDeck.push(cardInfo);
                }
            });
            this.shuffle(this.mainDeck); console.log(`Talia główna stworzona: ${this.mainDeck.length} kart.`);
            const kickCard = allCards.find(c => c.id === 'kick');
            const weaknessCard = allCards.find(c => c.id === 'weakness');
            for (let i = 0; i < 16; i++) this.kickStack.push(kickCard);
            for (let i = 0; i < 20; i++) this.weaknessStack.push(weaknessCard);
            const svCards = allCards.filter(c => c.type === 'Super-Villain' && c.id !== 'ras_al_ghul');
            this.shuffle(svCards); this.superVillainStack = svCards.slice(0, 7);
            this.superVillainStack.push(allCards.find(c => c.id === 'ras_al_ghul'));
            this.superVillainStack.reverse(); console.log(`Stos Super-złoczyńców gotowy: ${this.superVillainStack.length} kart.`);
            for(let i = 0; i < 5; i++) { if (this.mainDeck.length > 0) this.lineUp.push(this.mainDeck.pop()); }
            for(let i = 0; i < 5; i++) { this.drawCard(false); }
            this.renderAll(); console.log("Setup zakończony, plansza wyrenderowana.");
        }
        drawCard(render = true) {
            if (this.player.deck.length === 0) {
                if (this.player.discard.length === 0) { console.log("Brak kart do dobrania."); return; }
                console.log("Tasowanie odrzutów."); this.player.deck = [...this.player.discard];
                this.player.discard = []; this.shuffle(this.player.deck);
            }
            this.player.hand.push(this.player.deck.pop());
            if (render) this.renderAll();
        }
        addCardById(cardId, destination) {
            const card = allCards.find(c => c.id === cardId);
            if (!card) { console.error(`Nie znaleziono karty o ID: ${cardId}`); return; }
            if (destination === 'hand') { this.player.hand.push(card); console.log(`Dodano ${card.name_pl} do ręki.`); }
            else if (destination === 'lineup') { this.lineUp.push(card); console.log(`Dodano ${card.name_pl} do Line-Up.`); }
        }
        destroyCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(card => card.id === cardId);
            if (cardIndex > -1) {
                const [destroyedCard] = this.player.hand.splice(cardIndex, 1);
                this.destroyedPile.push(destroyedCard);
                console.log(`Zniszczono ${destroyedCard.name_pl} z ręki.`);
            } else {
                console.error(`Nie znaleziono karty ${cardId} w ręce.`);
            }
        }
        createCardElement(cardData, isFaceDown = false) {
            const cardDiv = document.createElement('div');
            if (!cardData || !cardData.id) { console.error("Błąd: Próba stworzenia karty z nieprawidłowych danych.", cardData); cardDiv.textContent = 'BŁĄD'; return cardDiv; }
            cardDiv.className = 'card'; cardDiv.dataset.id = cardData.id;
            if (isFaceDown) { cardDiv.classList.add('is-face-down');
            } else { cardDiv.style.backgroundImage = `url('${cardData.image_path}')`; cardDiv.textContent = cardData.name_pl; }
            return cardDiv;
        }
        renderAll() {
            Object.values(this.ui).forEach(zone => { if (zone && zone.id !== 'power-total') zone.innerHTML = ''; });
            this.player.hand.forEach(card => this.ui.playerHand.appendChild(this.createCardElement(card)));
            if (this.player.deck.length > 0) this.ui.playerDeck.appendChild(this.createCardElement(this.player.deck[0], true));
            if (this.player.discard.length > 0) this.ui.playerDiscard.appendChild(this.createCardElement(this.player.discard[this.player.discard.length - 1]));
            if (this.player.superhero) this.ui.playerSuperhero.appendChild(this.createCardElement(this.player.superhero));
            if (this.destroyedPile.length > 0) this.ui.destroyedPile.appendChild(this.createCardElement(this.destroyedPile[this.destroyedPile.length - 1]));
            this.lineUp.forEach(card => this.ui.lineUp.appendChild(this.createCardElement(card)));
            if (this.mainDeck.length > 0) this.ui.mainDeck.appendChild(this.createCardElement(this.mainDeck[0], true));
            if (this.kickStack.length > 0) this.ui.kickStack.appendChild(this.createCardElement(this.kickStack[0]));
            if (this.weaknessStack.length > 0) this.ui.weaknessStack.appendChild(this.createCardElement(this.weaknessStack[0]));
            if (this.superVillainStack.length > 0) this.ui.superVillainStack.appendChild(this.createCardElement(this.superVillainStack[0]));
            this.ui.powerTotal.textContent = this.player.power;
        }
    }

    // --- Inicjalizacja Aplikacji ---
    let game;
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const settingsModal = document.getElementById('settings-modal');
    const cardIdModal = document.getElementById('card-id-modal');
    const newGameBtn = document.getElementById('new-game-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const cardIdSubmitBtn = document.getElementById('card-id-submit');
    const cardSelectList = document.getElementById('card-select-list');
    const cardModalTitle = document.getElementById('card-modal-title');
    const debugPanel = document.getElementById('debug-panel');
    let cardIdModalCallback = null;

    function showScreen(screenToShow) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); screenToShow.classList.add('active'); }
    function showModal(modal) { modal.classList.add('active'); }
    function hideModal(modal) { modal.classList.remove('active'); }

    function populateCardSelect(filterFn = () => true) {
        cardSelectList.innerHTML = '';
        const cardSource = allCards.filter(filterFn).sort((a,b) => a.name_pl.localeCompare(b.name_pl));
        cardSource.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = `${card.name_pl} [${card.type}]`;
            cardSelectList.appendChild(option);
        });
    }

    debugPanel.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || !game) return;
        const action = e.target.dataset.debug;
        let title = "Wybierz kartę";
        switch (action) {
            case 'draw-card': game.drawCard(); return;
            case 'add-power': game.player.power++; break;
            case 'remove-power': if (game.player.power > 0) game.player.power--; break;
            case 'add-card-hand':
                title = "Dodaj kartę do ręki";
                populateCardSelect(card => card.type !== 'Super-Hero');
                cardIdModalCallback = (cardId) => game.addCardById(cardId, 'hand');
                showModal(cardIdModal); return; 
            case 'add-card-lineup':
                title = "Dodaj kartę do Line-Up";
                populateCardSelect(card => card.type !== 'Super-Hero');
                cardIdModalCallback = (cardId) => game.addCardById(cardId, 'lineup');
                showModal(cardIdModal); return;
            case 'destroy-card':
                title = "Zniszcz kartę z ręki";
                // Pokaż tylko karty, które gracz ma aktualnie na ręce
                populateCardSelect(card => game.player.hand.some(handCard => handCard.id === card.id));
                cardIdModalCallback = (cardId) => game.destroyCardFromHand(cardId);
                showModal(cardIdModal); return;
            default: return;
        }
        game.renderAll();
    });
    
    cardIdSubmitBtn.addEventListener('click', () => {
        const selectedId = cardSelectList.value;
        if (selectedId && cardIdModalCallback) {
            cardIdModalCallback(selectedId);
            game.renderAll();
        }
        hideModal(cardIdModal);
        cardIdModalCallback = null;
    });

    async function main() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.querySelector('.close-btn')?.addEventListener('click', () => hideModal(modal));
        });
        newGameBtn.disabled = true;
        try {
            const [cardsRes, compoRes] = await Promise.all([fetch('cards.json'), fetch('deck_composition.json')]);
            allCards = await cardsRes.json(); deckComposition = await compoRes.json();
            console.log("Pomyślnie załadowano dane gry.");
            newGameBtn.disabled = false;
        } catch (error) { console.error("Błąd ładowania danych gry:", error); }
    }
    
    newGameBtn.addEventListener('click', () => { showScreen(gameScreen); game = new Game(); game.setupNewGame(); });
    settingsBtn.addEventListener('click', () => { populateCardSelect(c => c.type !== 'Super-Hero'); showModal(settingsModal);});
    main();
});