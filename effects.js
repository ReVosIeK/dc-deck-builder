// effects.js

export const effectHandlers = {
    // Efekty zaimplementowane wcześniej (bez zmian)
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
        
        if (effectString.startsWith('gain_card_from_')) {
            const match = effectString.match(/gain_card_from_(.*)_choice_cost_le_(\d+)/);
            if (!match) { console.warn(`Nie udało się sparsować efektu gain_card: ${effectString}`); return; }
            const [, sourceZone, costLimitStr] = match;
            const costLimit = parseInt(costLimitStr, 10);
            let sourcePile;
            if (sourceZone === 'lineup') sourcePile = game.lineUp;
            else { return; }
            const validCards = sourcePile.filter(card => card && card.cost <= costLimit);
            if (validCards.length === 0) { return; }
            const chosenCard = await game.ui.cardSelectionModal.waitForSelection(`Wybierz kartę o koszcie ${costLimit} lub mniej:`, validCards);
            if (chosenCard) { await game.gainCard(chosenCard, sourcePile); }
        }
        else if (effectString === 'reveal_deck_top_1_then_may_destroy_revealed') {
            if (game.player.deck.length === 0) game.shuffleDiscardIntoDeck();
            if (game.player.deck.length === 0) { return; }
            const topCard = game.player.deck[game.player.deck.length - 1];
            const choice = await game.ui.choiceModal.waitForChoice("Możesz zniszczyć tę kartę:", topCard);
            if (choice === 'yes') { const destroyedCard = game.player.deck.pop(); game.destroyedPile.push(destroyedCard); }
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
            if (choice === 'yes') { game.player.power += topCard.power || 0; await game.executeCardEffects(topCard); }
        }
        else if (effectString.startsWith('gain_all_type_')) {
            const match = effectString.match(/gain_all_type_(.*)_from_(.*)/);
            if (!match) { console.warn(`Nie udało się sparsować efektu: ${effectString}`); return; }
            const [, cardType, sourceZone] = match;
            let sourcePile;
            if (sourceZone === 'lineup') sourcePile = game.lineUp;
            else { return; }
            const cardsToGain = [];
            for (let i = 0; i < sourcePile.length; i++) {
                const card = sourcePile[i];
                if (card && card.type.toLowerCase() === cardType.toLowerCase()) {
                    cardsToGain.push(card);
                    sourcePile[i] = null;
                }
            }
            if (cardsToGain.length > 0) {
                game.player.discard.push(...cardsToGain);
                game.player.cardsGainedThisTurn.push(...cardsToGain);
            }
        }
        else if (effectString === 'play_again_card_choice_from_played_this_turn') {
            const playableCards = game.player.played.filter(card => card.id !== 'clayface');
            if (playableCards.length === 0) { return; }
            const chosenCard = await game.ui.cardSelectionModal.waitForSelection("Wybierz kartę, której efekt chcesz skopiować:", playableCards);
            if (chosenCard) {
                game.player.power += chosenCard.power || 0;
                await game.executeCardEffects(chosenCard);
            }
        }
        else {
            console.warn(`Nieznany efekt on_play_effect: ${effectString}`);
        }
    },

    conditional_effect: async (game, params) => {
        const effectString = params.join(':');
        const matchCatwoman = effectString.match(/if_card_played_this_turn_id_(.*)_then_(.*)/);
        if (matchCatwoman) {
            const [, cardId, thenAction] = matchCatwoman;
            const conditionMet = game.player.cardsPlayedThisTurn.some(card => card.id === cardId);
            if (conditionMet) {
                if (thenAction === 'may_move_all_gained_or_bought_cards_this_turn_to_hand') {
                    if (game.player.cardsGainedThisTurn.length > 0) {
                        const choice = await game.ui.choiceModal.waitForChoice("Przenieść zdobyte karty do ręki?", null);
                        if (choice === 'yes') {
                            for (const gainedCard of game.player.cardsGainedThisTurn) {
                                const cardIndex = game.player.discard.findIndex(c => c === gainedCard);
                                if (cardIndex > -1) {
                                    const [movedCard] = game.player.discard.splice(cardIndex, 1);
                                    game.player.hand.push(movedCard);
                                }
                            }
                            game.player.cardsGainedThisTurn = [];
                        }
                    }
                }
            }
            return;
        }
        const matchFirstCard = effectString.match(/if_first_card_played_this_turn_then_(.*)_else_(.*)/);
        if (matchFirstCard) {
            const [, thenAction, elseAction] = matchFirstCard;
            if (game.player.played.length === 1) {
                if (thenAction === 'discard_hand_draw_5') {
                    game.player.discard.push(...game.player.hand);
                    game.player.hand = [];
                    for (let i = 0; i < 5; i++) {
                        game.drawCard(false);
                    }
                }
            } else {
                const elseMatch = elseAction.match(/gain_power_(\d+)/);
                if (elseMatch) {
                    const powerAmount = parseInt(elseMatch[1], 10);
                    game.player.power += powerAmount;
                }
            }
        }
    },

    first_appearance_attack: (game, params) => {
        // Ta logika również powinna zostać przeniesiona do centralnej funkcji processAttack
        console.warn("first_appearance_attack nie jest jeszcze w pełni zintegrowany z nowym systemem obrony!");
        const attackString = params.join(':');
        if (attackString.includes('each_player_gains_weakness_count_equal_to_villains_in_lineup')) {
            const villainCount = game.lineUp.filter(card => card && card.type === 'Villain').length;
            for (let i = 0; i < villainCount; i++) {
                game.gainWeakness();
            }
        }
    },
    
    modify_gain_destination: (game, params) => {
        const effectString = params.join(':');
        if (effectString === 'top_deck_may') {
            game.player.activeTurnEffects.push({ type: 'modify_gain_destination', destination: 'deck_top', optional: true });
        }
    },

    then_discard_card: async (game, params) => {
        const effectString = params.join(':');
        const match = effectString.match(/count=(\d+)_from_hand_choice/);
        if (!match) { console.warn(`Nie udało się sparsować efektu then_discard_card: ${effectString}`); return; }
        const count = parseInt(match[1], 10);
        for (let i = 0; i < count; i++) {
            if (game.player.hand.length === 0) { break; }
            const chosenCard = await game.ui.cardSelectionModal.waitForSelection(`Wybierz kartę do odrzucenia (${i + 1}/${count}):`, game.player.hand);
            if (chosenCard) {
                const cardIndex = game.player.hand.findIndex(card => card === chosenCard);
                if (cardIndex > -1) {
                    const [discardedCard] = game.player.hand.splice(cardIndex, 1);
                    game.player.discard.push(discardedCard);
                }
            } else {
                break;
            }
        }
    },

    /**
     * ZMODYFIKOWANY HANDLER ATAKU
     * Teraz jedynie przekazuje informację o ataku do głównej klasy gry,
     * która zarządza procesem (sprawdzenie obrony, wykonanie efektu).
     */
    attack: async (game, params) => {
        const attackString = params.join(':');
        await game.processAttack(attackString);
    },

    /**
     * NOWY HANDLER OBRONY
     * Wykonuje logikę karty użytej do obrony (np. odrzucenie, dobranie kart).
     * Jest wywoływany przez metodę processAttack w klasie Game.
     */
    defense_effect: async (game, defenseCard, params) => {
        const effectString = params.join(':');
        console.log(`Aktywowano obronę kartą ${defenseCard.name_pl}: ${effectString}`);

        // Logika dla 'discard_this' (np. Lasso Prawdy)
        if (effectString.includes('discard_this')) {
            const cardIndex = game.player.hand.findIndex(card => card === defenseCard);
            if (cardIndex > -1) {
                const [discardedCard] = game.player.hand.splice(cardIndex, 1);
                game.player.discard.push(discardedCard);
                console.log(`Odrzucono ${discardedCard.name_pl} w ramach obrony.`);
            }
        }

        // Logika dla 'keep_this' (np. Blue Beetle)
        if (effectString.includes('keep_this')) {
            console.log(`${defenseCard.name_pl} pozostaje w ręce po obronie.`);
        }

        // Logika dla 'then_draw_X'
        const drawMatch = effectString.match(/then_draw_(\d+)/);
        if (drawMatch) {
            const amountToDraw = parseInt(drawMatch[1], 10);
            console.log(`Obrona: Dobieranie ${amountToDraw} kart(y).`);
            for (let i = 0; i < amountToDraw; i++) {
                game.drawCard(false);
            }
        }
    }
};