// script.js

import { effectHandlers } from './effects.js';

document.addEventListener('DOMContentLoaded', () => {
    let allCards = [];
    let deckComposition = [];
    
    const cardInspector = document.getElementById('card-inspector');
    document.addEventListener('click', () => {
        if (cardInspector.classList.contains('visible')) {
            cardInspector.classList.remove('visible');
        }
    });

    class Game {
        constructor() {
            this.player = {
                superhero: null, deck: [], hand: [], discard: [], locations: [], played: [], power: 0,
                firstPlaysThisTurn: new Set() // Śledzi pierwszy zagrany typ karty w turze
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
                choiceModal: {
                    element: document.getElementById('choice-modal'),
                    title: document.getElementById('choice-modal-title'),
                    cardDisplay: document.getElementById('choice-card-display'),
                    text: document.getElementById('choice-modal-text'),
                    yesBtn: document.getElementById('choice-yes-btn'),
                    noBtn: document.getElementById('choice-no-btn'),
                    waitForChoice: (prompt, card) => {
                        return new Promise(resolve => {
                            this.ui.choiceModal.title.textContent = "Podejmij decyzję";
                            this.ui.choiceModal.text.textContent = prompt;
                            this.ui.choiceModal.cardDisplay.innerHTML = '';
                            this.ui.choiceModal.cardDisplay.appendChild(this.createCardElement(card, 'choice'));
                            this.ui.choiceModal.element.classList.add('active');
                            this.ui.choiceModal.yesBtn.onclick = () => { this.ui.choiceModal.element.classList.remove('active'); resolve('yes'); };
                            this.ui.choiceModal.noBtn.onclick = () => { this.ui.choiceModal.element.classList.remove('active'); resolve('no'); };
                        });
                    }
                },
                cardSelectionModal: {
                    element: document.getElementById('card-selection-modal'),
                    title: document.getElementById('selection-modal-title'),
                    cardList: document.getElementById('selection-card-list'),
                    waitForSelection: (prompt, cardsToChooseFrom) => {
                        return new Promise(resolve => {
                            this.ui.cardSelectionModal.title.textContent = prompt;
                            this.ui.cardSelectionModal.cardList.innerHTML = '';
                            const resolvePromise = (card) => {
                                this.ui.cardSelectionModal.element.classList.remove('active');
                                this.ui.cardSelectionModal.element.removeEventListener('click', closeModalHandler); // Clean up listener
                                resolve(card);
                            };
                            cardsToChooseFrom.forEach(card => {
                                const cardElement = this.createCardElement(card, 'selection');
                                cardElement.addEventListener('click', (event) => {
                                    event.stopPropagation(); // Prevent the background click from firing
                                    resolvePromise(card)
                                });
                                this.ui.cardSelectionModal.cardList.appendChild(cardElement);
                            });
                            const closeModalHandler = (e) => {
                                if (e.target === this.ui.cardSelectionModal.element) {
                                    resolvePromise(null);
                                }
                            };
                            this.ui.cardSelectionModal.element.addEventListener('click', closeModalHandler);
                            this.ui.cardSelectionModal.element.classList.add('active');
                        });
                    }
                }
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
            this.refillLineUp();
            for(let i = 0; i < 5; i++) { this.drawCard(false); }
            this.renderAll(); console.log("Setup zakończony, plansza wyrenderowana.");
        }

        endTurn() {
            console.log("--- Koniec Tury ---");
            this.player.discard.push(...this.player.hand);
            this.player.discard.push(...this.player.played);
            this.player.hand = []; this.player.played = []; this.player.power = 0;
            this.player.firstPlaysThisTurn.clear(); // Czyścimy śledzenie na koniec tury
            console.log("Karty z ręki i zagrane przeniesione do odrzutów. Moc zresetowana.");
            this.lineUp = this.lineUp.filter(card => card !== null);
            this.refillLineUp();
            console.log("Line-Up uzupełniony.");
            for(let i = 0; i < 5; i++) { this.drawCard(false); }
            console.log("Dobrano nową rękę.");
            this.renderAll();
        }

        refillLineUp() {
            while (this.lineUp.length < 5 && this.mainDeck.length > 0) {
                this.lineUp.push(this.mainDeck.pop());
            }
        }

        shuffleDiscardIntoDeck() {
            if (this.player.discard.length > 0) {
                console.log("Tasowanie odrzutów.");
                this.player.deck = [...this.player.deck, ...this.player.discard];
                this.player.discard = [];
                this.shuffle(this.player.deck);
            }
        }
        
        async executeCardEffects(card) {
            if (!card.effect_tags || card.effect_tags.length === 0) return;
            // Używamy pętli for...of aby poprawnie obsłużyć 'await'
            for (const tag of card.effect_tags) {
                const [effectName, ...params] = tag.split(':');
                if (effectHandlers[effectName]) {
                    console.log(`Uruchamianie efektu: ${effectName} z parametrami: ${params}`);
                    await effectHandlers[effectName](this, params); // Czekamy na zakończenie efektu
                } else {
                    console.warn(`Nieznany tag efektu: ${effectName}`);
                }
            }
        }

        checkOngoingEffects(playedCard) {
            const playedType = playedCard.type.toLowerCase();
            // Sprawdź, czy karta tego typu była już zagrana w tej turze
            if (this.player.firstPlaysThisTurn.has(playedType)) {
                return; // Jeśli tak, nie rób nic
            }

            // Jeśli nie, sprawdź czy jakaś lokacja ma na to trigger
            this.player.locations.forEach(location => {
                location.effect_tags.forEach(tag => {
                    const match = tag.match(/on_play_first_(.*)_per_turn_draw_1/);
                    if (match) {
                        const triggerType = match[1].toLowerCase();
                        if (triggerType === playedType) {
                            console.log(`Efekt Lokacji (${location.name_pl}): Dobranie karty za zagranie pierwszego ${playedType}.`);
                            this.drawCard(false); // Dobierz kartę bez renderowania
                        }
                    }
                });
            });

            // Oznacz ten typ karty jako zagrany w tej turze
            this.player.firstPlaysThisTurn.add(playedType);
        }

        async playCardFromHand(cardId) {
            const cardIndex = this.player.hand.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return;
            const [cardToPlay] = this.player.hand.splice(cardIndex, 1);
            
            // Inaczej traktujemy lokacje
            if (cardToPlay.type === 'Location') {
                this.player.locations.push(cardToPlay);
                console.log(`Wyłożono lokację: ${cardToPlay.name_pl}`);
            } else {
                this.player.played.push(cardToPlay);
                // Sprawdzamy efekty lokacji tylko dla kart nie-lokacji
                this.checkOngoingEffects(cardToPlay);
            }

            this.player.power += cardToPlay.power || 0;
            console.log(`Zagrnao: ${cardToPlay.name_pl}, +${cardToPlay.power || 0} Mocy.`);
            
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
                console.log(`Kupiono: ${cardToBuy.name_pl} za ${cardToBuy.cost}. Pozostało mocy: ${this.player.power}`);
                this.renderAll();
            } else {
                console.log(`Za mało mocy by kupić ${cardToBuy.name_pl}. Wymagane: ${cardToBuy.cost}, Masz: ${this.player.power}`);
            }
        }
        
        drawCard(render = true) {
            if (this.player.deck.length === 0) { this.shuffleDiscardIntoDeck(); }
            if (this.player.deck.length > 0) {
                const drawnCard = this.player.deck.pop();
                if (drawnCard) this.player.hand.push(drawnCard);
            } else { console.log("Brak kart do dobrania."); }
            if (render) this.renderAll();
        }

        gainWeakness() {
            if (this.weaknessStack.length > 0) {
                const weaknessCard = this.weaknessStack.pop();
                this.player.discard.push(weaknessCard);
                console.log("Gracz otrzymał Słabość.");
            } else {
                console.log("Stos Słabości jest pusty.");
            }
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
            } else { console.error(`Nie znaleziono karty ${cardId} w ręce.`); }
        }
        
        createCardElement(cardData, location) {
            if (!cardData) {
                const placeholder = document.createElement('div');
                placeholder.className = 'card-placeholder';
                placeholder.textContent = 'Pusty slot';
                return placeholder;
            }
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            cardDiv.dataset.id = cardData.id;
            if (location !== 'selection' && location !== 'choice') {
                if (location === 'lineup' && this.player.power < cardData.cost) {
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
            if (['deck', 'main-deck'].includes(location)) { cardDiv.classList.add('is-face-down');
            } else { cardDiv.style.backgroundImage = `url('${cardData.image_path}')`; cardDiv.textContent = cardData.name_pl; }
            return cardDiv;
        }
        
        handleCardClick(cardData, location) {
            if (location === 'hand') { this.playCardFromHand(cardData.id); }
            else if (location === 'lineup') { this.buyCardFromLineUp(cardData.id); }
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
            if (this.superVillainStack.length > 0) this.ui.superVillainStack.appendChild(this.createCardElement(this.superVillainStack[0], 'super-villain'));
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
    let cardIdModalCallback = null;

    function showScreen(screenToShow) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); screenToShow.classList.add('active'); }
    function showModal(modal) { modal.classList.add('active'); }
    function hideModal(modal) { modal.classList.remove('active'); }
    function populateCardSelect(filterFn = () => true) {
        const cardSelectList = cardIdModal.querySelector('#card-select-list');
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
                if (game.player.hand.length === 0) { console.log("Nie ma kart w ręce do zniszczenia."); return; }
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

    async function main() {
        document.querySelectorAll('.modal-overlay:not(#choice-modal):not(#card-selection-modal)').forEach(modal => {
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
    settingsBtn.addEventListener('click', () => { showModal(document.getElementById('settings-modal'));});
    endTurnBtn.addEventListener('click', () => { if (game) { game.endTurn(); } });
    main();
});