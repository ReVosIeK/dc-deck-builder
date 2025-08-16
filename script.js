import { effectHandlers } from './effects.js';
import { translations } from './translations.js';
import { initializeAbilitySystem } from './abilities.js';

class EventDispatcher {
    constructor() {
        this.listeners = {};
    }
    subscribe(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }
    dispatch(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Zmienne globalne ---
    let allCards = [];
    let deckComposition = [];
    let game;

    // --- Elementy UI ---
    const cardInspector = document.getElementById('card-inspector');
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const newGameBtn = document.getElementById('new-game-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const endTurnBtn = document.getElementById('end-turn-btn');
    const debugPanel = document.getElementById('debug-panel');
    const languageSelect = document.getElementById('language-select');
    const cardIdModal = document.getElementById('card-id-modal');
    const cardIdSubmitBtn = document.getElementById('card-id-submit');
    let cardIdModalCallback = null;

    // --- Główna Klasa Gry ---
    class Game {
        constructor() {
            this.events = new EventDispatcher();
            this.currentLanguage = 'pl';

            this.player = {
                superhero: null, deck: [], hand: [], discard: [],
                locations: [], played: [], power: 0,
                cardsPlayedThisTurn: [], cardsGainedThisTurn: [],
                activeTurnEffects: [], firstPlaysThisTurn: new Set()
            };
            
            this.mainDeck = [];
            this.lineUp = [];
            this.kickStack = [];
            this.weaknessStack = [];
            this.superVillainStack = [];
            this.destroyedPile = [];

            this._initializeUI();
        }

        // --- Metody Inicjalizacyjne i Głównej Pętli Gry ---

        setupNewGame() {
            this.player = {
                superhero: allCards.find(c => c.id === 'batman'), deck: [], hand: [],
                discard: [], locations: [], played: [], power: 0,
                cardsPlayedThisTurn: [], cardsGainedThisTurn: [],
                activeTurnEffects: [], firstPlaysThisTurn: new Set()
            };
            this.mainDeck = []; this.lineUp = []; this.kickStack = [];
            this.weaknessStack = []; this.superVillainStack = []; this.destroyedPile = [];

            for (let i = 0; i < 7; i++) {
                this.player.deck.push(allCards.find(c => c.id === 'punch'));
            }
            for (let i = 0; i < 3; i++) {
                this.player.deck.push(allCards.find(c => c.id === 'vulnerability'));
            }
            this.shuffle(this.player.deck);

            deckComposition.forEach(item => {
                const cardInfo = allCards.find(c => c.id === item.id);
                if (cardInfo && !['Starter', 'Kick', 'Weakness', 'Super-Villain', 'Super-Hero'].includes(cardInfo.type)) {
                    for (let i = 0; i < item.count; i++) {
                        this.mainDeck.push(cardInfo);
                    }
                }
            });
            this.shuffle(this.mainDeck);

            const kickCard = allCards.find(c => c.id === 'kick');
            for (let i = 0; i < 16; i++) { this.kickStack.push(kickCard); }

            const weaknessCard = allCards.find(c => c.id === 'weakness');
            for (let i = 0; i < 20; i++) { this.weaknessStack.push(weaknessCard); }
            
            this.superVillainStack = allCards.filter(c => c.type === 'Super-Villain');
            this.shuffle(this.superVillainStack);
            
            initializeAbilitySystem(this);
            
            this.refillLineUp();
            for (let i = 0; i < 5; i++) {
                this.drawCard(false);
            }
            this.renderAll();
        }

        endTurn() {
            this.player.discard.push(...this.player.hand, ...this.player.played);
            this.player.hand = [];
            this.player.played = [];
            this.player.power = 0;
            this.player.firstPlaysThisTurn.clear();
            this.player.cardsPlayedThisTurn = [];
            this.player.cardsGainedThisTurn = [];
            this.player.activeTurnEffects = [];
            
            this.lineUp = this.lineUp.filter(card => card !== null);
            this.refillLineUp();
            
            for (let i = 0; i < 5; i++) {
                this.drawCard(false);
            }
            this.renderAll();
        }

        async playCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;

            const [cardToPlay] = this.player.hand.splice(cardIndex, 1);
            
            if (cardToPlay.type === 'Location') {
                this.player.locations.push(cardToPlay);
            } else {
                this.player.played.push(cardToPlay);
            }
            
            this.player.cardsPlayedThisTurn.push(cardToPlay);
            this.player.power += cardToPlay.power || 0;
            
            this.events.dispatch('cardPlayed', { card: cardToPlay, game: this });

            await this.executeCardEffects(cardToPlay);
            this.renderAll();
        }
        
        // --- Metody Obsługi Efektów i Zdarzeń ---

        async executeCardEffects(card) {
            if (!card.effect_tags || card.effect_tags.length === 0) return;

            for (const tag of card.effect_tags) {
                const [effectName, ...params] = tag.split(':');
                if (effectHandlers[effectName]) {
                    await effectHandlers[effectName](this, params);
                } else {
                    console.warn(`Nieznany tag efektu: ${effectName}`);
                }
            }
        }

        async processAttack(attackString) {
            const defenseCards = this.player.hand.filter(card => card.effect_tags.some(tag => tag.startsWith('defense_effect')));
            let defenseUsed = false;

            if (defenseCards.length > 0) {
                const chosenDefenseCard = await this.ui.cardSelectionModal.waitForSelection(translations[this.currentLanguage].defendPrompt, defenseCards);
                if (chosenDefenseCard) {
                    const defenseTag = chosenDefenseCard.effect_tags.find(tag => tag.startsWith('defense_effect'));
                    const [effectName, ...params] = defenseTag.split(':');
                    if (effectHandlers[effectName]) {
                        await effectHandlers[effectName](this, chosenDefenseCard, params);
                    }
                    defenseUsed = true;
                }
            }

            if (!defenseUsed) {
                console.log("Obrona nie została użyta. Efekt ataku przechodzi.");
                switch (attackString) {
                    case 'each_opponent_gains_weakness':
                        this.gainWeakness();
                        break;
                    case 'each_opponent_discards_card_from_hand_choice':
                        if (this.player.hand.length === 0) {
                            console.log("Ręka jest pusta, atak nie ma efektu.");
                            break;
                        }
                        const cardToDiscard = await this.ui.cardSelectionModal.waitForSelection(
                            "Atak! Wybierz kartę do odrzucenia:",
                            this.player.hand
                        );
                        if (cardToDiscard) {
                            const cardIndex = this.player.hand.findIndex(c => c === cardToDiscard);
                            if (cardIndex > -1) {
                                const [discardedCard] = this.player.hand.splice(cardIndex, 1);
                                this.player.discard.push(discardedCard);
                                console.log(`Odrzucono w wyniku ataku: ${discardedCard[`name_${this.currentLanguage}`]}`);
                            }
                        }
                        break;
                    default:
                        console.warn(`Nieobsługiwany atak: ${attackString}`);
                }
            } else {
                console.log("Atak został zablokowany przez obronę.");
            }
            this.renderAll();
        }
        
        // --- Metody Akcji Gracza (Kupowanie, Zdobywanie Kart) ---

        async gainCard(card, sourcePile, sourceIndex = -1) {
            if (sourcePile) {
                if (sourceIndex > -1) {
                    sourcePile.splice(sourceIndex, 1);
                } else {
                    sourcePile.pop();
                }
            }
            this.player.discard.push(card);
            this.player.cardsGainedThisTurn.push(card);
            this.events.dispatch('cardGained', { card: card, game: this });
            if (sourcePile === this.lineUp) {
                this.refillLineUp();
            }
        }

        async buyCardFromLineUp(cardId) {
            const cardIndex = this.lineUp.findIndex(c => c && c.id === cardId);
            if (cardIndex === -1) return;

            const cardToBuy = this.lineUp[cardIndex];
            if (this.player.power >= cardToBuy.cost) {
                this.player.power -= cardToBuy.cost;
                await this.gainCard(cardToBuy, this.lineUp, cardIndex);
                this.renderAll();
            }
        }

        async buyKickCard() {
            if (this.kickStack.length === 0) return;
            const kickCard = this.kickStack[0];
            if (this.player.power >= kickCard.cost) {
                this.player.power -= kickCard.cost;
                await this.gainCard(kickCard, this.kickStack);
                this.renderAll();
            }
        }

        async defeatSuperVillain() {
            if (this.superVillainStack.length === 0) return;
            const sv = this.superVillainStack[this.superVillainStack.length - 1];
            if (this.player.power >= sv.cost) {
                this.player.power -= sv.cost;
                await this.gainCard(sv, this.superVillainStack);
                this.renderAll();
            }
        }

        // --- Metody Pomocnicze i Debugowania ---

        shuffle(deck) {
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
        }

        refillLineUp() {
            while (this.lineUp.filter(c => c).length < 5 && this.mainDeck.length > 0) {
                const emptyIndex = this.lineUp.findIndex(c => c === null);
                if (emptyIndex !== -1) {
                    this.lineUp[emptyIndex] = this.mainDeck.pop();
                } else {
                    this.lineUp.push(this.mainDeck.pop());
                }
            }
        }

        shuffleDiscardIntoDeck() {
            if (this.player.discard.length > 0) {
                this.player.deck.push(...this.player.discard);
                this.player.discard = [];
                this.shuffle(this.player.deck);
            }
        }

        drawCard(render = true) {
            if (this.player.deck.length === 0) {
                this.shuffleDiscardIntoDeck();
            }
            if (this.player.deck.length > 0) {
                this.player.hand.push(this.player.deck.pop());
            }
            if (render) {
                this.renderAll();
            }
        }

        gainWeakness() {
            if (this.weaknessStack.length > 0) {
                this.player.discard.push(this.weaknessStack.pop());
            }
        }

        addCardById(cardId, dest) {
            const card = allCards.find(c => c.id === cardId);
            if (!card) return;

            if (dest === 'hand') {
                this.player.hand.push(card);
            } else if (dest === 'lineup') {
                this.lineUp.push(card);
            }
            this.renderAll();
        }

        destroyCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(card => card.id === cardId);
            if (cardIndex > -1) {
                const [destroyedCard] = this.player.hand.splice(cardIndex, 1);
                this.destroyedPile.push(destroyedCard);
                this.renderAll();
            }
        }
        
        // --- Metody UI i Renderowania ---

        _initializeUI() {
            this.ui = {
                playerHand: document.querySelector('#player-hand-area .card-row'),
                playerDeck: document.querySelector('#player-deck-area .card-stack'),
                playerDiscard: document.querySelector('#player-discard-pile-area .card-stack'),
                playerSuperhero: document.querySelector('#player-superhero-area .card-stack'),
                playedCards: document.querySelector('#played-cards-area .card-row'),
                playerLocations: document.querySelector('#player-locations-area .card-row'),
                destroyedPile: document.querySelector('#destroyed-pile-area .card-stack'),
                lineUp: document.querySelector('#line-up-area .card-row'),
                mainDeck: document.querySelector('#main-deck-area .card-stack'),
                kickStack: document.querySelector('#kick-stack-area .card-stack'),
                weaknessStack: document.querySelector('#weakness-stack-area .card-stack'),
                superVillainStack: document.querySelector('#super-villain-stack-area .card-stack'),
                powerTotal: document.getElementById('power-total'),
                choiceModal: {
                    element: document.getElementById('choice-modal'),
                    title: document.getElementById('choice-modal-title'),
                    cardDisplay: document.getElementById('choice-card-display'),
                    text: document.getElementById('choice-modal-text'),
                    yesBtn: document.getElementById('choice-yes-btn'),
                    noBtn: document.getElementById('choice-no-btn'),
                    waitForChoice: (prompt, card) => new Promise(resolve => {
                        this.ui.choiceModal.text.textContent = prompt;
                        if (card) { this.ui.choiceModal.cardDisplay.innerHTML = ''; this.ui.choiceModal.cardDisplay.appendChild(this.createCardElement(card, 'choice')); this.ui.choiceModal.cardDisplay.style.display = 'block'; } else { this.ui.choiceModal.cardDisplay.innerHTML = ''; this.ui.choiceModal.cardDisplay.style.display = 'none'; }
                        this.ui.choiceModal.element.classList.add('active');
                        const resolvePromise = (choice) => { this.ui.choiceModal.element.classList.remove('active'); resolve(choice); };
                        this.ui.choiceModal.yesBtn.addEventListener('click', () => resolvePromise('yes'), { once: true });
                        this.ui.choiceModal.noBtn.addEventListener('click', () => resolvePromise('no'), { once: true });
                    })
                },
                cardSelectionModal: {
                    element: document.getElementById('card-selection-modal'),
                    title: document.getElementById('selection-modal-title'),
                    cardList: document.getElementById('selection-card-list'),
                    waitForSelection: (prompt, cards) => new Promise(resolve => {
                        this.ui.cardSelectionModal.title.textContent = prompt;
                        this.ui.cardSelectionModal.cardList.innerHTML = '';
                        const resolvePromise = (card) => { this.ui.cardSelectionModal.element.classList.remove('active'); this.ui.cardSelectionModal.element.removeEventListener('click', closeModalHandler); resolve(card); };
                        cards.forEach(card => {
                            const cardEl = this.createCardElement(card, 'selection');
                            cardEl.addEventListener('click', (e) => { e.stopPropagation(); resolvePromise(card); });
                            this.ui.cardSelectionModal.cardList.appendChild(cardEl);
                        });
                        const closeModalHandler = (e) => { if (e.target === this.ui.cardSelectionModal.element) resolvePromise(null); };
                        this.ui.cardSelectionModal.element.addEventListener('click', closeModalHandler);
                        this.ui.cardSelectionModal.element.classList.add('active');
                    })
                }
            };
        }
        
        handleCardClick(cardData, loc) {
            if (loc === 'hand') { this.playCardFromHand(cardData.id); } 
            else if (loc === 'lineup') { this.buyCardFromLineUp(cardData.id); } 
            else if (loc === 'kick') { this.buyKickCard(); } 
            else if (loc === 'super-villain') { this.defeatSuperVillain(); }
        }

        createCardElement(cardData, location) {
            if (!cardData) {
                const p = document.createElement('div');
                p.className = 'card-placeholder';
                p.textContent = translations[this.currentLanguage].emptySlot;
                return p;
            }
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.dataset.id = cardData.id;
            const cardName = cardData[`name_${this.currentLanguage}`] || cardData.name_en;
            if (location !== 'selection' && location !== 'choice') {
                if ((['lineup', 'super-villain', 'kick'].includes(location)) && this.player.power < cardData.cost) {
                    cardDiv.classList.add('unaffordable');
                } else {
                    cardDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleCardClick(cardData, location);
                    });
                }
            }
            if (!['deck', 'main-deck', 'choice', 'selection'].includes(location)) {
                cardDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    cardInspector.style.backgroundImage = `url('${cardData.image_path}')`;
                    cardInspector.classList.add('visible');
                });
            }
            if (['deck', 'main-deck'].includes(location)) {
                cardDiv.classList.add('is-face-down');
            } else {
                cardDiv.style.backgroundImage = `url('${cardData.image_path}')`;
                cardDiv.textContent = cardName;
            }
            return cardDiv;
        }

        renderAll() {
            const zones = [this.ui.playerHand, this.ui.playedCards, this.ui.playerLocations, this.ui.lineUp, this.ui.playerDeck, this.ui.playerDiscard, this.ui.destroyedPile, this.ui.playerSuperhero, this.ui.mainDeck, this.ui.kickStack, this.ui.weaknessStack, this.ui.superVillainStack];
            zones.forEach(zone => { zone.innerHTML = ''; });

            this.player.hand.forEach(card => this.ui.playerHand.appendChild(this.createCardElement(card, 'hand')));
            this.player.played.forEach(card => this.ui.playedCards.appendChild(this.createCardElement(card, 'played')));
            this.player.locations.forEach(card => this.ui.playerLocations.appendChild(this.createCardElement(card, 'location')));
            this.lineUp.forEach(card => this.ui.lineUp.appendChild(this.createCardElement(card, 'lineup')));
            if (this.player.deck.length > 0) this.ui.playerDeck.appendChild(this.createCardElement(this.player.deck[this.player.deck.length - 1], 'deck'));
            if (this.player.discard.length > 0) this.ui.playerDiscard.appendChild(this.createCardElement(this.player.discard[this.player.discard.length - 1], 'discard'));
            if (this.destroyedPile.length > 0) this.ui.destroyedPile.appendChild(this.createCardElement(this.destroyedPile[this.destroyedPile.length - 1], 'destroyed'));
            if (this.player.superhero) this.ui.playerSuperhero.appendChild(this.createCardElement(this.player.superhero, 'superhero'));
            if (this.kickStack.length > 0) this.ui.kickStack.appendChild(this.createCardElement(this.kickStack[0], 'kick'));
            if (this.weaknessStack.length > 0) this.ui.weaknessStack.appendChild(this.createCardElement(this.weaknessStack[0], 'weakness'));
            if (this.superVillainStack.length > 0) this.ui.superVillainStack.appendChild(this.createCardElement(this.superVillainStack[this.superVillainStack.length - 1], 'super-villain'));
            
            this.ui.powerTotal.textContent = this.player.power;
        }
    }

    // --- Funkcje Pomocnicze Poza Klasą ---
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }
    function showModal(modal) { modal.classList.add('active'); }
    function hideModal(modal) { modal.classList.remove('active'); }
    
    function populateCardSelect(filterFn = () => true) {
        const list = cardIdModal.querySelector('#card-select-list');
        list.innerHTML = '';
        const lang = game ? game.currentLanguage : 'pl';
        allCards.filter(filterFn)
            .sort((a, b) => (a[`name_${lang}`] || a.name_en).localeCompare(b[`name_${lang}`] || b.name_en))
            .forEach(card => {
                const opt = document.createElement('option');
                opt.value = card.id;
                opt.textContent = `${(card[`name_${lang}`] || card.name_en)} [${card.type}]`;
                list.appendChild(opt);
            });
    }
    
    // --- Główna Logika Startowa Aplikacji ---
    async function main() {
        if (!newGameBtn) {
            console.error("Błąd krytyczny: Nie znaleziono przycisku 'new-game-btn'. Sprawdź ID w pliku HTML.");
            return;
        }
        newGameBtn.disabled = true;
        try {
            const [cardsRes, compoRes] = await Promise.all([fetch('cards.json'), fetch('deck_composition.json')]);
            allCards = await cardsRes.json();
            deckComposition = await compoRes.json();
            newGameBtn.disabled = false;
        } catch (error) {
            console.error("Błąd ładowania danych gry:", error);
        }
    }

    // --- Dowiązanie Event Listenerów ---
    document.addEventListener('click', () => cardInspector.classList.remove('visible'));
    newGameBtn.addEventListener('click', () => { showScreen(gameScreen); game = new Game(); game.setupNewGame(); });
    settingsBtn.addEventListener('click', () => showModal(document.getElementById('settings-modal')));
    endTurnBtn.addEventListener('click', () => { if (game) game.endTurn(); });
    languageSelect.addEventListener('change', (e) => { if (game) game.setLanguage(e.target.value); });
    
    debugPanel.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || !game) return;
        const action = e.target.dataset.debug;
        switch (action) {
            case 'draw-card': game.drawCard(); break;
            case 'add-power': game.player.power++; game.renderAll(); break;
            case 'add-card-hand':
                populateCardSelect(c => c.type !== 'Super-Hero');
                cardIdModalCallback = (id) => game.addCardById(id, 'hand');
                showModal(cardIdModal);
                break;
            case 'destroy-card':
                if (game.player.hand.length > 0) {
                    const unique = [...new Map(game.player.hand.map(item => [item.id, item])).values()];
                    populateCardSelect(c => unique.some(h => h.id === c.id));
                    cardIdModalCallback = (id) => game.destroyCardFromHand(id);
                    showModal(cardIdModal);
                }
                break;
        }
    });

    cardIdSubmitBtn.addEventListener('click', () => {
        const selectedId = cardIdModal.querySelector('#card-select-list').value;
        if (selectedId && cardIdModalCallback) {
            cardIdModalCallback(selectedId);
        }
        hideModal(cardIdModal);
        cardIdModalCallback = null;
    });

    document.querySelectorAll('.modal-overlay:not(#choice-modal):not(#card-selection-modal)').forEach(modal => {
        modal.querySelector('.close-btn')?.addEventListener('click', () => hideModal(modal));
    });
    
    main();
});