// script.js

import { effectHandlers } from './effects.js';
import { translations } from './translations.js';

document.addEventListener('DOMContentLoaded', () => {
    let allCards = [];
    let deckComposition = [];
    let currentLanguage = 'pl';

    const cardInspector = document.getElementById('card-inspector');
    document.addEventListener('click', () => {
        if (cardInspector.classList.contains('visible')) {
            cardInspector.classList.remove('visible');
        }
    });

    function setLanguage(lang) {
        currentLanguage = lang;
        document.querySelectorAll('[data-translate-key]').forEach(element => {
            const key = element.dataset.translateKey;
            if (translations[lang][key]) {
                element.textContent = translations[lang][key];
            }
        });
        document.querySelectorAll('.card-placeholder').forEach(el => {
            el.textContent = translations[lang].emptySlot;
        });
    }

    class Game {
        constructor() {
            this.player = {
                superhero: null, deck: [], hand: [], discard: [], locations: [], played: [], power: 0,
                firstPlaysThisTurn: new Set()
            };
            this.mainDeck = []; this.lineUp = []; this.kickStack = [];
            this.weaknessStack = []; this.superVillainStack = []; this.destroyedPile = [];

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
                choiceModal: { element: document.getElementById('choice-modal'), title: document.getElementById('choice-modal-title'), cardDisplay: document.getElementById('choice-card-display'), text: document.getElementById('choice-modal-text'), yesBtn: document.getElementById('choice-yes-btn'), noBtn: document.getElementById('choice-no-btn'), waitForChoice: (prompt, card) => { return new Promise(resolve => { this.ui.choiceModal.text.textContent = prompt; this.ui.choiceModal.cardDisplay.innerHTML = ''; this.ui.choiceModal.cardDisplay.appendChild(this.createCardElement(card, 'choice')); this.ui.choiceModal.element.classList.add('active'); const resolvePromise = (choice) => { this.ui.choiceModal.element.classList.remove('active'); resolve(choice); }; this.ui.choiceModal.yesBtn.addEventListener('click', () => resolvePromise('yes'), { once: true }); this.ui.choiceModal.noBtn.addEventListener('click', () => resolvePromise('no'), { once: true }); }); } },
                cardSelectionModal: { element: document.getElementById('card-selection-modal'), title: document.getElementById('selection-modal-title'), cardList: document.getElementById('selection-card-list'), waitForSelection: (prompt, cardsToChooseFrom) => { return new Promise(resolve => { this.ui.cardSelectionModal.title.textContent = prompt; this.ui.cardSelectionModal.cardList.innerHTML = ''; const resolvePromise = (card) => { this.ui.cardSelectionModal.element.classList.remove('active'); this.ui.cardSelectionModal.element.removeEventListener('click', closeModalHandler); resolve(card); }; cardsToChooseFrom.forEach(card => { const cardElement = this.createCardElement(card, 'selection'); cardElement.addEventListener('click', (event) => { event.stopPropagation(); resolvePromise(card) }); this.ui.cardSelectionModal.cardList.appendChild(cardElement); }); const closeModalHandler = (e) => { if (e.target === this.ui.cardSelectionModal.element) { resolvePromise(null); } }; this.ui.cardSelectionModal.element.addEventListener('click', closeModalHandler); this.ui.cardSelectionModal.element.classList.add('active'); }); } }
            };
        }
        
        shuffle(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; } }
        
        resetState() {
            this.player = { superhero: null, deck: [], hand: [], discard: [], locations: [], played: [], power: 0, firstPlaysThisTurn: new Set() };
            this.mainDeck = []; this.lineUp = []; this.kickStack = [];
            this.weaknessStack = []; this.superVillainStack = []; this.destroyedPile = [];
            Object.values(this.ui).forEach(zone => { if (zone.id !== 'power-total' && zone.element === undefined) zone.innerHTML = ''; });
        }

        setupNewGame() {
            this.resetState();
            const superheroes = allCards.filter(c => c.type === 'Super-Hero');
            this.player.superhero = superheroes[Math.floor(Math.random() * superheroes.length)];
            for (let i = 0; i < 7; i++) this.player.deck.push(allCards.find(c => c.id === 'punch'));
            for (let i = 0; i < 3; i++) this.player.deck.push(allCards.find(c => c.id === 'vulnerability'));
            this.shuffle(this.player.deck);
            deckComposition.forEach(item => {
                const cardInfo = allCards.find(c => c.id === item.id);
                if (cardInfo && !['Starter', 'Kick', 'Weakness', 'Super-Villain', 'Super-Hero'].includes(cardInfo.type)) {
                    for (let i = 0; i < item.count; i++) this.mainDeck.push(cardInfo);
                }
            });
            this.shuffle(this.mainDeck);
            const kickCard = allCards.find(c => c.id === 'kick');
            const weaknessCard = allCards.find(c => c.id === 'weakness');
            for (let i = 0; i < 16; i++) this.kickStack.push(kickCard);
            for (let i = 0; i < 20; i++) this.weaknessStack.push(weaknessCard);
            const svCards = allCards.filter(c => c.type === 'Super-Villain' && c.id !== 'ras_al_ghul');
            this.shuffle(svCards); 
            this.superVillainStack = svCards.slice(0, 7);
            this.superVillainStack.push(allCards.find(c => c.id === 'ras_al_ghul'));
            this.refillLineUp();
            for(let i = 0; i < 5; i++) { this.drawCard(false); }
            this.renderAll();
        }

        async defeatSuperVillain() {
            if (this.superVillainStack.length === 0) return;
            const superVillain = this.superVillainStack[this.superVillainStack.length - 1];

            if (this.player.power >= superVillain.cost) {
                console.log(`Pokonujesz ${superVillain.name_pl}!`);
                this.player.power -= superVillain.cost;

                const defeatedSV = this.superVillainStack.pop();
                this.player.discard.push(defeatedSV);

                if (this.superVillainStack.length > 0) {
                    const nextSuperVillain = this.superVillainStack[this.superVillainStack.length - 1];
                    console.log(`Pojawia się nowy Super-Złoczyńca: ${nextSuperVillain.name_pl}!`);
                    
                    if (nextSuperVillain.effect_tags) {
                        for (const tag of nextSuperVillain.effect_tags) {
                            if (tag.startsWith('first_appearance_attack')) {
                                const [effectName, ...params] = tag.split(':');
                                if (effectHandlers[effectName]) {
                                    await effectHandlers[effectName](this, params);
                                }
                            }
                        }
                    }
                } else {
                    console.log("Pokonano ostatniego Super-Złoczyńcę!");
                }
                this.renderAll();
            } else {
                console.log(`Za mało mocy, by pokonać ${superVillain.name_pl}. Wymagane: ${superVillain.cost}, Masz: ${this.player.power}`);
            }
        }

        endTurn() {
            this.player.discard.push(...this.player.hand);
            this.player.discard.push(...this.player.played);
            this.player.hand = []; this.player.played = []; this.player.power = 0;
            this.player.firstPlaysThisTurn.clear();
            
            this.lineUp = this.lineUp.filter(card => card !== null);
            this.refillLineUp();
            
            if (this.superVillainStack.length === 0) {
                this.endGame("Pokonano ostatniego Super-Złoczyńcę!");
                return;
            }
            if (this.lineUp.length < 5 && this.mainDeck.length === 0) {
                this.endGame("Nie można uzupełnić Line-Upu!");
                return;
            }

            for(let i = 0; i < 5; i++) { this.drawCard(false); }
            this.renderAll();
        }

        calculateVictoryPoints() {
            const allPlayerCards = [
                ...this.player.deck, ...this.player.hand,
                ...this.player.discard, ...this.player.played,
                ...this.player.locations
            ];
            return allPlayerCards.reduce((total, card) => total + (card.vp || 0), 0);
        }

        endGame(reason) {
            console.log("--- KONIEC GRY ---");
            const finalScore = this.calculateVictoryPoints();
            console.log(`Ostateczny wynik: ${finalScore} punktów zwycięstwa.`);
            alert(`Koniec gry!\n${reason}\n\nTwój wynik: ${finalScore} PZ`);
        }

        refillLineUp() {
            while (this.lineUp.length < 5 && this.mainDeck.length > 0) {
                this.lineUp.push(this.mainDeck.pop());
            }
        }

        shuffleDiscardIntoDeck() {
            if (this.player.discard.length > 0) {
                this.player.deck = [...this.player.deck, ...this.player.discard];
                this.player.discard = [];
                this.shuffle(this.player.deck);
            }
        }
        
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

        checkOngoingEffects(playedCard) {
            const playedType = playedCard.type.toLowerCase();
            if (this.player.firstPlaysThisTurn.has(playedType)) { return; }
            this.player.locations.forEach(location => {
                location.effect_tags.forEach(tag => {
                    const match = tag.match(/on_play_first_(.*)_per_turn_draw_1/);
                    if (match) {
                        const triggerType = match[1].toLowerCase();
                        if (triggerType === playedType) {
                            this.drawCard(false);
                        }
                    }
                });
            });
            this.player.firstPlaysThisTurn.add(playedType);
        }

        async playCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const [cardToPlay] = this.player.hand.splice(cardIndex, 1);
            if (cardToPlay.type === 'Location') {
                this.player.locations.push(cardToPlay);
            } else {
                this.player.played.push(cardToPlay);
                this.checkOngoingEffects(cardToPlay);
            }
            this.player.power += cardToPlay.power || 0;
            await this.executeCardEffects(cardToPlay);
            this.renderAll();
        }

        buyCardFromLineUp(cardId) {
            const cardIndex = this.lineUp.findIndex(c => c && c.id === cardId);
            if (cardIndex === -1) return;
            const cardToBuy = this.lineUp[cardIndex];
            if (this.player.power >= cardToBuy.cost) {
                this.player.power -= cardToBuy.cost;
                this.player.discard.push(cardToBuy);
                this.lineUp[cardIndex] = null;
                this.renderAll();
            }
        }
        
        drawCard(render = true) {
            if (this.player.deck.length === 0) { this.shuffleDiscardIntoDeck(); }
            if (this.player.deck.length > 0) {
                const drawnCard = this.player.deck.pop();
                if (drawnCard) this.player.hand.push(drawnCard);
            }
            if (render) this.renderAll();
        }

        gainWeakness() {
            if (this.weaknessStack.length > 0) {
                const weaknessCard = this.weaknessStack.pop();
                this.player.discard.push(weaknessCard);
            }
        }

        addCardById(cardId, destination) {
            const card = allCards.find(c => c.id === cardId);
            if (!card) { return; }
            if (destination === 'hand') { this.player.hand.push(card); }
            else if (destination === 'lineup') { this.lineUp.push(card); }
        }

        destroyCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(card => card.id === cardId);
            if (cardIndex > -1) {
                const [destroyedCard] = this.player.hand.splice(cardIndex, 1);
                this.destroyedPile.push(destroyedCard);
            }
        }
        
        createCardElement(cardData, location) {
            if (!cardData) {
                const placeholder = document.createElement('div');
                placeholder.className = 'card-placeholder';
                placeholder.textContent = translations[currentLanguage].emptySlot;
                return placeholder;
            }
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.dataset.id = cardData.id;
            const cardName = cardData[`name_${currentLanguage}`] || cardData.name_en;
            if (location !== 'selection' && location !== 'choice') {
                if ((location === 'lineup' || location === 'super-villain') && this.player.power < cardData.cost) {
                    cardDiv.classList.add('unaffordable');
                } else {
                    cardDiv.addEventListener('click', (event) => {
                        event.stopPropagation();
                        this.handleCardClick(cardData, location);
                    });
                }
            }
            if (!['deck', 'main-deck', 'choice', 'selection'].includes(location)) {
                cardDiv.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
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
        
        handleCardClick(cardData, location) {
            if (location === 'hand') { this.playCardFromHand(cardData.id); }
            else if (location === 'lineup') { this.buyCardFromLineUp(cardData.id); }
            else if (location === 'super-villain') { this.defeatSuperVillain(); }
        }

        renderAll() {
            Object.values(this.ui).forEach(zone => { if (zone && zone.id !== 'power-total' && zone.element === undefined) zone.innerHTML = ''; });
            this.player.hand.forEach(card => this.ui.playerHand.appendChild(this.createCardElement(card, 'hand')));
            this.player.played.forEach(card => this.ui.playedCards.appendChild(this.createCardElement(card, 'played')));
            this.player.locations.forEach(card => this.ui.playerLocations.appendChild(this.createCardElement(card, 'location')));
            this.lineUp.forEach(card => this.ui.lineUp.appendChild(this.createCardElement(card, 'lineup')));
            if (this.player.deck.length > 0) this.ui.playerDeck.appendChild(this.createCardElement(this.player.deck[0], 'deck'));
            if (this.player.discard.length > 0) this.ui.playerDiscard.appendChild(this.createCardElement(this.player.discard[this.player.discard.length - 1], 'discard'));
            if (this.destroyedPile.length > 0) this.ui.destroyedPile.appendChild(this.createCardElement(this.destroyedPile[this.destroyedPile.length - 1], 'destroyed'));
            if (this.player.superhero) this.ui.playerSuperhero.appendChild(this.createCardElement(this.player.superhero, 'superhero'));
            if (this.mainDeck.length > 0) this.ui.mainDeck.appendChild(this.createCardElement(this.mainDeck[0], 'main-deck'));
            if (this.kickStack.length > 0) this.ui.kickStack.appendChild(this.createCardElement(this.kickStack[0], 'kick'));
            if (this.weaknessStack.length > 0) this.ui.weaknessStack.appendChild(this.createCardElement(this.weaknessStack[0], 'weakness'));
            if (this.superVillainStack.length > 0) this.ui.superVillainStack.appendChild(this.createCardElement(this.superVillainStack[this.superVillainStack.length - 1], 'super-villain'));
            this.ui.powerTotal.textContent = this.player.power;
        }
    }

    let game;
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const newGameBtn = document.getElementById('new-game-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const endTurnBtn = document.getElementById('end-turn-btn');
    const cardIdModal = document.getElementById('card-id-modal');
    const cardIdSubmitBtn = document.getElementById('card-id-submit');
    const debugPanel = document.getElementById('debug-panel');
    const languageSelect = document.getElementById('language-select');
    let cardIdModalCallback = null;

    function showScreen(screenToShow) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); screenToShow.classList.add('active'); }
    function showModal(modal) { modal.classList.add('active'); }
    function hideModal(modal) { modal.classList.remove('active'); }
    
    function populateCardSelect(filterFn = () => true) {
        const cardSelectList = cardIdModal.querySelector('#card-select-list');
        cardSelectList.innerHTML = '';
        const cardSource = allCards.filter(filterFn).sort((a, b) => (a[`name_${currentLanguage}`] || a.name_en).localeCompare(b[`name_${currentLanguage}`] || b.name_en));
        cardSource.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = `${card[`name_${currentLanguage}`] || card.name_en} [${card.type}]`;
            cardSelectList.appendChild(option);
        });
    }

    debugPanel.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || !game) return;
        const action = e.target.dataset.debug;
        switch (action) {
            case 'draw-card': game.drawCard(); return;
            case 'add-power': game.player.power++; game.renderAll(); return;
            case 'remove-power': if (game.player.power > 0) game.player.power--; game.renderAll(); return;
            case 'add-card-hand':
                populateCardSelect(card => card.type !== 'Super-Hero');
                cardIdModalCallback = (cardId) => game.addCardById(cardId, 'hand');
                showModal(cardIdModal); return; 
            case 'add-card-lineup':
                populateCardSelect(card => card.type !== 'Super-Hero');
                cardIdModalCallback = (cardId) => game.addCardById(cardId, 'lineup');
                showModal(cardIdModal); return;
            case 'destroy-card':
                if (game.player.hand.length === 0) { return; }
                const uniqueHandCards = [...new Map(game.player.hand.map(item => [item['id'], item])).values()];
                populateCardSelect(card => uniqueHandCards.some(handCard => handCard.id === card.id));
                cardIdModalCallback = (cardId) => game.destroyCardFromHand(cardId);
                showModal(cardIdModal); return;
            default: return;
        }
    });
    
    cardIdSubmitBtn.addEventListener('click', () => {
        if (!cardIdModal.classList.contains('active')) return;
        const selectedId = cardIdModal.querySelector('#card-select-list').value;
        if (selectedId && cardIdModalCallback) {
            cardIdModalCallback(selectedId);
            game.renderAll();
        }
        hideModal(cardIdModal);
        cardIdModalCallback = null;
    });

    languageSelect.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });

    async function main() {
        document.querySelectorAll('.modal-overlay:not(#choice-modal):not(#card-selection-modal)').forEach(modal => {
            modal.querySelector('.close-btn')?.addEventListener('click', () => hideModal(modal));
        });
        newGameBtn.disabled = true;
        try {
            const [cardsRes, compoRes] = await Promise.all([fetch('cards.json'), fetch('deck_composition.json')]);
            allCards = await cardsRes.json(); deckComposition = await compoRes.json();
            newGameBtn.disabled = false;
        } catch (error) { console.error("Błąd ładowania danych gry:", error); }
    }
    
    newGameBtn.addEventListener('click', () => { showScreen(gameScreen); game = new Game(); game.setupNewGame(); });
    settingsBtn.addEventListener('click', () => { showModal(document.getElementById('settings-modal'));});
    endTurnBtn.addEventListener('click', () => { if (game) { game.endTurn(); } });
    
    setLanguage('en');
    main();
});