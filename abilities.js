import { translations } from './translations.js';

// POPRAWKA: Dodano brakujące słowo 'export'
export function initializeAbilitySystem(game) {
    game.events.subscribe('cardPlayed', (data) => {
        handleOngoingEffects(data.card, game);
    });

    game.events.subscribe('cardGained', (data) => {
        handleOnGainEffects(data.card, data.game);
    });
}

/**
 * Obsługuje logikę dla efektów stałych (Ongoing) z kart Lokacji.
 * @param {object} playedCard - Karta, która właśnie została zagrana.
 * @param {Game} game - Instancja całej gry.
 */
function handleOngoingEffects(playedCard, game) {
    const playedType = playedCard.type.toLowerCase();
    if (game.player.firstPlaysThisTurn.has(playedType)) {
        return;
    }

    game.player.locations.forEach(location => {
        location.effect_tags.forEach(tag => {
            const match = tag.match(/on_play_first_(.*)_per_turn_draw_1/);
            if (match) {
                const triggerType = match[1].toLowerCase();
                if (triggerType === playedType) {
                    const lang = game.currentLanguage;
                    const locationName = location[`name_${lang}`] || location.name_en;
                    const playedCardName = playedCard[`name_${lang}`] || playedCard.name_en;
                    const logMessage = translations[lang].ongoingEffectLog.replace('{0}', locationName).replace('{1}', playedCardName);
                    
                    console.log(logMessage);
                    game.drawCard(false);
                }
            }
        });
    });

    game.player.firstPlaysThisTurn.add(playedType);
}

/**
 * Obsługuje efekty aktywowane w momencie zdobycia karty.
 * @param {object} gainedCard - Karta, która właśnie została zdobyta.
 * @param {Game} game - Instancja całej gry.
 */
async function handleOnGainEffects(gainedCard, game) {
    const onGainTag = gainedCard.effect_tags.find(tag => tag.startsWith('on_gain_or_buy'));
    if (!onGainTag) return;

    if (onGainTag === 'on_gain_or_buy:may_move_to_deck_top') {
        const lang = game.currentLanguage;
        const cardName = gainedCard[`name_${lang}`] || gainedCard.name_en;
        const prompt = `Czy chcesz położyć ${cardName} na wierzchu swojej talii?`;

        const choice = await game.ui.choiceModal.waitForChoice(prompt, gainedCard);

        if (choice === 'yes') {
            const cardIndex = game.player.discard.lastIndexOf(gainedCard);
            if (cardIndex > -1) {
                const [cardToMove] = game.player.discard.splice(cardIndex, 1);
                game.player.deck.push(cardToMove);
                console.log(`${cardName} został(a) położony(a) na wierzchu talii.`);
                game.renderAll();
            }
        }
    }
}