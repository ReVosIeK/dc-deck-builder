// effects.js

export const effectHandlers = {
    draw: (game, params) => {
        const amount = parseInt(params[0], 10) || 1;
        for (let i = 0; i < amount; i++) {
            game.drawCard(false); 
        }
    },

    gain_power: (game, params) => {
        const amount = parseInt(params[0], 10) || 0;
        game.player.power += amount;
    },

    conditional_power: (game, params) => {
        const conditionString = params.join(':');
        const match = conditionString.match(/if_discard_pile_empty_then_(\d+)_else_(\d+)/);
        if (match) {
            const thenPower = parseInt(match[1], 10);
            const elsePower = parseInt(match[2], 10);
            if (game.player.discard.length === 0) {
                game.player.power += thenPower;
            } else {
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
            if (game.player.deck.length === 0) { return; }
            const topCard = game.player.deck[game.player.deck.length - 1];
            const choice = await game.ui.choiceModal.waitForChoice("Możesz zniszczyć tę kartę:", topCard);
            if (choice === 'yes') {
                const destroyedCard = game.player.deck.pop();
                game.destroyedPile.push(destroyedCard);
            }
        }
        else if (effectString.startsWith('move_card_from_')) {
            const match = effectString.match(/move_card_from_(.*)_to_(.*)_choice_type_(.*)/);
            if (!match) { console.warn(`Nie udało się sparsować efektu: ${effectString}`); return; }
            const [, sourceZone, destZone, cardType] = match;
            let sourcePile;
            if (sourceZone === 'discard') sourcePile = game.player.discard;
            else { return; }
            if (!sourcePile || sourcePile.length === 0) { return; }
            const validCards = sourcePile.filter(card => card.type.toLowerCase().includes(cardType.toLowerCase()));
            if (validCards.length === 0) { return; }
            const chosenCard = await game.ui.cardSelectionModal.waitForSelection(`Wybierz ${cardType}, aby przenieść do ${destZone}:`, [...new Map(validCards.map(item => [item.id, item])).values()]);
            if (chosenCard) {
                const cardIndex = sourcePile.findIndex(card => card.id === chosenCard.id);
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
        // NOWA LOGIKA DLA "DARK KNIGHT"
        else if (effectString.startsWith('gain_all_type_')) {
            const match = effectString.match(/gain_all_type_(.*)_from_(.*)/);
            if (!match) { console.warn(`Nie udało się sparsować efektu: ${effectString}`); return; }

            const [, cardType, sourceZone] = match;
            let sourcePile;
            if (sourceZone === 'lineup') sourcePile = game.lineUp;
            else { return; }

            console.log(`Efekt: Zdobywanie wszystkich kart typu '${cardType}' z '${sourceZone}'.`);
            const cardsToGain = [];
            
            // Iterujemy po indeksach, bo będziemy modyfikować tablicę w locie
            for (let i = 0; i < sourcePile.length; i++) {
                const card = sourcePile[i];
                if (card && card.type.toLowerCase() === cardType.toLowerCase()) {
                    cardsToGain.push(card);
                    sourcePile[i] = null; // Zastępujemy kartę placeholderem
                }
            }

            if (cardsToGain.length > 0) {
                game.player.discard.push(...cardsToGain);
                console.log(`Zdobyto ${cardsToGain.length} kart(y) Ekwipunku.`);
            }
        }
        else {
            console.warn(`Nieznany efekt on_play_effect: ${effectString}`);
        }
    },
    
    attack: (game, params) => {
        const attackString = params.join(':');
        if (attackString === 'each_opponent_gains_weakness') {
            game.gainWeakness();
        } else {
            console.warn(`Nieznany typ ataku: ${attackString}`);
        }
    },

    first_appearance_attack: (game, params) => {
        const attackString = params.join(':');
        console.log(`Atak Pierwszego Pojawienia: ${attackString}`);
        if (attackString.includes('each_player_gains_weakness_count_equal_to_villains_in_lineup')) {
            const villainCount = game.lineUp.filter(card => card && card.type === 'Villain').length;
            for (let i = 0; i < villainCount; i++) {
                game.gainWeakness();
            }
        }
        else {
            console.warn(`Niezaimplementowany Atak Pierwszego Pojawienia: ${attackString}`);
        }
    }
};