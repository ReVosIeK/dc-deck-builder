// effects.js

export const effectHandlers = {
    draw: (game, params) => {
        const amount = parseInt(params[0], 10) || 1;
        console.log(`Efekt: Dobieranie ${amount} kart.`);
        for (let i = 0; i < amount; i++) {
            game.drawCard(false); 
        }
    },

    gain_power: (game, params) => {
        const amount = parseInt(params[0], 10) || 0;
        console.log(`Efekt: Dodawanie ${amount} Mocy.`);
        game.player.power += amount;
    },

    conditional_power: (game, params) => {
        const conditionString = params.join(':');
        const match = conditionString.match(/if_discard_pile_empty_then_(\d+)_else_(\d+)/);
        if (match) {
            const thenPower = parseInt(match[1], 10);
            const elsePower = parseInt(match[2], 10);
            if (game.player.discard.length === 0) {
                console.log(`Warunek spełniony (pusty discard pile). Dodaję ${thenPower} Mocy.`);
                game.player.power += thenPower;
            } else {
                console.log(`Warunek niespełniony (discard pile nie jest pusty). Dodaję ${elsePower} Mocy.`);
                game.player.power += elsePower;
            }
        } else {
            console.warn(`Nieznany warunek dla conditional_power: ${conditionString}`);
        }
    },

    on_play_effect: async (game, params) => {
        const effectString = params.join(':');
        
        if (effectString === 'reveal_deck_top_1_then_may_destroy_revealed') {
            if (game.player.deck.length === 0) game.shuffleDiscardIntoDeck();
            if (game.player.deck.length === 0) { console.log("Brak kart w talii do podejrzenia."); return; }

            const topCard = game.player.deck[game.player.deck.length - 1];
            const choice = await game.ui.choiceModal.waitForChoice("Możesz zniszczyć tę kartę:", topCard);

            if (choice === 'yes') {
                const destroyedCard = game.player.deck.pop();
                game.destroyedPile.push(destroyedCard);
                console.log(`Zniszczono wierzchnią kartę talii: ${destroyedCard.name_pl}`);
            } else {
                console.log("Zdecydowano nie niszczyć karty.");
            }
        }
        else if (effectString.startsWith('move_card_from_')) {
            const match = effectString.match(/move_card_from_(.*)_to_(.*)_choice_type_(.*)/);
            if (!match) { console.warn(`Nie udało się sparsować efektu: ${effectString}`); return; }

            const [, sourceZone, destZone, cardType] = match;
            
            let sourcePile;
            if (sourceZone === 'discard') sourcePile = game.player.discard;

            if (!sourcePile || sourcePile.length === 0) { return; }
            const validCards = sourcePile.filter(card => card.type.toLowerCase() === cardType.toLowerCase());
            if (validCards.length === 0) { return; }

            const chosenCard = await game.ui.cardSelectionModal.waitForSelection(`Wybierz kartę typu '${cardType}', aby przenieść ją do '${destZone}':`, validCards);

            if (chosenCard) {
                const cardIndex = sourcePile.findIndex(card => card === chosenCard);
                if (cardIndex > -1) sourcePile.splice(cardIndex, 1);
                
                if (destZone === 'hand') game.player.hand.push(chosenCard);
            }
        }
        else if (effectString.includes('each_opponent_reveals_deck_top_1')) {
            if (game.mainDeck.length === 0) { return; }
            const topCard = game.mainDeck[game.mainDeck.length - 1];

            if (topCard.type === 'Location') { return; }

            const choice = await game.ui.choiceModal.waitForChoice(`Możesz zagrać tę kartę z talii głównej:`, topCard);

            if (choice === 'yes') {
                game.player.power += topCard.power || 0;
                await game.executeCardEffects(topCard);
            }
        }
        else {
            console.warn(`Nieznany efekt on_play_effect: ${effectString}`);
        }
    },
    
    attack: (game, params) => {
        const attackString = params.join(':');
        if (attackString === 'each_opponent_gains_weakness') {
            console.log("Efekt Ataku: Przeciwnik otrzymuje Słabość.");
            game.gainWeakness();
        } else {
            console.warn(`Nieznany typ ataku: ${attackString}`);
        }
    },

    /**
     * NOWY EFEKT
     * Obsługuje ataki z Pierwszego Pojawienia Super-Złoczyńców.
     * @param {Game} game - Instancja całej gry.
     * @param {string[]} params - Parametry ataku.
     */
    first_appearance_attack: (game, params) => {
        const attackString = params.join(':');
        console.log(`Nadchodzi nowy Super-Złoczyńca! Atak Pierwszego Pojawienia: ${attackString}`);

        // Przykładowy, prosty atak, np. z Lexa Luthora
        if (attackString.includes('each_player_gains_weakness_count_equal_to_villains_in_lineup')) {
            const villainCount = game.lineUp.filter(card => card && card.type === 'Villain').length;
            console.log(`Liczba Złoczyńców w Line-Up: ${villainCount}. Otrzymujesz tyle Słabości.`);
            for (let i = 0; i < villainCount; i++) {
                game.gainWeakness();
            }
        }
        // W przyszłości dodamy 'else if' dla innych ataków
        else {
            console.warn(`Niezaimplementowany Atak Pierwszego Pojawienia: ${attackString}`);
        }
    }
};