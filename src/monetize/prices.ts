// Every price and reward in one place, so tuning after playtests touches only this file.
// Coin amounts are whole numbers. Display prices for packs stand in until the stores supply
// the real, localized ones at runtime.

/** Coins a new player starts with: the two free hints the game used to give. */
export const STARTING_COINS = 20;
/** Coins for each star a level earns for the first time. */
export const COINS_PER_NEW_STAR = 1;
/** One hint (a free move), bought with coins. */
export const HINT_PRICE = 10;
/** One retry once a level's free ones are spent, bought with coins. */
export const RETRY_PRICE = 5;
/** Retries every level gives after its first Run, refilled when the level is solved. */
export const FREE_RETRIES = 2;
/** Coins for watching a rewarded ad in the shop, and how many such ads count each day. */
export const AD_COINS = 5;
export const AD_COINS_PER_DAY = 5;
/** Coins for solving the daily puzzle, once a day. */
export const DAILY_COINS = 2;
/** Bonus coins each time a daily streak reaches a multiple of this many days. */
export const STREAK_BONUS_DAYS = 7;
export const STREAK_BONUS_COINS = 5;
/** Saves a streak after one missed day, once the week's free freeze is used. */
export const STREAK_REPAIR_PRICE = 30;
/** The tutorial: the first levels give free hints and unlimited retries. */
export const TUTORIAL_LEVELS = 3;

export interface CoinPack {
  /** The product id the stores will know it by. */
  id: string;
  coins: number;
  price: string;
}

export const COIN_PACKS: readonly CoinPack[] = [
  { id: 'coins_100', coins: 100, price: '$0.99' },
  { id: 'coins_600', coins: 600, price: '$3.99' },
];
